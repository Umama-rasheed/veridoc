"""Image extractor — OCR via Tesseract."""
import io
import pytesseract
from PIL import Image
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def extract_image(file_bytes: bytes) -> dict:
    try:
        img = Image.open(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Failed to open image: {e}")

    if img.mode != "RGB":
        img = img.convert("RGB")

    try:
        text = pytesseract.image_to_string(img)
    except Exception as e:
        raise ValueError(f"OCR failed: {e}. Is Tesseract installed?")

    cleaned = text.strip()

    return {
        "text": cleaned,
        "pages": [{"page": 1, "text": cleaned}],
        "source_type": "image",
        "used_ocr": True,
    }