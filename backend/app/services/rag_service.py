import os
from typing import List
from dotenv import load_dotenv

from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_groq import ChatGroq
from sqlalchemy import text
from database.db import SessionLocal, engine
from database.models import Comment

load_dotenv()


def load_embeddings():
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )


class PgVectorRetriever(BaseRetriever):
    embeddings: object = None
    k: int = 2  # Reduced to 2 to further lower token count
    max_content_length: int = 1500  # Reduced max characters per document
    max_comments: int = 3  # Reduced to 3 comments per post
    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, embeddings, k=3):
        super().__init__(embeddings=embeddings, k=k)
        object.__setattr__(self, 'db', SessionLocal())

    def _truncate_text(self, text: str, max_length: int) -> str:
        """Truncate text to max_length, preserving word boundaries."""
        if len(text) <= max_length:
            return text
        # Truncate and add ellipsis
        truncated = text[:max_length].rsplit(' ', 1)[0]
        return truncated + "... [truncated]"

    def _get_relevant_documents(self, query: str):
        query_embedding = self.embeddings.embed_query(query)

        embedding_list = []
        for num in query_embedding:
            embedding_list.append(str(num))
        query_embedding_str = '[' + ','.join(embedding_list) + ']'

        # UNION query to search both posts and approved user experiences
        # Wrapped in subquery to allow ORDER BY on embedding
        sql_query = """
            SELECT * FROM (
                (
                    SELECT
                        id,
                        post_id as item_id,
                        title,
                        text,
                        full_text,
                        source,
                        date,
                        post_link as url,
                        score,
                        num_comments,
                        upvote_ratio,
                        NULL::text as experience_type,
                        'post' as source_type,
                        embedding
                    FROM posts
                    WHERE embedding IS NOT NULL
                )
                UNION ALL
                (
                    SELECT
                        id,
                        id::text as item_id,
                        title,
                        text,
                        NULL::text as full_text,
                        'user_experience' as source,
                        submitted_at::text as date,
                        NULL::text as url,
                        NULL::integer as score,
                        NULL::integer as num_comments,
                        NULL::real as upvote_ratio,
                        experience_type,
                        'user_experience' as source_type,
                        embedding
                    FROM user_experiences
                    WHERE embedding IS NOT NULL AND status = 'approved'
                )
            ) combined_results
            ORDER BY embedding <=> CAST(:query_embedding AS vector)
            LIMIT :k
        """

        with engine.connect() as conn:
            results = conn.execute(
                text(sql_query),
                {
                    "query_embedding": query_embedding_str,
                    "k": self.k
                }
            ).fetchall()

        documents = []

        for row in results:
            # Access row columns by name (SQLAlchemy Row objects support this)
            # Use getattr with defaults for safety
            source_type = getattr(row, 'source_type', 'post')
            row_title = getattr(row, 'title', '')
            row_text = getattr(row, 'text', '')
            item_id = getattr(row, 'item_id', None)

            # Truncate text to prevent token overflow
            content_text = self._truncate_text(row_text or "", self.max_content_length // 2)

            if source_type == 'post':
                # Handle Reddit posts (with comments)
                content = f"Title: {row_title}\n\nPost: {content_text}"

                # Get comments for Reddit posts (only if post_id exists)
                if item_id:
                    comments = self.db.query(Comment).filter(
                        Comment.post_id == item_id
                    ).limit(self.max_comments).all()

                    if comments:
                        content += "\n\nComments and Responses:"
                        comment_text = ""
                        for comment in comments:
                            comment_text += f"\n{comment.text}"

                        # Truncate comments section if too long
                        max_comment_length = self.max_content_length // 2
                        if len(comment_text) > max_comment_length:
                            comment_text = self._truncate_text(
                                comment_text, max_comment_length
                            )
                        content += comment_text

                metadata = {
                    'post_id': item_id,
                    'source': getattr(row, 'source', 'reddit'),
                    'date': getattr(row, 'date', None),
                    'score': getattr(row, 'score', 0) or 0,
                    'num_comments': getattr(row, 'num_comments', 0) or 0,
                    'url': getattr(row, 'url', None),
                    'source_type': 'post'
                }
            else:
                # Handle user experiences (no comments)
                experience_type = getattr(row, 'experience_type', None)
                type_label = f" ({experience_type.replace('_', ' ')})" if experience_type else ""
                content = f"User Experience{type_label}: {content_text}"

                metadata = {
                    'post_id': item_id,  # Using item_id for experience ID
                    'source': 'user_experience',
                    'date': getattr(row, 'date', None),
                    'score': None,
                    'num_comments': None,
                    'url': None,
                    'source_type': 'user_experience',
                    'experience_type': experience_type
                }

            # Final truncation of entire content
            content = self._truncate_text(content, self.max_content_length)

            doc = Document(page_content=content, metadata=metadata)
            documents.append(doc)

        return documents


def load_retriever(embeddings, k: int = 2):
    return PgVectorRetriever(embeddings, k)


def load_llm():
    return ChatGroq(
        model_name="llama-3.1-8b-instant",
        groq_api_key=os.getenv("GROQ_API_KEY"),
    )


def build_rag_chain():
    embeddings = load_embeddings()
    retriever = load_retriever(embeddings)
    llm = load_llm()

    system_prompt = """
    You are a helpful career advisor assistant. Use the following Reddit posts, comments, and user-submitted experiences
    to answer the user's career-related question.

    The context contains real experiences and advice from people in various career fields, including:
    - Reddit posts and comments from career-related subreddits
    - User-submitted career experiences that have been approved by moderators

    Provide a thoughtful, practical answer based on this information.

    If the context doesn't contain relevant information, say so honestly and provide general guidance.

    IMPORTANT: Do NOT reference comment numbers or IDs.

    Context:
    {context}

    Question: {input}
    """

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ]
    )

    doc_chain = create_stuff_documents_chain(llm, prompt)
    rag_chain = create_retrieval_chain(retriever, doc_chain)

    return rag_chain


def ask_question(
    rag_chain,
    question: str,
    chat_history: List = None,
):
    if chat_history is None:
        chat_history = []

    # Limit chat history to last 3 messages to prevent token overflow
    # Each message can be large, so we keep only recent context
    max_history_messages = 3
    if len(chat_history) > max_history_messages:
        chat_history = chat_history[-max_history_messages:]

    result = rag_chain.invoke(
        {
            "input": question,
            "chat_history": chat_history,
        }
    )

    answer = result["answer"]

    sources = []
    if "context" in result:
        seen_urls = set()
        seen_experiences = set()
        for doc in result["context"]:
            metadata = doc.metadata if hasattr(doc, 'metadata') else {}
            source_type = metadata.get('source_type', 'post')

            if source_type == 'user_experience':
                # Handle user experience sources
                exp_id = metadata.get('post_id')  # Using post_id field for experience ID
                if exp_id and exp_id not in seen_experiences:
                    seen_experiences.add(exp_id)
                    source_info = {
                        "url": None,  # User experiences don't have URLs
                        "post_id": str(exp_id),
                        "source": "user_experience",
                        "date": metadata.get('date', ''),
                        "score": None,
                        "num_comments": None,
                        "experience_type": metadata.get('experience_type', ''),
                    }
                    sources.append(source_info)
            else:
                # Handle Reddit post sources
                url = metadata.get('url', '')
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    source_info = {
                        "url": url,
                        "post_id": metadata.get('post_id', ''),
                        "source": metadata.get('source', 'reddit'),
                        "date": metadata.get('date', ''),
                        "score": metadata.get('score', 0),
                        "num_comments": metadata.get('num_comments', 0),
                    }
                    sources.append(source_info)

    chat_history.append(HumanMessage(content=question))
    chat_history.append(AIMessage(content=answer))

    return answer, chat_history, sources
