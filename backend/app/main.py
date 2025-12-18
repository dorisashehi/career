from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from app.services.rag_service import build_rag_chain, ask_question
from app.services.content_validator import validate_experience
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from database.db import get_db, SessionLocal
from database.models import UserExperience
from datetime import datetime

from langchain_core.messages import HumanMessage, AIMessage


app = FastAPI()

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
