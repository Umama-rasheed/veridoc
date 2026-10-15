"""DOCX extractor — preserves paragraphs and list structure."""
import io
from docx import Document


def extract_docx(file_bytes: bytes) -> dict:
    try:
        doc = Document(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Failed to open DOCX: {e}")

    lines = []

    for p in doc.paragraphs:
        text = p.text.strip()
        if not text:
            # Preserve intentional blank lines between paragraphs
            if lines and lines[-1] != "":
                lines.append("")
            continue

        style_name = (p.style.name or "").lower() if p.style else ""

        # Detect list items
        is_list = (
            "list" in style_name
            or "bullet" in style_name
            or style_name.startswith("list paragraph")
        )

        if is_list:
            lines.append(f"• {text}")
        else:
            lines.append(text)

    # ---- Include table text too ----
    for table in doc.tables:
        lines.append("")  # blank before table
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            if any(cells):
                lines.append(" | ".join(cells))
        lines.append("")  # blank after table

    # Clean up: collapse 3+ blank lines → single blank
    cleaned = []
    blank_count = 0
    for line in lines:
        if line.strip() == "":
            blank_count += 1
            if blank_count <= 1:
                cleaned.append("")
        else:
            blank_count = 0
            cleaned.append(line)

    # Trim leading/trailing blanks
    while cleaned and cleaned[0] == "":
        cleaned.pop(0)
    while cleaned and cleaned[-1] == "":
        cleaned.pop()

    full_text = "\n".join(cleaned)

    return {
        "text": full_text,
        "pages": [{"page": 1, "text": full_text}],
        "source_type": "docx",
        "used_ocr": False,
    }