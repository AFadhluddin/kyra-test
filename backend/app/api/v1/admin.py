from fastapi import APIRouter, Depends
from sqlalchemy import select, and_, or_

from ...services.auth import get_current_user, get_current_admin      # ← fixed
from ...db.models import SessionLocal, UnansweredQuery, Message, ChatSession, User
from datetime import datetime


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

@router.get("/analytics")
async def analytics(
    answered: bool = True,
    ethnic_group: str = None,
    min_age: int = None,
    max_age: int = None,
    gender: str = None,
    rag_score_min: float = None,
    rag_score_max: float = None,
    reason: str = None,
    country: str = None,
    long_term_conditions: str = None,
    medications: str = None,
    user_id: int = None,
    session_id: int = None,
    user=Depends(get_current_admin)
):
    async with SessionLocal() as db:
        filters = []
        user_filters = []
        if ethnic_group:
            user_filters.append(User.ethnic_group == ethnic_group)
        if gender:
            user_filters.append(User.gender == gender)
        if country:
            user_filters.append(User.country == country)
        if long_term_conditions:
            user_filters.append(User.long_term_conditions.like(f"%{long_term_conditions}%"))
        if medications:
            user_filters.append(User.medications.like(f"%{medications}%"))
        if min_age or max_age:
            from datetime import datetime
            today = datetime.today()
            if min_age:
                max_birth = today.replace(year=today.year - min_age)
                user_filters.append(User.date_of_birth <= max_birth.strftime("%Y-%m-%d"))
            if max_age:
                min_birth = today.replace(year=today.year - max_age)
                user_filters.append(User.date_of_birth >= min_birth.strftime("%Y-%m-%d"))
        if user_id:
            user_filters.append(User.id == user_id)
        if session_id:
            filters.append(ChatSession.id == session_id)
        if answered:
            # Answered: filter on Message (assistant role)
            query = select(Message, ChatSession, User).join(ChatSession, Message.session_id == ChatSession.id).join(User, ChatSession.user_id == User.id).where(Message.role == "assistant")
            if rag_score_min is not None:
                filters.append(Message.confidence_score >= rag_score_min)
            if rag_score_max is not None:
                filters.append(Message.confidence_score <= rag_score_max)
            if user_filters:
                query = query.where(and_(*user_filters))
            if filters:
                query = query.where(and_(*filters))
            rows = (await db.execute(query)).all()
            results = []
            for msg, session, user in rows:
                results.append({
                    "question": msg.content,
                    "session_id": session.id,
                    "user_id": user.id,
                    "ethnic_group": user.ethnic_group,
                    "gender": user.gender,
                    "date_of_birth": user.date_of_birth,
                    "country": user.country,
                    "long_term_conditions": user.long_term_conditions,
                    "medications": user.medications,
                    "created_at": msg.created_at,
                    "rag_score": msg.confidence_score,
                    "reason": None,
                    "sources": msg.sources,
                })
            return results
        else:
            # Unanswered: filter on UnansweredQuery
            from sqlalchemy.orm import outerjoin
            query = select(UnansweredQuery, ChatSession, User)\
                .outerjoin(ChatSession, UnansweredQuery.session_id == ChatSession.id)\
                .outerjoin(User, ChatSession.user_id == User.id)
            if reason:
                filters.append(UnansweredQuery.reason == reason)
            if rag_score_min is not None:
                filters.append(UnansweredQuery.score >= rag_score_min)
            if rag_score_max is not None:
                filters.append(UnansweredQuery.score <= rag_score_max)
            if user_filters:
                query = query.where(and_(*user_filters))
            if filters:
                query = query.where(and_(*filters))
            rows = (await db.execute(query)).all()
            results = []
            for uq, session, user in rows:
                results.append({
                    "question": uq.text,
                    "session_id": session.id if session else None,
                    "user_id": user.id if user else None,
                    "ethnic_group": user.ethnic_group if user else None,
                    "gender": user.gender if user else None,
                    "date_of_birth": user.date_of_birth if user else None,
                    "country": user.country if user else None,
                    "long_term_conditions": user.long_term_conditions if user else None,
                    "medications": user.medications if user else None,
                    "created_at": uq.created_at,
                    "rag_score": uq.score,
                    "reason": uq.reason,
                    "sources": uq.sources,
                })
            return results
