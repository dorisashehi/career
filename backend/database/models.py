from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from pgvector.sqlalchemy import Vector
from datetime import datetime

Base = declarative_base()


class Post(Base):
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
    status = Column(String, default="pending")  # "pending", "approved", "rejected"
    flagged_reason = Column(Text)  # Why it was flagged (bad words, negative sentiment, etc.)
    flagged_at = Column(DateTime)
    severity = Column(String)  # "critical", "medium", "low", or None

    # Embedding (same as posts)
    embedding = Column(Vector(384))

    # Timestamps
    submitted_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)