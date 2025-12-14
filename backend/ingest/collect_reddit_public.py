"""Collect Reddit posts and comments from career-related subreddits (Optimized)."""
import time
import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def create_session():
    """Create a requests session with connection pooling and retry logic."""
    session = requests.Session()

    # Configure retry strategy
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )

    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=10,
        pool_maxsize=20
    )

    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; CareerRAGBot/1.0)"})

    return session


# Global session for reuse
SESSION = create_session()


def fetch_posts(subreddit, limit=20, sort="top", time_filter="all"):
    """
    Fetch high-quality posts from Reddit using the public JSON endpoint.

    Args:
        subreddit: Subreddit name
        limit: Number of posts to fetch
        sort: Sort method - "top", "hot", or "new" (default: "top" for quality)
        time_filter: Time filter for "top" - "all", "year", "month", "week", "day"
    """
    url = f"https://www.reddit.com/r/{subreddit}/{sort}.json"

    params = {
        "limit": min(limit, 100)  # Reddit API max is 100 per request
    }
    if sort == "top":
        params["t"] = time_filter

    try:
        res = SESSION.get(url, params=params, timeout=30)
        res.raise_for_status()

        json_data = res.json()
        posts = []

        if "data" in json_data and "children" in json_data["data"]:
            for child in json_data["data"]["children"]:
                if child["kind"] != "t3":
                    continue

                post_data = child["data"]
                posts.append({
                    "id": post_data.get("id", ""),
                    "title": post_data.get("title", ""),
                    "selftext": post_data.get("selftext", ""),
                    "created_utc": post_data.get("created_utc", 0),
                    "score": post_data.get("score", 0),
                    "num_comments": post_data.get("num_comments", 0),
                    "upvote_ratio": post_data.get("upvote_ratio", 0.0),
                    "subreddit": subreddit
                })

        print(f"   ✅ Fetched {len(posts)} posts from r/{subreddit} (sort: {sort})")
        return posts

    except requests.exceptions.RequestException as e:
        print(f"   ❌ Error fetching posts from r/{subreddit}: {e}")
        return []
    except (ValueError, KeyError) as e:
        print(f"   ❌ Unexpected error parsing response from r/{subreddit}: {e}")
        return []


def fetch_comments(post_id, subreddit, max_comments=50):
    """Fetch comments for a given Reddit post ID.

    Args:
        post_id: Reddit post ID
        subreddit: Subreddit name
        max_comments: Maximum number of comments to fetch (default: 50)
    """
    url = f"https://www.reddit.com/comments/{post_id}.json"

    try:
        res = SESSION.get(url, timeout=30)

        if res.status_code != 200:
            return []

        if not res.text or len(res.text.strip()) == 0:
            return []

        content_type = res.headers.get("Content-Type", "").lower()
        if "application/json" not in content_type:
            if res.text.strip().startswith("<"):
                return []

        try:
            json_data = res.json()
        except ValueError:
            return []

        comments_list = []

        if len(json_data) < 2:
            return comments_list

        comments = json_data[1]["data"]["children"]

        for c in comments[:max_comments]:  # Limit to max_comments
            if c["kind"] != "t1":
                continue

            body = c["data"].get("body", "")
            created = c["data"].get("created_utc", None)
            comment_id = c["data"].get("id", "")
            comment_link = (
                f"https://www.reddit.com/r/{subreddit}/comments/{post_id}/_/{comment_id}/"
            )

            comments_list.append({
                "text": body,
                "date": datetime.utcfromtimestamp(created).strftime("%Y-%m-%d") if created else "",
                "comment_id": comment_id,
                "comment_link": comment_link,
                "post_id": post_id
            })

        return comments_list

    except (requests.exceptions.Timeout, requests.exceptions.RequestException):
        return []
    except (ValueError, KeyError):
        return []


def process_post(post, min_score, min_comments, min_text_length, max_comments=50):
    """Process a single post and fetch its comments.

    Args:
        post: Post data dictionary
        min_score: Minimum score filter
        min_comments: Minimum comments filter
        min_text_length: Minimum text length filter
        max_comments: Maximum comments to fetch per post (default: 50)
    """
    post_id = post["id"]
    title = post.get("title", "")
    text = post.get("selftext", "")
    score = post.get("score", 0)
    num_comments = post.get("num_comments", 0)
    upvote_ratio = post.get("upvote_ratio", 0.0)
    subreddit = post.get("subreddit", "")

    # Quality filters
    if len(text.strip()) < min_text_length:
        return None, []
    if score < min_score:
        return None, []
    if num_comments < min_comments:
        return None, []

    full_text = f"{title}\n\n{text}"
    post_link = f"https://www.reddit.com/r/{subreddit}/comments/{post_id}/"

    post_data = {
        "post_id": post_id,
        "title": title,
        "text": text,
        "full_text": full_text,
        "source": subreddit,
        "date": datetime.utcfromtimestamp(post["created_utc"]).strftime("%Y-%m-%d"),
        "post_link": post_link,
        "score": score,
        "num_comments": num_comments,
        "upvote_ratio": upvote_ratio
    }

    # Fetch comments
    comments = fetch_comments(post_id, subreddit, max_comments)

    return post_data, comments


def collect_reddit_data(
    subreddits,
    posts_per_sub=20,
    posts_csv="posts.csv",
    comments_csv="comments.csv",
    min_score=5,
    min_comments=3,
    min_text_length=100,
    sort="top",
    time_filter="all",
    max_workers=10,
    max_comments=50
):
    """
    Collect high-quality posts and comments from specified subreddits (parallel version).

    Args:
        subreddits: List of subreddit names
        posts_per_sub: Number of posts to fetch per subreddit
        posts_csv: Output file for posts
        comments_csv: Output file for comments
        min_score: Minimum upvotes required (default: 5)
        min_comments: Minimum number of comments required (default: 3)
        min_text_length: Minimum post text length in characters (default: 100)
        sort: Sort method - "top", "hot", or "new" (default: "top")
        time_filter: Time filter for "top" - "all", "year", "month", "week", "day"
        max_workers: Maximum number of parallel workers (default: 10)
        max_comments: Maximum comments to fetch per post (default: 50)
    """
    posts_list = []
    comments_list = []

    # Step 1: Fetch all posts from all subreddits (can be parallelized if needed)
    all_posts = []
    for subreddit in subreddits:
        print(f"\n🔍 Fetching posts from r/{subreddit}...")
        posts = fetch_posts(subreddit, limit=posts_per_sub, sort=sort, time_filter=time_filter)

        if not posts:
            print(f"   ⚠️  No posts found for r/{subreddit}, skipping...")
            continue

        all_posts.extend(posts)

    if not all_posts:
        print("\n⚠️  No posts found from any subreddit")
        return

    print(f"\n💬 Processing {len(all_posts)} posts in parallel with {max_workers} workers...")

    # Step 2: Process all posts in parallel (filter + fetch comments)
    filtered_count = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_post = {
            executor.submit(
                process_post,
                post,
                min_score,
                min_comments,
                min_text_length,
                max_comments
            ): post for post in all_posts
        }

        # Process completed tasks
        for future in as_completed(future_to_post):
            try:
                post_data, comments = future.result()

                if post_data is None:
                    filtered_count += 1
                    continue

                posts_list.append(post_data)
                comments_list.extend(comments)

                print(f"   ✓ Processed post {post_data['post_id']} ({len(comments)} comments)")

            except Exception as e:
                print(f"   ❌ Error processing post: {e}")

    if filtered_count > 0:
        print(f"\n📊 Filtered out {filtered_count} low-quality posts")

    # Save posts to CSV
    if posts_list:
        posts_df = pd.DataFrame(posts_list)
        posts_df.to_csv(posts_csv, index=False)
        print(f"\n✅ Saved {len(posts_list)} posts to {posts_csv}")
    else:
        print("\n⚠️  No posts to save")

    # Save comments to CSV
    if comments_list:
        comments_df = pd.DataFrame(comments_list)
        comments_df.to_csv(comments_csv, index=False)
        print(f"✅ Saved {len(comments_list)} comments to {comments_csv}")
    else:
        print("⚠️  No comments to save")

    print(f"\n📊 Summary: {len(posts_list)} posts, {len(comments_list)} comments")


if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)

    SUBREDDITS = [
        "cscareerquestions",
        "jobs",
        "ExperiencedDevs",
        "ITCareerQuestions",
    ]

    collect_reddit_data(
        subreddits=SUBREDDITS,
        posts_per_sub=50,
        posts_csv="../data/posts.csv",
        comments_csv="../data/comments.csv",
        min_score=5,
        min_comments=3,
        min_text_length=100,
        sort="top",
        time_filter="year",
        max_workers=10,  # Adjust based on your needs
        max_comments=50  # Limit comments per post
    )