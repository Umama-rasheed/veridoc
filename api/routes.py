"""API routes for Veridoc."""
import os
from dotenv import load_dotenv
load_dotenv()  # belt-and-suspenders: ensures env loaded even if imported directly

import hashlib
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from backend.extractors import extract
from backend.ingest import ingest_document
from backend.retriever import retrieve
from backend.answer import answer

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---------- /api/health ----------
@router.get("/health")
def health():
    return {"status": "ok", "service": "veridoc"}


# ---------- /api/upload ----------
@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    """Accept a PDF, extract, embed, store. Returns doc_id + chunk count."""
    allowed_exts = (".pdf", ".docx", ".pptx", ".png", ".jpg", ".jpeg", ".txt", ".md")
    if not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_exts)}"
        )

    file_bytes = await file.read()
    doc_id = hashlib.md5(file_bytes).hexdigest()[:12]
    save_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{file.filename}")

    with open(save_path, "wb") as f:
        f.write(file_bytes)

    try:
        extracted = extract(file.filename, file_bytes=file_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    try:
        result = ingest_document(doc_id, file.filename, extracted)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest failed: {e}")

    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "pages": len(extracted["pages"]),
        "chars": len(extracted["text"]),
        "chunks_added": result["chunks_added"],
    }


# ---------- /api/ask ----------
class AskRequest(BaseModel):
    question: str


@router.post("/ask")
def ask(req: AskRequest):
    """Retrieve + generate an anchored answer with per-point citations."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question is empty.")

    chunks = retrieve(req.question)
    res = answer(req.question, chunks)

    return {
        "status": res["status"],
        "answer": res["answer"],
        "sources": res.get("sources", []),
        "points": res.get("points", []),
    }


class UnverifiedRequest(BaseModel):
    question: str


@router.post("/ask-unverified")
def ask_unverified(req: UnverifiedRequest):
    """General LLM answer — NOT grounded in documents. User explicitly opted in."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question is empty.")

    from openai import OpenAI
    import os

    client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY"),
    )

    system_prompt = """You are Veridoc in UNVERIFIED mode.

The user has explicitly asked for a general answer because their documents do not contain this information.

RULES:
1. Answer from your general knowledge — clearly and helpfully.
2. Start your answer with a brief 1-sentence note that this is NOT from the user's documents.
3. Do NOT pretend you have sources. Do NOT include [1] style citations.
4. Be honest that this is general knowledge and may not reflect the user's specific context.
5. Keep the answer structured: 1-2 sentence intro, then bullets or a short paragraph.

STYLE:
- Clear, warm, teacher-like
- No filler
"""

    resp = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.question},
        ],
        temperature=0.3,
    )

    text = resp.choices[0].message.content.strip()

    return {
        "status": "unverified",
        "answer": text,
        "sources": [],
    }


# ---------- /api/pdf-page ----------
class PdfPageRequest(BaseModel):
    filename: str
    page: int


@router.post("/pdf-page")
def pdf_page(req: PdfPageRequest):
    """Render a page as PNG + return word positions for highlighting."""
    import base64
    import io
    import glob
    import pdfplumber
    from pdf2image import convert_from_path

    matches = glob.glob(os.path.join(UPLOAD_DIR, f"*{req.filename}"))
    if not matches:
        raise HTTPException(status_code=404, detail=f"File not found: {req.filename}")

    pdf_path = matches[0]

    try:
        images = convert_from_path(
            pdf_path,
            first_page=req.page,
            last_page=req.page,
            dpi=150,
            poppler_path=r"C:\Users\luqma\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Render failed: {e}")

    if not images:
        raise HTTPException(status_code=404, detail="Page not found")

    buf = io.BytesIO()
    images[0].save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    image_data_url = f"data:image/png;base64,{b64}"

    words = []
    page_width = 0
    page_height = 0
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if req.page - 1 < len(pdf.pages):
                page_obj = pdf.pages[req.page - 1]
                page_width = page_obj.width
                page_height = page_obj.height
                for w in page_obj.extract_words():
                    words.append({
                        "text": w["text"],
                        "x0": w["x0"],
                        "top": w["top"],
                        "x1": w["x1"],
                        "bottom": w["bottom"],
                    })
    except Exception as e:
        print(f"[pdf-page] word extraction failed: {e}")

    return {
        "filename": req.filename,
        "page": req.page,
        "image_data_url": image_data_url,
        "page_width": page_width,
        "page_height": page_height,
        "words": words,
    }


# =====================================================
# Auth helper + History endpoints
# =====================================================
import httpx
from fastapi import Header
from typing import Optional

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://etzgiqzabbacsbvcegia.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
print(f"[startup] SUPABASE_URL = {SUPABASE_URL}")
print(f"[startup] SUPABASE_ANON_KEY = {SUPABASE_ANON_KEY[:20]}... (length={len(SUPABASE_ANON_KEY)})")


async def get_user_from_token(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {token}",
                },
                timeout=10,
            )
        if r.status_code != 200:
            return None
        user = r.json()
        return {"user_id": user.get("id"), "email": user.get("email")}
    except Exception:
        return None


class HistorySaveRequest(BaseModel):
    question: str
    answer: str | None = None
    status: str
    sources: list = []


@router.post("/history")
async def save_history(
    req: HistorySaveRequest,
    authorization: Optional[str] = Header(None),
):
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/history",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": authorization,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "user_id": user["user_id"],
                "question": req.question,
                "answer": req.answer,
                "status": req.status,
                "sources": req.sources,
            },
            timeout=10,
        )
    if r.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"Save failed: {r.text}")
    return {"ok": True}


@router.get("/history")
async def get_history(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/history?user_id=eq.{user['user_id']}&order=created_at.desc&limit=100",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": authorization,
            },
            timeout=10,
        )
    if r.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"Fetch failed: {r.text}")
    return r.json()


# =====================================================
# Documents endpoint (persistent document library)
# =====================================================
@router.get("/documents")
async def list_documents():
    """List all uploaded files (persisted in uploads/ folder)."""
    if not os.path.isdir(UPLOAD_DIR):
        return {"documents": []}

    files = []
    for f in os.listdir(UPLOAD_DIR):
        full_path = os.path.join(UPLOAD_DIR, f)
        if not os.path.isfile(full_path):
            continue

        parts = f.split("_", 1)
        original_name = parts[1] if len(parts) > 1 and len(parts[0]) == 12 else f

        files.append({
            "stored_name": f,
            "filename": original_name,
            "size": os.path.getsize(full_path),
            "uploaded_at": os.path.getmtime(full_path),
        })

    files.sort(key=lambda x: x["uploaded_at"], reverse=True)
    return {"documents": files}


@router.delete("/documents/{stored_name}")
async def delete_document(stored_name: str):
    """Delete a document from uploads/ and ChromaDB."""
    file_path = os.path.join(UPLOAD_DIR, stored_name)

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        os.remove(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")

    try:
        import chromadb
        client = chromadb.PersistentClient(path=os.getenv("CHROMA_DIR", "./chroma_db"))
        col = client.get_or_create_collection(
            name="veridoc",
            metadata={"hnsw:space": "cosine"},
        )
        doc_id = stored_name.split("_", 1)[0]
        col.delete(where={"doc_id": doc_id})
    except Exception as e:
        print(f"[delete] Chroma cleanup failed: {e}")

    return {"ok": True, "deleted": stored_name}


# =====================================================
# NEW: Raw file endpoint (for images)
# =====================================================
from fastapi.responses import FileResponse
import glob as glob_module


@router.get("/raw-file/{filename}")
async def raw_file(filename: str):
    """Serve a raw uploaded file (used for image previews)."""
    matches = glob_module.glob(os.path.join(UPLOAD_DIR, f"*{filename}"))
    if not matches:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    file_path = matches[0]
    ext = os.path.splitext(filename)[1].lower()

    mime_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    media_type = mime_types.get(ext, "application/octet-stream")

    return FileResponse(file_path, media_type=media_type)


# =====================================================
# NEW: Text preview endpoint (for pptx/docx/txt/md)
# =====================================================
@router.get("/text-preview/{filename}")
async def text_preview(filename: str):
    """Extract and return text content of a non-PDF document."""
    matches = glob_module.glob(os.path.join(UPLOAD_DIR, f"*{filename}"))
    if not matches:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    file_path = matches[0]

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    try:
        extracted = extract(filename, file_bytes=file_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    pages = extracted.get("pages", [])

    cleaned_pages = []
    for p in pages:
        raw_text = p.get("text") or ""
        if not raw_text.strip():
            continue

        # Per-line cleanup:
        # - collapse multiple spaces/tabs into one
        # - preserve \n (line breaks)
        lines = []
        blank_count = 0
        for line in raw_text.split("\n"):
            line = " ".join(line.split())  # collapse whitespace within line
            if line == "":
                blank_count += 1
                if blank_count <= 1:  # at most one blank line
                    lines.append("")
            else:
                blank_count = 0
                lines.append(line)

        # Trim leading/trailing blanks
        while lines and lines[0] == "":
            lines.pop(0)
        while lines and lines[-1] == "":
            lines.pop()

        cleaned = "\n".join(lines)

        if cleaned.strip():
            cleaned_pages.append({
                "page": p.get("page", 1),
                "text": cleaned,
            })

    return {
        "filename": filename,
        "source_type": extracted.get("source_type", "unknown"),
        "pages": cleaned_pages,
        "total_pages": len(cleaned_pages),
    }