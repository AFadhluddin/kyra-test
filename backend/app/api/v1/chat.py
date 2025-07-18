from ...db.models import (
    SessionLocal,
    ChatSession,
    Message,
    UnansweredQuery,     # ← add this
)

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from ...services.auth import get_current_user
from ...services.rag import answer
from ...db.models import SessionLocal, ChatSession, Message

router = APIRouter()

class ChatIn(BaseModel):
    message: str
    location: str | None = None


class ChatOut(BaseModel):
    response: str
    from_cache: bool = False


@router.post("/chat", response_model=ChatOut)
async def chat(body: ChatIn, user=Depends(get_current_user)):
    """
    Simpler HTTP endpoint (no streaming) – good enough for pre‑beta.
    """
    async with SessionLocal() as db:
        session = ChatSession(user_id=user.id, location=body.location)
        db.add(session)
        await db.flush()  # get session.id

        db.add(Message(session_id=session.id, role="user", content=body.message))

        response, score = answer(body.message)
        if response is None:
            # unanswered – store separately
            db.add(UnansweredQuery(text=body.message, location=body.location))
            response = (
                "I'm not sure about that yet – a clinician will review your question."
            )

        db.add(Message(session_id=session.id, role="assistant", content=response))
        await db.commit()

    return {"response": response}
