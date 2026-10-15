// Ask page — dynamic subheadings + per-point citations
document.addEventListener("DOMContentLoaded", () => {

  const input = document.getElementById("veridoc-inquiry-input");
  const submitBtn = document.getElementById("btn-submit-query");

  if (!input || !submitBtn) return;

  async function runQuery() {
    const question = input.value.trim();
    if (!question) return;

    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>';
    submitBtn.disabled = true;

    try {
      const result = await window.VeridocAPI.askQuestion(question);
      renderAnswer(question, result);

      sessionStorage.setItem("veridoc_last_query", question);
      sessionStorage.setItem("veridoc_last_answer", result.answer || "");
      sessionStorage.setItem("veridoc_last_status", result.status);
      sessionStorage.setItem("veridoc_last_sources", JSON.stringify(result.sources || []));
      sessionStorage.setItem("veridoc_last_points", JSON.stringify(result.points || []));
      sessionStorage.setItem("veridoc_last_blocks", JSON.stringify(result.blocks || []));

      try {
        const session = await window.Auth.getSession();
        if (session && !window.Auth.isGuest()) {
          await fetch(`https://veridoc-3ysg.onrender.com/api/history`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              question: question,
              answer: result.answer,
              status: result.status,
              sources: result.sources || [],
            }),
          });
        }
      } catch (e) {
        console.warn("History save failed:", e);
      }
    } catch (err) {
      alert("Query failed: " + err.message);
    } finally {
      submitBtn.innerHTML = originalHTML;
      submitBtn.disabled = false;
    }
  }

  submitBtn.addEventListener("click", runQuery);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runQuery();
  });

  function renderAnswer(question, result) {
    const leftCol = document.querySelector(".lg\\:col-span-8");
    if (!leftCol) return;

    if (result.status === "anchored") {
      let bodyHtml = "";

      if (result.blocks && result.blocks.length > 0) {
        // Opening paragraph: extract raw non-bullet, non-subheading lines from the answer before the first ## 
        const rawLines = (result.answer || "").split("\n").map(l => l.trimEnd());
        let openingEnd = rawLines.findIndex(l => /^##\s/.test(l) || /^\s*[-•]\s+/.test(l));
        if (openingEnd === -1) openingEnd = rawLines.length;
        const openingText = rawLines
          .slice(0, openingEnd)
          .map(l => l.trim())
          .filter(Boolean)
          .filter(l => !/^#+\s/.test(l))
          .join(" ");

        if (openingText) {
          bodyHtml += `<p class="leading-relaxed mb-4">${formatInline(openingText)}</p>`;
        }

        // Render blocks (subheadings + bullets)
        let inList = false;
        for (const block of result.blocks) {
          if (block.type === "subheading") {
            if (inList) {
              bodyHtml += `</ul>`;
              inList = false;
            }
            bodyHtml += `<h3 class="font-headline-sm text-headline-sm text-on-surface mt-6 mb-3 tracking-tight">${escapeHtml(block.text)}</h3>`;
          } else if (block.type === "bullet") {
            if (!inList) {
              bodyHtml += `<ul class="flex flex-col gap-3 my-3">`;
              inList = true;
            }
            const withTag = insertTagIntoPoint(block.text, block.tag);
            bodyHtml += `<li class="ml-4 list-disc leading-relaxed">${withTag}</li>`;
          }
        }
        if (inList) bodyHtml += `</ul>`;

        // Closing paragraph: extract raw lines after the last bullet
        let lastBulletIdx = -1;
        rawLines.forEach((l, i) => {
          if (/^\s*[-•]\s+/.test(l)) lastBulletIdx = i;
        });

        if (lastBulletIdx >= 0) {
          const closingText = rawLines
            .slice(lastBulletIdx + 1)
            .map(l => l.trim())
            .filter(Boolean)
            .filter(l => !/^#+\s/.test(l))
            .join(" ");
          if (closingText) {
            bodyHtml += `<p class="leading-relaxed mt-4">${formatInline(closingText)}</p>`;
          }
        }
      } else {
        bodyHtml = formatAnswer(result.answer);
      }

      leftCol.innerHTML = `
        <article class="bg-surface-container rounded-xl shadow-xl overflow-hidden relative">
          <div class="h-0.5 w-full bg-gradient-to-r from-transparent via-primary-container to-transparent opacity-80"></div>
          <div class="p-space-lg md:p-space-xl flex flex-col gap-space-md">
            <div class="flex items-center justify-between flex-wrap gap-2 pb-2">
              <div class="inline-flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
                <span class="font-label-md text-label-md text-primary tracking-wider uppercase">Verified Answer</span>
              </div>
              <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/20 text-secondary">
                <span class="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_currentColor]"></span>
                <span class="font-label-sm text-label-sm font-medium">Anchored (${(result.sources || []).length} Sources)</span>
              </div>
            </div>
            <h2 class="font-headline-md text-headline-md text-on-surface">${escapeHtml(question)}</h2>
            <div class="font-body-md text-body-md text-on-surface leading-relaxed space-y-2">${bodyHtml}</div>
          </div>
        </article>
      `;

      leftCol.querySelectorAll(".citation-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const n = btn.getAttribute("data-citation");
          const source = (result.sources || []).find(s => String(s.evidence_tag) === String(n));
          if (!source) return;

          const params = new URLSearchParams({
            file: source.filename,
            page: source.page,
            snippet: source.snippet || "",
          });
          window.location.href = `viewer.html?${params.toString()}`;
        });
      });

      renderSources(result.sources || []);
    } else {
      leftCol.innerHTML = `
        <article class="bg-surface-container-low rounded-xl shadow-lg p-space-lg md:p-space-xl flex flex-col gap-space-md">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="inline-flex items-center gap-2 text-error">
              <span class="material-symbols-outlined text-[18px]">gpp_maybe</span>
              <span class="font-label-md text-label-md uppercase tracking-wider font-semibold">Verification Boundary</span>
            </div>
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error-container/40 text-error">
              <span class="w-2 h-2 rounded-full bg-error shadow-[0_0_8px_currentColor]"></span>
              <span class="font-label-sm text-label-sm font-medium">No Root Reference Available</span>
            </div>
          </div>
          <div class="p-3.5 rounded-lg bg-surface-container text-on-surface-variant font-body-sm text-body-sm flex items-center gap-2.5">
            <span class="material-symbols-outlined text-outline text-[18px] shrink-0">help_outline</span>
            <span>User asked: <span class="text-on-surface italic">"${escapeHtml(question)}"</span></span>
          </div>
          <p class="font-body-md text-body-md text-on-surface">
            This information does not exist in your uploaded documents.
            <span class="font-semibold text-primary">Veridoc will not hallucinate facts.</span>
          </p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Would you like a general ungrounded web/LLM answer instead?
          </p>
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <button id="btn-unverified-yes" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-tertiary-container/20 text-tertiary hover:bg-tertiary-container hover:text-on-tertiary transition-all font-label-md text-label-md shadow-sm">
              <span class="material-symbols-outlined text-[16px]">public</span>
              <span>Yes, generate general answer</span>
            </button>
            <button id="btn-unverified-no" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md">
              <span class="material-symbols-outlined text-[16px]">lock</span>
              <span>No, stick strictly to my docs</span>
            </button>
          </div>
        </article>
      `;

      document.getElementById("btn-unverified-yes")?.addEventListener("click", () => {
        handleUnverified(question, leftCol);
      });

      document.getElementById("btn-unverified-no")?.addEventListener("click", () => {
        const btnRow = document.getElementById("btn-unverified-yes")?.closest("div");
        if (btnRow) btnRow.remove();
      });
    }
  }

  function insertTagIntoPoint(text, tag) {
    const cleaned = text.replace(/\s*\[\d+\]\s*/g, " ").trim();
    let html = escapeHtml(cleaned).replace(/\*\*(.+?)\*\*/g,
      '<strong class="text-on-surface font-semibold">$1</strong>');
    if (tag == null) return html;
    const btn = `<button class="citation-btn inline-flex items-center justify-center px-1.5 py-0.2 rounded bg-primary-container/15 text-primary text-label-sm font-label-sm hover:bg-primary-container hover:text-on-primary-fixed transition-colors align-middle mx-1 font-mono" data-citation="${tag}">[${tag}]</button>`;
    return `${html} ${btn}`;
  }

  function formatInline(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g,
      '<strong class="text-on-surface font-semibold">$1</strong>');
    html = html.replace(/\[(\d+)\]/g, (m, n) =>
      `<button class="citation-btn inline-flex items-center justify-center px-1.5 py-0.2 rounded bg-primary-container/15 text-primary text-label-sm font-label-sm hover:bg-primary-container hover:text-on-primary-fixed transition-colors align-middle mx-1 font-mono" data-citation="${n}">[${n}]</button>`
    );
    return html;
  }

  async function handleUnverified(question, container) {
    const btn = document.getElementById("btn-unverified-yes");
    if (btn) {
      btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span><span>Generating…</span>';
      btn.disabled = true;
    }

    try {
      const result = await window.VeridocAPI.askUnverified(question);

      container.innerHTML = `
        <article class="bg-surface-container-low rounded-xl shadow-lg p-space-lg md:p-space-xl flex flex-col gap-space-md border border-tertiary/30">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="inline-flex items-center gap-2 text-tertiary">
              <span class="material-symbols-outlined text-[18px]">public</span>
              <span class="font-label-md text-label-md uppercase tracking-wider font-semibold">Unverified Answer</span>
            </div>
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-container/20 text-tertiary">
              <span class="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_currentColor]"></span>
              <span class="font-label-sm text-label-sm font-medium">Not from your documents</span>
            </div>
          </div>
          <div class="p-3.5 rounded-lg bg-tertiary-container/10 text-tertiary text-body-sm flex items-start gap-2.5">
            <span class="material-symbols-outlined text-[18px] shrink-0 mt-0.5">warning</span>
            <span>This answer comes from general knowledge, <strong>not</strong> from your uploaded documents. It may be inaccurate for your specific context.</span>
          </div>
          <h2 class="font-headline-md text-headline-md text-on-surface">${escapeHtml(question)}</h2>
          <div class="font-body-md text-body-md text-on-surface leading-relaxed space-y-2">${formatAnswer(result.answer)}</div>
          <div class="pt-2">
            <button id="btn-back-to-docs" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md">
              <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to documents</span>
            </button>
          </div>
        </article>
      `;

      document.getElementById("btn-back-to-docs")?.addEventListener("click", () => {
        renderAnswer(question, { status: "not_found", answer: null, sources: [], points: [], blocks: [] });
      });
    } catch (err) {
      alert("Unverified mode failed: " + err.message);
    }
  }

  function formatAnswer(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g,
      '<strong class="text-on-surface font-semibold">$1</strong>');
    html = html.replace(/\[(\d+)\]/g, (m, n) =>
      `<button class="citation-btn inline-flex items-center justify-center px-1.5 py-0.2 rounded bg-primary-container/15 text-primary text-label-sm font-label-sm hover:bg-primary-container hover:text-on-primary-fixed transition-colors align-middle mx-1 font-mono" data-citation="${n}">[${n}]</button>`
    );

    const blocks = html.split(/\n\n+/);
    const processed = blocks.map(block => {
      const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);

      const bulletLines = lines.filter(l => /^[-•]\s+/.test(l));
      if (bulletLines.length >= 2) {
        const items = lines.map(l => {
          const content = l.replace(/^[-•]\s+/, '');
          return `<li class="ml-4 list-disc leading-relaxed">${content}</li>`;
        }).join("");
        return `<ul class="flex flex-col gap-2 my-3">${items}</ul>`;
      }

      const numLines = lines.filter(l => /^\d+\.\s+/.test(l));
      if (numLines.length >= 2) {
        const items = lines.map(l => {
          const content = l.replace(/^\d+\.\s+/, '');
          return `<li class="ml-4 list-decimal leading-relaxed">${content}</li>`;
        }).join("");
        return `<ol class="flex flex-col gap-2 my-3">${items}</ol>`;
      }

      return `<p class="leading-relaxed mb-3">${lines.join(" ")}</p>`;
    }).join("");

    return processed;
  }

  function renderSources(sources) {
    const aside = document.querySelector("aside.lg\\:col-span-4");
    if (!aside) return;

    const cards = sources.map((s) => `
      <div class="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-2" id="citation-card-${s.evidence_tag}">
        <div class="flex items-center justify-between text-label-sm font-label-sm">
          <span class="font-mono text-primary bg-primary-container/10 px-1.5 py-0.5 rounded">[${s.evidence_tag}] ${escapeHtml(s.filename)}</span>
        </div>
        <div class="flex items-center justify-between text-outline font-label-sm text-label-sm pt-1">
          <span>Page ${s.page}</span>
        </div>
      </div>
    `).join("");

    aside.innerHTML = `
      <div class="bg-surface-container rounded-xl shadow-lg p-space-md flex flex-col gap-space-md sticky top-24">
        <div class="flex items-center justify-between pb-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[18px]">find_in_page</span>
            <span class="font-label-md text-label-md text-on-surface font-semibold tracking-wide uppercase">Sources</span>
          </div>
          <span class="text-outline font-label-sm text-label-sm">${sources.length} Passages</span>
        </div>
        ${cards}
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  (function restoreLastQuery() {
    const savedQuery = sessionStorage.getItem("veridoc_last_query");
    const savedAnswer = sessionStorage.getItem("veridoc_last_answer");
    const savedStatus = sessionStorage.getItem("veridoc_last_status");
    const savedSources = sessionStorage.getItem("veridoc_last_sources");
    const savedPoints = sessionStorage.getItem("veridoc_last_points");
    const savedBlocks = sessionStorage.getItem("veridoc_last_blocks");

    if (!savedQuery || !savedStatus) return;

    try {
      const parsedSources = savedSources ? JSON.parse(savedSources) : [];
      const parsedPoints = savedPoints ? JSON.parse(savedPoints) : [];
      const parsedBlocks = savedBlocks ? JSON.parse(savedBlocks) : [];
      renderAnswer(savedQuery, {
        status: savedStatus,
        answer: savedAnswer || "",
        sources: parsedSources,
        points: parsedPoints,
        blocks: parsedBlocks,
      });
      if (input) input.value = savedQuery;
    } catch (e) {
      console.warn("Failed to restore state:", e);
    }
  })();

});