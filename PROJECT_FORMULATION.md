# Career Catalyst - The Community-Driven Career Coach

## 🚀 Project Overview

**Career Catalyst** is a comprehensive, data-informed, and community-moderated resource for job seekers and interview candidates. The platform combines user-generated content, external data aggregation, and expert moderation to create a powerful, community-driven career coaching ecosystem.

### Core Concept

Provide job seekers with a trusted platform where they can:

- Share anonymous experiences from job applications and interviews
- Ask questions and receive AI-synthesized responses from both internal experiences and external data
- Access curated, expert-validated career insights
- Track their contributions and see their impact on the community

Enable career coaches to:

- Moderate and curate user-generated content
- Provide expert commentary on synthesized responses
- Access comprehensive data analytics for evidence-based coaching

---

## 1. Core Features & User Stories

### Job Seeker (User) Features

#### Experience Submission

**User Story:** As a user, I can create an account and share my detailed, anonymous experiences (successes and failures) from job applications and interviews, categorized by:

- Company name
- Role/Job title
- Industry
- Topic/Theme (e.g., 'Salary Negotiation', 'Technical Interview', 'Culture Fit', 'Rejection Feedback')
- Interview stage (Phone, Technical, Final, etc.)
- Outcome (Offer, Rejection, Withdrew, etc.)
- Location
- Date

**UI Inspiration:** Similar to health assessment flow - guided form with conversational interface

#### Q&A/Search Interface

**User Story:** As a user, I can ask a question (e.g., "What is it like to interview at Company X for a Data Scientist role?") and receive responses synthesized from:

- Internal user-submitted experiences
- External scraped data (Glassdoor, Reddit, forums)
- Expert-curated insights from career coaches

**UI Inspiration:** Chat interface similar to myhealthpal - conversational Q&A with AI-powered responses

#### Personal Dashboard

**User Story:** As a user, I can:

- Track my submitted experiences
- See view counts and engagement metrics for my contributions
- View how many others have benefited from my submissions
- Access my saved questions and responses
- Review my interaction history

**UI Inspiration:** Clean dashboard with metrics and activity feed

### Career Coach/Moderator Features

#### Moderation Queue

**User Story:** As a coach, I can:

- Review new user-submitted experiences in a dedicated queue
- See sentiment analysis flags for potentially inappropriate content
- Approve experiences (making them public)
- Reject or request revisions (keeping them private)
- Add moderation notes and tags

**UI Inspiration:** Admin panel with list view and detail modals

#### Expert Response/Curate

**User Story:** As a coach, I can:

- Review synthesized responses to user questions
- Add professional commentary and insights
- Highlight the most relevant data points
- Create premium-tier curated responses
- Flag important trends or patterns

**UI Inspiration:** Editor interface with rich text and annotation tools

### System/Admin Features

#### Data Aggregation Engine

**User Story:** The system automatically:

- Scrapes/ingests public data from external sources:
  - Glassdoor reviews and interview experiences
  - Reddit threads (r/cscareerquestions, r/jobs, etc.)
  - Professional forums and communities
  - Career blogs and articles
- Configures scraping based on:
  - Keywords (job titles, companies, topics)
  - Companies (whitelist/blacklist)
  - Roles and industries
  - Date ranges
- Stores raw data for processing
- Runs on scheduled intervals or triggered events

#### Sentiment/Tone Analysis

**User Story:** The system automatically:

- Runs tone analysis on all new submissions (user-generated and scraped)
- Flags potentially toxic, misleading, or highly emotional content
- Assigns sentiment scores (positive, negative, neutral)
- Detects toxicity levels
- Routes flagged content to moderation queue for coach review
- Provides confidence scores for automated decisions

---

## 2. Technology Stack

### Frontend (Client-Side)

- **React** - Single Page Application (SPA) for dynamic, interactive user experience
- **Tailwind CSS or Chakra UI** - Rapid, responsive styling
- **State Management** - React Context API or Zustand for global state
- **HTTP Client** - Axios or Fetch API for API communication
- **UI Components** - Custom components inspired by health app design (chat interface, assessment forms, dashboards)

### Backend (Server-Side/API)

- **Python FastAPI** - Modern, fast web framework for building APIs
  - Async support for handling concurrent requests
  - Automatic API documentation (OpenAPI/Swagger)
  - Type hints and validation with Pydantic
  - Excellent integration with data processing pipelines

### Database

- **PostgreSQL** - Relational database for structured data:
  - User accounts and authentication
  - Experience submissions
  - Moderation logs
  - User interactions and analytics
  - Coach profiles and credentials
- **Prisma ORM** - Type-safe database access and migrations
  - Schema management
  - Query builder
  - Migration system
  - TypeScript/Python type generation

### Data/NLP Pipeline

#### Web Scraping

- **Python Libraries:**
  - **BeautifulSoup + Requests** - For simpler scraping tasks
  - **Scrapy** - Full-featured, scalable web crawler framework
  - **Selenium/Playwright** - For JavaScript-heavy sites
- **Third-party Services (Optional):**
  - ScrapingBee or Bright Data - Handle anti-bot measures ethically
  - Respect robots.txt and rate limiting

#### Sentiment/Tone Analysis

- **Python Libraries:**
  - **NLTK** - Natural Language Toolkit for text processing
  - **TextBlob** - Simple sentiment analysis
  - **Hugging Face Transformers** - Pre-trained BERT-based models for:
    - Sentiment analysis
    - Toxicity detection
    - Emotion classification
- **Deployment:** Microservice or background worker

#### Q&A Generation/Synthesis (RAG)

- **Framework:** LangChain - Retrieval-Augmented Generation
- **Components:**
  - Vector Database: PGvector (PostgreSQL extension), Pinecone, or Chroma
  - Embeddings: OpenAI embeddings or open-source alternatives (sentence-transformers)
  - LLM: OpenAI GPT, Anthropic Claude, or open-source (Llama 2, Mistral)
- **Process:**
  1. Convert user question to embedding
  2. Retrieve relevant experiences from vector database
  3. Augment LLM prompt with retrieved context
  4. Generate synthesized, sourced response

### Additional Infrastructure

- **Task Queue:** Celery with Redis/RabbitMQ - For async background jobs (scraping, NLP processing)
- **Caching:** Redis - For frequently accessed data and session management
- **File Storage:** AWS S3 or similar - For storing attachments, documents
- **Authentication:** JWT tokens or OAuth 2.0
- **API Rate Limiting:** FastAPI middleware or Redis-based rate limiting

---

## 3. System Architecture

### Architecture Approach: Modular Monolith → Microservices

**Initial Phase:** Modular Monolith

- Single codebase with clear module boundaries
- Easier development and deployment
- Lower operational complexity
- Suitable for MVP and early stages

**Future Phase:** Microservices (for data pipeline)

- Separate services for:
  - Scraping Worker
  - NLP/AI Worker
  - Q&A/RAG Service
- Better scalability and independent deployment

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React SPA)                      │
│  - User Interface (Chat, Forms, Dashboard)                  │
│  - State Management                                          │
│  - API Client                                                │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST API
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Backend API (FastAPI)                           │
│  ┌────────────────────────────────────────────────────┐    │
│  │  User/Auth Service                                  │    │
│  │  - Registration, Login, JWT                         │    │
│  │  - Profile Management                               │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Content Service                                    │    │
│  │  - CRUD for User Experiences                        │    │
│  │  - Moderation Actions                               │    │
│  │  - Q&A Request Handling                             │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Scraped Data Service                               │    │
│  │  - Access to processed external data                │    │
│  │  - Search and filtering                             │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌────▼──────────┐
│  PostgreSQL  │ │   Redis    │ │  Vector DB    │
│  (Prisma)    │ │  (Cache/   │ │  (PGvector/   │
│              │ │   Queue)   │ │   Pinecone)   │
└──────────────┘ └────────────┘ └───────────────┘

┌─────────────────────────────────────────────────────────────┐
│         Data Processing Layer (Background Workers)           │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Scraping Worker (Celery)                          │    │
│  │  - Periodic scraping from external sources         │    │
│  │  - Data extraction and normalization               │    │
│  │  - Stores in PostgreSQL/NoSQL                      │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  NLP/AI Worker (Celery)                            │    │
│  │  - Sentiment/Tone Analysis                         │    │
│  │  - Toxicity Detection                              │    │
│  │  - Text Embedding Generation                       │    │
│  │  - Vector Database Indexing                        │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Q&A/RAG Service                                    │    │
│  │  - Question Embedding                              │    │
│  │  - Vector Similarity Search                        │    │
│  │  - LLM Response Generation                         │    │
│  │  - Source Attribution                              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Components

#### 1. Frontend (React SPA)

- **Chat Interface:** Similar to myhealthpal - conversational Q&A with message bubbles
- **Assessment/Form Interface:** Guided experience submission with step-by-step flow
- **Dashboard:** Personal metrics, activity feed, saved content
- **Moderation Panel:** Queue view for coaches with filtering and actions

#### 2. Backend API (FastAPI)

- **RESTful API** endpoints for all frontend interactions
- **Authentication Middleware:** JWT token validation
- **Rate Limiting:** Prevent abuse and ensure fair usage
- **Request Validation:** Pydantic models for type safety
- **Error Handling:** Consistent error responses

#### 3. Database Layer

- **PostgreSQL (Prisma):**
  - Users, Experiences, Moderation Logs
  - Questions, Responses, Coach Comments
  - Analytics and Metrics
- **Vector Database:**
  - Embedded experience texts for semantic search
  - Fast similarity queries for RAG

#### 4. Data Processing (Asynchronous)

- **Celery Workers:**
  - Scraping tasks (scheduled or triggered)
  - NLP processing (sentiment, embeddings)
  - Background jobs don't block API responses
- **Task Queue (Redis/RabbitMQ):**
  - Reliable job distribution
  - Retry mechanisms for failed tasks
  - Priority queues for urgent processing

### Key Architectural Considerations

#### Asynchronous Tasks

- Scraping and NLP analysis are long-running jobs
- Use Celery with Redis/RabbitMQ for background processing
- Keep main API fast and responsive
- Provide job status endpoints for tracking

#### Security

- **Authentication:** Secure JWT implementation
- **Authorization:** Role-based access control (User, Coach, Admin)
- **Data Protection:** Encrypt sensitive user data
- **API Security:** Rate limiting, CORS, input validation
- **Anonymization:** Ensure user experiences remain anonymous

#### Data Governance

- **Ethical Scraping:** Respect robots.txt and terms of service
- **Rate Limiting:** Don't overwhelm target websites
- **Data Attribution:** Track sources for transparency
- **Privacy Compliance:** GDPR, CCPA compliance
- **Content Moderation:** Clear guidelines and processes

#### Scalability

- **Read/Write Separation:** Separate read-heavy Q&A from write-heavy submissions
- **Caching Strategy:** Redis for frequently accessed data
- **Database Indexing:** Optimize queries with proper indexes
- **Horizontal Scaling:** Stateless API allows multiple instances
- **CDN:** Serve static assets efficiently

#### Performance

- **API Response Times:** < 200ms for standard requests
- **Q&A Generation:** < 5 seconds for synthesized responses
- **Background Processing:** Process in batches, not blocking
- **Database Optimization:** Connection pooling, query optimization

---

## 4. UI/UX Design Inspiration

### Design Principles (Inspired by myhealthpal)

- **Clean, Modern Interface:** White background with blue accent colors
- **Conversational Experience:** Chat-like interface for Q&A
- **Guided Flows:** Step-by-step assessment forms for experience submission
- **Visual Hierarchy:** Clear navigation, prominent CTAs
- **Accessibility:** WCAG compliant, keyboard navigation

### Key UI Components

#### 1. Landing/Home Page

- Hero section with platform value proposition
- Two main CTAs:
  - "Start Assessment" - Begin experience submission
  - "Ask Career Question" - Open Q&A chat interface
- Trust indicators and statistics

#### 2. Chat Interface (Q&A)

- Left side: Animated character or illustration (career-themed)
- Right side: Chat window with message bubbles
- User messages: Blue bubbles on right
- System/AI responses: White bubbles on left
- Coach responses: Highlighted with expert badge
- "Start Recording" button for voice input (future feature)
- Timestamp for each message

#### 3. Experience Submission Form

- Multi-step guided form
- Conversational tone
- Progress indicator
- Field validation with helpful error messages
- Preview before submission
- Anonymous submission toggle

#### 4. Personal Dashboard

- Statistics cards (experiences shared, views, helpful votes)
- Recent activity feed
- Saved questions and responses
- Contribution impact metrics
- Quick actions (submit new experience, ask question)

#### 5. Moderation Queue (Coach View)

- List view of pending submissions
- Sentiment flags and risk indicators
- Quick actions (approve, reject, request revision)
- Detail view with full experience text
- Moderation history and notes

---

## 5. Data Models (Prisma Schema Overview)

### Core Entities

```prisma
// User Management
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  role          Role     @default(USER)
  createdAt     DateTime @default(now())
  profile       UserProfile?
  experiences   Experience[]
  questions     Question[]
}

model UserProfile {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  industry  String?
  location  String?
  isAnonymous Boolean @default(true)
}

enum Role {
  USER
  COACH
  ADMIN
}

// Experience Submission
model Experience {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  company       String?
  role          String?
  industry      String?
  topic         String
  stage         String?
  outcome       String?
  content       String
  isAnonymous   Boolean  @default(true)
  status        ExperienceStatus @default(PENDING)
  sentimentScore Float?
  toxicityScore  Float?
  createdAt     DateTime @default(now())
  approvedAt    DateTime?
  moderatorId   String?
  views         Int      @default(0)
  helpfulVotes  Int      @default(0)
  moderationLog ModerationLog?
  embeddings    Embedding[]
}

enum ExperienceStatus {
  PENDING
  APPROVED
  REJECTED
  REVISION_REQUESTED
}

// Moderation
model ModerationLog {
  id            String   @id @default(uuid())
  experienceId  String   @unique
  experience    Experience @relation(fields: [experienceId], references: [id])
  moderatorId   String
  action        ModerationAction
  notes         String?
  createdAt     DateTime @default(now())
}

enum ModerationAction {
  APPROVED
  REJECTED
  REVISION_REQUESTED
}

// Q&A System
model Question {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
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
  isExpertCurated Boolean @default(false)
  coachId       String?
  createdAt     DateTime @default(now())
}

enum SourceType {
  USER_EXPERIENCE
  SCRAPED_DATA
  SYNTHESIZED
  EXPERT_COMMENTARY
}

model ResponseSource {
  id         String   @id @default(uuid())
  responseId String
  response   Response @relation(fields: [responseId], references: [id])
  sourceId   String
  sourceType String
  relevanceScore Float?
}

// Scraped Data
model ScrapedContent {
  id            String   @id @default(uuid())
  source        String
  url           String?
  content       String
  company       String?
  role          String?
  industry      String?
  scrapedAt     DateTime @default(now())
  processedAt   DateTime?
  sentimentScore Float?
  toxicityScore  Float?
  embeddings    Embedding[]
}

// Vector Embeddings
model Embedding {
  id            String   @id @default(uuid())
  experienceId  String?
  experience    Experience? @relation(fields: [experienceId], references: [id])
  scrapedContentId String?
  scrapedContent ScrapedContent? @relation(fields: [scrapedContentId], references: [id])
  vector        Json     // Store embedding vector
  createdAt     DateTime @default(now())
}
```

---

## 6. API Endpoints (FastAPI)

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns JWT)
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user profile

### Experiences

- `POST /api/experiences` - Submit new experience
- `GET /api/experiences` - List experiences (with filters)
- `GET /api/experiences/{id}` - Get experience details
- `PUT /api/experiences/{id}` - Update experience (own only)
- `DELETE /api/experiences/{id}` - Delete experience (own only)
- `GET /api/experiences/my` - Get user's own experiences
- `POST /api/experiences/{id}/helpful` - Mark as helpful

### Q&A

- `POST /api/questions` - Ask a question
- `GET /api/questions` - List questions (with filters)
- `GET /api/questions/{id}` - Get question and responses
- `GET /api/questions/my` - Get user's own questions
- `POST /api/questions/{id}/responses` - Generate/get response

### Moderation (Coach/Admin)

- `GET /api/moderation/queue` - Get moderation queue
- `POST /api/moderation/experiences/{id}/approve` - Approve experience
- `POST /api/moderation/experiences/{id}/reject` - Reject experience
- `POST /api/moderation/experiences/{id}/request-revision` - Request revision
- `POST /api/moderation/responses/{id}/curate` - Add expert commentary

### Dashboard

- `GET /api/dashboard/stats` - Get user statistics
- `GET /api/dashboard/activity` - Get recent activity
- `GET /api/dashboard/contributions` - Get contribution metrics

### Admin/System

- `POST /api/admin/scraping/trigger` - Manually trigger scraping job
- `GET /api/admin/scraping/status` - Get scraping job status
- `GET /api/admin/analytics` - Platform analytics

---

## 7. Development Roadmap

### Phase 1: MVP (Minimum Viable Product)

**Duration:** 8-12 weeks

#### Week 1-2: Project Setup

- Initialize React frontend with Vite
- Set up FastAPI backend
- Configure PostgreSQL database with Prisma
- Set up development environment and tooling
- Basic authentication system

#### Week 3-4: Core User Features

- User registration and login
- Experience submission form
- Basic experience listing
- Personal dashboard (basic stats)

#### Week 5-6: Q&A System

- Question submission
- Basic response generation (simple keyword matching)
- Chat interface UI
- Response display

#### Week 7-8: Moderation System

- Moderation queue for coaches
- Approve/reject functionality
- Basic sentiment analysis integration
- Coach role and permissions

#### Week 9-10: Data Aggregation (Basic)

- Simple web scraper for one source (e.g., Reddit)
- Data storage and basic processing
- Integration with experience database

#### Week 11-12: Polish & Testing

- UI/UX refinements
- Error handling and validation
- Basic testing
- Deployment preparation

### Phase 2: Enhanced Features

**Duration:** 6-8 weeks

- Advanced RAG implementation for Q&A
- Multiple scraping sources
- Advanced sentiment analysis
- Vector database integration
- Expert curation features
- Enhanced analytics

### Phase 3: Scale & Optimize

**Duration:** Ongoing

- Performance optimization
- Advanced caching strategies
- Microservices migration (if needed)
- Mobile app (optional)
- Advanced AI features
- Community features (comments, discussions)

---

## 8. Key Questions for Refinement

### Content & Moderation

1. What specific topics/categories should experiences be organized into?
2. Should there be a minimum word count or quality threshold for experiences?
3. How should duplicate or very similar experiences be handled?
4. What level of detail is required for moderation notes?
5. Should coaches be able to edit user experiences or only comment?

### Q&A & RAG

1. What is the maximum number of sources to include in a synthesized response?
2. How should conflicting information from different sources be handled?
3. Should responses include direct quotes or only summaries?
4. What is the target response length (short, medium, detailed)?
5. How to handle questions about very specific companies/roles with limited data?

### Scraping & Data

1. Which sources should be prioritized for initial scraping?
2. How frequently should each source be scraped?
3. What is the data retention policy (how long to keep scraped content)?
4. How to handle source attribution and links?
5. What legal disclaimers are needed for scraped content?

### User Experience

1. Should users be able to edit their submitted experiences after approval?
2. Can users delete their experiences, and what happens to associated data?
3. Should there be a reputation/points system for contributors?
4. How should users discover relevant experiences (search, recommendations, trending)?
5. Should there be notifications for new responses to questions?

### Business Model

1. Will the platform be free, freemium, or subscription-based?
2. What features should be premium/paid?
3. How are career coaches compensated?
4. Are there partnership opportunities with job boards or companies?
5. What is the monetization strategy?

### Technical

1. What are the expected user volumes (concurrent users, daily active users)?
2. What is the target uptime/SLA?
3. What backup and disaster recovery procedures are needed?
4. How to handle GDPR right-to-deletion requests?
5. What monitoring and logging infrastructure is needed?

---

## 9. Success Metrics

### User Engagement

- Number of registered users
- Daily/Monthly Active Users (DAU/MAU)
- Experiences submitted per day/week
- Questions asked per day/week
- Average session duration
- Return user rate

### Content Quality

- Approval rate of submitted experiences
- Average sentiment score of approved content
- Number of helpful votes per experience
- Coach satisfaction with moderation tools
- Response quality ratings

### Platform Health

- API response times
- System uptime
- Error rates
- Background job success rates
- Database query performance

### Business Metrics

- User acquisition cost
- User retention rate
- Premium conversion rate (if applicable)
- Coach engagement and activity
- Data freshness (time since last scrape)

---

## 10. Potential Challenges & Solutions

### Challenge 1: Data Quality & Accuracy

**Problem:** Ensuring scraped and user-submitted data is accurate and relevant
**Solutions:**

- Multi-layer moderation (automated + human)
- Source verification and credibility scoring
- User reporting mechanism for inaccurate content
- Regular data audits and cleanup

### Challenge 2: Legal & Ethical Scraping

**Problem:** Web scraping may violate terms of service or legal restrictions
**Solutions:**

- Respect robots.txt and rate limits
- Use official APIs where available
- Consider third-party data providers
- Legal review of scraping practices
- Clear attribution and disclaimers

### Challenge 3: Bias in Data & Responses

**Problem:** Data may reflect biases (gender, race, location, etc.)
**Solutions:**

- Diverse data sources
- Bias detection in NLP models
- Transparent about data limitations
- Encourage diverse user contributions
- Regular bias audits

### Challenge 4: Scalability of RAG System

**Problem:** Q&A generation may be slow or expensive at scale
**Solutions:**

- Caching frequently asked questions
- Optimize vector search (approximate nearest neighbor)
- Batch processing where possible
- Consider cost-effective LLM options
- Progressive loading of responses

### Challenge 5: Content Moderation at Scale

**Problem:** Manual moderation doesn't scale with user growth
**Solutions:**

- Automated pre-filtering with high confidence
- Priority queue for high-risk content
- Community moderation (user reporting)
- Machine learning models improve over time
- Clear guidelines reduce edge cases

---

## 11. Next Steps

1. **Finalize Requirements:** Answer key questions above
2. **Design Database Schema:** Complete Prisma schema with all relationships
3. **Create Wireframes:** Design key UI screens (chat, forms, dashboard)
4. **Set Up Development Environment:** Initialize repositories, CI/CD
5. **Build MVP:** Follow Phase 1 roadmap
6. **User Testing:** Gather feedback from early users
7. **Iterate:** Refine based on feedback and metrics

---

## 12. Resources & References

### Documentation

- FastAPI: https://fastapi.tiangolo.com/
- Prisma: https://www.prisma.io/docs
- React: https://react.dev/
- LangChain: https://python.langchain.com/
- Hugging Face: https://huggingface.co/

### Inspiration

- myhealthpal UI/UX patterns
- Glassdoor (data aggregation)
- Reddit (community moderation)
- ChatGPT (conversational interface)

---

**Project Status:** Formulation Complete - Ready for Development Planning
