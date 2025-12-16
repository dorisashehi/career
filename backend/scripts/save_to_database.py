import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sqlalchemy.orm import Session
from database.db import SessionLocal, init_db
from database.models import Post, Comment
from scripts.collect_reddit_public import collect_reddit_data
from scripts.clean_data import clean_reddit_data
import tempfile


def df_to_dict_list(df):
    return df.to_dict('records')


def save_posts_to_db(db: Session, posts_data: list):
    posts_to_insert = []

    for post_dict in posts_data:
        existing = db.query(Post).filter(Post.post_id == post_dict['post_id']).first()
        if existing:
            continue

        post = Post(
            post_id=post_dict.get('post_id'),
            title=post_dict.get('title', ''),
            text=post_dict.get('text', ''),
            full_text=post_dict.get('full_text', ''),
            source=post_dict.get('source', ''),
            date=post_dict.get('date', ''),
            post_link=post_dict.get('post_link', ''),
            score=post_dict.get('score', 0),
            num_comments=post_dict.get('num_comments', 0),
            upvote_ratio=post_dict.get('upvote_ratio', 0.0)
        )
        posts_to_insert.append(post)

    if posts_to_insert:
        db.bulk_save_objects(posts_to_insert)
        db.commit()
        print(f"Saved {len(posts_to_insert)} posts to database")
    else:
        print("No new posts to save")


def save_comments_to_db(db: Session, comments_data: list):
    comments_to_insert = []

    for comment_dict in comments_data:
        existing = db.query(Comment).filter(Comment.comment_id == comment_dict['comment_id']).first()
        if existing:
            continue

        comment = Comment(
            comment_id=comment_dict.get('comment_id'),
            text=comment_dict.get('text', ''),
            date=comment_dict.get('date', ''),
            comment_link=comment_dict.get('comment_link', ''),
            post_id=comment_dict.get('post_id')
        )
        comments_to_insert.append(comment)

    if comments_to_insert:
        db.bulk_save_objects(comments_to_insert)
        db.commit()
        print(f"Saved {len(comments_to_insert)} comments to database")
    else:
        print("No new comments to save")


def main():
    print("=" * 60)
    print("Starting Reddit data collection and database save")
    print("=" * 60)

    init_db()

    with tempfile.TemporaryDirectory() as tmpdir:
        posts_raw = os.path.join(tmpdir, "posts.csv")
        comments_raw = os.path.join(tmpdir, "comments.csv")
        posts_cleaned = os.path.join(tmpdir, "posts_cleaned.csv")
        comments_cleaned = os.path.join(tmpdir, "comments_cleaned.csv")

        print("\n1. Collecting data from Reddit...")
        subreddits = [
            "cscareerquestions",
            "jobs",
            "ExperiencedDevs",
            "ITCareerQuestions",
        ]

        collect_reddit_data(
            subreddits=subreddits,
            posts_per_sub=20,
            posts_csv=posts_raw,
            comments_csv=comments_raw,
            min_score=5,
            min_comments=3,
            min_text_length=100,
            sort="top",
            time_filter="year",
            max_workers=10,
            max_comments=50
        )

        print("\n2. Cleaning data...")
        clean_reddit_data(
            posts_input=posts_raw,
            comments_input=comments_raw,
            posts_output=posts_cleaned,
            comments_output=comments_cleaned,
            min_post_length=10,
            min_comment_length=20
        )

        print("\n3. Loading cleaned data into DataFrames...")
        posts_df = pd.read_csv(posts_cleaned)
        comments_df = pd.read_csv(comments_cleaned)

        print(f"   Loaded {len(posts_df)} posts")
        print(f"   Loaded {len(comments_df)} comments")

        print("\n4. Converting to list of dictionaries...")
        posts_list = df_to_dict_list(posts_df)
        comments_list = df_to_dict_list(comments_df)

        print("\n5. Saving to PostgreSQL database...")
        db = SessionLocal()
        try:
            save_posts_to_db(db, posts_list)
            save_comments_to_db(db, comments_list)
        finally:
            db.close()

        print("\n" + "=" * 60)
        print("Complete!")
        print("=" * 60)


if __name__ == "__main__":
    main()

