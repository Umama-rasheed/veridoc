"""Retrieve relevant chunks for a query."""
import os
import chromadb
from sentence_transformers import SentenceTransformer

CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma_db")

_embed_model = None


def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embed_model


def _chroma():
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    return client.get_or_create_collection(
        name="veridoc",
        metadata={"hnsw:space": "cosine"}
    )


def retrieve(question: str, top_k: int = 6):
    col = _chroma()

    if col.count() == 0:
        return []

    model = _get_embed_model()
    q_embed = model.encode([question], normalize_embeddings=True)[0].tolist()

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