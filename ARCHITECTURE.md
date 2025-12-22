# 404ella System Architecture

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [API Architecture](#api-architecture)
7. [Database Schema](#database-schema)
8. [RAG System Architecture](#rag-system-architecture)
9. [Content Validation Pipeline](#content-validation-pipeline)
10. [Authentication & Authorization](#authentication--authorization)
11. [Background Processing](#background-processing)
12. [Deployment Architecture](#deployment-architecture)

---

## System Overview

404ella is an AI-powered career advice application that uses **Retrieval-Augmented Generation (RAG)** to provide contextual answers based on real experiences from Reddit and user-submitted content.

### Core Capabilities

- **Semantic Search**: Find relevant career information using natural language queries
- **RAG-Powered Chat**: Generate answers by retrieving and synthesizing information from multiple sources
- **Content Aggregation**: Automatically collect and process career-related discussions from Reddit
- **User Experience Submission**: Allow users to submit their own career experiences for review
- **Admin Moderation**: Review and approve/reject user-submitted content
- **Content Validation**: Automatic validation for safety, PII, spam, and relevance

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│  Next.js/React Application (chatbot-ui-design/)                 │
│  - Chat Interface                                                │
│  - Admin Panel                                                   │
│  - Experience Submission Forms                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST API
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      API Layer (FastAPI)                         │
│  app/main.py                                                    │
│  - /ask (Chat endpoint)                                         │
│  - /api/experiences (User submissions)                          │
│  - /api/admin/* (Admin endpoints)                               │
└─────────────┬───────────────────────────────┬───────────────────┘
              │                               │
              │                               │
┌─────────────▼──────────┐      ┌─────────────▼──────────┐
│   Service Layer        │      │   Background Tasks     │
│                        │      │                        │
│ - RAG Service          │      │ - Content Validation   │
│ - Content Validator    │      │ - Embedding Generation │
└─────────────┬──────────┘      └─────────────┬──────────┘
              │                               │
              │                               │
┌─────────────▼───────────────────────────────▼──────────┐
│              Database Layer (PostgreSQL)                │
│  - Posts (Reddit data)                                  │
│  - Comments (Reddit comments)                           │
│  - User Experiences (User submissions)                  │
│  - Admin Users (Authentication)                        │
│  - Vector Embeddings (pgvector)                        │
└─────────────────────────────────────────────────────────┘
              │
              │
┌─────────────▼───────────────────────────────────────────┐
│         External Services & Data Sources                │
│  - Reddit API (Data collection)                        │
│  - Groq API (LLM inference)                            │
│  - HuggingFace Models (Validation)                      │
└─────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Frontend (Next.js/React)

**Location**: `chatbot-ui-design/`

**Components**:

- **Chat Interface**: Main conversation UI for asking questions
- **Admin Panel**: Review and moderate user experiences
- **Experience Submission**: Form for users to submit career experiences
- **Authentication**: Login/registration for admin users

**Key Technologies**:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Radix UI components

### 2. API Layer (FastAPI)

**Location**: `backend/app/main.py`

**Responsibilities**:

- HTTP request handling
- Request validation (Pydantic models)
- Authentication & authorization
- Response formatting
- Error handling

**Key Endpoints**:

- `POST /ask`: Chat endpoint for RAG queries
- `POST /api/experiences`: Submit user experiences
- `GET /api/admin/experiences`: List experiences for review
- `PUT /api/admin/experiences/{id}/approve`: Approve experience
- `PUT /api/admin/experiences/{id}/reject`: Reject experience
- `POST /api/admin/register`: Admin registration
- `POST /api/admin/login`: Admin authentication

### 3. Service Layer

#### 3.1 RAG Service

**Location**: `backend/app/services/rag_service.py`

**Components**:

- **Embeddings Model**: HuggingFace `sentence-transformers/all-MiniLM-L6-v2`
- **Retriever**: `PgVectorRetriever` - Custom PostgreSQL vector retriever
- **LLM**: Groq `llama-3.1-8b-instant`
- **RAG Chain**: LangChain retrieval chain

**Responsibilities**:

- Generate query embeddings
- Perform semantic search in PostgreSQL
- Retrieve relevant documents (posts + comments + user experiences)
- Generate answers using LLM with retrieved context
- Format sources for citation

#### 3.2 Content Validator Service

**Location**: `backend/app/services/content_validator.py`

**Validation Checks**:

1. **PII Detection**: Email, phone, URL detection and redaction
2. **Safety Checks**: Toxicity, hate speech, threats, self-harm, illegal advice
3. **Spam Detection**: Promotional content, excessive links
4. **Relevance Check**: Career-related content verification

**ML Models Used**:

- `SkolkovoInstitute/roberta_toxicity_classifier` (toxicity)
- `valhalla/distilbart-mnli-12-3` (zero-shot relevance)

### 4. Database Layer

**Location**: `backend/database/`

**Database**: PostgreSQL with pgvector extension

**Models**:

- `Post`: Reddit posts with embeddings
- `Comment`: Reddit comments linked to posts
- `UserExperience`: User-submitted experiences
- `AdminUser`: Admin account information

**Key Features**:

- Vector similarity search using pgvector
- Full-text search capabilities
- Relational data integrity

### 5. Background Processing

**Location**: `backend/scripts/`

**Scheduled Tasks** (Cron):

- **Data Collection**: Monthly Reddit data scraping (`collect_reddit_public.py`)
- **Embedding Generation**: Generate embeddings for new content (`generate_embeddings.py`)

**Background Tasks** (FastAPI):

- **Content Validation**: Async validation of user submissions

---

## Data Flow

### 1. Chat Query Flow

```
User Question
    │
    ▼
POST /ask
    │
    ▼
RAG Service
    │
    ├─► Generate Query Embedding
    │
    ├─► Semantic Search (PostgreSQL)
    │   ├─► Search Posts
    │   ├─► Search User Experiences (approved only)
    │   └─► Retrieve Top K Results
    │
    ├─► Fetch Comments for Posts
    │
    ├─► Build Context
    │
    └─► Generate Answer (LLM)
        │
        └─► Return Answer + Sources
```

### 2. Experience Submission Flow

```
User Submission
    │
    ▼
POST /api/experiences
    │
    ├─► Validate Input (category, description)
    │
    ├─► Create UserExperience Record
    │   └─► Status: "pending"
    │
    ├─► Return Response (immediate)
    │
    └─► Background Task (async)
        │
        ├─► Content Validation
        │   ├─► PII Detection & Redaction
        │   ├─► Safety Checks
        │   ├─► Spam Detection
        │   └─► Relevance Check
        │
        └─► Update Record
            ├─► cleaned_text
            ├─► status
            ├─► severity
            └─► flagged_reason
```

### 3. Admin Review Flow

```
Admin Login
    │
    ▼
GET /api/admin/experiences?status=pending
    │
    ├─► Query Pending Experiences
    │
    └─► Return List
        │
        ▼
Admin Reviews Experience
    │
    ├─► Approve
    │   └─► PUT /api/admin/experiences/{id}/approve
    │       └─► Status: "approved"
    │           └─► Generate Embedding (next cron run)
    │
    └─► Reject
        └─► PUT /api/admin/experiences/{id}/reject
            └─► Status: "rejected"
```

### 4. Data Collection Flow

```
Cron Job (Monthly)
    │
    ▼
collect_reddit_public.py
    │
    ├─► Fetch Reddit Posts
    │   └─► Subreddits: cscareerquestions, jobs, etc.
    │
    ├─► Fetch Comments for Posts
    │
    ├─► Save to Database
    │   ├─► Posts Table
    │   └─► Comments Table
    │
    └─► Log Results
        │
        ▼
generate_embeddings.py (Next Cron Job)
    │
    ├─► Load Embeddings Model
    │
    ├─► Process Posts (without embeddings)
    │   └─► Generate & Store Embeddings
    │
    ├─► Process Comments (without embeddings)
    │   └─► Generate & Store Embeddings
    │
    └─► Process Approved User Experiences
        └─► Generate & Store Embeddings
```

---

## Technology Stack

### Backend

| Component      | Technology | Purpose                     |
| -------------- | ---------- | --------------------------- |
| **Framework**  | FastAPI    | REST API framework          |
| **Language**   | Python 3.x | Backend development         |
| **Database**   | PostgreSQL | Primary data store          |
| **Vector DB**  | pgvector   | Vector similarity search    |
| **ORM**        | SQLAlchemy | Database abstraction        |
| **Validation** | Pydantic   | Request/response validation |

### AI/ML

| Component           | Technology                                    | Purpose                    |
| ------------------- | --------------------------------------------- | -------------------------- |
| **RAG Framework**   | LangChain                                     | RAG pipeline orchestration |
| **Embeddings**      | HuggingFace Transformers                      | Text vectorization         |
| **Embedding Model** | sentence-transformers/all-MiniLM-L6-v2        | 384-dim embeddings         |
| **LLM**             | Groq (Llama 3.1 8B)                           | Answer generation          |
| **Toxicity Model**  | SkolkovoInstitute/roberta_toxicity_classifier | Content safety             |
| **Relevance Model** | valhalla/distilbart-mnli-12-3                 | Zero-shot classification   |

### Frontend

| Component            | Technology   | Purpose               |
| -------------------- | ------------ | --------------------- |
| **Framework**        | Next.js 16   | React framework       |
| **Language**         | TypeScript   | Type-safe frontend    |
| **Styling**          | Tailwind CSS | Utility-first CSS     |
| **UI Components**    | Radix UI     | Accessible components |
| **State Management** | React Hooks  | Component state       |

### Infrastructure

| Component            | Technology              | Purpose                 |
| -------------------- | ----------------------- | ----------------------- |
| **Task Scheduler**   | Cron                    | Scheduled jobs          |
| **Authentication**   | JWT (python-jose)       | Token-based auth        |
| **Password Hashing** | bcrypt                  | Secure password storage |
| **CORS**             | FastAPI CORS Middleware | Cross-origin requests   |

---

## API Architecture

### Endpoint Categories

#### 1. Chat Endpoints

**`POST /ask`**

- **Purpose**: Ask questions to the chatbot
- **Authentication**: None (public)
- **Request**: `AskRequest` (question, chat_history)
- **Response**: `AskResponse` (answer, sources)
- **Process**: RAG retrieval + LLM generation

#### 2. Experience Endpoints

**`POST /api/experiences`**

- **Purpose**: Submit user experience
- **Authentication**: None (public)
- **Request**: `ExperienceRequest` (category, description)
- **Response**: `ExperienceResponse` (id, status, message)
- **Process**: Validation in background

#### 3. Admin Endpoints

**`POST /api/admin/register`**

- **Purpose**: Register admin account
- **Authentication**: Registration secret (optional)
- **Request**: `AdminRegisterRequest`
- **Response**: `TokenResponse` (JWT token)

**`POST /api/admin/login`**

- **Purpose**: Admin authentication
- **Authentication**: None (public endpoint)
- **Request**: `AdminLoginRequest`
- **Response**: `TokenResponse` (JWT token)

**`GET /api/admin/me`**

- **Purpose**: Get current admin info
- **Authentication**: JWT Bearer token
- **Response**: Admin user details

**`GET /api/admin/experiences`**

- **Purpose**: List experiences for review
- **Authentication**: JWT Bearer token
- **Query Params**: `status` (pending/approved/rejected)
- **Response**: `List[ExperienceListItem]`

**`PUT /api/admin/experiences/{id}/approve`**

- **Purpose**: Approve experience
- **Authentication**: JWT Bearer token
- **Response**: Success message

**`PUT /api/admin/experiences/{id}/reject`**

- **Purpose**: Reject experience
- **Authentication**: JWT Bearer token
- **Response**: Success message

### API Documentation

- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`
- **OpenAPI JSON**: `/openapi.json`

---

## Database Schema

### Tables

#### `posts`

Stores Reddit post data with vector embeddings.

| Column         | Type        | Description           |
| -------------- | ----------- | --------------------- |
| `id`           | Integer     | Primary key           |
| `post_id`      | String      | Unique Reddit post ID |
| `title`        | String      | Post title            |
| `text`         | Text        | Post text content     |
| `full_text`    | Text        | Full post content     |
| `source`       | String      | Subreddit source      |
| `date`         | String      | Post date             |
| `post_link`    | String      | Reddit URL            |
| `score`        | Integer     | Upvote score          |
| `num_comments` | Integer     | Comment count         |
| `upvote_ratio` | Float       | Upvote ratio          |
| `embedding`    | Vector(384) | Text embedding        |
| `created_at`   | DateTime    | Record creation time  |

#### `comments`

Stores Reddit comments linked to posts.

| Column         | Type        | Description                  |
| -------------- | ----------- | ---------------------------- |
| `id`           | Integer     | Primary key                  |
| `comment_id`   | String      | Unique Reddit comment ID     |
| `text`         | Text        | Comment text                 |
| `date`         | String      | Comment date                 |
| `comment_link` | String      | Reddit URL                   |
| `post_id`      | String      | Foreign key to posts.post_id |
| `embedding`    | Vector(384) | Text embedding               |
| `created_at`   | DateTime    | Record creation time         |

#### `user_experiences`

Stores user-submitted career experiences.

| Column            | Type        | Description                            |
| ----------------- | ----------- | -------------------------------------- |
| `id`              | Integer     | Primary key                            |
| `title`           | String      | Short title/summary                    |
| `text`            | Text        | Experience text (PII-redacted)         |
| `experience_type` | String      | Category (interview, job_search, etc.) |
| `status`          | String      | pending/approved/rejected              |
| `flagged_reason`  | Text        | Validation flags                       |
| `flagged_at`      | DateTime    | When flagged                           |
| `severity`        | String      | critical/medium/low                    |
| `embedding`       | Vector(384) | Text embedding (approved only)         |
| `submitted_at`    | DateTime    | Submission time                        |
| `approved_at`     | DateTime    | Approval time                          |
| `created_at`      | DateTime    | Record creation time                   |

#### `admin_users`

Stores admin account information.

| Column            | Type     | Description           |
| ----------------- | -------- | --------------------- |
| `id`              | Integer  | Primary key           |
| `username`        | String   | Unique username       |
| `email`           | String   | Unique email          |
| `hashed_password` | String   | Bcrypt hash           |
| `created_at`      | DateTime | Account creation time |

### Relationships

```
posts (1) ──< (many) comments
  └─ post_id (FK)

user_experiences (standalone, no FKs)
admin_users (standalone, no FKs)
```

### Indexes

- `posts.post_id`: Unique index
- `comments.comment_id`: Unique index
- `comments.post_id`: Index for joins
- `user_experiences.status`: For filtering pending experiences
- Vector similarity indexes (pgvector)

---

## RAG System Architecture

### Components

1. **Embeddings Model**

   - Model: `sentence-transformers/all-MiniLM-L6-v2`
   - Dimensions: 384
   - Device: CPU
   - Normalization: Enabled

2. **Retriever** (`PgVectorRetriever`)

   - **Search Strategy**: Cosine similarity (`<=>` operator)
   - **Top K**: Configurable (default: 2-3)
   - **Sources**:
     - Reddit posts (with comments)
     - Approved user experiences
   - **Content Truncation**: Max 1500 chars per document
   - **Comment Limit**: Max 3 comments per post

3. **LLM**

   - Provider: Groq
   - Model: `llama-3.1-8b-instant`
   - Context Window: Managed via truncation
   - Chat History: Limited to last 3 messages

4. **RAG Chain**
   - Framework: LangChain
   - Type: Retrieval chain
   - Process:
     1. Generate query embedding
     2. Retrieve relevant documents
     3. Build context with retrieved docs
     4. Generate answer with LLM
     5. Format sources for citation

### Retrieval Process

```python
# 1. Query Embedding
query_embedding = embeddings.embed_query(question)

# 2. Vector Search (SQL)
SELECT * FROM (
    (SELECT ... FROM posts WHERE embedding IS NOT NULL)
    UNION ALL
    (SELECT ... FROM user_experiences
     WHERE embedding IS NOT NULL AND status = 'approved')
) ORDER BY embedding <=> :query_embedding
LIMIT :k

# 3. Document Construction
- Post: Title + Text + Comments (top 3)
- Experience: Title + Text
- Truncate to max_content_length

# 4. Context Building
context = "\n\n".join([doc.page_content for doc in documents])

# 5. LLM Generation
answer = llm.generate(context + question + chat_history)
```

### Embedding Generation

**Pre-computed** (not real-time):

- Posts: Generated during monthly cron job
- Comments: Generated during monthly cron job
- User Experiences: Generated after admin approval

**Real-time**:

- Query embeddings: Generated on each `/ask` request

---

## Content Validation Pipeline

### Validation Flow

```
User Submission
    │
    ▼
Initial Save (status: "pending")
    │
    ▼
Background Validation
    │
    ├─► check_pii()
    │   └─► Redact: [EMAIL], [PHONE], [URL]
    │
    ├─► check_safety()
    │   ├─► Keyword checks (hate, threats, self-harm, illegal)
    │   └─► Toxicity model (roberta_toxicity_classifier)
    │
    ├─► check_spam()
    │   ├─► URL count (2+ = spam)
    │   └─► Promo keywords
    │
    └─► check_relevance()
        ├─► Zero-shot classification (distilbart-mnli)
        └─► Career keyword check
            │
            ▼
Determine Severity & Status
    │
    ├─► Critical (safety) → severity: "critical"
    ├─► Spam → severity: "medium"
    ├─► Off-topic → severity: "low"
    └─► PII only → severity: "medium"
            │
            ▼
Update Database Record
    ├─► cleaned_text
    ├─► status: "pending"
    ├─► severity
    ├─► flagged_reason
    └─► flagged_at
```

### Validation Rules

| Check              | Method        | Threshold    | Action           |
| ------------------ | ------------- | ------------ | ---------------- |
| **PII**            | Regex         | Any match    | Redact & flag    |
| **Toxicity**       | ML Model      | Score ≥ 0.7  | Flag as critical |
| **Hate Speech**    | Keywords      | Any match    | Flag as critical |
| **Threats**        | Keywords      | Any match    | Flag as critical |
| **Self-Harm**      | Keywords      | Any match    | Flag as critical |
| **Illegal Advice** | Keywords      | Any match    | Flag as critical |
| **Spam**           | URL count ≥ 2 | Any match    | Flag as medium   |
| **Relevance**      | ML Model      | Score < 0.45 | Flag as low      |

### Models

**Toxicity Detection**:

- Model: `SkolkovoInstitute/roberta_toxicity_classifier`
- Input: First 512 characters
- Output: Label + confidence score
- Threshold: 0.7

**Relevance Detection**:

- Model: `valhalla/distilbart-mnli-12-3`
- Type: Zero-shot classification
- Labels: Career-related vs. off-topic
- Threshold: 0.45

---

## Authentication & Authorization

### Admin Authentication

**Flow**:

1. Admin registers with username, email, password
2. Password hashed with bcrypt
3. JWT token generated (HS256)
4. Token returned to client
5. Client includes token in `Authorization: Bearer <token>` header

**JWT Configuration**:

- Algorithm: HS256
- Expiration: 60 minutes
- Secret: `ADMIN_JWT_SECRET_KEY` (env var)
- Payload: `{"sub": user_id}`

### Registration Protection

- Optional registration secret: `ADMIN_REGISTRATION_SECRET`
- If set, required for registration
- Prevents unauthorized admin account creation

### Authorization

**Protected Endpoints**:

- All `/api/admin/*` endpoints (except register/login)
- Dependency: `get_current_admin()`
- Validates JWT token
- Retrieves admin user from database

**Public Endpoints**:

- `/ask` (chat)
- `/api/experiences` (submission)

---

## Background Processing

### Scheduled Tasks (Cron)

**1. Data Collection** (`collect_reddit_public.py`)

- **Schedule**: 1st of month, 2:00 AM
- **Purpose**: Collect Reddit posts and comments
- **Output**: Saved to `posts` and `comments` tables

**2. Embedding Generation** (`generate_embeddings.py`)

- **Schedule**: 1st of month, 3:00 AM
- **Purpose**: Generate embeddings for new content
- **Input**: Posts/comments/experiences without embeddings
- **Output**: Embeddings stored in database

### Background Tasks (FastAPI)

**Content Validation** (`run_experience_validation`)

- **Trigger**: After experience submission
- **Type**: FastAPI `BackgroundTasks`
- **Process**: Async validation, updates database
- **Non-blocking**: Returns response immediately

### Task Management

**Cron Configuration**:

- Location: `backend/scripts/cron_scripts/`
- Wrapper scripts: Shell scripts with error handling
- Logs: `backend/logs/cron_*.log`

---

## Deployment Architecture

### Development Environment

```
┌─────────────────┐
│  Next.js Dev    │  :3000
│  (Frontend)     │
└────────┬────────┘
         │
         │ HTTP
         │
┌────────▼────────┐
│  FastAPI Dev    │  :8000
│  (Backend)      │
└────────┬────────┘
         │
         │ SQL
         │
┌────────▼────────┐
│  PostgreSQL     │  :5432
│  (Database)     │
└─────────────────┘
```

### Production Considerations

**Backend**:

- WSGI server: Uvicorn or Gunicorn
- Process manager: systemd or supervisor
- Reverse proxy: Nginx
- Environment variables: `.env` file

**Frontend**:

- Build: `next build`
- Static export or server-side rendering
- CDN for static assets

**Database**:

- Connection pooling
- Backup strategy
- pgvector extension installed
- Index optimization

**Security**:

- HTTPS/TLS
- CORS configuration
- Environment variable management
- Secret rotation
- Rate limiting (future)

**Monitoring**:

- Application logs
- Error tracking
- Performance metrics
- Database monitoring

---

## Key Design Decisions

### 1. RAG Architecture

**Why RAG over fine-tuning?**

- No training data required
- Can update knowledge base without retraining
- Source attribution for transparency
- Lower cost (no model training)

### 2. PostgreSQL + pgvector

**Why not dedicated vector DB?**

- Single database for all data
- Relational queries alongside vector search
- Simpler infrastructure
- ACID guarantees

### 3. Background Validation

**Why async validation?**

- Fast user response time
- Non-blocking API
- Can handle slow ML models
- Better user experience

### 4. Separate User Experiences Table

**Why not reuse Posts table?**

- Different lifecycle (approval workflow)
- Different fields (status, severity, flags)
- Easier admin queries
- Future extensibility

### 5. Pre-computed Embeddings

**Why not generate on-demand?**

- Faster query response
- Consistent embeddings
- Lower compute cost
- Batch processing efficiency

---

## Future Enhancements

### Planned Features

1. **User Accounts**: Track user submissions and history
2. **Feedback System**: Rate answers and improve RAG
3. **Advanced Search**: Filters by category, date, source
4. **Analytics Dashboard**: Usage metrics and insights
5. **Multi-language Support**: Internationalization
6. **Model Fine-tuning**: Custom models for career domain
7. **Real-time Updates**: WebSocket for live chat
8. **Rate Limiting**: Prevent abuse
9. **Caching**: Redis for frequent queries
10. **Monitoring**: APM and error tracking

### Technical Debt

1. **Error Handling**: More comprehensive error responses
2. **Testing**: Expand test coverage
3. **Documentation**: API usage examples
4. **Performance**: Query optimization
5. **Security**: Additional security headers
6. **Scalability**: Horizontal scaling support

---

## Glossary

- **RAG**: Retrieval-Augmented Generation - AI technique combining retrieval and generation
- **Embedding**: Vector representation of text for semantic search
- **pgvector**: PostgreSQL extension for vector similarity search
- **Zero-shot Classification**: ML classification without training data
- **PII**: Personally Identifiable Information
- **JWT**: JSON Web Token - authentication token format
- **CORS**: Cross-Origin Resource Sharing - browser security feature

---

## References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [LangChain Documentation](https://python.langchain.com/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [HuggingFace Transformers](https://huggingface.co/docs/transformers)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Last Updated**: 2024
**Version**: 1.0.0
