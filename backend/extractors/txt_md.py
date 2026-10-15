"""TXT / Markdown extractor — direct read."""


def extract_txt_md(file_bytes: bytes) -> dict:
    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1", errors="ignore")

    text = text.strip()

    return {
        "text": text,
        "pages": [{"page": 1, "text": text}],
        "source_type": "text",
        "used_ocr": False,
    }