# Career Catalyst - MVP Product Specification
## Data Aggregation & RAG Chat Interface

---

## 🎯 MVP Scope

This MVP focuses on two core features:

1. **Data Aggregation System** - Automatically collect and process career-related data from external sources
2. **RAG Chat Interface** - Conversational Q&A system that retrieves and synthesizes information using Retrieval-Augmented Generation

---

## 1. Data Aggregation System

### Overview

The system automatically scrapes and ingests public career-related data from external sources to build a comprehensive knowledge base for answering user questions.

### Data Sources

#### Primary Sources (MVP)

1. **Reddit**
   - Subreddits: `r/cscareerquestions`, `r/jobs`, `r/ExperiencedDevs`, `r/ITCareerQuestions`
   - Content types: Interview experiences, salary discussions, company reviews
   - Keywords: Job titles, company names, interview topics

2. **Glassdoor** (if accessible)
   - Interview reviews
   - Company reviews
   - Salary information

3. **Career Forums** (optional for MVP)
   - Blind (if accessible)
   - Industry-specific forums

### Data Collection Process

#### Scraping Configuration

```python
# Example scraping configuration
scraping_config = {
    "sources": [
        {
            "name": "reddit",
            "subreddits": ["cscareerquestions", "jobs", "ExperiencedDevs"],
            "keywords": ["interview", "salary", "offer", "rejection"],
            "date_range": "last_30_days",
            "frequency": "daily"
        }
    ],
    "filters": {
        "min_upvotes": 5,  # Quality threshold
        "min_comments": 3,
        "exclude_keywords": ["spam", "off-topic"]
    }
}
```

#### Scraping Workflow

1. **Scheduled Jobs** (Celery)
   - Daily scraping runs at off-peak hours
   - Configurable intervals per source
   - Respect rate limits and robots.txt

2. **Data Extraction**
   - Extract relevant fields:
     - Title/Subject
     - Content/Body
     - Company name (if mentioned)
     - Job title/role (if mentioned)
     - Date posted
     - Source URL
     - Metadata (upvotes, comments, etc.)

3. **Data Normalization**
   - Standardize company names
   - Extract and categorize job titles
   - Identify topics/themes
   - Clean and format text

4. **Storage**
   - Store raw data in PostgreSQL (`ScrapedContent` table)
   - Track scraping metadata (timestamp, source, status)

### Data Processing Pipeline

#### Step 1: Sentiment Analysis

- Analyze tone and sentiment of scraped content
- Assign sentiment scores (positive, negative, neutral)
- Flag potentially toxic or inappropriate content
- Store scores in database

#### Step 2: Text Embedding

- Generate vector embeddings for all scraped content
- Use sentence transformers or OpenAI embeddings
- Store embeddings in vector database (PGvector or Pinecone)

#### Step 3: Indexing

- Index content for fast retrieval
- Create metadata indexes (company, role, topic, date)
- Enable semantic search capabilities

### Technical Implementation

#### Libraries & Tools

- **Scrapy** or **BeautifulSoup + Requests** - Web scraping
- **Selenium/Playwright** - For JavaScript-heavy sites
- **Celery** - Background task processing
- **Redis** - Task queue and caching
- **PostgreSQL** - Data storage
- **PGvector** or **Pinecone** - Vector database for embeddings

#### Data Model

```prisma
model ScrapedContent {
  id            String   @id @default(uuid())
  source        String   // "reddit", "glassdoor", etc.
  url           String?  @unique
  title         String?
  content       String
  company       String?
  role          String?
  industry      String?
  topic         String?
  scrapedAt     DateTime @default(now())
  processedAt   DateTime?
  sentimentScore Float?
  toxicityScore  Float?
  metadata      Json?    // Store additional source-specific data
  embeddings    Embedding[]
  createdAt     DateTime @default(now())
}

model Embedding {
  id              String   @id @default(uuid())
  scrapedContentId String?
  scrapedContent  ScrapedContent? @relation(fields: [scrapedContentId], references: [id])
  vector          Json     // Store embedding vector
  model           String   // Embedding model used
  createdAt       DateTime @default(now())
}
```

#### API Endpoints

- `POST /api/admin/scraping/trigger` - Manually trigger scraping job
- `GET /api/admin/scraping/status` - Get scraping job status
- `GET /api/admin/scraping/history` - View scraping history
- `GET /api/admin/scraped-content` - List scraped content (with filters)

---

## 2. RAG Chat Interface

### Overview

A conversational chat interface where users can ask career-related questions and receive AI-generated responses synthesized from:
- Scraped external data
- User-submitted experiences (if available in MVP)
- General knowledge

### User Experience

#### Chat Interface Design

- **Layout**: Clean, modern chat interface
  - Left side: Chat history with message bubbles
  - Right side: Optional sidebar with related resources
  - Input field at bottom with send button

- **Message Types**:
  - User messages: Blue bubbles, right-aligned
  - AI responses: White/gray bubbles, left-aligned
  - Loading indicators during response generation
  - Source citations in responses

- **Features**:
  - Real-time typing indicators
  - Message timestamps
  - Copy message functionality
  - Regenerate response option
  - Show sources toggle

### RAG (Retrieval-Augmented Generation) Process

#### Step 1: Question Processing

1. User submits question via chat interface
2. Question is sent to backend API
3. Question is preprocessed and normalized

#### Step 2: Retrieval

1. **Question Embedding**
   - Convert user question to vector embedding
   - Use same embedding model as content indexing

2. **Vector Similarity Search**
   - Search vector database for similar content
   - Retrieve top K most relevant documents (e.g., top 5-10)
   - Calculate similarity scores

3. **Metadata Filtering** (optional)
   - Filter by company, role, topic if mentioned in question
   - Apply date filters if relevant
   - Filter by source type

4. **Ranking & Selection**
   - Combine similarity scores with metadata relevance
   - Select most relevant chunks for context
   - Limit context window size

#### Step 3: Response Generation

1. **Context Assembly**
   - Combine retrieved documents into context
   - Format with clear source attribution
   - Include metadata (source, date, relevance score)

2. **LLM Prompt Construction**
   ```
   You are a helpful career advisor. Answer the user's question based on the
   following context from real experiences and discussions:

   [Retrieved Context with Sources]

   Question: {user_question}

   Instructions:
   - Synthesize information from multiple sources
   - Be specific and cite sources
   - If information conflicts, mention both perspectives
   - If insufficient data, say so clearly
   - Keep response concise but informative
   ```

3. **LLM Generation**
   - Send prompt to LLM (OpenAI GPT, Claude, or open-source)
   - Generate response with source citations
   - Stream response back to frontend (optional)

4. **Post-Processing**
   - Format response with proper citations
   - Extract and highlight key points
   - Add source links if available

#### Step 4: Response Delivery

1. Stream or return complete response to frontend
2. Display in chat interface
3. Show source citations as expandable sections
4. Store question and response in database

### Technical Implementation

#### RAG Stack

- **Framework**: LangChain
- **Vector Database**: PGvector (PostgreSQL extension) or Pinecone
- **Embeddings**:
  - OpenAI `text-embedding-ada-002` or
  - Open-source: `sentence-transformers/all-MiniLM-L6-v2`
- **LLM**:
  - OpenAI GPT-4 or GPT-3.5-turbo (recommended for MVP)
  - Alternative: Anthropic Claude, or open-source (Llama 2, Mistral)

#### Data Model

```prisma
model Question {
  id            String   @id @default(uuid())
  userId        String?  // Optional for MVP (can be anonymous)
  questionText  String
  createdAt     DateTime @default(now())
  responses     Response[]
}

model Response {
  id            String   @id @default(uuid())
  questionId    String
  question      Question @relation(fields: [questionId], references: [id])
  content       String
  sourceType    SourceType
  sources       ResponseSource[]
  createdAt     DateTime @default(now())
  metadata      Json?    // Store generation metadata
}

enum SourceType {
  SCRAPED_DATA
  SYNTHESIZED
}

model ResponseSource {
  id             String   @id @default(uuid())
  responseId     String
  response       Response @relation(fields: [responseId], references: [id])
  sourceId       String   // ID of ScrapedContent
  sourceType     String   // "scraped_content"
  relevanceScore Float?
  excerpt        String?  // Relevant excerpt from source
}
```

#### API Endpoints

- `POST /api/questions` - Submit a question
  ```json
  {
    "questionText": "What is it like to interview at Google for a Software Engineer role?",
    "userId": "optional-user-id"
  }
  ```

- `POST /api/questions/{id}/generate-response` - Generate RAG response
  - Triggers retrieval and generation process
  - Returns response with sources

- `GET /api/questions/{id}` - Get question and response
  ```json
  {
    "id": "question-id",
    "questionText": "...",
    "response": {
      "content": "...",
      "sources": [
        {
          "id": "source-id",
          "excerpt": "...",
          "relevanceScore": 0.85,
          "sourceUrl": "..."
        }
      ]
    }
  }
  ```

- `GET /api/questions` - List questions (optional for MVP)

#### Response Format

```json
{
  "response": {
    "id": "response-id",
    "content": "Based on recent discussions and experiences...",
    "sources": [
      {
        "id": "source-1",
        "title": "Reddit post title",
        "excerpt": "Relevant excerpt...",
        "source": "reddit",
        "url": "https://...",
        "relevanceScore": 0.92,
        "date": "2024-01-15"
      }
    ],
    "generatedAt": "2024-01-20T10:30:00Z"
  }
}
```

---

## 3. System Architecture (MVP)

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  - Chat Interface Component                                 │
│  - Message Display                                          │
│  - Question Input                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST API
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Backend API (FastAPI)                           │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Question Service                                  │    │
│  │  - POST /api/questions                             │    │
│  │  - Question processing                             │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  RAG Service                                       │    │
│  │  - Question embedding                              │    │
│  │  - Vector similarity search                        │    │
│  │  - LLM response generation                         │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Scraped Data Service                              │    │
│  │  - Access scraped content                          │    │
│  │  - Search and filtering                            │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌────▼──────────┐
│  PostgreSQL  │ │   Redis    │ │  Vector DB    │
│  (Prisma)    │ │  (Cache/   │ │  (PGvector/   │
│              │ │   Queue)   │ │   Pinecone)   │
│  - Questions │ │            │ │  - Embeddings │
│  - Responses │ │            │ │  - Similarity │
│  - Scraped   │ │            │ │    Search     │
│    Content   │ │            │ │               │
└──────────────┘ └────────────┘ └───────────────┘

┌─────────────────────────────────────────────────────────────┐
│         Background Workers (Celery)                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Scraping Worker                                   │    │
│  │  - Scheduled scraping jobs                         │    │
│  │  - Data extraction and normalization               │    │
│  │  - Store in PostgreSQL                             │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  NLP Worker                                        │    │
│  │  - Sentiment analysis                              │    │
│  │  - Text embedding generation                       │    │
│  │  - Vector database indexing                        │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Key Workflows

#### Workflow 1: Data Aggregation

1. Celery scheduler triggers scraping job
2. Scraping worker fetches data from configured sources
3. Raw data stored in PostgreSQL
4. NLP worker processes new content:
   - Sentiment analysis
   - Generate embeddings
   - Index in vector database
5. Content available for RAG retrieval

#### Workflow 2: User Question → RAG Response

1. User submits question via chat interface
2. Frontend sends POST request to `/api/questions`
3. Backend stores question
4. RAG service:
   - Embeds question
   - Searches vector database
   - Retrieves relevant documents
   - Constructs LLM prompt
   - Generates response
5. Response returned to frontend
6. Display in chat interface with sources

---

## 4. Technology Stack (MVP)

### Backend

- **FastAPI** - REST API framework
- **Python 3.10+** - Programming language
- **Prisma** - Database ORM
- **PostgreSQL** - Primary database
- **PGvector** - Vector database extension (or Pinecone)
- **Celery** - Background task processing
- **Redis** - Task queue and caching
- **LangChain** - RAG framework
- **OpenAI API** - LLM and embeddings (or alternatives)

### Frontend

- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **React Query** (optional) - Data fetching and caching

### Scraping

- **Scrapy** or **BeautifulSoup + Requests** - Web scraping
- **Selenium/Playwright** - JavaScript rendering (if needed)

### NLP/AI

- **sentence-transformers** or **OpenAI embeddings** - Text embeddings
- **Hugging Face Transformers** (optional) - Sentiment analysis
- **OpenAI GPT** or **Anthropic Claude** - LLM for generation

---

## 5. MVP Development Roadmap

### Phase 1: Data Aggregation (Weeks 1-3)

**Week 1: Setup & Basic Scraping**
- Set up project structure
- Configure PostgreSQL with Prisma
- Set up Celery with Redis
- Implement basic Reddit scraper
- Store scraped data in database

**Week 2: Data Processing**
- Implement sentiment analysis
- Set up vector database (PGvector or Pinecone)
- Generate embeddings for scraped content
- Index content in vector database

**Week 3: Automation & Testing**
- Schedule scraping jobs
- Error handling and retries
- Data quality checks
- Basic monitoring

### Phase 2: RAG Chat Interface (Weeks 4-6)

**Week 4: Backend RAG Service**
- Implement question embedding
- Vector similarity search
- LLM integration (OpenAI/Claude)
- Response generation with sources
- API endpoints

**Week 5: Frontend Chat Interface**
- React chat component
- Message display
- Question input
- API integration
- Loading states

**Week 6: Integration & Polish**
- Connect frontend to backend
- Source citation display
- Error handling
- UI/UX refinements
- Basic testing

### Phase 3: MVP Polish (Week 7-8)

- Performance optimization
- Caching strategies
- Error handling improvements
- Documentation
- Deployment preparation

---

## 6. Success Criteria

### Data Aggregation

- ✅ Successfully scrape from at least 2 sources (Reddit + one other)
- ✅ Process and index at least 1,000 pieces of content
- ✅ Daily automated scraping runs without errors
- ✅ Content is searchable via vector similarity

### RAG Chat

- ✅ Users can ask questions via chat interface
- ✅ Responses are generated within 5 seconds
- ✅ Responses include relevant source citations
- ✅ At least 70% of responses are relevant and helpful
- ✅ System handles questions with no relevant data gracefully

### Technical

- ✅ API response times < 200ms (excluding RAG generation)
- ✅ RAG response generation < 5 seconds
- ✅ System handles 10+ concurrent users
- ✅ Error rate < 1%

---

## 7. Key Considerations

### Data Quality

- Implement quality filters (minimum upvotes, relevance checks)
- Regular data validation and cleanup
- Monitor scraping success rates

### Rate Limiting

- Respect source website rate limits
- Implement delays between requests
- Use proxies if necessary (ethically)

### Legal & Ethical

- Respect robots.txt
- Follow terms of service
- Proper attribution of sources
- Consider data retention policies

### Cost Management

- Monitor LLM API costs
- Implement caching for common questions
- Optimize embedding generation (batch processing)
- Consider cost-effective LLM options

### Scalability

- Design for horizontal scaling
- Use connection pooling
- Implement caching layers
- Monitor resource usage

---

## 8. Future Enhancements (Post-MVP)

- User authentication and personalization
- User-submitted experiences integration
- Advanced filtering and search
- Multi-turn conversations
- Response quality ratings
- Analytics dashboard
- Additional data sources
- Real-time streaming responses
- Voice input support

---

**MVP Status:** Ready for Development

