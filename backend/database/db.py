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
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

