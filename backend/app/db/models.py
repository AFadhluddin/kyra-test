from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncAttrs, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, synonym
from sqlalchemy import String, ForeignKey, JSON, func, Text, Column, Integer, Float, DateTime
from ..core.config import get_settings

settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(AsyncAttrs, DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_pw: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    location: Mapped[Optional[str]]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    
    user: Mapped["User"] = relationship(backref="sessions")

class Message(Base):
    __tablename__ = "messages"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id"))
    role: Mapped[str] = mapped_column(String(10))  # "user" / "assistant" / "system"
    content: Mapped[str] = mapped_column(Text)
    # sources: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)  # Store sources as JSON
    # response_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # Store metadata as JSON (renamed from metadata)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

class UnansweredQuery(Base):
    __tablename__ = "unanswered_queries"
    
    id = Column(Integer, primary_key=True)
    text = Column(Text, nullable=False)
    location = Column(String, nullable=True)
    reason = Column(String, nullable=True)  # NEW
    score = Column(Float, nullable=True)  # NEW
    created_at = Column(DateTime, default=datetime.utcnow)