# backend/app/services/rag.py
"""
Temporary no‑op RAG so the API server starts.
"""

def answer(query: str) -> tuple[str | None, float]:
    # Always returns fallback; score = 0.0
    return None, 0.0


# """
# Thin wrapper around llama‑index or langchain to:

# 1. Retrieve top‑k chunks from Chroma.
# 2. Detect “no answer” if score below threshold.
# 3. Return either answer text or None.
# """

# from llama_index.core import VectorStoreIndex, PromptTemplate
# from llama_index.llms.openai import OpenAI
# from llama_index.embeddings.openai import OpenAIEmbedding
# import chromadb
# from chromadb.config import Settings as ChromaSettings
# from pathlib import Path

# # store vectors under ./chroma_data/ so git ignores it
# db_path = Path(__file__).parent.parent.parent / "chroma_data"
# db_path.mkdir(exist_ok=True)

# client = chromadb.PersistentClient(path=str(db_path), settings=ChromaSettings(allow_reset=True))
# collection = client.get_or_create_collection("nhs_docs")

# # client = chromadb.HttpClient(host="vectorstore", port=8000)
# # collection = client.get_or_create_collection("nhs_docs")
# index = VectorStoreIndex.from_vector_store(collection)

# llm = OpenAI(model="gpt-4o-mini", temperature=0.2)
# prompt = PromptTemplate("You are an NHS medical info assistant...\n\n{context}\n\nQuestion: {query}")

# def answer(query: str) -> tuple[str | None, float]:
#     response = index.query(
#         query,
#         llm=llm,
#         text_qa_template=prompt,
#         similarity_top_k=4,
#     )
#     best = response.get_formatted_sources()
#     if response.extra_info["similarity_score"] < 0.15:
#         return None, response.extra_info["similarity_score"]
#     return str(response), response.extra_info["similarity_score"]
