from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.rag_service import build_rag_chain, ask_question
from app.services.content_validator import validate_experience
from app.middleware.security_headers import SecurityHeadersMiddleware
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from database.db import get_db, SessionLocal, init_db
from database.models import UserExperience, AdminUser
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
import os
from contextlib import asynccontextmanager

from langchain_core.messages import HumanMessage, AIMessage


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initialize database tables on startup.

    Creates all database tables defined in models.py and ensures
    the pgvector extension is available.

    Args:
        app: FastAPI application instance

    Yields:
        None (control returns to FastAPI after initialization)
    """
    try:
        init_db()
        print("Database tables initialized successfully.")
    except Exception as e:
        print(f"Warning: Could not initialize database tables: {e}")
        print("You may need to run init_db() manually or check your database connection.")
    yield


app = FastAPI(
    title="404ella API",
    description="""
    Career advice chatbot API with RAG (Retrieval-Augmented Generation) system.

    ## Features

    * **Chat Interface**: Ask career-related questions and get AI-powered answers
    * **RAG System**: Retrieves relevant information from Reddit posts and user-submitted experiences
    * **Experience Submission**: Users can submit their career experiences for review
    * **Admin Panel**: Admin users can review and approve/reject submitted experiences
    * **Content Validation**: Automatic validation of submitted content for safety, PII, spam, and relevance

    ## Authentication

    Admin endpoints require JWT authentication. Register an admin account using the `/api/admin/register` endpoint
    with a valid registration secret, then use the returned token in the Authorization header.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    contact={
        "name": "404ella API Support",
    },
    license_info={
        "name": "MIT",
    },
)

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers middleware (add before CORS)
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3003", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

rag_chain = build_rag_chain()


# ---------------------------
# Admin Auth Config
# ---------------------------

# In a real app you should set these as environment variables.
SECRET_KEY = os.getenv("ADMIN_JWT_SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()


# ---------------------------
# Request / Response Schemas
# ---------------------------
class ChatMessage(BaseModel):
    """
    Chat message model for conversation history.

    Attributes:
        role: Message role, either "user" or "assistant"
        content: The message content/text
    """
    role: str = Field(..., description="Message role", pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=10000, description="Message content")


class AskRequest(BaseModel):
    """
    Request model for asking questions to the chatbot.

    Attributes:
        question: The user's question about career advice
        chat_history: Optional list of previous messages in the conversation
    """
    question: str
    chat_history: Optional[List[ChatMessage]] = []


class Source(BaseModel):
    """
    Source information for RAG responses.

    Attributes:
        url: URL of the source (Reddit post link or None for user experiences)
        post_id: Unique identifier for the post or experience
        source: Source type (e.g., "reddit", "user_experience")
        date: Date when the content was posted/submitted
        score: Reddit post score (upvotes - downvotes)
        num_comments: Number of comments on the Reddit post
    """
    url: str
    post_id: Optional[str] = None
    source: Optional[str] = None
    date: Optional[str] = None
    score: Optional[int] = None
    num_comments: Optional[int] = None


class AskResponse(BaseModel):
    """
    Response model containing answer and sources.

    Attributes:
        answer: The AI-generated answer to the user's question
        sources: List of sources (Reddit posts or user experiences) used to generate the answer
    """
    answer: str
    sources: List[Source] = []


class ExperienceRequest(BaseModel):
    """
    Request model for submitting user experiences.

    Attributes:
        category: Experience category (e.g., "interview", "job-search", "career-advice")
        description: Detailed description of the experience (minimum 50 characters)
    """
    category: str = Field(
        ...,
        description="Experience category",
        pattern="^(interview|job-search|career-advice|salary-negotiation|workplace-issues|career-transition|professional-development|other)$"
    )
    description: str = Field(..., min_length=50, max_length=10000, description="Experience description (50-10000 characters)")


class ExperienceResponse(BaseModel):
    """
    Response model for experience submission.

    Attributes:
        id: Unique identifier for the submitted experience
        status: Current status ("pending", "approved", or "rejected")
        message: Human-readable message about the submission
    """
    id: int
    status: str
    message: str


class AdminRegisterRequest(BaseModel):
    """
    Request model for admin registration.

    Attributes:
        username: Unique username for the admin account
        email: Unique email address for the admin account
        password: Password for the admin account (will be hashed)
        registration_secret: Optional secret key required for registration (if configured)
    """
    username: str = Field(..., min_length=3, max_length=50, description="Username (3-50 characters)")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=8, max_length=100, description="Password (minimum 8 characters)")
    registration_secret: Optional[str] = Field(default=None, max_length=200, description="Registration secret if required")


class AdminLoginRequest(BaseModel):
    """
    Request model for admin login.

    Attributes:
        username: Admin username
        password: Admin password
    """
    username: str = Field(..., min_length=1, max_length=50, description="Admin username")
    password: str = Field(..., min_length=1, max_length=100, description="Admin password")


class TokenResponse(BaseModel):
    """
    Response model for authentication tokens.

    Attributes:
        access_token: JWT access token for authenticated requests
        token_type: Token type, always "bearer"
    """
    access_token: str
    token_type: str = "bearer"


def run_experience_validation(experience_id: int, original_text: str) -> None:
    """
    Perform NLP validation in the background and update the saved experience.
    This is intentionally best-effort and should never block the main request.
    """
    db = SessionLocal()
    try:
        validation = validate_experience(original_text.strip())

        experience = (
            db.query(UserExperience)
            .filter(UserExperience.id == experience_id)
            .first()
        )

        if not experience:
            return

        experience.text = validation["cleaned_text"]
        experience.status = validation["status"]
        experience.severity = validation["severity"]
        experience.flagged_reason = validation["flagged_reason"]
        experience.flagged_at = validation["flagged_at"] if validation["flagged_at"] else None

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Background validation error for experience {experience_id}: {e}")
    finally:
        db.close()

# ---------------------------
# Helpers
# ---------------------------
def parse_chat_history(history: List[ChatMessage]):
    """
    Convert chat history from API format to LangChain message format.

    Args:
        history: List of ChatMessage objects

    Returns:
        List of LangChain HumanMessage and AIMessage objects
    """
    parsed = []
    for msg in history:
        if msg.role == "user":
            parsed.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            parsed.append(AIMessage(content=msg.content))
    return parsed


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a bcrypt hash.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Bcrypt hash to compare against

    Returns:
        True if password matches, False otherwise
    """
    # Convert string hash to bytes if needed
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')

    try:
        return bcrypt.checkpw(plain_password, hashed_password)
    except Exception as e:
        print(f"Error verifying password: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    # Convert password to bytes
    if isinstance(password, str):
        password = password.encode('utf-8')

    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password, salt)

    # Return as string for database storage
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Dictionary containing token payload (e.g., user ID)
        expires_delta: Optional expiration time delta

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> AdminUser:
    """
    Get current admin user from JWT token.

    Reads JWT token from Authorization header, decodes it, and retrieves
    the AdminUser from database.

    Args:
        credentials: HTTPBearer credentials containing JWT token
        db: Database session

    Returns:
        AdminUser object

    Raises:
        HTTPException: If token is invalid or admin not found
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate admin credentials",
            )

        # Convert string ID back to integer
        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate admin credentials",
        )

    # Query by ID instead of username (more secure and stable)
    admin = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin not found",
        )
    return admin


@app.post(
    "/ask",
    response_model=AskResponse,
    tags=["Chat"],
    summary="Ask a question to the chatbot",
    description="""
    Ask a question to the career advice chatbot.

    Uses RAG (Retrieval-Augmented Generation) to provide answers based on:
    - Reddit posts and comments from career-related subreddits
    - User-submitted experiences that have been approved by admins

    The system retrieves relevant context and generates an AI-powered answer.
    """,
    response_description="Answer with source citations",
)
@limiter.limit("10/minute")  # Rate limit: 10 requests per minute per IP
def ask(request: Request, payload: AskRequest):
    """
    Ask a question to the career advice chatbot.

    Uses RAG (Retrieval-Augmented Generation) to provide answers based on
    Reddit posts, comments, and user-submitted experiences.

    Args:
        payload: AskRequest containing question and optional chat history

    Returns:
        AskResponse with answer and source citations

    Raises:
        HTTPException: If request is too large (413) or rate limited
    """
    try:
        chat_history = parse_chat_history(payload.chat_history)

        answer, _, sources = ask_question(
            rag_chain = rag_chain,
            question = payload.question,
            chat_history = chat_history
        )

        # Convert sources to Source models
        source_models = [Source(**source) for source in sources]

        return {"answer": answer, "sources": source_models}
    except Exception as e:
        error_message = str(e)
        # Check if it's a token limit error
        if "413" in error_message or "tokens per minute" in error_message.lower() or "rate_limit" in error_message.lower():
            raise HTTPException(
                status_code=413,
                detail="Request too large. Please try asking a shorter question or wait a moment before trying again."
            )
        # Re-raise other errors
        raise


# ---------------------------
# Admin Auth Endpoints
# ---------------------------

@app.post(
    "/api/admin/register",
    response_model=TokenResponse,
    tags=["Admin"],
    summary="Register a new admin account",
    description="""
    Register a new admin account.

    This endpoint is protected by a registration secret (if configured via ADMIN_REGISTRATION_SECRET).
    After successful registration, returns a JWT token for immediate authentication.
    """,
)
@limiter.limit("5/hour")  # Rate limit: 5 registrations per hour per IP
def register_admin(request: Request, payload: AdminRegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new admin user account.

    Creates a new admin account with hashed password. Protected by optional
    registration secret to prevent unauthorized account creation.

    Args:
        payload: AdminRegisterRequest with username, email, password, and optional secret
        db: Database session

    Returns:
        TokenResponse with JWT access token for immediate authentication

    Raises:
        HTTPException:
            - 403 if registration secret is invalid
            - 400 if username or email already exists
            - 500 for database or unexpected errors
    """
    try:
        expected_secret = os.getenv("ADMIN_REGISTRATION_SECRET")
        if expected_secret and payload.registration_secret != expected_secret:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid registration secret",
            )

        # Check if username or email already exists
        existing_user = (
            db.query(AdminUser)
            .filter(
                (AdminUser.username == payload.username)
                | (AdminUser.email == payload.email)
            )
            .first()
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already registered",
            )

        hashed_password = get_password_hash(payload.password)

        admin_user = AdminUser(
            username=payload.username,
            email=payload.email,
            hashed_password=hashed_password,
            created_at=datetime.utcnow(),
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        # Automatically log the admin in after registration
        # Use user ID instead of username for better security and stability
        access_token = create_access_token(data={"sub": str(admin_user.id)})
        return TokenResponse(access_token=access_token)
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Database error during admin registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred. Please try again later.",
        ) from e
    except Exception as e:
        db.rollback()
        print(f"Unexpected error during admin registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}",
        ) from e


@app.post(
    "/api/admin/login",
    response_model=TokenResponse,
    tags=["Admin"],
    summary="Login as admin user",
    description="""
    Authenticate admin credentials and receive JWT token.

    The frontend should send username and password, and it will receive
    a JWT token that can be stored in memory or localStorage for subsequent requests.
    """,
)
@limiter.limit("10/hour")  # Rate limit: 10 login attempts per hour per IP
def login_admin(request: Request, payload: AdminLoginRequest, db: Session = Depends(get_db)):
    """
    Login as admin user.

    Authenticates admin credentials and returns JWT token for subsequent requests.

    Args:
        payload: AdminLoginRequest with username and password
        db: Database session

    Returns:
        TokenResponse with JWT access token

    Raises:
        HTTPException:
            - 401 if credentials are invalid
            - 500 for database or unexpected errors
    """
    try:
        admin_user = (
            db.query(AdminUser).filter(AdminUser.username == payload.username).first()
        )

        if not admin_user or not verify_password(payload.password, admin_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )

        # Use user ID instead of username for better security and stability
        access_token = create_access_token(data={"sub": str(admin_user.id)})
        return TokenResponse(access_token=access_token)
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        print(f"Database error during admin login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred. Please try again later.",
        ) from e
    except Exception as e:
        print(f"Unexpected error during admin login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}",
        ) from e


@app.get(
    "/api/admin/me",
    tags=["Admin"],
    summary="Get current admin information",
    description="Returns basic information about the authenticated admin user. Requires valid JWT token.",
)
def get_current_admin_info(admin: AdminUser = Depends(get_current_admin)):
    """
    Get current admin user information.

    Returns basic information about the authenticated admin user.
    Requires valid JWT token in Authorization header.

    Args:
        admin: Current admin user from JWT token (automatically injected)

    Returns:
        Dictionary with admin id, username, email, and created_at

    Raises:
        HTTPException: 401 if token is invalid or admin not found
    """
    return {
        "id": admin.id,
        "username": admin.username,
        "email": admin.email,
        "created_at": admin.created_at.isoformat() if admin.created_at else None,
    }


class ExperienceListItem(BaseModel):
    id: int
    title: Optional[str]
    text: str
    experience_type: Optional[str]
    status: str
    severity: Optional[str]
    flagged_reason: Optional[str]
    flagged_at: Optional[str]
    submitted_at: Optional[str]


@app.get(
    "/api/admin/experiences",
    response_model=List[ExperienceListItem],
    tags=["Admin"],
    summary="Get experiences for admin review",
    description="Retrieve experiences filtered by status. Defaults to 'pending' experiences.",
)
@limiter.limit("30/minute")  # Rate limit: 30 requests per minute for authenticated admins
def get_pending_experiences(
    request: Request,
    status: str = "pending",
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Get experiences for admin review.

    Retrieves experiences filtered by status. By default returns pending experiences,
    but can filter by "approved", "rejected", or "pending".

    Args:
        status: Filter by experience status (default: "pending")
        admin: Current admin user (automatically injected)
        db: Database session

    Returns:
        List of ExperienceListItem objects matching the status filter

    Raises:
        HTTPException: 500 for database errors
    """
    try:
        experiences = (
            db.query(UserExperience)
            .filter(UserExperience.status == status)
            .order_by(UserExperience.submitted_at.desc())
            .all()
        )

        result = []
        for exp in experiences:
            result.append({
                "id": exp.id,
                "title": exp.title,
                "text": exp.text,
                "experience_type": exp.experience_type,
                "status": exp.status,
                "severity": exp.severity,
                "flagged_reason": exp.flagged_reason,
                "flagged_at": exp.flagged_at.isoformat() if exp.flagged_at else None,
                "submitted_at": exp.submitted_at.isoformat() if exp.submitted_at else None,
            })

        return result
    except Exception as e:
        print(f"Error fetching experiences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch experiences",
        ) from e


@app.put("/api/admin/experiences/{experience_id}/approve", tags=["Admin"])
def approve_experience(
    experience_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Approve a user experience.

    Changes experience status from pending to approved and sets approved_at timestamp.
    Requires admin authentication.

    Args:
        experience_id: ID of experience to approve
        admin: Current admin user
        db: Database session

    Returns:
        Dictionary with experience id, status, and success message

    Raises:
        HTTPException: If experience not found
    """
    try:
        # Find the experience in the database
        experience = db.query(UserExperience).filter(UserExperience.id == experience_id).first()

        # Check if experience exists
        if not experience:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experience not found"
            )

        # Update the status to approved
        experience.status = "approved"
        experience.approved_at = datetime.utcnow()

        # Save changes to database
        db.commit()

        return {
            "id": experience.id,
            "status": experience.status,
            "message": "Experience approved successfully"
        }
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Database error during approval: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred. Please try again later."
        ) from e
    except Exception as e:
        db.rollback()
        print(f"Unexpected error during approval: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later."
        ) from e


@app.put(
    "/api/admin/experiences/{experience_id}/reject",
    tags=["Admin"],
    summary="Reject a user experience",
    description="Changes experience status from pending to rejected.",
)
def reject_experience(
    experience_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Reject a user experience.

    Changes experience status from pending to rejected.
    Requires admin authentication.

    Args:
        experience_id: ID of experience to reject
        admin: Current admin user (automatically injected)
        db: Database session

    Returns:
        Dictionary with experience id, status, and success message

    Raises:
        HTTPException:
            - 404 if experience not found
            - 500 for database or unexpected errors
    """
    try:
        # Find the experience in the database
        experience = db.query(UserExperience).filter(UserExperience.id == experience_id).first()

        # Check if experience exists
        if not experience:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experience not found"
            )

        # Update the status to rejected
        experience.status = "rejected"

        # Save changes to database
        db.commit()

        return {
            "id": experience.id,
            "status": experience.status,
            "message": "Experience rejected successfully"
        }
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Database error during rejection: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred. Please try again later."
        ) from e
    except Exception as e:
        db.rollback()
        print(f"Unexpected error during rejection: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later."
        ) from e


@app.post(
    "/api/experiences",
    response_model=ExperienceResponse,
    tags=["Experiences"],
    summary="Submit a user experience",
    description="""
    Submit a user experience for review.

    Creates a new experience entry and triggers background validation including:
    - PII (Personally Identifiable Information) detection and redaction
    - Toxicity and safety checks
    - Spam detection
    - Relevance verification

    The experience will be reviewed by an admin before being added to the knowledge base.
    """,
)
@limiter.limit("5/minute")  # Rate limit: 5 submissions per minute per IP
def submit_experience(
    request: Request,
    experience: ExperienceRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Submit a user experience for review.

    Creates a new experience entry and triggers background validation
    (PII detection, toxicity check, spam detection, relevance check).

    Args:
        experience: ExperienceRequest with category and description
        background_tasks: FastAPI background tasks for async validation
        db: Database session

    Returns:
        ExperienceResponse with experience id, status, and message

    Raises:
        HTTPException:
            - 400 if category/description missing or description too short (< 50 chars)
            - 500 for database or unexpected errors
    """
    try:
        # Pydantic validation already ensures category and description are valid
        # No need for redundant checks here
        category_map = {
            "interview": "interview",
            "job-search": "job_search",
            "career-advice": "career_advice",
            "salary-negotiation": "salary_negotiation",
            "workplace-issues": "workplace_issues",
            "career-transition": "career_transition",
            "professional-development": "professional_development",
            "other": "other"
        }

        experience_type = category_map.get(experience.category, "other")

        original_text = experience.description.strip()

        # Build a short title from the raw text so we can respond quickly.
        title_source = original_text
        title = title_source[:100] + "..." if len(title_source) > 100 else title_source

        new_experience = UserExperience(
            title=title,
            text=original_text,
            experience_type=experience_type,
            submitted_at=datetime.utcnow(),
        )

        db.add(new_experience)
        db.commit()
        db.refresh(new_experience)

        # Trigger validation in the background so the response is fast.
        background_tasks.add_task(
            run_experience_validation,
            experience_id=new_experience.id,
            original_text=original_text,
        )

        return {
            "id": new_experience.id,
            "status": new_experience.status,
            "message": "Experience submitted successfully. It will be reviewed by an admin."
        }
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Database error: {e}")
        raise HTTPException(
            status_code=500, detail="Database error occurred. Please try again later."
        ) from e
    except Exception as e:
        db.rollback()
        print(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        ) from e
