"""PDF extractor — text-based via pdfplumber, OCR fallback via pytesseract."""
import io
import pdfplumber
from PIL import Image
import pytesseract


def extract_pdf(file_bytes: bytes) -> dict:
    """
    Returns:
        {
          "text": str,
          "pages": [{"page": 1, "text": "..."}, ...],
          "source_type": "pdf",
          "used_ocr": bool
        }
    """
    pages = []
    used_ocr = False

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""

            # If no text → likely scanned page → OCR
            if not text.strip():
                used_ocr = True
                try:
                    pil_img = page.to_image(resolution=200).original
                    text = pytesseract.image_to_string(pil_img)
                except Exception as e:
                    text = f"[OCR failed on page {i}: {e}]"

            pages.append({"page": i, "text": text.strip()})

    full_text = "\n\n".join(p["text"] for p in pages if p["text"])

    return {
        "text": full_text,
        "pages": pages,
        "source_type": "pdf",
        "used_ocr": used_ocr,
    }