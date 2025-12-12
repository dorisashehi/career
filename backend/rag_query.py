import os
from dotenv import load_dotenv
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_community.vectorstores import FAISS
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_groq import ChatGroq

load_dotenv()

current_dir = os.path.dirname(os.path.abspath(__file__))
persistent_directory = os.path.join(current_dir, "data", "faiss_index")

print("🔧 Loading embedding model...")
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
print("   ✅ Embeddings loaded!")

print("📂 Loading vector store...")
db = FAISS.load_local(folder_path=persistent_directory, embeddings=embeddings)
retriever = db.as_retriever(search_kwargs = {"k": 5}, search_type="similarity")
print("   ✅ Vector store loaded!")

print("🔧 Initializing GROQ LLM...")
llm = ChatGroq(model_name="llama-3.1-8b-instant", groq_api_key=os.getenv("GROQ_API_KEY"))

qa_system_prompt = (
    """You are a helpful career advisor assistant. Use the following Reddit posts and comments to answer the user's career-related question.

    The context contains real experiences and advice from people in various career fields. Provide a thoughtful, practical answer based on this information.

    If the context doesn't contain relevant information, say so honestly and provide general guidance if possible.

    Context from Reddit discussions:
    {context}

    Question: {input}

    Answer (be conversational, practical, and cite specific experiences when relevant):"""
)
qa_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", qa_system_prompt),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}")
    ]
)

question_answer_chain = create_stuff_documents_chain(llm, qa_prompt)
rag_chain = create_retrieval_chain(retriever, question_answer_chain)


def main():
    """Main function to run RAG system."""

    # Example questions
    example_questions = [
        "How do people handle imposter syndrome in tech jobs?",
        "Is it worth doing a coding bootcamp to switch careers?",
        "What's the best way to negotiate a salary increase?",
        "Should I leave my job without having another one lined up?"
    ]

    print("\n💬 Ask a career question (or 'quit' to exit):")
    print("   Example questions:")
    for q in example_questions:
        print(f"   - {q}")

    chat_history = []
    # Interactive mode
    while True:
        print("\n" + "-"*60)
        question = input("\n❓ Your question: ").strip()

        if question.lower() in ['quit', 'exit', 'q']:
            print("\n👋 Goodbye!")
            break

        if not question:
            continue

        try:
            result = rag_chain.invoke({"input": question, "chat_history":chat_history})
            print("\n" + "="*60)
            print("💡 ANSWER:")
            print("="*60)
            print(result['answer'])
            chat_history.append(HumanMessage(content=question))
            chat_history.append(AIMessage(content=result["answer"]))

        except Exception as e:
            print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    main()
