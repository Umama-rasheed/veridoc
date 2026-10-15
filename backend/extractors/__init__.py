"""Routes a file to the correct extractor based on extension / type."""
from .pdf import extract_pdf
from .docx import extract_docx
from .pptx import extract_pptx
from .image import extract_image
from .txt_md import extract_txt_md


def extract(filename: str, file_bytes: bytes = None, url: str = None) -> dict:
    name = (filename or "").lower()

    if name.endswith(".pdf"):
        return extract_pdf(file_bytes)
    if name.endswith(".docx"):
        return extract_docx(file_bytes)
    if name.endswith(".pptx"):
        return extract_pptx(file_bytes)
    if name.endswith((".png", ".jpg", ".jpeg")):
        return extract_image(file_bytes)
    if name.endswith((".txt", ".md")):
        return extract_txt_md(file_bytes)

    raise ValueError(f"Unsupported file type: {filename}")