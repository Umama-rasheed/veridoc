"""Retrieve relevant chunks for a query — using Gemini Embeddings."""
import os
import chromadb
from google import genai

CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma_db")
EMBED_MODEL = "text-embedding-004"

_client = None

def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        _client = genai.Client(api_key=api_key)
    return _client


def _chroma():
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    return client.get_or_create_collection(
        name="veridoc",
        metadata={"hnsw:space": "cosine"}
    )


def get_query_embedding(question: str) -> list[float]:
    """Generate embedding for a search query using Gemini."""
    client = _get_client()
    result = client.models.embed_content(
        model=EMBED_MODEL,
        contents=[question],
        config={"task_type": "RETRIEVAL_QUERY"},
    )
    return result.embeddings[0].values


def retrieve(question: str, top_k: int = 6):
    col = _chroma()

    if col.count() == 0:
        return []

    q_embed = get_query_embedding(question)

    results = col.query(
        query_embeddings=[q_embed],
        n_results=min(top_k, col.count()),
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for text, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "text": text,
            "filename": meta["filename"],
            "page": meta["page"],
            "source_type": meta["source_type"],
            "score": 1 - dist,
        })

    return chunks