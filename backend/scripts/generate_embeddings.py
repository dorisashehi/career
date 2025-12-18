import sys
import os

from sqlalchemy.orm import Session

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.db import SessionLocal
from database.models import Post, Comment, UserExperience
from langchain_huggingface import HuggingFaceEmbeddings


def get_embeddings():
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def combine_post_with_comments(db: Session, post: Post, max_comments: int = 10) -> str:
    content_parts = [
        f"Title: {post.title}",
        f"\nPost: {post.text}",
    ]

    comments = (
        db.query(Comment)
        .filter(Comment.post_id == post.post_id)
        .limit(max_comments)
        .all()
    )

    if comments:
        content_parts.append("\n\nComments and Responses:")
        for comment in comments:
            content_parts.append(f"\n{comment.text}")

    full_content = "".join(content_parts)
    return full_content


def generate_post_and_comment_embeddings():
    embeddings = get_embeddings()
    db = SessionLocal()

    try:
        posts = db.query(Post).all()
        print(f"Processing {len(posts)} posts...")

        updated = 0
        for post in posts:
            if post.embedding is not None:
                continue

            combined_text = combine_post_with_comments(db, post)
            embedding = embeddings.embed_query(combined_text)
            post.embedding = embedding
            updated += 1

            if updated % 10 == 0:
                db.commit()
                print(f"Updated {updated} posts...")

        db.commit()
        print(f"Generated embeddings for {updated} posts")

        comments = db.query(Comment).filter(Comment.embedding.is_(None)).all()
        print(f"Processing {len(comments)} comments...")

        comment_updated = 0
        for comment in comments:
            embedding = embeddings.embed_query(comment.text)
            comment.embedding = embedding
            comment_updated += 1

            if comment_updated % 50 == 0:
                db.commit()
                print(f"Updated {comment_updated} comments...")

        db.commit()
        print(f"Generated embeddings for {comment_updated} comments")

    finally:
        db.close()


def generate_user_experience_embeddings(status_filter: str = "approved"):
    """
    Generate embeddings for user experiences that have passed validation / review.

    By default we only embed rows whose `status` is \"approved\" and whose
    `embedding` column is currently NULL.
    """
    embeddings = get_embeddings()
    db = SessionLocal()

    try:
        query = db.query(UserExperience).filter(UserExperience.embedding.is_(None))

        if status_filter:
            query = query.filter(UserExperience.status == status_filter)

        experiences = query.all()
        print(
            f"Processing {len(experiences)} user experiences "
            f"(status = '{status_filter}' if set)..."
        )

        updated = 0
        for exp in experiences:
            # `text` already contains cleaned / validated content
            if not exp.text:
                continue

            embedding = embeddings.embed_query(exp.text)
            exp.embedding = embedding
            updated += 1

            if updated % 25 == 0:
                db.commit()
                print(f"Updated {updated} user experiences...")

        # If table is empty or nothing matched the filter, this is still safe.
        db.commit()
        if updated == 0:
            print("No user experiences needed embeddings.")
        else:
            print(f"Generated embeddings for {updated} user experiences")

    finally:
        db.close()


def main():
    print("=" * 60)
    print("Generating embeddings for posts, comments, and user experiences")
    print("=" * 60)

    print("\n1. Generating embeddings for posts (with combined comments)...")
    generate_post_and_comment_embeddings()

    print("\n2. Generating embeddings for user experiences (approved only)...")
    generate_user_experience_embeddings(status_filter="approved")

    print("\n" + "=" * 60)
    print("Complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()

