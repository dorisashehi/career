"""
Unit tests for rag_service.py

Tests RAG service functions with mocking for external dependencies (database, embeddings, LLM).
"""
import pytest
from unittest.mock import patch, MagicMock, Mock
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, AIMessage

from app.services.rag_service import (
    load_embeddings,
    load_retriever,
    load_llm,
    build_rag_chain,
    ask_question,
    PgVectorRetriever
)


@pytest.mark.unit
class TestLoadEmbeddings:
    """Tests for load_embeddings function."""

    @patch('app.services.rag_service.HuggingFaceEmbeddings')
    def test_load_embeddings(self, mock_embeddings_class):
        """Test that embeddings are loaded with correct configuration."""
        mock_embeddings = MagicMock()
        mock_embeddings_class.return_value = mock_embeddings

        result = load_embeddings()

        mock_embeddings_class.assert_called_once()
        call_kwargs = mock_embeddings_class.call_args[1]
        assert call_kwargs['model_name'] == "sentence-transformers/all-MiniLM-L6-v2"
        assert call_kwargs['model_kwargs']['device'] == 'cpu'
        assert call_kwargs['encode_kwargs']['normalize_embeddings'] is True
        assert result == mock_embeddings


@pytest.mark.unit
class TestLoadLLM:
    """Tests for load_llm function."""

    @patch('app.services.rag_service.ChatGroq')
    @patch('app.services.rag_service.os.getenv')
    def test_load_llm(self, mock_getenv, mock_chat_groq):
        """Test that LLM is loaded with correct configuration."""
        mock_getenv.return_value = "test_api_key"
        mock_llm = MagicMock()
        mock_chat_groq.return_value = mock_llm

        result = load_llm()

        mock_chat_groq.assert_called_once_with(
            model_name="llama-3.1-8b-instant",
            groq_api_key="test_api_key"
        )
        assert result == mock_llm


@pytest.mark.unit
class TestPgVectorRetriever:
    """Tests for PgVectorRetriever class."""

    @patch('app.services.rag_service.SessionLocal')
    @patch('app.services.rag_service.engine')
    def test_retriever_initialization(self, mock_engine, mock_session_local):
        """Test retriever initialization."""
        mock_embeddings = MagicMock()
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db

        retriever = PgVectorRetriever(mock_embeddings, k=3)

        assert retriever.embeddings == mock_embeddings
        assert retriever.k == 3
        assert retriever.max_content_length == 1500
        assert retriever.max_comments == 3

    def test_truncate_text(self):
        """Test text truncation function."""
        mock_embeddings = MagicMock()
        retriever = PgVectorRetriever(mock_embeddings, k=2)

        # Test text shorter than max_length
        short_text = "Short text"
        result = retriever._truncate_text(short_text, 100)
        assert result == short_text

        # Test text longer than max_length
        long_text = "This is a very long text that needs to be truncated because it exceeds the maximum length limit"
        result = retriever._truncate_text(long_text, 20)
        assert len(result) <= 20 + len("... [truncated]")
        assert "... [truncated]" in result
        # Should preserve word boundaries
        assert result.endswith("... [truncated]")

    @patch('app.services.rag_service.SessionLocal')
    @patch('app.services.rag_service.engine')
    def test_get_relevant_documents(self, mock_engine, mock_session_local):
        """Test document retrieval with mocked database."""
        mock_embeddings = MagicMock()
        mock_embeddings.embed_query.return_value = [0.1] * 384  # Mock embedding vector

        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn

        # Mock database results
        mock_row = MagicMock()
        mock_row.source_type = 'post'
        mock_row.title = 'Test Post'
        mock_row.text = 'Test post content'
        mock_row.item_id = 'post123'
        mock_row.source = 'reddit'
        mock_row.date = '2024-01-15'
        mock_row.score = 100
        mock_row.num_comments = 25
        mock_row.url = 'https://reddit.com/test'

        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_row]
        mock_conn.execute.return_value = mock_result

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.limit.return_value.all.return_value = []
        mock_session_local.return_value = mock_db

        retriever = PgVectorRetriever(mock_embeddings, k=2)
        documents = retriever._get_relevant_documents("test query")

        assert len(documents) == 1
        assert isinstance(documents[0], Document)
        assert "Test Post" in documents[0].page_content
        assert documents[0].metadata['source_type'] == 'post'


@pytest.mark.unit
class TestBuildRagChain:
    """Tests for build_rag_chain function."""

    @patch('app.services.rag_service.load_llm')
    @patch('app.services.rag_service.load_retriever')
    @patch('app.services.rag_service.load_embeddings')
    @patch('app.services.rag_service.create_retrieval_chain')
    @patch('app.services.rag_service.create_stuff_documents_chain')
    def test_build_rag_chain(self, mock_create_doc_chain, mock_create_retrieval_chain,
                             mock_load_embeddings, mock_load_retriever, mock_load_llm):
        """Test RAG chain construction."""
        # Setup mocks
        mock_embeddings = MagicMock()
        mock_retriever = MagicMock()
        mock_llm = MagicMock()
        mock_doc_chain = MagicMock()
        mock_rag_chain = MagicMock()

        mock_load_embeddings.return_value = mock_embeddings
        mock_load_retriever.return_value = mock_retriever
        mock_load_llm.return_value = mock_llm
        mock_create_doc_chain.return_value = mock_doc_chain
        mock_create_retrieval_chain.return_value = mock_rag_chain

        result = build_rag_chain()

        # Verify all components were loaded
        mock_load_embeddings.assert_called_once()
        mock_load_retriever.assert_called_once_with(mock_embeddings, k=2)
        mock_load_llm.assert_called_once()

        # Verify chains were created
        mock_create_doc_chain.assert_called_once()
        mock_create_retrieval_chain.assert_called_once_with(mock_retriever, mock_doc_chain)

        assert result == mock_rag_chain


@pytest.mark.unit
class TestAskQuestion:
    """Tests for ask_question function."""

    def test_ask_question_with_empty_history(self):
        """Test asking question with empty chat history."""
        mock_rag_chain = MagicMock()
        mock_doc = Document(
            page_content="Test content",
            metadata={"source": "reddit", "url": "https://example.com"}
        )
        mock_rag_chain.invoke.return_value = {
            "answer": "This is a test answer",
            "context": [mock_doc]
        }

        answer, chat_history, sources = ask_question(
            rag_chain=mock_rag_chain,
            question="What is a good career path?",
            chat_history=None
        )

        assert answer == "This is a test answer"
        assert len(chat_history) == 2  # HumanMessage + AIMessage
        assert isinstance(chat_history[0], HumanMessage)
        assert isinstance(chat_history[1], AIMessage)
        assert len(sources) == 1
        assert sources[0]["source"] == "reddit"

    def test_ask_question_with_history(self):
        """Test asking question with existing chat history."""
        mock_rag_chain = MagicMock()
        mock_rag_chain.invoke.return_value = {
            "answer": "Follow-up answer",
            "context": []
        }

        existing_history = [
            HumanMessage(content="First question"),
            AIMessage(content="First answer")
        ]

        answer, chat_history, sources = ask_question(
            rag_chain=mock_rag_chain,
            question="Follow-up question",
            chat_history=existing_history
        )

        assert answer == "Follow-up answer"
        assert len(chat_history) == 4  # 2 existing + 2 new
        assert chat_history[-2].content == "Follow-up question"
        assert chat_history[-1].content == "Follow-up answer"

    def test_ask_question_history_limit(self):
        """Test that chat history is limited to prevent token overflow."""
        mock_rag_chain = MagicMock()
        mock_rag_chain.invoke.return_value = {
            "answer": "Answer",
            "context": []
        }

        # Create history with more than max_history_messages (3)
        long_history = [
            msg
            for i in range(5)  # 10 messages total
            for msg in [
                HumanMessage(content=f"Question {i}"),
                AIMessage(content=f"Answer {i}")
            ]
        ]

        answer, chat_history, sources = ask_question(
            rag_chain=mock_rag_chain,
            question="New question",
            chat_history=long_history
        )

        # Should only keep last 3 messages + new question/answer = 5 total
        # Actually, it keeps last 3, then adds 2 more = 5 total
        assert len(chat_history) <= 5

    def test_ask_question_with_sources(self):
        """Test that sources are properly extracted from context."""
        mock_rag_chain = MagicMock()
        mock_doc1 = Document(
            page_content="Content 1",
            metadata={
                "source_type": "post",
                "url": "https://reddit.com/post1",
                "post_id": "123",
                "source": "reddit",
                "date": "2024-01-15",
                "score": 100,
                "num_comments": 25
            }
        )
        mock_doc2 = Document(
            page_content="Content 2",
            metadata={
                "source_type": "user_experience",
                "post_id": "456",
                "source": "user_experience",
                "date": "2024-01-16",
                "experience_type": "interview"
            }
        )

        mock_rag_chain.invoke.return_value = {
            "answer": "Answer with sources",
            "context": [mock_doc1, mock_doc2]
        }

        answer, chat_history, sources = ask_question(
            rag_chain=mock_rag_chain,
            question="Test question",
            chat_history=None
        )

        assert len(sources) == 2
        assert sources[0]["url"] == "https://reddit.com/post1"
        assert sources[1]["source"] == "user_experience"
        assert sources[1]["experience_type"] == "interview"

    def test_ask_question_deduplicates_sources(self):
        """Test that duplicate sources are not included multiple times."""
        mock_rag_chain = MagicMock()
        # Create multiple documents with same URL
        mock_doc = Document(
            page_content="Content",
            metadata={
                "source_type": "post",
                "url": "https://reddit.com/same",
                "post_id": "123"
            }
        )

        mock_rag_chain.invoke.return_value = {
            "answer": "Answer",
            "context": [mock_doc, mock_doc, mock_doc]  # Same source 3 times
        }

        answer, chat_history, sources = ask_question(
            rag_chain=mock_rag_chain,
            question="Test",
            chat_history=None
        )

        # Should only have one source despite multiple documents
        assert len(sources) == 1
