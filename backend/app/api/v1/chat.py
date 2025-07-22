from ...db.models import (
    SessionLocal,
    ChatSession,
    Message,
    UnansweredQuery,
)
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from ...services.auth import get_current_user
from ...services.rag import answer
from sqlalchemy import select, desc

router = APIRouter()

class ChatIn(BaseModel):
    message: str
    location: str | None = None
    session_id: int | None = None  # Optional session ID for continuing conversation

class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: str
    # sources: Optional[List[str]] = None
    # response_metadata: Optional[dict] = None  # Changed from metadata to response_metadata

class ChatOut(BaseModel):
    response: str
    sources: list[str]
    session_id: int
    messages: List[MessageOut] = []
    metadata: dict = {}  # Include metadata for debugging/analytics

@router.post("/chat", response_model=ChatOut)
async def chat(body: ChatIn, user=Depends(get_current_user)):
    async with SessionLocal() as db:
        # ---------- Get or create chat session ---------------------------
        session = None
        if body.session_id:
            # Try to get existing session
            result = await db.execute(
                select(ChatSession).where(
                    ChatSession.id == body.session_id,
                    ChatSession.user_id == user.id
                )
            )
            session = result.scalar_one_or_none()
        
        if not session:
            # Create new session
            session = ChatSession(
                user_id=user.id,
                location=body.location
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)
        
        # ---------- Get conversation history for context ------------------
        # Get history BEFORE adding current message to build proper context
        history_result = await db.execute(
            select(Message)
            .where(Message.session_id == session.id)
            .order_by(Message.created_at)
            .limit(20)  # Limit to last 20 messages for context
        )
        history_messages = history_result.scalars().all()
        
        print(f"[DEBUG] Found {len(history_messages)} existing messages in session {session.id}")
        
        # Build conversation history for GPT-4o (existing messages only)
        conversation_history = []
        for msg in history_messages[-10:]:  # Use last 10 for context
            conversation_history.append({
                "role": msg.role if msg.role != "assistant" else "assistant", 
                "content": msg.content
            })
        
        print(f"[DEBUG] Built conversation history with {len(conversation_history)} messages")
        if conversation_history:
            print(f"[DEBUG] Last 3 messages in history:")
            for i, msg in enumerate(conversation_history[-3:]):
                print(f"  {i+1}. {msg['role']}: {msg['content'][:100]}...")
        else:
            print(f"[DEBUG] No conversation history found")
        
        # ---------- Save user message AFTER getting history ---------------
        user_message = Message(
            session_id=session.id,
            role="user",
            content=body.message
        )
        db.add(user_message)
        # Don't commit yet - we'll commit after the assistant response
        
        # ---------- Generate response with hybrid system -----------------
        try:
            # Build contextual query for RAG (if medical)
            contextual_query = body.message  # Default to just the current message
            
            if conversation_history:
                print(f"[DEBUG] Building contextual query with {len(conversation_history)} previous messages")
                
                # Create context-aware query for RAG classification and retrieval
                context_messages = []
                for msg in conversation_history[-5:]:  # Last 5 for context
                    context_messages.append(f"{msg['role']}: {msg['content']}")
                
                # Add current message to context
                context_messages.append(f"user: {body.message}")
                
                contextual_query = f"Previous conversation:\n" + "\n".join(context_messages[:-1]) + f"\n\nCurrent question: {body.message}"
                print(f"[DEBUG] Contextual query: {contextual_query[:300]}...")
            else:
                print(f"[DEBUG] No conversation history, using direct query: {body.message}")
            
            print(f"[DEBUG] Calling answer() with:")
            print(f"  - Query: {contextual_query[:100]}...")
            print(f"  - Original query: {body.message}")
            print(f"  - Conversation history items: {len(conversation_history)}")
            
            # Call the hybrid RAG + GPT-4o system
            response, sources, metadata = answer(
                query=contextual_query,
                conversation_history=conversation_history,
                original_query=body.message
            )
            
            # Log for analytics if the question was unanswered by RAG
            if metadata.get("is_medical", False) and not metadata.get("used_rag", False):
                db.add(
                    UnansweredQuery(
                        text=body.message,
                        location=body.location,
                        reason=f"medical_question_no_rag<score:{metadata.get('rag_score', 0):.3f}>",
                        score=metadata.get('rag_score', 0.0),
                    )
                )
            
        except Exception as e:
            # Log the error
            db.add(
                UnansweredQuery(
                    text=body.message,
                    location=body.location,
                    reason=f"system_error: {str(e)}",
                )
            )
            
            # Save error message
            error_message = Message(
                session_id=session.id,
                role="assistant",
                content="I'm having trouble responding right now. Please try again in a moment."
            )
            db.add(error_message)
            await db.commit()
            
            # Get all messages for response
            all_messages_result = await db.execute(
                select(Message)
                .where(Message.session_id == session.id)
                .order_by(Message.created_at)
            )
            all_messages = all_messages_result.scalars().all()
            
            return {
                "response": "I'm having trouble responding right now. Please try again in a moment.",
                "sources": [],
                "session_id": session.id,
                "messages": [
                    MessageOut(
                        id=msg.id,
                        role=msg.role,
                        content=msg.content,
                        created_at=msg.created_at.isoformat()
                    ) for msg in all_messages
                ],
                "metadata": {"error": True}
            }
        
        # ---------- Success - save assistant message ---------------------
        assistant_message = Message(
            session_id=session.id,
            role="assistant",
            content=response,
            # sources=sources,  # Store sources with the message
            # response_metadata=metadata  # Store metadata with the message (renamed from metadata)
        )
        db.add(assistant_message)
        await db.commit()
        
        # Get all messages for response
        all_messages_result = await db.execute(
            select(Message)
            .where(Message.session_id == session.id)
            .order_by(Message.created_at)
        )
        all_messages = all_messages_result.scalars().all()
        
        return {
            "response": response,
            "sources": sources,
            "session_id": session.id,
            "messages": [
                MessageOut(
                    id=msg.id,
                    role=msg.role,
                    content=msg.content,
                    created_at=msg.created_at.isoformat(),
                    # sources=msg.sources,
                    # response_metadata=msg.response_metadata
                ) for msg in all_messages
            ],
            "metadata": metadata
        }

@router.get("/chat/sessions", response_model=List[dict])
async def get_chat_sessions(user=Depends(get_current_user)):
    """Get all chat sessions for the current user"""
    async with SessionLocal() as db:
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user.id)
            .order_by(desc(ChatSession.created_at))
        )
        sessions = result.scalars().all()
        
        session_list = []
        for session in sessions:
            # Get the first message for preview
            first_msg_result = await db.execute(
                select(Message)
                .where(Message.session_id == session.id, Message.role == "user")
                .order_by(Message.created_at)
                .limit(1)
            )
            first_message = first_msg_result.scalar_one_or_none()
            
            session_list.append({
                "id": session.id,
                "created_at": session.created_at.isoformat(),
                "location": session.location,
                "preview": first_message.content[:50] + "..." if first_message else "New conversation"
            })
        
        return session_list

@router.get("/chat/session/{session_id}", response_model=List[MessageOut])
async def get_session_messages(session_id: int, user=Depends(get_current_user)):
    """Get all messages for a specific session"""
    async with SessionLocal() as db:
        # Verify session belongs to user
        session_result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user.id
            )
        )
        session = session_result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get messages
        messages_result = await db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.created_at)
        )
        messages = messages_result.scalars().all()
        
        return [
            MessageOut(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                created_at=msg.created_at.isoformat(),
                # sources=msg.sources,
                # response_metadata=msg.response_metadata
            ) for msg in messages
        ]