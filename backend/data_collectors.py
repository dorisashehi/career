"""
Data collection modules for Career Catalyst
Supports Reddit, Hacker News, and Stack Overflow
"""

import requests
import time
from typing import List, Dict, Optional
from datetime import datetime


class RedditCollector:
    """Collect data from Reddit using public JSON endpoints"""

    BASE_URL = "https://www.reddit.com"

    def __init__(self, user_agent: str = "CareerCatalyst/1.0"):
        self.headers = {"User-Agent": user_agent}
        self.rate_limit_delay = 2  # seconds between requests

    def get_subreddit_posts(
        self,
        subreddit: str,
        limit: int = 25,
        sort: str = "hot",
        timeframe: str = "day"
    ) -> List[Dict]:
        """
        Fetch posts from a subreddit

        Args:
            subreddit: Subreddit name (without r/)
            limit: Number of posts to fetch (max 100)
            sort: Sort order (hot, new, top, rising)
            timeframe: For 'top' sort (hour, day, week, month, year, all)
        """
        url = f"{self.BASE_URL}/r/{subreddit}/{sort}.json"
        params = {"limit": limit}
        if sort == "top":
            params["t"] = timeframe

        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()

            posts = []
            for child in data.get("data", {}).get("children", []):
                post_data = child.get("data", {})
                posts.append({
                    "id": post_data.get("id"),
                    "title": post_data.get("title"),
                    "content": post_data.get("selftext", ""),
                    "author": post_data.get("author"),
                    "score": post_data.get("score", 0),
                    "num_comments": post_data.get("num_comments", 0),
                    "url": post_data.get("url"),
                    "permalink": f"{self.BASE_URL}{post_data.get('permalink', '')}",
                    "created_utc": post_data.get("created_utc"),
                    "subreddit": post_data.get("subreddit"),
                    "source": "reddit"
                })

            time.sleep(self.rate_limit_delay)  # Respect rate limits
            return posts

        except requests.exceptions.RequestException as e:
            print(f"Error fetching Reddit data: {e}")
            return []

    def get_multiple_subreddits(
        self,
        subreddits: List[str],
        limit: int = 25
    ) -> List[Dict]:
        """Fetch posts from multiple subreddits"""
        all_posts = []
        for subreddit in subreddits:
            print(f"Fetching from r/{subreddit}...")
            posts = self.get_subreddit_posts(subreddit, limit=limit)
            all_posts.extend(posts)
            time.sleep(self.rate_limit_delay)
        return all_posts

    def search_subreddit(
        self,
        subreddit: str,
        query: str,
        limit: int = 25
    ) -> List[Dict]:
        """Search within a subreddit"""
        url = f"{self.BASE_URL}/r/{subreddit}/search.json"
        params = {"q": query, "limit": limit, "restrict_sr": "true"}

        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()

            posts = []
            for child in data.get("data", {}).get("children", []):
                post_data = child.get("data", {})
                posts.append({
                    "id": post_data.get("id"),
                    "title": post_data.get("title"),
                    "content": post_data.get("selftext", ""),
                    "author": post_data.get("author"),
                    "score": post_data.get("score", 0),
                    "num_comments": post_data.get("num_comments", 0),
                    "url": post_data.get("url"),
                    "permalink": f"{self.BASE_URL}{post_data.get('permalink', '')}",
                    "created_utc": post_data.get("created_utc"),
                    "subreddit": post_data.get("subreddit"),
                    "source": "reddit"
                })

            time.sleep(self.rate_limit_delay)
            return posts

        except requests.exceptions.RequestException as e:
            print(f"Error searching Reddit: {e}")
            return []


class HackerNewsCollector:
    """Collect data from Hacker News API"""

    BASE_URL = "https://hacker-news.firebaseio.com/v0"

    def __init__(self):
        self.rate_limit_delay = 0.1  # HN API is more lenient

    def get_item(self, item_id: int) -> Optional[Dict]:
        """Fetch a single item (story, comment, job, etc.)"""
        url = f"{self.BASE_URL}/item/{item_id}.json"
        try:
            response = requests.get(url)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching HN item {item_id}: {e}")
            return None

    def get_top_stories(self, limit: int = 100) -> List[int]:
        """Get IDs of top stories"""
        url = f"{self.BASE_URL}/topstories.json"
        try:
            response = requests.get(url)
            response.raise_for_status()
            story_ids = response.json()
            return story_ids[:limit]
        except requests.exceptions.RequestException as e:
            print(f"Error fetching top stories: {e}")
            return []

    def get_job_stories(self, limit: int = 100) -> List[int]:
        """Get IDs of job postings"""
        url = f"{self.BASE_URL}/jobstories.json"
        try:
            response = requests.get(url)
            response.raise_for_status()
            job_ids = response.json()
            return job_ids[:limit]
        except requests.exceptions.RequestException as e:
            print(f"Error fetching job stories: {e}")
            return []

    def get_ask_hn_stories(self, limit: int = 100) -> List[int]:
        """Get IDs of Ask HN stories (career-related Q&A)"""
        url = f"{self.BASE_URL}/askstories.json"
        try:
            response = requests.get(url)
            response.raise_for_status()
            ask_ids = response.json()
            return ask_ids[:limit]
        except requests.exceptions.RequestException as e:
            print(f"Error fetching Ask HN stories: {e}")
            return []

    def fetch_stories_by_ids(
        self,
        story_ids: List[int],
        filter_keywords: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Fetch full story data from IDs

        Args:
            story_ids: List of story IDs
            filter_keywords: Optional keywords to filter stories (e.g., ['career', 'job', 'interview'])
        """
        stories = []
        for story_id in story_ids:
            item = self.get_item(story_id)
            if not item or item.get("type") != "story":
                continue

            # Filter by keywords if provided
            if filter_keywords:
                title = item.get("title", "").lower()
                text = item.get("text", "").lower()
                if not any(keyword.lower() in title or keyword.lower() in text
                          for keyword in filter_keywords):
                    continue

            stories.append({
                "id": item.get("id"),
                "title": item.get("title"),
                "content": item.get("text", ""),
                "author": item.get("by"),
                "score": item.get("score", 0),
                "num_comments": item.get("descendants", 0),
                "url": item.get("url", ""),
                "permalink": f"https://news.ycombinator.com/item?id={item.get('id')}",
                "created_utc": item.get("time"),
                "type": item.get("type"),
                "source": "hackernews"
            })
            time.sleep(self.rate_limit_delay)

        return stories

    def get_career_related_stories(self, limit: int = 50) -> List[Dict]:
        """Get career-related stories from Ask HN and Jobs"""
        career_keywords = [
            "career", "job", "interview", "salary", "offer",
            "resume", "cv", "hiring", "recruiter", "company"
        ]

        all_stories = []

        # Get Ask HN stories
        ask_ids = self.get_ask_hn_stories(limit=limit)
        ask_stories = self.fetch_stories_by_ids(ask_ids, filter_keywords=career_keywords)
        all_stories.extend(ask_stories)

        # Get Job stories
        job_ids = self.get_job_stories(limit=limit)
        job_stories = self.fetch_stories_by_ids(job_ids)
        all_stories.extend(job_stories)

        return all_stories


class StackOverflowCollector:
    """Collect data from Stack Overflow API"""

    BASE_URL = "https://api.stackexchange.com/2.3"

    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: Optional API key (increases rate limit from 300 to 10000 requests/day)
        """
        self.api_key = api_key
        self.rate_limit_delay = 0.1

    def search_questions(
        self,
        query: str,
        tagged: Optional[str] = None,
        sort: str = "relevance",
        order: str = "desc",
        pagesize: int = 100
    ) -> List[Dict]:
        """
        Search for questions on Stack Overflow

        Args:
            query: Search query
            tagged: Tags to filter by (e.g., "career-development,jobs")
            sort: Sort order (relevance, activity, votes, creation)
            order: asc or desc
            pagesize: Number of results (max 100)
        """
        url = f"{self.BASE_URL}/search/advanced"
        params = {
            "q": query,
            "site": "stackoverflow",
            "sort": sort,
            "order": order,
            "pagesize": pagesize,
            "filter": "withbody"  # Include question body
        }

        if tagged:
            params["tagged"] = tagged

        if self.api_key:
            params["key"] = self.api_key

        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            questions = []
            for item in data.get("items", []):
                questions.append({
                    "id": item.get("question_id"),
                    "title": item.get("title"),
                    "content": item.get("body", ""),
                    "author": item.get("owner", {}).get("display_name", "Unknown"),
                    "score": item.get("score", 0),
                    "num_comments": item.get("comment_count", 0),
                    "num_answers": item.get("answer_count", 0),
                    "url": item.get("link"),
                    "permalink": item.get("link"),
                    "created_utc": item.get("creation_date"),
                    "tags": item.get("tags", []),
                    "view_count": item.get("view_count", 0),
                    "source": "stackoverflow"
                })

            time.sleep(self.rate_limit_delay)
            return questions

        except requests.exceptions.RequestException as e:
            print(f"Error searching Stack Overflow: {e}")
            return []

    def get_career_questions(self, limit: int = 100) -> List[Dict]:
        """Get career-related questions"""
        career_tags = "career-development,jobs,interview,resume"
        queries = [
            "career advice",
            "job interview",
            "salary negotiation",
            "career change",
            "job search"
        ]

        all_questions = []
        for query in queries:
            questions = self.search_questions(
                query=query,
                tagged=career_tags,
                pagesize=limit // len(queries)
            )
            all_questions.extend(questions)
            time.sleep(self.rate_limit_delay)

        return all_questions


# Example usage
if __name__ == "__main__":
    # Reddit example
    print("=== Reddit Data Collection ===")
    reddit = RedditCollector()
    subreddits = ["cscareerquestions", "jobs", "ExperiencedDevs", "ITCareerQuestions"]
    reddit_posts = reddit.get_multiple_subreddits(subreddits, limit=10)
    print(f"Collected {len(reddit_posts)} Reddit posts")

    # Hacker News example
    print("\n=== Hacker News Data Collection ===")
    hn = HackerNewsCollector()
    hn_stories = hn.get_career_related_stories(limit=20)
    print(f"Collected {len(hn_stories)} Hacker News stories")

    # Stack Overflow example (no API key needed for basic usage)
    print("\n=== Stack Overflow Data Collection ===")
    so = StackOverflowCollector()
    so_questions = so.get_career_questions(limit=50)
    print(f"Collected {len(so_questions)} Stack Overflow questions")

    # Print sample data
    if reddit_posts:
        print(f"\nSample Reddit post: {reddit_posts[0]['title']}")
    if hn_stories:
        print(f"Sample HN story: {hn_stories[0]['title']}")
    if so_questions:
        print(f"Sample SO question: {so_questions[0]['title']}")

