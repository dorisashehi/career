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

        # Check response status
        if res.status_code != 200:
            print(f"   ⚠️  Post {post_id}: HTTP {res.status_code} - Skipping comments")
            return []

        # Check if response is empty
        if not res.text or len(res.text.strip()) == 0:
            print(f"   ⚠️  Post {post_id}: Empty response - Skipping comments")
            return []

        # Check if response is JSON (not HTML error page)
        content_type = res.headers.get("Content-Type", "").lower()
        if "application/json" not in content_type:
            # Check if it looks like HTML (common for error pages)
            if res.text.strip().startswith("<"):
                msg = f"   ⚠️  Post {post_id}: Received HTML instead of JSON "
                msg += "(post may be deleted/private)"
                print(msg)
                return []

        # Try to parse JSON
        try:
            json_data = res.json()
        except ValueError as json_error:
            print(f"   ⚠️  Post {post_id}: Invalid JSON response - {json_error}")
            print(f"      Response preview: {res.text[:100]}")
            return []

        comments_list = []

        if len(json_data) < 2:
            return comments_list

        comments = json_data[1]["data"]["children"]

        for c in comments:
            if c["kind"] != "t1":
                continue

            body = c["data"].get("body", "")
            created = c["data"].get("created_utc", None)
            comment_id = c["data"].get("id", "")
            subreddit_name = c["data"].get("subreddit", "")
            # Build proper comment link with comment ID
            comment_link = (
                f"https://www.reddit.com/r/{subreddit_name}/comments/{post_id}/_/{comment_id}/"
            )

            comments_list.append({
                "text": body,
                "date": datetime.utcfromtimestamp(created).strftime("%Y-%m-%d") if created else "",
                "comment_id": comment_id,
                "comment_link": comment_link
            })

        return comments_list

    except requests.exceptions.Timeout:
        print(f"   ⚠️  Post {post_id}: Request timeout - Skipping comments")
        return []
    except requests.exceptions.RequestException as e:
        print(f"   ⚠️  Post {post_id}: Network error - {e}")
        return []
    except (ValueError, KeyError) as e:
        print(f"   ⚠️  Post {post_id}: Parsing error - {e}")
        return []


# Collect data from Reddit JSON
def collect_reddit_data(
    subreddits, posts_per_sub=20, posts_csv="posts.csv", comments_csv="comments.csv"
):
    """Collect posts and comments from specified subreddits and save to separate CSV files."""
    posts_list = []
    comments_list = []

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

            # Save post (normalized - no comment data)
            posts_list.append({
                "post_id": post_id,
                "title": title,
                "text": text,
                "full_text": full_text,  # Combined for convenience
                "source": subreddit,
                "date": datetime.utcfromtimestamp(post["created_utc"]).strftime("%Y-%m-%d"),
                "post_link": post_link
            })

            # Fetch comments
            print(f"   💬 Fetching comments for post {post_id}...")
            comments = fetch_comments(post_id)

            for c in comments:
                # Save comment (normalized - only comment data, post_id as foreign key)
                comments_list.append({
                    "comment_id": c["comment_id"],
                    "post_id": post_id,  # Foreign key to posts table
                    "text": c["text"],
                    "date": c["date"],
                    "comment_link": c["comment_link"]
                })

            time.sleep(1)  # Gentle rate limiting

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
    SUBREDDITS = [
        "cscareerquestions",
        "jobs",
        "ExperiencedDevs",
        "ITCareerQuestions",
    ]

    collect_reddit_data(
        subreddits=SUBREDDITS,
        posts_per_sub=30,  # 4 subs * 30 posts ~= 120 posts
        posts_csv="posts.csv",
        comments_csv="comments.csv"
    )
