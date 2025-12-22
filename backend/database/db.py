"""
Database configuration and session management.

Provides database engine, session factory, and initialization functions
for the CareerPath application using PostgreSQL with pgvector extension.
"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from database.models import Base

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/career_db"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """
    Initialize database tables and extensions.

    Creates the pgvector extension if not already present, then creates all
    database tables defined in models.py using SQLAlchemy Base metadata.

    Raises:
        Exception: If pgvector extension cannot be installed or tables cannot be created
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
    except Exception as e:
        print("\n" + "=" * 60)
        print("ERROR: pgvector extension is not installed!")
        print("=" * 60)
        print(f"Error: {e}")
        print("\nYou need to install pgvector extension in PostgreSQL.")
        print("Quick fix:")
        print("  sudo apt-get install postgresql-14-pgvector")
        print("  # or for PostgreSQL 15:")
        print("  sudo apt-get install postgresql-15-pgvector")
        print("\nThen create the extension manually:")
        print("  psql -U postgres -d career_db -c 'CREATE EXTENSION vector;'")
        print("\nSee README_DATABASE.md for more installation options.")
        print("=" * 60 + "\n")
        raise

    Base.metadata.create_all(bind=engine)


def get_db():
    """
    Database session dependency for FastAPI.

    Creates a database session, yields it for use in route handlers,
    and ensures it's closed after the request completes.

    Yields:
        Database session (SQLAlchemy Session)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

