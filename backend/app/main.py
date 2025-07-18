from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.admin import router as admin_router
from .api.v1.auth import router as auth_router
from .api.v1.chat import router as chat_router

app = FastAPI(title="MedHelp Chatbot – Pre‑Beta")

# --- CORS: allow your Vite dev server ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
app.include_router(chat_router, prefix="/api/v1", tags=["chat"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])



@app.get("/healthz")
async def health_check():
    return {"status": "ok"}
