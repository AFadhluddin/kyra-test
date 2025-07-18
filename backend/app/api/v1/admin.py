from fastapi import APIRouter, Depends
from sqlalchemy import select

from ...services.auth import get_current_user      # ← fixed
from ...db.models import SessionLocal, UnansweredQuery


router = APIRouter()

@router.get("/unanswered")
async def list_unanswered(limit: int = 20, user=Depends(get_current_user)):
    async with SessionLocal() as db:
        rows = (await db.execute(
            select(UnansweredQuery)
            .order_by(UnansweredQuery.created_at.desc())
            .limit(limit)
        )).scalars().all()
        return [
            {
                "text": r.text,
                "location": r.location,
                "score": r.score,
                "reason": r.reason,
                "created_at": r.created_at,
            }
            for r in rows
]
