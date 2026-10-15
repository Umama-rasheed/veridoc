"""Generate an anchored answer with dynamic structure and per-point citations."""
import os
import re
from openai import OpenAI

CHAT_MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = """You are Veridoc, a document Q&A assistant that produces detailed, grounded, essay-style answers.

GOAL:
Produce a thorough, well-structured, elaborated answer that reads like a well-written essay — while remaining 100% traceable to the provided CONTEXT.

STRUCTURE — MUST follow this shape:

1. OPENING PARAGRAPH (AT LEAST 5 SENTENCES, no heading):
   - Start directly with a clear definition or direct answer to the question
   - Expand with context, background, and why this topic matters
   - Preview what the answer will cover
   - No bullets, no headings — just a flowing introductory paragraph

2. DYNAMIC SUBHEADINGS + BULLETS:
   - Analyze the QUESTION TYPE and choose 1 to 6 relevant subheadings
   - Examples of good subheadings based on question type:
     * "What is X?" → subheadings like "Definition", "Key Characteristics", "Examples"
     * "Applications of X?" → subheadings like "Applications", "Use Cases"
     * "How does X work?" → subheadings like "Mechanism", "Steps", "Real-World Examples"
     * "Compare X vs Y?" → subheadings like "Comparison", "Key Differences", "Verdict"
     * "Advantages of X?" → subheadings like "Advantages", "Trade-offs"
   - Each subheading must be formatted as: "## <Subheading Name>"
   - Under each subheading, produce 2 to 8 bullet points
   - TOTAL bullets across all subheadings: 10 to 15 (this is a hard minimum)
   - Each bullet starts with "- " (hyphen + space)
   - Each bullet must be 25-45 words, distinct, detailed
   - Each bullet must end with one or more [n] citation tags

3. CLOSING PARAGRAPH (AT LEAST 5 SENTENCES, no heading, no "Conclusion:" label):
   - Summarize the key takeaway and its significance
   - Do NOT start with "In conclusion" or "Conclusion:"
   - Write it as a natural closing thought that ties the essay together

EVIDENCE TAGS — MUST use square brackets exactly like this: [1] [2] [3]
   - NEVER use 【1】 or 《1》 or (1)
   - ONLY [number] format
   - Every claim, number, name, or definition MUST have a tag

BOLD FORMATTING — MUST use **double asterisks** for key terms

ELABORATE using ONLY the CONTEXT:
   - You may rephrase, restructure, explain, and connect ideas across chunks
   - You may use "This means…", "For example…", "In practice…", "As a result…"
   - Do NOT invent facts, numbers, or names

WHEN INFORMATION IS MISSING: say "This isn't specified in the provided documents."
WHEN THE WHOLE QUESTION IS UNANSWERABLE: reply exactly "NO_ROOT_REFERENCE"

STYLE:
- Write like a thoughtful teacher explaining to a student
- Aim for 500-800 words total
- Use markdown formatting consistently
- Do NOT use headings like "Key Points:" or "Conclusion:" (only use ## for subheadings)
"""


def _client():
    return OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY"),
    )


def _normalize(text: str) -> str:
    return re.sub(r"[^\w\s]", "", (text or "").lower()).strip()


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text or "")
    return [s.strip() for s in parts if s.strip()]


def _find_best_snippet_and_sentence(
    point_text: str,
    chunk_text: str,
    used_snippets: set[str],
    snippet_len: int = 60,
) -> tuple[str, str]:
    """
    Find the best-matching short phrase (6-9 words) in chunk_text for a given point.
    Returns (snippet, full_sentence).

    - snippet: the most relevant 6-9 word phrase (unique across bullets)
    - full_sentence: the full sentence containing that phrase

    Respects uniqueness: if the best snippet is already in used_snippets,
    tries the next best one.
    """
    if not chunk_text:
        return "", ""

    point_words = set(_normalize(point_text).split())
    if not point_words:
        fallback = chunk_text[:snippet_len]
        return fallback, fallback

    sentences = _split_sentences(chunk_text)
    if not sentences:
        fallback = chunk_text[:snippet_len]
        return fallback, fallback

    # Score each sentence by word overlap with the point
    scored = []
    for sent in sentences:
        sent_words = set(_normalize(sent).split())
        if not sent_words:
            continue
        overlap = len(point_words & sent_words)
        score = overlap / max(len(point_words), 1)
        scored.append((score, sent))

    scored.sort(key=lambda x: x[0], reverse=True)

    # Try sentences from best match down, finding a unique 6-9 word snippet
    for score, sent in scored:
        if score < 0.10:
            continue

        # Split into words
        words = sent.split()
        if len(words) < 3:
            continue

        # Find the best 6-9 word window in this sentence
        best_window = None
        best_window_score = (-1, -1)

        win_min = 6
        win_max = 9
        for win_size in range(win_min, min(win_max + 1, len(words) + 1)):
            for start in range(0, len(words) - win_size + 1):
                window = words[start:start + win_size]
                window_norm = set(_normalize(" ".join(window)).split())
                if not window_norm:
                    continue
                overlap = len(point_words & window_norm)
                # Prefer higher overlap, tie-break by longer windows
                score_here = (overlap, win_size)
                if score_here > best_window_score:
                    best_window_score = score_here
                    best_window = window

        if not best_window:
            continue

        snippet = " ".join(best_window)
        snippet_norm = _normalize(snippet)

        # Uniqueness check
        if snippet_norm in used_snippets:
            continue

        used_snippets.add(snippet_norm)
        return snippet, sent

    # Fallback — use a short prefix of the chunk that isn't already used
    for start in range(0, len(chunk_text) - snippet_len, snippet_len // 2):
        candidate = chunk_text[start:start + snippet_len].strip()
        candidate_norm = _normalize(candidate)
        if candidate_norm and candidate_norm not in used_snippets:
            used_snippets.add(candidate_norm)
            first_sentence = _split_sentences(candidate)[0] if candidate else candidate
            return candidate, first_sentence

    # Give up — return what we have
    fallback = chunk_text[:snippet_len]
    return fallback, fallback


def _parse_structured_points(text: str) -> list[dict]:
    """
    Extract subheadings and bullets from the LLM answer.
    Returns list of items, each one of:
      {"type": "subheading", "text": "..."}
      {"type": "bullet", "text": "...", "tags": [1,2]}
    """
    items = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("## "):
            items.append({"type": "subheading", "text": line[3:].strip()})
            continue
        if line.startswith("# "):
            items.append({"type": "subheading", "text": line[2:].strip()})
            continue
        if line.startswith("- ") or line.startswith("• "):
            content = re.sub(r"^[-•]\s+", "", line).strip()
            if not content:
                continue
            tags = [int(m) for m in re.findall(r"\[(\d+)\]", content)]
            items.append({"type": "bullet", "text": content, "tags": tags})
    return items


def answer(question: str, chunks: list[dict]):
    if not chunks:
        return {"status": "not_found", "answer": None, "sources": [], "points": [], "blocks": []}

    best_score = max(c.get("score", 0) for c in chunks)
    print(f"[answer] best_score = {best_score:.3f} for: {question[:60]}")

    if best_score < 0.40:
        return {"status": "not_found", "answer": None, "sources": [], "points": [], "blocks": []}

    context = "\n\n".join(
        f"[{i + 1}] (from {c['filename']}, page {c['page']}):\n{c['text']}"
        for i, c in enumerate(chunks)
    )

    user_msg = f"CONTEXT:\n{context}\n\nQUESTION: {question}"

    resp = _client().chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        temperature=0,
    )

    text = resp.choices[0].message.content.strip()

    if "NO_ROOT_REFERENCE" in text:
        return {"status": "not_found", "answer": None, "sources": [], "points": [], "blocks": []}

    refusal_patterns = [
        "not in the provided documents",
        "not specified in the provided documents",
        "does not exist in your uploaded documents",
        "isn't in the provided context",
        "is not in the context",
        "no information",
        "not mentioned in the",
        "cannot be found in the",
        "not found in the",
        "not present in the",
        "does not contain information",
        "do not contain information",
    ]
    lower = text.lower()
    if any(p in lower for p in refusal_patterns):
        return {"status": "not_found", "answer": None, "sources": [], "points": [], "blocks": []}

    # ---- Parse structured items ----
    items = _parse_structured_points(text)

    # ---- Build unique sources + points + blocks ----
    sources = []
    points_out = []
    blocks_out = []
    used_snippets: set[str] = set()
    next_tag = 1

    for item in items:
        if item["type"] == "subheading":
            blocks_out.append({"type": "subheading", "text": item["text"]})
            continue

        # Bullet
        pt_tags = item.get("tags", [])
        if not pt_tags:
            # Bullet without tag — still include, no citation
            blocks_out.append({"type": "bullet", "text": item["text"], "tag": None})
            points_out.append({
                "text": item["text"],
                "evidence_tag": None,
                "filename": None,
                "page": None,
                "snippet": "",
                "sentence": "",
            })
            continue

        primary = pt_tags[0]
        if primary - 1 >= len(chunks):
            continue
        chunk = chunks[primary - 1]

        snippet, sentence = _find_best_snippet_and_sentence(
            item["text"], chunk["text"], used_snippets
        )

        tag = next_tag
        next_tag += 1

        sources.append({
            "evidence_tag": tag,
            "filename": chunk["filename"],
            "page": chunk["page"],
            "snippet": sentence or snippet,   # viewer uses this to highlight
        })

        points_out.append({
            "text": item["text"],
            "evidence_tag": tag,
            "filename": chunk["filename"],
            "page": chunk["page"],
            "snippet": sentence or snippet,
        })

        blocks_out.append({
            "type": "bullet",
            "text": item["text"],
            "tag": tag,
        })

    if not sources:
        sources = [
            {
                "evidence_tag": i + 1,
                "filename": c["filename"],
                "page": c["page"],
                "snippet": c["text"][:220],
            }
            for i, c in enumerate(chunks)
        ]

    return {
        "status": "anchored",
        "answer": text,
        "sources": sources,
        "points": points_out,
        "blocks": blocks_out,
    }