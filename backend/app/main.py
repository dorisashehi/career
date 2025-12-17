from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.services.rag_service import build_rag_chain, ask_question
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from database.db import get_db, init_db
from database.models import UserExperience

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
def submit_experience(experience: ExperienceRequest, db: Session = Depends(get_db)):
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

        title = experience.description[:100] + "..." if len(experience.description) > 100 else experience.description

        new_experience = UserExperience(
            title=title,
            text=experience.description.strip(),
            experience_type=experience_type,
            status="pending"
        )

        db.add(new_experience)
        db.commit()
        db.refresh(new_experience)

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
