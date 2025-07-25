# kyra-test

Initial pre-beta for Kyra

## Overview

Kyra is a full-stack application featuring a Python-based backend (FastAPI) and a modern React frontend. It is designed to provide a chat interface powered by Retrieval-Augmented Generation (RAG), with user authentication, data ingestion, and document retrieval capabilities. The system is modular, scalable, and easy to extend.

---

## Features

- **Chatbot Interface:** Interactive chat UI for users to ask questions and receive answers, with support for document-sourced responses.
- **User Authentication:** Secure login and session management.
- **Retrieval-Augmented Generation (RAG):** Combines LLMs with a vector database (ChromaDB) for context-aware answers.
- **Admin & Analytics:** Endpoints for admin operations and analytics.
- **Document Ingestion:** Scripts and pipelines for ingesting and indexing new documents (e.g., NHS and Cancer Research UK health data).
- **Source Attribution:** Modal UI to display sources for chatbot answers.
- **Extensible Architecture:** Modular backend and frontend for easy feature addition.

---

## Architecture

### Backend (`backend/`)

- **Framework:** FastAPI
- **API:** RESTful endpoints for authentication, chat, admin, and preview.
- **Database:** SQLite (dev) via SQLAlchemy ORM; migrations managed by Alembic.
- **RAG Services:** Document embedding, indexing, and retrieval using ChromaDB.
- **Scripts:** For data refresh and user registration.

### Frontend (`frontend/`)

- **Framework:** React + TypeScript + Vite
- **Components:** Chat, Login, Markdown rendering, Message list, Session sidebar, Source modal.
- **API Integration:** HTTP requests to backend for chat, authentication, etc.
- **Styling:** CSS modules and Vite configuration.

---

## Data Flow

1. User interacts with the frontend (e.g., logs in, sends a chat message).
2. Frontend sends HTTP requests to backend API.
3. Backend authenticates, processes chat or data requests, and retrieves relevant documents.
4. Backend responds with data or error.
5. Frontend updates the UI accordingly.

---

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- (Optional) Docker for containerized deployment

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt  # or use pyproject.toml/uv/poetry
alembic upgrade head  # Run DB migrations
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Useful Scripts

- `scripts/refresh_nhs_data.sh`: Refreshes NHS data for ingestion.
- `scripts/register_user.sh`: Registers a new user.

---

## Project Structure

```
backend/
  app/
    api/v1/         # FastAPI routers (auth, chat, admin, preview)
    core/           # Config and settings
    db/             # ORM models, migrations
    services/       # Business logic (auth, analytics, RAG)
  rag/              # RAG pipeline, vector DB, document loaders
  migrations/       # Alembic migrations

frontend/
  src/
    components/     # React components (Chat, Login, etc.)
    api.ts          # API integration
    App.tsx         # Main app
  public/           # Static assets
```

---

## Extensibility & Testing

- **Backend:** Add new endpoints or business logic in `services/` and `api/v1/`.
- **Frontend:** Add new UI features as React components.
- **Testing:** Place backend tests in `backend/tests/`. Use Jest/React Testing Library for frontend.

---

## License

Pre-beta, not for production use. License to be determined.

---

Let me know if you want to add usage examples, API details, or deployment instructions!
