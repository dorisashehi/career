"""
Database models for 404ella application.

Defines SQLAlchemy models for:
- Post: Reddit posts with embeddings
- Comment: Reddit comments linked to posts
- UserExperience: User-submitted career experiences
- AdminUser: Admin account information

All models use pgvector for semantic search capabilities.
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base
from pgvector.sqlalchemy import Vector
from datetime import datetime

Base = declarative_base()


class Post(Base):
    """
    Database model for Reddit posts.

    Stores Reddit post data including title, text, metadata, and vector embeddings
    for semantic search using pgvector.
    """
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    text = Column(Text)
    full_text = Column(Text)
    source = Column(String)
    date = Column(String)
    post_link = Column(String)
    score = Column(Integer, default=0)
    num_comments = Column(Integer, default=0)
    upvote_ratio = Column(Float, default=0.0)
    embedding = Column(Vector(384))
    created_at = Column(DateTime, default=datetime.utcnow)


class Comment(Base):
    """
    Database model for Reddit comments.

    Stores comment data linked to posts via foreign key, including text and
    vector embeddings for semantic search.
    """
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    comment_id = Column(String, unique=True, nullable=False, index=True)
    text = Column(Text, nullable=False)
    date = Column(String)
    comment_link = Column(String)
    post_id = Column(String, ForeignKey("posts.post_id"), nullable=False, index=True)
    embedding = Column(Vector(384))
    created_at = Column(DateTime, default=datetime.utcnow)


class UserExperience(Base):
    __tablename__ = "user_experiences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String)  # Short title/summary of the experience
    text = Column(Text, nullable=False)
    experience_type = Column(String)  # "interview", "job_search", "career_advice", etc.

    # Status workflow
    status = Column(String, default="approved")  # "pending", "approved", "rejected"
    flagged_reason = Column(Text)  # Why it was flagged (bad words, negative sentiment, etc.)
    flagged_at = Column(DateTime)
    severity = Column(String)  # "critical", "medium", "low", or None

    # Embedding (same as posts)
    embedding = Column(Vector(384))

    # Timestamps
    submitted_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdminUser(Base):
    """
    Database model for admin users.

    Stores admin account information including username, email, and hashed password.
    Used for authentication and authorization of admin endpoints.
    """
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)
    email = Column(String, unique=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)