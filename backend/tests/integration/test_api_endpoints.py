"""
Integration tests for FastAPI endpoints in main.py

Tests API endpoints with test database and mocked external services.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import status

from database.models import UserExperience, AdminUser, Post, Comment


@pytest.mark.integration
class TestAskEndpoint:
    """Tests for /ask endpoint."""

    @patch('app.main.ask_question')
    @patch('app.main.rag_chain')
    def test_ask_endpoint_success(self, mock_rag_chain, mock_ask_question, test_client):
        """Test successful question asking."""
        mock_ask_question.return_value = (
            "This is a test answer about career advice.",
            [],
            [{"url": "https://reddit.com/test", "post_id": "123", "source": "reddit"}]
        )

        response = test_client.post(
            "/ask",
            json={
                "question": "What is a good career path?",
                "chat_history": []
            }
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "answer" in data
        assert "sources" in data
        assert data["answer"] == "This is a test answer about career advice."
        assert len(data["sources"]) == 1

    @patch('app.main.ask_question')
    def test_ask_endpoint_with_chat_history(self, mock_ask_question, test_client):
        """Test asking question with chat history."""
        mock_ask_question.return_value = (
            "Follow-up answer",
            [],
            []
        )

        response = test_client.post(
            "/ask",
            json={
                "question": "Tell me more",
                "chat_history": [
                    {"role": "user", "content": "What is software engineering?"},
                    {"role": "assistant", "content": "Software engineering is..."}
                ]
            }
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["answer"] == "Follow-up answer"

    @patch('app.main.ask_question')
    def test_ask_endpoint_rate_limit_error(self, mock_ask_question, test_client):
        """Test handling of rate limit errors."""
        mock_ask_question.side_effect = Exception("413 tokens per minute rate_limit exceeded")

        response = test_client.post(
            "/ask",
            json={
                "question": "Test question",
                "chat_history": []
            }
        )

        assert response.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        assert "too large" in response.json()["detail"].lower()


@pytest.mark.integration
class TestExperienceSubmission:
    """Tests for /api/experiences endpoint."""

    def test_submit_experience_success(self, test_client, db_session):
        """Test successful experience submission."""
        response = test_client.post(
            "/api/experiences",
            json={
                "category": "interview",
                "description": "I had a great interview experience at a tech company. The process was smooth and the team was very welcoming. The questions were relevant and the interviewers were professional."
            }
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "id" in data
        assert data["status"] in ["pending", "approved"]
        assert "message" in data

        # Verify it was saved to database
        experience = db_session.query(UserExperience).filter(
            UserExperience.id == data["id"]
        ).first()
        assert experience is not None
        assert experience.experience_type == "interview"

    def test_submit_experience_missing_fields(self, test_client):
        """Test submission with missing required fields."""
        response = test_client.post(
            "/api/experiences",
            json={
                "category": "interview"
                # Missing description
            }
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_submit_experience_too_short(self, test_client):
        """Test submission with description that's too short."""
        response = test_client.post(
            "/api/experiences",
            json={
                "category": "interview",
                "description": "Short text"  # Less than 50 characters
            }
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "50 characters" in response.json()["detail"]

    def test_submit_experience_invalid_category(self, test_client):
        """Test submission with invalid category."""
        response = test_client.post(
            "/api/experiences",
            json={
                "category": "invalid_category",
                "description": "This is a valid description that is long enough to pass the minimum length requirement of 50 characters."
            }
        )

        # Should still work, but category maps to "other"
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] is not None


@pytest.mark.integration
class TestAdminAuth:
    """Tests for admin authentication endpoints."""

    def test_admin_register_success(self, test_client, db_session):
        """Test successful admin registration."""
        response = test_client.post(
            "/api/admin/register",
            json={
                "username": "testadmin",
                "email": "test@example.com",
                "password": "securepassword123",
                "registration_secret": "test_registration_secret"
            }
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

        # Verify admin was created
        admin = db_session.query(AdminUser).filter(
            AdminUser.username == "testadmin"
        ).first()
        assert admin is not None
        assert admin.email == "test@example.com"

    def test_admin_register_duplicate_username(self, test_client, db_session):
        """Test registration with duplicate username."""
        # Create existing admin
        existing_admin = AdminUser(
            username="existing",
            email="existing@example.com",
            hashed_password="hashed"
        )
        db_session.add(existing_admin)
        db_session.commit()

        response = test_client.post(
            "/api/admin/register",
            json={
                "username": "existing",
                "email": "new@example.com",
                "password": "password123",
                "registration_secret": "test_registration_secret"
            }
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already registered" in response.json()["detail"].lower()

    def test_admin_login_success(self, test_client, db_session):
        """Test successful admin login."""
        from app.main import get_password_hash

        # Create admin user
        admin = AdminUser(
            username="loginuser",
            email="login@example.com",
            hashed_password=get_password_hash("password123")
        )
        db_session.add(admin)
        db_session.commit()

        response = test_client.post(
            "/api/admin/login",
            json={
                "username": "loginuser",
                "password": "password123"
            }
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_admin_login_invalid_credentials(self, test_client, db_session):
        """Test login with invalid credentials."""
        from app.main import get_password_hash

        # Create admin user
        admin = AdminUser(
            username="testuser",
            email="test@example.com",
            hashed_password=get_password_hash("correctpassword")
        )
        db_session.add(admin)
        db_session.commit()

        response = test_client.post(
            "/api/admin/login",
            json={
                "username": "testuser",
                "password": "wrongpassword"
            }
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "incorrect" in response.json()["detail"].lower()

    def test_get_current_admin(self, test_client, db_session):
        """Test getting current admin info with valid token."""
        from app.main import create_access_token, get_password_hash

        # Create admin and get token
        admin = AdminUser(
            username="currentuser",
            email="current@example.com",
            hashed_password=get_password_hash("password123")
        )
        db_session.add(admin)
        db_session.commit()

        token = create_access_token(data={"sub": str(admin.id)})

        response = test_client.get(
            "/api/admin/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "currentuser"
        assert data["email"] == "current@example.com"

    def test_get_current_admin_invalid_token(self, test_client):
        """Test getting admin info with invalid token."""
        response = test_client.get(
            "/api/admin/me",
            headers={"Authorization": "Bearer invalid_token"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.integration
class TestAdminExperienceManagement:
    """Tests for admin experience management endpoints."""

    def test_get_pending_experiences(self, test_client, db_session):
        """Test getting pending experiences."""
        from app.main import create_access_token, get_password_hash
        from datetime import datetime

        # Create admin
        admin = AdminUser(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("password123")
        )
        db_session.add(admin)
        db_session.commit()

        # Create pending experience
        experience = UserExperience(
            title="Test Experience",
            text="This is a test experience that needs review.",
            experience_type="interview",
            status="pending",
            submitted_at=datetime.utcnow()
        )
        db_session.add(experience)
        db_session.commit()

        token = create_access_token(data={"sub": str(admin.id)})

        response = test_client.get(
            "/api/admin/experiences?status=pending",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["status"] == "pending"

    def test_approve_experience(self, test_client, db_session):
        """Test approving an experience."""
        from app.main import create_access_token, get_password_hash
        from datetime import datetime

        # Create admin
        admin = AdminUser(
            username="approver",
            email="approver@example.com",
            hashed_password=get_password_hash("password123")
        )
        db_session.add(admin)
        db_session.commit()

        # Create pending experience
        experience = UserExperience(
            title="To Approve",
            text="This experience should be approved.",
            experience_type="interview",
            status="pending",
            submitted_at=datetime.utcnow()
        )
        db_session.add(experience)
        db_session.commit()
        experience_id = experience.id

        token = create_access_token(data={"sub": str(admin.id)})

        response = test_client.put(
            f"/api/admin/experiences/{experience_id}/approve",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "approved"

        # Verify in database
        updated = db_session.query(UserExperience).filter(
            UserExperience.id == experience_id
        ).first()
        assert updated.status == "approved"
        assert updated.approved_at is not None

    def test_reject_experience(self, test_client, db_session):
        """Test rejecting an experience."""
        from app.main import create_access_token, get_password_hash
        from datetime import datetime

        # Create admin
        admin = AdminUser(
            username="rejector",
            email="rejector@example.com",
            hashed_password=get_password_hash("password123")
        )
        db_session.add(admin)
        db_session.commit()

        # Create pending experience
        experience = UserExperience(
            title="To Reject",
            text="This experience should be rejected.",
            experience_type="interview",
            status="pending",
            submitted_at=datetime.utcnow()
        )
        db_session.add(experience)
        db_session.commit()
        experience_id = experience.id

        token = create_access_token(data={"sub": str(admin.id)})

        response = test_client.put(
            f"/api/admin/experiences/{experience_id}/reject",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "rejected"

        # Verify in database
        updated = db_session.query(UserExperience).filter(
            UserExperience.id == experience_id
        ).first()
        assert updated.status == "rejected"

    def test_approve_nonexistent_experience(self, test_client, db_session):
        """Test approving an experience that doesn't exist."""
        from app.main import create_access_token, get_password_hash

        admin = AdminUser(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("password123")
        )
        db_session.add(admin)
        db_session.commit()

        token = create_access_token(data={"sub": str(admin.id)})

        response = test_client.put(
            "/api/admin/experiences/99999/approve",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
