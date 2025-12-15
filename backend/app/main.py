from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.rag_service import build_rag_chain, ask_question
from pydantic import BaseModel
from typing import List, Optional

from langchain_core.messages import HumanMessage, AIMessage


app = FastAPI()

# Add CORS middleware to allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class AskResponse(BaseModel):
    answer: str

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

    answer, _ = ask_question(
        rag_chain = rag_chain,
        question = payload.question,
        chat_history = chat_history
    )
    return {"answer": answer}
