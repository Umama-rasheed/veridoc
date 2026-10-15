"""Chunk text, embed locally, store in ChromaDB."""
import os
import uuid
import chromadb
from sentence_transformers import SentenceTransformer

CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma_db")
CHUNK_SIZE = 400
CHUNK_OVERLAP = 100

# Load local embedding model once (free, no API needed)
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


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP):
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start = end - overlap
    return [c for c in chunks if c.strip()]


def embed_batch(texts: list[str]) -> list[list[float]]:
    model = _get_embed_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return [e.tolist() for e in embeddings]


def ingest_document(doc_id: str, filename: str, extracted: dict):
    col = _chroma() 
    try:
        col.delete(where={"doc_id": doc_id})
        print(f"[ingest] Removed old chunks for doc_id={doc_id}")
    except Exception as e:
        print(f"[ingest] No existing chunks to remove: {e}") 
    chunks, metadatas, ids = [], [], []

    for page in extracted["pages"]:
        page_text = page["text"]
        if not page_text.strip():
            continue
        for chunk in chunk_text(page_text):
            chunks.append(chunk)
            metadatas.append({
                "doc_id": doc_id,
                "filename": filename,
                "page": page["page"],
                "source_type": extracted["source_type"],
            })
            ids.append(str(uuid.uuid4()))

    if not chunks:
        return {"chunks_added": 0}

    embeddings = embed_batch(chunks)

    col.add(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas,
    )

    return {"chunks_added": len(chunks)}