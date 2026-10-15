"""Chunk text, embed via Gemini API, store in ChromaDB."""
import os
import uuid
import chromadb
from google import genai

CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma_db")
CHUNK_SIZE = 400
CHUNK_OVERLAP = 100
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


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP):
    """Split text into overlapping chunks respecting word boundaries."""
    if not text:
        return []
    words = text.split()
    chunks = []
    current = []
    current_len = 0
    for word in words:
        if current_len + len(word) + 1 > size and current:
            chunks.append(" ".join(current))
            # keep overlap
            overlap_words = []
            overlap_len = 0
            for w in reversed(current):
                if overlap_len + len(w) + 1 > overlap:
                    break
                overlap_words.insert(0, w)
                overlap_len += len(w) + 1
            current = overlap_words
            current_len = overlap_len
        current.append(word)
        current_len += len(word) + 1
    if current:
        chunks.append(" ".join(current))
    return [c for c in chunks if c.strip()]


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings using Gemini API."""
    client = _get_client()
    result = client.models.embed_content(
        model=EMBED_MODEL,
        contents=texts,
        config={"task_type": "RETRIEVAL_DOCUMENT"},
    )
    return [emb.values for emb in result.embeddings]


def ingest_document(doc_id: str, filename: str, extracted: dict):
    col = _chroma()

    # Remove old chunks for this doc_id to prevent duplicates
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