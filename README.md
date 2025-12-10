# Career Catalyst

Career Catalyst is an AI-powered career advice application that aggregates and synthesizes career-related discussions from Reddit to help job seekers and career changers find relevant information more easily.

## What It Does

The application uses **Retrieval-Augmented Generation (RAG)** to answer career-related questions based on real experiences shared in career-related subreddits. It:

- **Aggregates Data**: Automatically collects career-related content from subreddits like r/cscareerquestions, r/jobs, r/ExperiencedDevs, and r/ITCareerQuestions
- **Synthesizes Information**: Uses AI to combine insights from multiple Reddit discussions to provide comprehensive answers
- **Provides Source Attribution**: All responses include proper citations and links back to original Reddit posts
- **Enables Semantic Search**: Makes it easy to find relevant career information even when you don't know the exact keywords

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React/Next.js with TypeScript
- **Database**: PostgreSQL with PGvector for vector embeddings
- **AI/ML**: LangChain for RAG, OpenAI for LLM and embeddings
- **Data Processing**: Celery for background tasks, Redis for task queue
