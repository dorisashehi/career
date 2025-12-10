"""Collect Reddit posts and comments from career-related subreddits."""
import time
from datetime import datetime

import pandas as pd
import requests

# Fetch posts from Reddit's public JSON endpoint (Pushshift is down)
def fetch_posts(subreddit, limit=20):
    """
    Fetch posts from Reddit using the public JSON endpoint.
    Note: Pushshift API is no longer publicly available, so we use Reddit's JSON API.
    """
    url = f"https://www.reddit.com/r/{subreddit}/new.json"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; CareerRAGBot/1.0)"}

    params = {
        "limit": min(limit, 100)  # Reddit API max is 100 per request
    }

    try:
        res = requests.get(url, headers=headers, params=params, timeout=30)
        res.raise_for_status()  # Raise an exception for bad status codes

        json_data = res.json()
        posts = []

        if "data" in json_data and "children" in json_data["data"]:
            for child in json_data["data"]["children"]:
                if child["kind"] != "t3":  # t3 is a link/post
                    continue

                post_data = child["data"]
                posts.append({
                    "id": post_data.get("id", ""),
                    "title": post_data.get("title", ""),
                    "selftext": post_data.get("selftext", ""),
                    "created_utc": post_data.get("created_utc", 0)
                })

        print(f"   ✅ Fetched {len(posts)} posts from r/{subreddit}")
        return posts

    except requests.exceptions.RequestException as e:
        print(f"   ❌ Error fetching posts from r/{subreddit}: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response status: {e.response.status_code}")
            print(f"   Response body: {e.response.text[:200]}")
        return []
    except (ValueError, KeyError) as e:
        print(f"   ❌ Unexpected error parsing response from r/{subreddit}: {e}")
        return []


# Fetch comments using Reddit's public JSON endpoint
def fetch_comments(post_id):
    """Fetch comments for a given Reddit post ID."""
    url = f"https://www.reddit.com/comments/{post_id}.json"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; CareerRAGBot/1.0)"}

    try:
        res = requests.get(url, headers=headers, timeout=30)
        json_data = res.json()

        comments_list = []

        if len(json_data) < 2:
            return comments_list

        comments = json_data[1]["data"]["children"]

        for c in comments:
            if c["kind"] != "t1":
                continue

            body = c["data"].get("body", "")
            created = c["data"].get("created_utc", None)
            subreddit_name = c["data"].get("subreddit", "")
            comment_link = (
                f"https://www.reddit.com/r/{subreddit_name}/comments/{post_id}/"
            )

            comments_list.append({
                "text": body,
                "date": datetime.utcfromtimestamp(created).strftime("%Y-%m-%d") if created else "",
                "comment_link": comment_link
            })

        return comments_list

    except (requests.exceptions.RequestException, ValueError, KeyError) as e:
        print(f"Error loading comments for {post_id}: {e}")
        return []


# Collect data from Reddit JSON
def collect_reddit_data(subreddits, posts_per_sub=20, output_csv="experiences_raw.csv"):
    """Collect posts and comments from specified subreddits and save to CSV."""
    rows = []
    record_id = 0

    for subreddit in subreddits:
        print(f"\n🔍 Fetching posts from r/{subreddit}...")
        posts = fetch_posts(subreddit, limit=posts_per_sub)

        if not posts:
            print(f"   ⚠️  No posts found for r/{subreddit}, skipping...")
            continue

        for post in posts:
            post_id = post["id"]
            title = post.get("title", "")
            text = post.get("selftext", "")

            # Skip empty posts
            if len(text.strip()) < 20:
                continue

            full_text = f"{title}\n\n{text}"
            post_link = f"https://www.reddit.com/r/{subreddit}/comments/{post_id}/"

            # Save post
            rows.append({
                "id": record_id,
                "type": "post",
                "text": full_text,
                "post_id": post_id,
                "source": subreddit,
                "date": datetime.utcfromtimestamp(post["created_utc"]).strftime("%Y-%m-%d"),
                "post_link": post_link,
                "comment_link": ""  # No comment link for the post
            })
            record_id += 1

            # Fetch comments
            print(f"   💬 Fetching comments for post {post_id}...")
            comments = fetch_comments(post_id)

            for c in comments:
                rows.append({
                    "id": record_id,
                    "type": "comment",
                    "text": c["text"],
                    "post_id": post_id,
                    "source": subreddit,
                    "date": c["date"],
                    "post_link": post_link,  # Link to the post
                    "comment_link": c["comment_link"]  # Link to the comment
                })
                record_id += 1

            time.sleep(1)  # Gentle rate limiting
    print("rowwww:", rows)

    # Save to CSV
    df = pd.DataFrame(rows)
    df.to_csv(output_csv, index=False)

    print(f"\n✅ Saved {len(rows)} records to {output_csv}")


if __name__ == "__main__":
    SUBREDDITS = [
        "careeradvice",
        "jobs",
        "interviews",
        "cscareerquestions",
    ]

    collect_reddit_data(
        subreddits=SUBREDDITS,
        posts_per_sub=30,  # 4 subs * 30 posts ~= 120 posts
        output_csv="experiences_raw.csv"
    )
