"""RAG helper functions used by /chat endpoints."""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional, Tuple

import openai
from chromadb import PersistentClient
from llama_index.core import Settings, VectorStoreIndex
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.vector_stores.chroma import ChromaVectorStore

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
openai.api_key = os.getenv("OPENAI_API_KEY")
SIM_THRESHOLD: float = 0.30  # minimum similarity to accept an answer

INDEX_DIR = (
    Path(__file__)
    .resolve()
    .parent.parent  # → backend/app/
    / "../rag/chroma_db"     # backend/rag/chroma_db
).resolve()

# --------------------------------------------------------------------------- #
# Initialise Chroma‑powered query engine (loads once per worker)
# --------------------------------------------------------------------------- #
chroma_client = PersistentClient(path=str(INDEX_DIR))
collection = chroma_client.get_or_create_collection("nhs_docs")

store = ChromaVectorStore(chroma_collection=collection, stores_text=True)

Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0.2)

index = VectorStoreIndex.from_vector_store(store)
query_engine = index.as_query_engine(similarity_top_k=4)

# --------------------------------------------------------------------------- #
# Public helper
# --------------------------------------------------------------------------- #
def answer(query: str) -> Tuple[Optional[str], float, List[str]]:
    """
    Run the RAG pipeline and decide whether to answer or fall back.

    Returns
    -------
    (response_text | None, similarity_score, sources)

    * If similarity < SIM_THRESHOLD **or** retrieved pages are not NHS /
      Cancer Research UK, returns (None, score, links) to indicate fallback.
    * Raises RuntimeError("rag_error: …") for network / OpenAI issues so the
      caller can log the reason.
    """
    # ---- Retrieve & generate -------------------------------------------------
    try:
        res = query_engine.query(query)  # llama‑index Response object
    except Exception as exc:
        raise RuntimeError(f"rag_error: {exc}") from exc

    # ---- If nothing retrieved, force fallback --------------------------------
    if not res.source_nodes:
        return None, 0.0, []

    # ---- Gather source URLs ---------------------------------------------------
    links: List[str] = [
        n.node.metadata.get("source", "")
        for n in res.source_nodes
        if n.node.metadata.get("source")
    ]
    # Domain filter: only NHS / Cancer Research pages are considered valid.
    if not any(("nhs.uk" in url) or ("cancerresearchuk.org" in url) for url in links):
        return None, 0.0, links

    # ---- Similarity score -----------------------------------------------------
    score = res.source_nodes[0].score or 0.0
    print(f"[DEBUG] similarity '{query[:30]}…' = {score:.3f}")

    # ---- Decision -------------------------------------------------------------
    if score < SIM_THRESHOLD:
        return None, score, links  # low similarity → fallback
    return str(res), score, links  # success
