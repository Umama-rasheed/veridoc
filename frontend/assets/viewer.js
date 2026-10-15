// Viewer — branches by file type: PDF, image, or text preview
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const filename = params.get("file");
  const page = parseInt(params.get("page") || "1", 10);
  const snippet = params.get("snippet") || "";
  const sentence = params.get("sentence") || "";

  // DOM refs
  const pdfWrapper = document.getElementById("pdfWrapper");
  const pdfImage = document.getElementById("pdfImage");
  const pdfLoading = document.getElementById("pdfLoading");
  const highlightOverlay = document.getElementById("highlightOverlay");
  const imageWrapper = document.getElementById("imageWrapper");
  const imagePreview = document.getElementById("imagePreview");
  const textWrapper = document.getElementById("textWrapper");
  const textPreviewContainer = document.getElementById("textPreviewContainer");
  const viewerFileIcon = document.getElementById("viewerFileIcon");
  const viewerFilename = document.getElementById("viewerFilename");
  const viewerPageLabel = document.getElementById("viewerPageLabel");
  const breadcrumbFile = document.getElementById("breadcrumbFile");
  const breadcrumbPage = document.getElementById("breadcrumbPage");
  const metaFilename = document.getElementById("metaFilename");
  const metaPage = document.getElementById("metaPage");
  const currentPageDisplay = document.getElementById("currentPageDisplay");
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");
  const openFullDocBtn = document.getElementById("openFullDocBtn");

  // Guard: no file
  if (!filename) {
    pdfLoading.innerHTML = `
      <div class="flex flex-col items-center justify-center gap-4 text-center max-w-md px-6">
        <span class="material-symbols-outlined text-[64px] text-outline">find_in_page</span>
        <h2 class="font-headline-md text-headline-md text-on-surface">No citation selected</h2>
        <p class="font-body-md text-body-md text-on-surface-variant">
          The Viewer opens when you click a citation <span class="font-mono text-primary">[1]</span> inside an answer.
        </p>
        <a href="ask.html" class="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-fixed font-label-md hover:bg-primary transition-all shadow-md">
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Go to Ask</span>
        </a>
      </div>
    `;
    return;
  }

  let currentPage = page;

  // Common metadata updates
  viewerFilename.textContent = filename;
  metaFilename.textContent = filename;
  breadcrumbFile.innerHTML = `<span class="material-symbols-outlined text-[15px] text-primary">description</span> ${escapeHtml(filename)}`;

  // Determine file type
  const lower = filename.toLowerCase();
  const isPdf = lower.endsWith(".pdf");
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/.test(lower);
  const isText = /\.(pptx|docx|txt|md)$/.test(lower);

  // ---- API base ----
  const API_BASE = "https://veridoc-3ysg.onrender.com/api";

  // ==================================================
  // HIGHLIGHT: PDF (position-based)
  // ==================================================
  function highlightSnippet(words, pageWidth, pageHeight, imgEl, snippetText, sentenceText, overlay) {
    if (!words.length || !pageWidth || !pageHeight || !snippetText) {
      overlay.style.display = "none";
      return;
    }

    const normalize = (t) => t.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const snippetWords = normalize(snippetText).split(/\s+/).filter(Boolean);
    if (snippetWords.length === 0) {
      overlay.style.display = "none";
      return;
    }

    const normalizedWords = words.map(w => ({ ...w, norm: normalize(w.text) }));

    let bestStart = -1;
    let bestLen = 0;

    const snippetLen = snippetWords.length;
    const scanLengths = [
      snippetLen,
      Math.min(snippetLen, 7),
      Math.min(snippetLen, 6),
      Math.min(snippetLen, 5),
      Math.min(snippetLen, 4),
      Math.min(snippetLen, 3),
    ];

    for (const L of scanLengths) {
      if (L < 3) continue;
      for (let start = 0; start < snippetWords.length - L + 1; start++) {
        const target = snippetWords.slice(start, start + L);
        for (let i = 0; i <= normalizedWords.length - L; i++) {
          let match = true;
          for (let j = 0; j < L; j++) {
            if (normalizedWords[i + j].norm !== target[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            bestStart = i;
            bestLen = L;
            break;
          }
        }
        if (bestStart !== -1) break;
      }
      if (bestStart !== -1) break;
    }

    if (bestStart === -1) {
      overlay.style.display = "none";
      return;
    }

    // Extend to full sentence
    let sentenceStart = bestStart;
    let sentenceEnd = bestStart + bestLen - 1;

    if (sentenceText) {
      const sentenceNorm = normalize(sentenceText);
      const sentenceWords = sentenceNorm.split(/\s+/).filter(Boolean);
      if (sentenceWords.length >= 2) {
        const firstWord = sentenceWords[0];
        const lastWord = sentenceWords[sentenceWords.length - 1];

        for (let i = bestStart; i >= Math.max(0, bestStart - 30); i--) {
          if (normalizedWords[i].norm === firstWord) {
            sentenceStart = i;
            break;
          }
        }

        for (let j = bestStart + bestLen - 1; j < Math.min(normalizedWords.length, bestStart + bestLen + 60); j++) {
          if (normalizedWords[j].norm === lastWord) {
            sentenceEnd = j;
            break;
          }
        }
      }
    }

    const matchedWords = normalizedWords.slice(sentenceStart, sentenceEnd + 1);
    if (matchedWords.length === 0) {
      overlay.style.display = "none";
      return;
    }

    const x0 = Math.min(...matchedWords.map(w => w.x0));
    const x1 = Math.max(...matchedWords.map(w => w.x1));
    const y0 = Math.min(...matchedWords.map(w => w.top));
    const y1 = Math.max(...matchedWords.map(w => w.bottom));

    const imgW = imgEl.clientWidth;
    const imgH = imgEl.clientHeight;
    const scaleX = imgW / pageWidth;
    const scaleY = imgH / pageHeight;

    overlay.style.display = "block";
    overlay.style.left = `${x0 * scaleX - 6}px`;
    overlay.style.top = `${y0 * scaleY - 4}px`;
    overlay.style.width = `${(x1 - x0) * scaleX + 12}px`;
    overlay.style.height = `${(y1 - y0) * scaleY + 8}px`;
  }

  // ==================================================
  // HIGHLIGHT: Plain text (for PPTX/DOCX/TXT previews)
  // ==================================================
  function highlightTextSnippet(text, snippetText) {
    if (!snippetText || !text) return escapeHtml(text);

    const normalize = (t) => t.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const snippetWords = normalize(snippetText).split(/\s+/).filter(Boolean);
    if (snippetWords.length === 0) return escapeHtml(text);

    // Tokenize the text into words + whitespace (kept as separate tokens)
    const words = text.split(/(\s+)/);

    // Build a flat list of {norm, idx} for word tokens only
    const normalizedWords = [];
    words.forEach((tok, idx) => {
      const n = normalize(tok);
      if (n) normalizedWords.push({ norm: n, idx });
    });

    // Try the longest match first, down to 4 words
    for (let len = Math.min(snippetWords.length, 9); len >= 4; len--) {
      for (let start = 0; start < snippetWords.length - len + 1; start++) {
        const target = snippetWords.slice(start, start + len);
        for (let i = 0; i <= normalizedWords.length - len; i++) {
          let match = true;
          for (let j = 0; j < len; j++) {
            if (normalizedWords[i + j].norm !== target[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            // Found — extend to the containing sentence
            const startOrigIdx = normalizedWords[i].idx;
            const endOrigIdx = normalizedWords[i + len - 1].idx;

            let extendedStart = startOrigIdx;
            let extendedEnd = endOrigIdx;

            // Walk left to previous punctuation or start
            for (let k = startOrigIdx - 1; k >= 0; k--) {
              extendedStart = k;
              const t = words[k] || "";
              if (/[.!?]\s*$/.test(t)) break;
            }

            // Walk right to next punctuation
            for (let k = endOrigIdx + 1; k < words.length; k++) {
              extendedEnd = k;
              const t = words[k] || "";
              if (/[.!?]/.test(t)) break;
            }

            const before = words.slice(0, extendedStart).join("");
            const hit = words.slice(extendedStart, extendedEnd + 1).join("");
            const after = words.slice(extendedEnd + 1).join("");

            return `${escapeHtml(before)}<mark class="bg-sky-300/35 text-on-surface border-b-2 border-sky-400 px-0.5 rounded-sm">${escapeHtml(hit)}</mark>${escapeHtml(after)}`;
          }
        }
      }
    }

    return escapeHtml(text);
  }

  // ==================================================
  // LOADER: PDF
  // ==================================================
  async function loadPdf(p) {
    currentPage = p;
    pdfLoading.classList.remove("hidden");
    pdfWrapper.classList.add("hidden");
    imageWrapper.classList.add("hidden");
    textWrapper.classList.add("hidden");

    try {
      const result = await window.VeridocAPI.getPdfPage(filename, p);
      pdfImage.src = result.image_data_url;

      pdfImage.onload = () => {
        pdfLoading.classList.add("hidden");
        pdfWrapper.classList.remove("hidden");

        if (snippet) {
          highlightSnippet(
            result.words || [],
            result.page_width,
            result.page_height,
            pdfImage,
            snippet,
            sentence,
            highlightOverlay
          );
        }
      };

      const pageLabel = `Page ${p}`;
      viewerPageLabel.textContent = pageLabel;
      breadcrumbPage.textContent = pageLabel;
      metaPage.textContent = String(p);
      currentPageDisplay.textContent = String(p);

      prevBtn.disabled = p <= 1;
      prevBtn.classList.toggle("opacity-40", p <= 1);
      prevBtn.classList.toggle("cursor-not-allowed", p <= 1);
      nextBtn.disabled = false;
      nextBtn.classList.remove("opacity-40", "cursor-not-allowed");
    } catch (err) {
      pdfLoading.innerHTML = `
        <span class="material-symbols-outlined text-[48px] text-error">error</span>
        <span class="font-label-md text-error">Failed to load page: ${escapeHtml(err.message)}</span>
      `;
    }
  }

  // ==================================================
  // LOADER: Image (PNG / JPG)
  // ==================================================
  async function loadImage() {
    pdfLoading.classList.remove("hidden");
    pdfWrapper.classList.add("hidden");
    imageWrapper.classList.add("hidden");
    textWrapper.classList.add("hidden");

    try {
      imagePreview.src = `${API_BASE}/raw-file/${encodeURIComponent(filename)}`;
      imagePreview.onload = () => {
        pdfLoading.classList.add("hidden");
        imageWrapper.classList.remove("hidden");
      };
      imagePreview.onerror = () => {
        pdfLoading.innerHTML = `
          <span class="material-symbols-outlined text-[48px] text-error">error</span>
          <span class="font-label-md text-error">Failed to load image.</span>
        `;
      };

      viewerFileIcon.textContent = "image";
      viewerPageLabel.textContent = "Image";
      breadcrumbPage.textContent = "Image";
      metaPage.textContent = "—";
      currentPageDisplay.textContent = "—";

      prevBtn.disabled = true;
      nextBtn.disabled = true;
      prevBtn.classList.add("opacity-40", "cursor-not-allowed");
      nextBtn.classList.add("opacity-40", "cursor-not-allowed");
    } catch (err) {
      pdfLoading.innerHTML = `
        <span class="material-symbols-outlined text-[48px] text-error">error</span>
        <span class="font-label-md text-error">Failed: ${escapeHtml(err.message)}</span>
      `;
    }
  }

  // ==================================================
  // LOADER: Text preview (PPTX / DOCX / TXT / MD)
  // ==================================================
  async function loadText() {
    pdfLoading.classList.remove("hidden");
    pdfWrapper.classList.add("hidden");
    imageWrapper.classList.add("hidden");
    textWrapper.classList.add("hidden");

    try {
      const res = await fetch(`${API_BASE}/text-preview/${encodeURIComponent(filename)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to load text preview");
      }
      const data = await res.json();

      // Icon based on source_type
      const icons = { pptx: "slideshow", docx: "article", text: "description" };
      viewerFileIcon.textContent = icons[data.source_type] || "description";

      // Render each page as a card
      const pagesHtml = (data.pages || []).map(p => `
        <div class="bg-surface-container rounded-xl p-5 shadow-md border border-outline-variant/30">
          <div class="flex items-center justify-between mb-3 pb-3 border-b border-outline-variant/30">
            <span class="inline-flex items-center gap-1.5 font-label-sm text-label-sm text-primary uppercase tracking-wider">
              <span class="material-symbols-outlined text-[16px]">${data.source_type === "pptx" ? "slideshow" : "description"}</span>
              ${data.source_type === "pptx" ? `Slide ${p.page}` : `Page ${p.page}`}
            </span>
            <span class="font-label-sm text-label-sm text-outline">${p.text.length} chars</span>
          </div>
          <div class="font-body-md text-body-md text-on-surface leading-relaxed whitespace-pre-wrap">${highlightTextSnippet(p.text, snippet)}</div>
        </div>
      `).join("");

      textPreviewContainer.innerHTML = pagesHtml || `
        <div class="bg-surface-container rounded-xl p-8 text-center">
          <p class="text-outline">No text content found in this file.</p>
        </div>
      `;

      pdfLoading.classList.add("hidden");
      textWrapper.classList.remove("hidden");

      const typeLabel = data.source_type === "pptx" ? "Slides" : "Sections";
      viewerPageLabel.textContent = `${data.total_pages} ${typeLabel}`;
      breadcrumbPage.textContent = `${data.total_pages} ${typeLabel}`;
      metaPage.textContent = String(data.total_pages);
      currentPageDisplay.textContent = "—";

      prevBtn.disabled = true;
      nextBtn.disabled = true;
      prevBtn.classList.add("opacity-40", "cursor-not-allowed");
      nextBtn.classList.add("opacity-40", "cursor-not-allowed");
    } catch (err) {
      pdfLoading.innerHTML = `
        <span class="material-symbols-outlined text-[48px] text-error">error</span>
        <span class="font-label-md text-error">Failed: ${escapeHtml(err.message)}</span>
      `;
    }
  }

  // ==================================================
  // ROUTER
  // ==================================================
  if (isPdf) {
    openFullDocBtn.classList.remove("hidden");
    openFullDocBtn.href = `viewer.html?file=${encodeURIComponent(filename)}&page=1`;

    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) loadPdf(currentPage - 1);
    });
    nextBtn.addEventListener("click", () => loadPdf(currentPage + 1));

    await loadPdf(page);
  } else if (isImage) {
    await loadImage();
  } else if (isText) {
    await loadText();
  } else {
    pdfLoading.innerHTML = `
      <div class="flex flex-col items-center justify-center gap-4 text-center max-w-md px-6">
        <span class="material-symbols-outlined text-[64px] text-outline">help</span>
        <h2 class="font-headline-md text-headline-md text-on-surface">Unsupported file type</h2>
        <p class="font-body-md text-body-md text-on-surface-variant">
          Veridoc can't preview <span class="font-mono text-primary">${escapeHtml(filename)}</span> yet.
        </p>
        <a href="ask.html" class="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-fixed font-label-md hover:bg-primary transition-all shadow-md">
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Ask</span>
        </a>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }
});