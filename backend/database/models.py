from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
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
    created_at = Column(DateTime, default=datetime.utcnow)


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    comment_id = Column(String, unique=True, nullable=False, index=True)
    text = Column(Text, nullable=False)
    date = Column(String)
    comment_link = Column(String)
    post_id = Column(String, ForeignKey("posts.post_id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

