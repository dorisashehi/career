import os
from typing import List
from dotenv import load_dotenv

from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from sqlalchemy.orm import Session
from sqlalchemy import text
from database.db import SessionLocal, engine
from database.models import Post, Comment

load_dotenv()


def load_embeddings():
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )


class PgVectorRetriever:
    def __init__(self, embeddings, k=5):
        self.embeddings = embeddings
        self.k = k
        self.db = SessionLocal()

    def get_relevant_documents(self, query: str):
        query_embedding = self.embeddings.embed_query(query)
        query_embedding_str = '[' + ','.join(map(str, query_embedding)) + ']'

        sql = text("""
            SELECT
                id, post_id, title, text, full_text, source, date,
                post_link, score, num_comments, upvote_ratio,
                1 - (embedding <=> CAST(:query_embedding AS vector)) as similarity
            FROM posts
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:query_embedding AS vector)
            LIMIT :k
        """)

        with engine.connect() as conn:
            results = conn.execute(
                sql,
                {
                    "query_embedding": query_embedding_str,
                    "k": self.k
                }
            ).fetchall()

        documents = []
        for row in results:
            content = f"Title: {row.title}\n\nPost: {row.text}"

            comments = self.db.query(Comment).filter(Comment.post_id == row.post_id).limit(10).all()
            if comments:
                content += "\n\nComments and Responses:"
                for comment in comments:
                    content += f"\n{comment.text}"

            metadata = {
                'post_id': row.post_id,
                'source': row.source,
                'date': row.date,
                'score': row.score,
                'num_comments': row.num_comments,
                'url': row.post_link
            }

            documents.append(Document(page_content=content, metadata=metadata))

        return documents

    def __call__(self, query: str):
        return self.get_relevant_documents(query)


def load_retriever(embeddings, k: int = 5):
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
    You are a helpful career advisor assistant. Use the following Reddit posts and comments
    to answer the user's career-related question.

    The context contains real experiences and advice from people in various career fields.
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
        for doc in result["context"]:
            metadata = doc.metadata if hasattr(doc, 'metadata') else {}
            url = metadata.get('url', '')

            if url and url not in seen_urls:
                seen_urls.add(url)
                source_info = {
                    "url": url,
                    "post_id": metadata.get('post_id', ''),
                    "source": metadata.get('source', ''),
                    "date": metadata.get('date', ''),
                    "score": metadata.get('score', 0),
                    "num_comments": metadata.get('num_comments', 0),
                }
                sources.append(source_info)

    chat_history.append(HumanMessage(content=question))
    chat_history.append(AIMessage(content=answer))

    return answer, chat_history, sources
