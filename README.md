# 🚀 404ella - Your AI-Powered Tech Career Advisor

> **Get instant, personalized career advice for technology professionals powered by real experiences from thousands of developers, engineers, and tech workers.**

404ella is an intelligent career advice platform **exclusively focused on technology careers** that combines the wisdom of Reddit communities with cutting-edge AI to help you navigate your tech career journey. Ask any technology career question about software engineering, data science, IT, cloud computing, DevOps, cybersecurity, or related tech fields and get comprehensive answers backed by real experiences from professionals who've been there.

---

## ✨ What Makes 404ella Special?

### 🤖 **AI-Powered Intelligence**

Our advanced RAG (Retrieval-Augmented Generation) system doesn't just give generic advice—it finds and synthesizes real experiences from **technology career discussions** to give you actionable, context-aware guidance specifically tailored to tech professionals.

### 📚 **Knowledge from Real People**

- **10,000+ Reddit Posts**: Curated content from r/cscareerquestions, r/jobs, r/ExperiencedDevs, and more
- **User Experiences**: Community-submitted career stories reviewed and approved by moderators
- **Always Growing**: New experiences added daily from our community

### 🎯 **Semantic Search for Tech Topics**

Don't know the exact keywords? No problem. Ask technology career questions in natural language and our system finds relevant information from tech discussions even when you phrase it differently.

### 🔒 **Safe & Validated Content**

Every user-submitted experience goes through automatic validation:

- ✅ PII (Personal Information) detection and redaction
- ✅ Toxicity and safety checks
- ✅ Spam detection
- ✅ Relevance verification
- ✅ Human moderation before publication

### 💬 **Voice & Text Interface**

- **Voice Input**: Speak your questions naturally (auto-submits after 1.5s of silence)
- **Text Chat**: Traditional typing interface
- **Conversation History**: Context-aware responses that remember your previous questions

---

## 🎯 Key Features

### For Job Seekers

- 💼 **Interview Preparation**: Get insights from real interview experiences
- 💰 **Salary Negotiation**: Learn from successful negotiation stories
- 🔄 **Career Transitions**: Understand how others made successful career changes
- 📈 **Professional Development**: Discover growth strategies that worked for others

### For Career Changers

- 🎓 **Skill Assessment**: Understand what skills you need to transition
- 🌐 **Industry Insights**: Learn about different career paths
- 📝 **Resume & LinkedIn Tips**: Get advice from professionals who've optimized their profiles

### For Tech Professionals

- 🔍 **Instant Tech Answers**: Get comprehensive responses about technology careers in seconds
- 📖 **Source Citations**: Every answer includes links to original tech discussions
- 💡 **Practical Tech Advice**: Real-world solutions from experienced tech professionals, not generic tips
- 🎤 **Voice Interface**: Ask technology career questions hands-free
- 💻 **Tech-Specific Topics**: Get answers about programming languages, frameworks, cloud platforms, DevOps, data science, and more

---

## 🛠️ Technology Stack

### Backend

- **FastAPI** - High-performance Python web framework
- **PostgreSQL + pgvector** - Vector database for semantic search
- **LangChain** - RAG pipeline orchestration
- **HuggingFace** - Embeddings and NLP models
- **Groq (Llama 3.1)** - Fast LLM inference
- **Transformers** - Content validation models

### Frontend

- **Next.js 16** - React framework with server-side rendering
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Modern, responsive styling
- **Web Speech API** - Voice input support

### AI/ML

- **RAG Architecture** - Retrieval-Augmented Generation for accurate answers
- **Semantic Search** - Vector similarity search with pgvector
- **Content Validation** - Multi-layer ML validation pipeline

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- Groq API key (for LLM)

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database and API keys

# To create database tables and embeddins manually othervise
cd scripts
python3 save_to_database.py
python3 generate_embeddings.py

# or they will be created automatically by putting these cron jobs in your computer
crontab -l 2>/dev/null; cat /home/dorisa/Public/AI/career/backend/scripts/cron_scripts/crontab_entries.txt) | crontab -

# Run the server
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Frontend Setup

```bash
# Navigate to frontend directory
cd chatbot-ui-design

# Install dependencies
npm install

# Set up environment variables
# Create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:8000

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

---

## 📖 API Documentation

### Interactive API Docs

Once the backend is running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Main Endpoints

#### Chat Endpoint

```http
POST /ask
Content-Type: application/json

{
  "question": "How do I negotiate a higher salary?",
  "chat_history": []
}
```

#### Submit Experience

```http
POST /api/experiences
Content-Type: application/json

{
  "category": "salary-negotiation",
  "description": "I successfully negotiated a 30% raise as a senior software engineer by demonstrating my impact on the product..."
}
```

**Experience Categories (Technology-Focused):**

- `interview` - Tech interview experiences
- `job-search` - Tech job search stories
- `career-advice` - General tech career advice
- `salary-negotiation` - Tech salary negotiation experiences
- `workplace-issues` - Tech workplace situations
- `career-transition` - Transitions between tech roles
- `professional-development` - Tech skill development

#### Admin Endpoints

- `POST /api/admin/register` - Register admin account
- `POST /api/admin/login` - Login and get JWT token
- `GET /api/admin/experiences` - Get pending experiences
- `PUT /api/admin/experiences/{id}/approve` - Approve experience
- `PUT /api/admin/experiences/{id}/reject` - Reject experience

See the full API documentation at `/docs` when the server is running.

---

## 🏗️ Project Structure

```
career/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # API endpoints
│   │   └── services/       # Business logic
│   │       ├── rag_service.py
│   │       └── content_validator.py
│   ├── database/           # Database models and setup
│   ├── scripts/           # Data collection and processing
│   └── tests/             # Test suite
│
├── chatbot-ui-design/     # Next.js frontend
│   ├── app/               # Next.js app router pages
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   └── lib/               # API client and utilities
│
└── README.md              # This file
```

---

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest                    # Run all tests
pytest tests/unit/        # Unit tests only
pytest tests/integration/ # Integration tests only
pytest --cov              # With coverage report
```

### Frontend Tests

```bash
cd chatbot-ui-design
npm test                  # Run tests
```

---

## 🔐 Security Features

- **JWT Authentication** - Secure admin authentication
- **Password Hashing** - bcrypt for password security
- **Rate Limiting** - Protection against abuse
- **CORS Configuration** - Controlled cross-origin access
- **Input Validation** - Pydantic models for request validation
- **Content Moderation** - Automatic validation of user submissions

---

## 📊 Data Sources

### Reddit Subreddits

- r/cscareerquestions
- r/jobs
- r/ExperiencedDevs
- r/ITCareerQuestions
- r/careerguidance
- And more career-related communities

### User Submissions

Community members can submit their own career experiences, which are:

1. Automatically validated for quality and safety
2. Reviewed by human moderators
3. Added to the knowledge base if approved

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Report Issues**: Found a bug? Open an issue
2. **Suggest Features**: Have an idea? We'd love to hear it
3. **Submit Experiences**: Share your career story
4. **Code Contributions**: Fork, make changes, submit a PR

---

## 📝 License

This project is licensed under the MIT License.

---

## 🎓 Learn More

- **Architecture**: See `backend/ARCHITECTURE.md` for system design
- **API Examples**: See `backend/API_USAGE_EXAMPLES.md` for code samples
- **Security**: See `backend/SECURITY.md` for security practices

---

## 🗺️ Coming Soon

We're constantly improving 404ella! Here's what's coming next:

### 🔍 **Admin Activity Log**

- Track all admin actions and changes

### 🎓 **Learning Resources Hub**

A comprehensive resource page for technology professionals featuring:

- **Online Courses**: Curated recommendations for programming, data science, cloud computing, and more
- **Bootcamps**: Top-rated coding bootcamps with reviews and outcomes
- **University Programs**: Best colleges and universities for tech degrees
- **Certifications**: Industry-recognized certifications to boost your career
- **Learning Paths**: Structured roadmaps for different tech careers
- **Resource Reviews**: Community feedback on courses and programs

Perfect for:

- Career changers looking to break into tech
- Developers wanting to upskill
- Students planning their education
- Professionals seeking certifications

---

## 💡 Why 404ella?

**Traditional career advice sites** give you generic articles that may or may not apply to your situation.

**404ella** gives you:

- ✅ Answers based on **real tech career experiences** from professionals like you
- ✅ **Multiple tech perspectives** synthesized into one comprehensive answer
- ✅ **Source citations** so you can read the full technology career discussions
- ✅ **Context-aware responses** that understand your tech career conversation history
- ✅ **Voice interface** for natural, hands-free interaction
- ✅ **Technology-focused knowledge base** covering software engineering, data science, IT, cloud, DevOps, and more

**Stop searching through generic career advice. Get technology-specific answers from real tech professionals.**

---

## 📞 Support

Questions? Issues? Want to contribute?

- Check the documentation in the `backend/` directory
- Review the API docs at `/docs` when running the server
- Open an issue on GitHub

---

**Built with ❤️ to help people navigate their careers**
