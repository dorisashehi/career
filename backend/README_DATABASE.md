# Database Setup Guide

This guide explains how to set up and use the PostgreSQL database for storing Reddit data.

## Overview

The database stores Reddit posts and comments collected from career-related subreddits. The data flow is:

```
Reddit JSON
    ↓
Python scraper
    ↓
Pandas DataFrame (in memory)
    ↓
Clean / filter / enrich
    ↓
Convert to list[dict]
    ↓
SQLAlchemy bulk insert → PostgreSQL
```

## Prerequisites

1. **PostgreSQL** installed and running
2. **Python dependencies** installed:
   ```bash
   pip install -r requirements.txt
   ```

Required packages:

- `sqlalchemy`
- `psycopg2-binary`
- `pandas`
- `python-dotenv`

## How to Run

### Quick Start

1. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Create PostgreSQL database:**
   ```bash
   psql -U postgres
   CREATE DATABASE career_db;
   \q
   ```

3. **Create `.env` file in `backend/` directory:**
   ```bash
   cd backend
   echo "DATABASE_URL=postgresql://postgres:your_password@localhost:5432/career_db" > .env
   ```

   Replace `your_password` with your actual PostgreSQL password.

4. **Run the script:**
   ```bash
   python scripts/save_to_database.py
   ```

That's it! The script will automatically:
- Create the database tables
- Collect Reddit data
- Clean and filter the data
- Save everything to PostgreSQL

### Detailed Steps

#### 1. Install Python Packages

Make sure you're in the `backend` directory:

```bash
cd backend
pip install -r requirements.txt
```

#### 2. Set Up PostgreSQL

**Option A: Using psql**
```bash
psql -U postgres
CREATE DATABASE career_db;
\q
```

**Option B: Using command line**
```bash
createdb -U postgres career_db
```

**Option C: Using Docker**
```bash
docker run --name postgres-career \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=career_db \
  -p 5432:5432 \
  -d postgres
```

#### 3. Configure Database Connection

Create a `.env` file in the `backend/` directory with your database URL:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/career_db
```

**Example:**
```env
DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/career_db
```

#### 4. Run the Script

```bash
cd backend
python scripts/save_to_database.py
```

### What Happens When You Run It

The script performs these steps automatically:

1. **Creates tables** - Sets up `posts` and `comments` tables if they don't exist
2. **Collects data** - Fetches posts and comments from Reddit subreddits
3. **Cleans data** - Removes URLs, usernames, emojis, and filters low-quality content
4. **Saves to database** - Bulk inserts all data into PostgreSQL

### Expected Output

```
============================================================
Starting Reddit data collection and database save
============================================================

1. Collecting data from Reddit...
🔍 Fetching posts from r/cscareerquestions...
   ✅ Fetched 20 posts from r/cscareerquestions (sort: top)

2. Cleaning data...
🧹 Cleaning posts from /tmp/...
   Cleaned 80 posts

3. Loading cleaned data into DataFrames...
   Loaded 75 posts
   Loaded 1200 comments

4. Converting to list of dictionaries...

5. Saving to PostgreSQL database...
Saved 75 posts to database
Saved 1200 comments to database

============================================================
Complete!
============================================================
```

### Running Multiple Times

You can run the script multiple times - it will skip posts and comments that already exist in the database (duplicates are automatically ignored).

## Database Models

### Post Model

Stores Reddit post information:

- `id` - Primary key (auto-increment)
- `post_id` - Reddit post ID (unique)
- `title` - Post title
- `text` - Post text content
- `full_text` - Combined title and text
- `source` - Subreddit name
- `date` - Post date
- `post_link` - Link to Reddit post
- `score` - Upvote score
- `num_comments` - Number of comments
- `upvote_ratio` - Upvote ratio
- `created_at` - Record creation timestamp

### Comment Model

Stores Reddit comment information:

- `id` - Primary key (auto-increment)
- `comment_id` - Reddit comment ID (unique)
- `text` - Comment text
- `date` - Comment date
- `comment_link` - Link to comment
- `post_id` - Foreign key to Post (post_id)
- `created_at` - Record creation timestamp

## Usage

### Running the Script Multiple Times

You can run the script multiple times - it will skip posts and comments that already exist in the database (based on `post_id` and `comment_id`).

### Initializing Database Tables

The tables are automatically created when you run the script. If you need to create them manually:

```python
from database.db import init_db
init_db()
```

## Data Flow Details

1. **Collection**: Fetches posts and comments from Reddit using the public JSON API
2. **DataFrame**: Data is stored in Pandas DataFrames for easy manipulation
3. **Cleaning**:
   - Removes URLs, usernames, emojis
   - Filters by minimum length
   - Removes irrelevant comments
4. **Conversion**: DataFrames are converted to list of dictionaries
5. **Database Insert**: SQLAlchemy bulk insert saves data to PostgreSQL

## Script Configuration

You can modify the collection parameters in `scripts/save_to_database.py`:

```python
collect_reddit_data(
    subreddits=subreddits,
    posts_per_sub=20,          # Posts per subreddit
    min_score=5,               # Minimum upvotes
    min_comments=3,            # Minimum comments
    min_text_length=100,       # Minimum text length
    sort="top",                # Sort method
    time_filter="year",        # Time range
    max_workers=10,            # Parallel workers
    max_comments=50            # Max comments per post
)
```

## Querying the Database

### Using SQLAlchemy

```python
from database.db import SessionLocal
from database.models import Post, Comment

db = SessionLocal()

# Get all posts
posts = db.query(Post).all()

# Get posts from specific subreddit
posts = db.query(Post).filter(Post.source == "cscareerquestions").all()

# Get comments for a post
comments = db.query(Comment).filter(Comment.post_id == "post_id_here").all()

db.close()
```

### Using SQL

```sql
-- Get all posts
SELECT * FROM posts;

-- Get posts with high scores
SELECT * FROM posts WHERE score > 100;

-- Get comments for a specific post
SELECT * FROM comments WHERE post_id = 'post_id_here';

-- Count posts by subreddit
SELECT source, COUNT(*) FROM posts GROUP BY source;
```

## Troubleshooting

### Connection Error

If you get a connection error, check:

- PostgreSQL is running: `sudo systemctl status postgresql`
- Database exists: `psql -U postgres -l`
- `DATABASE_URL` in `.env` is correct
- User has permissions to access the database

### Duplicate Key Error

The script automatically skips existing posts/comments based on `post_id` and `comment_id`. If you see duplicate errors, the unique constraint might be missing.

### Import Errors

Make sure you're running the script from the `backend/` directory or have the correct Python path set up.

## File Structure

```
backend/
├── database/
│   ├── __init__.py
│   ├── db.py              # Database connection
│   └── models.py          # SQLAlchemy models
├── scripts/
│   ├── collect_reddit_public.py  # Reddit scraper
│   ├── clean_data.py             # Data cleaning
│   └── save_to_database.py       # Main script
└── .env                    # Environment variables
```
