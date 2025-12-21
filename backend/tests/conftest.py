"""
Shared pytest fixtures and configuration for all tests.
"""
import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import app and database components
from app.main import app
from database.db import get_db
from database.models import Base


# Test database URL (in-memory SQLite for fast tests)
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def db_session():
    """
    Create a fresh database session for each test.
    Uses in-memory SQLite for fast, isolated tests.
    """
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_client(db_session):
    """
    Create a test client for FastAPI endpoints.
    Overrides the database dependency with test database session.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    # Override the database dependency
    app.dependency_overrides[get_db] = override_get_db

    # Create test client
    client = TestClient(app)

    yield client

    # Clean up overrides after test
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def sample_post_data():
    """Sample post data for testing."""
    return {
        "post_id": "test_post_123",
        "title": "Test Post Title",
        "text": "This is a test post about software engineering careers.",
        "full_text": "Test Post Title\n\nThis is a test post about software engineering careers.",
        "source": "cscareerquestions",
        "date": "2024-01-15",
        "post_link": "https://reddit.com/r/test/post/123",
        "score": 100,
        "num_comments": 25,
        "upvote_ratio": 0.95
    }


@pytest.fixture(scope="function")
def sample_comment_data():
    """Sample comment data for testing."""
    return {
        "comment_id": "test_comment_456",
        "text": "This is a helpful comment about career advice.",
        "date": "2024-01-15",
        "comment_link": "https://reddit.com/r/test/comments/123/_/456",
        "post_id": "test_post_123"
    }


@pytest.fixture(scope="function")
def sample_experience_text():
    """Sample user experience text for validation testing."""
    return {
        "valid": "I had a great interview experience at a tech company. The process was smooth and the team was very welcoming.",
        "with_pii": "Contact me at john.doe@email.com or call 555-1234 for more details about my interview experience.",
        "toxic": "This company is terrible and the interviewer was an idiot who didn't know anything.",
        "spam": "Check out this amazing course! Sign up here: https://example.com/course. Use promo code SAVE20!",
        "off_topic": "I love cooking pasta recipes. Here's my favorite recipe for spaghetti carbonara.",
        "short": "Good interview"
    }


@pytest.fixture(autouse=True)
def reset_environment(monkeypatch):
    """
    Reset environment variables for each test.
    Prevents tests from affecting each other.
    """
    # Set test environment variables
    monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
    monkeypatch.setenv("GROQ_API_KEY", "test_api_key")
    monkeypatch.setenv("ADMIN_JWT_SECRET_KEY", "test_secret_key")
    monkeypatch.setenv("ADMIN_REGISTRATION_SECRET", "test_registration_secret")
