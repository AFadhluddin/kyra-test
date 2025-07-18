from ...db.models import (
    SessionLocal,
    ChatSession,
    Message,
    UnansweredQuery,     # ← add this
)

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from ...services.rag import answer, llm_fallback, SIM_THRESHOLD
from ...services.auth import get_current_user
from ...services.rag import answer
from ...db.models import SessionLocal, ChatSession, Message

FALLBACK_TXT = (
    "I'm not sure about that yet – a clinician will review your question."
)
router = APIRouter()

class ChatIn(BaseModel):
    message: str
    location: str | None = None


class ChatOut(BaseModel):
    response: str
    sources: list[str]
    from_cache: bool = False


@router.post("/chat", response_model=ChatOut)
async def chat(body: ChatIn, user=Depends(get_current_user)):
    async with SessionLocal() as db:
        # ---------- call RAG --------------------------------------------------
        try:
            response, score, sources = answer(body.message)   # ← 3 VALUES NOW
        except RuntimeError as e:                             # rag_error: ...
            db.add(
                UnansweredQuery(
                    text=body.message,
                    location=body.location,
                    reason=str(e),
                )
            )
            await db.commit()
            
            # NEW: ask GPT‑4o‑mini with guard‑rail prompt
            llm_resp = llm_fallback(body.message)

            # If the model refused, return standard fallback
            if llm_resp.lower().startswith("i’m sorry") or score < SIM_THRESHOLD:
                return {"response": FALLBACK_TXT, "sources": [], "from_cache": False}

            return {"response": llm_resp, "sources": [], "from_cache": False}

        # ---------- low‑similarity fallback ----------------------------------
        if response is None:
            db.add(
                UnansweredQuery(
                    text=body.message,
                    location=body.location,
                    reason=f"low_similarity<{score:.3f}>",
                    score=score,
                )
            )
            await db.commit()
            return {"response": FALLBACK_TXT, "sources": [], "from_cache": False}

        # ---------- success ---------------------------------------------------
        return {"response": response, "sources": sources, "from_cache": False}