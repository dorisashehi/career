import os
from typing import List
from dotenv import load_dotenv

from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_groq import ChatGroq

# --------------------------------------------------
# ENV
# --------------------------------------------------
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Go up 2 levels from services/ to backend/, then into data/faiss_index
BACKEND_DIR = os.path.dirname(os.path.dirname(BASE_DIR))
FAISS_DIR = os.path.join(BACKEND_DIR, "data", "faiss_index")

# --------------------------------------------------
# INITIALIZATION FUNCTIONS
# --------------------------------------------------
def load_embeddings():
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )


def load_retriever(embeddings, k: int = 5):
    db = FAISS.load_local(
        folder_path=FAISS_DIR,
        embeddings=embeddings,
        allow_dangerous_deserialization=True
    )
    return db.as_retriever(
        search_type="similarity",
        search_kwargs={"k": k}
    )


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

    # Extract source documents from the result
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
