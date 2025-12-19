from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.rag_service import build_rag_chain, ask_question
from app.services.content_validator import validate_experience
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from database.db import get_db, SessionLocal, init_db
from database.models import UserExperience, AdminUser
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
import os

from langchain_core.messages import HumanMessage, AIMessage


app = FastAPI()


@app.on_event("startup")
def startup_event():
    """Initialize database tables on startup."""
    try:
        init_db()
        print("Database tables initialized successfully.")
    except Exception as e:
        print(f"Warning: Could not initialize database tables: {e}")
        print("You may need to run init_db() manually or check your database connection.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
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
    role: str
    content: str


class AskRequest(BaseModel):
    question: str
    chat_history: Optional[List[ChatMessage]] = []


class Source(BaseModel):
    url: str
    post_id: Optional[str] = None
    source: Optional[str] = None
    date: Optional[str] = None
    score: Optional[int] = None
    num_comments: Optional[int] = None


class AskResponse(BaseModel):
    answer: str
    sources: List[Source] = []


class ExperienceRequest(BaseModel):
    category: str
    description: str


class ExperienceResponse(BaseModel):
    id: int
    status: str
    message: str


class AdminRegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    # Simple shared secret to avoid public self-registration
    registration_secret: Optional[str] = None


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
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
    parsed = []
    for msg in history:
        if msg.role == "user":
            parsed.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            parsed.append(AIMessage(content=msg.content))
    return parsed


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hash."""
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
    Very small helper that:
    - reads the token from the Authorization header
    - decodes it
    - loads the AdminUser from the database using the user ID
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


@app.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest):

    chat_history = parse_chat_history(payload.chat_history)

    answer, _, sources = ask_question(
        rag_chain = rag_chain,
        question = payload.question,
        chat_history = chat_history
    )

    # Convert sources to Source models
    source_models = [Source(**source) for source in sources]

    return {"answer": answer, "sources": source_models}


# ---------------------------
# Admin Auth Endpoints
# ---------------------------

@app.post("/api/admin/register", response_model=TokenResponse)
def register_admin(payload: AdminRegisterRequest, db: Session = Depends(get_db)):
    """
    Simple admin registration endpoint.

    We protect this with a shared registration secret so that
    random users cannot create admin accounts.
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


@app.post("/api/admin/login", response_model=TokenResponse)
def login_admin(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    """
    Admin login endpoint.

    The frontend should send username and password, and it will receive
    a JWT token that it can store (for example) in memory or localStorage.
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


@app.get("/api/admin/me")
def get_current_admin_info(admin: AdminUser = Depends(get_current_admin)):
    """
    Simple endpoint to test if the admin token is working.
    Returns basic info about the logged-in admin.
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


@app.get("/api/admin/experiences", response_model=List[ExperienceListItem])
def get_pending_experiences(
    status: str = "pending",
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Get experiences for admin review.
    By default returns pending experiences, but you can filter by status.
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


@app.post("/api/experiences", response_model=ExperienceResponse)
def submit_experience(
    experience: ExperienceRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        if not experience.category or not experience.description:
            raise HTTPException(status_code=400, detail="Category and description are required")

        if len(experience.description.strip()) < 50:
            raise HTTPException(status_code=400, detail="Description must be at least 50 characters")

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
