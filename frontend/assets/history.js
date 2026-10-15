// History page — real data from backend
document.addEventListener("DOMContentLoaded", async () => {
  const questionsContainer = document.getElementById("questions-container");
  const filterTabs = document.querySelectorAll(".filter-tab-btn");
  const searchInput = document.getElementById("query-search-input");
  const exportBtn = document.getElementById("export-history-btn");
  const paginationLabel = document.getElementById("pagination-label");
  const paginationButtons = document.querySelectorAll(".pagination-btn");

  // Stat element IDs (we'll add these to history.html)
  const statTotalQueries = document.getElementById("stat-total-queries");
  const statAnchoredPct = document.getElementById("stat-anchored-pct");
  const statAnchoredBar = document.getElementById("stat-anchored-bar");
  const statPartialBar = document.getElementById("stat-partial-bar");
  const statUnverifiedBar = document.getElementById("stat-unverified-bar");
  const statAnchoredCount = document.getElementById("stat-anchored-count");
  const statPartialCount = document.getElementById("stat-partial-count");
  const statUnverifiedCount = document.getElementById("stat-unverified-count");
  const statDocsUsed = document.getElementById("stat-docs-used");

  let allRows = [];
  let currentFilter = "all";
  let searchQuery = "";

  async function loadHistory() {
    // 1. Get session
    const session = await window.Auth.getSession();
    if (!session) {
      questionsContainer.innerHTML = `
        <div class="bg-surface-container-low rounded-xl p-8 text-center">
          <p class="text-on-surface-variant">Please sign in to view your history.</p>
          <a href="login.html" class="inline-block mt-4 px-4 py-2 rounded-lg bg-primary-container text-on-primary-fixed font-label-md hover:bg-primary transition-all">Sign In</a>
        </div>
      `;
      return;
    }

    // 2. Guest check
    if (window.Auth.isGuest()) {
      questionsContainer.innerHTML = `
        <div class="bg-surface-container-low rounded-xl p-8 text-center">
          <p class="text-on-surface-variant">History isn't saved for guest sessions. Sign in to keep a permanent record of your questions.</p>
          <a href="login.html" class="inline-block mt-4 px-4 py-2 rounded-lg bg-primary-container text-on-primary-fixed font-label-md hover:bg-primary transition-all">Sign In</a>
        </div>
      `;
      return;
    }

    try {
      const res = await fetch("https://veridoc-api-xnmf.onrender.com/api/history", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`History fetch failed (${res.status})`);
      }

      const data = await res.json();
      allRows = Array.isArray(data) ? data : [];
      renderStats(allRows);
      renderRows(allRows);
    } catch (err) {
      console.warn("History load failed:", err);
      questionsContainer.innerHTML = `
        <div class="bg-surface-container-low rounded-xl p-8 text-center">
          <p class="text-error">Failed to load history: ${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }

  function renderStats(rows) {
    const total = rows.length;
    const anchored = rows.filter(r => r.status === "anchored").length;
    const partial = rows.filter(r => r.status === "partial").length;
    const unverified = rows.filter(r => r.status === "unverified" || r.status === "not_found").length;
    const anchoredPct = total > 0 ? Math.round((anchored / total) * 100) : 0;

    if (statTotalQueries) statTotalQueries.textContent = String(total);
    if (statAnchoredPct) statAnchoredPct.textContent = `${anchoredPct}%`;
    if (statAnchoredCount) statAnchoredCount.textContent = `${anchored} Anchored`;
    if (statPartialCount) statPartialCount.textContent = `${partial} Partial`;
    if (statUnverifiedCount) statUnverifiedCount.textContent = `${unverified} Unverified`;

    if (statAnchoredBar) statAnchoredBar.style.width = `${total > 0 ? (anchored / total) * 100 : 0}%`;
    if (statPartialBar) statPartialBar.style.width = `${total > 0 ? (partial / total) * 100 : 0}%`;
    if (statUnverifiedBar) statUnverifiedBar.style.width = `${total > 0 ? (unverified / total) * 100 : 0}%`;

    // Update filter tab counts
    const allTabCount = document.querySelector('[data-filter="all"] span:nth-child(2)');
    const anchoredTabCount = document.querySelector('[data-filter="anchored"] span:nth-child(3)');
    const partialTabCount = document.querySelector('[data-filter="partial"] span:nth-child(3)');
    const unverifiedTabCount = document.querySelector('[data-filter="unverified"] span:nth-child(3)');
    if (allTabCount) allTabCount.textContent = String(total);
    if (anchoredTabCount) anchoredTabCount.textContent = `(${anchored})`;
    if (partialTabCount) partialTabCount.textContent = `(${partial})`;
    if (unverifiedTabCount) unverifiedTabCount.textContent = `(${unverified})`;
  }

  async function renderRows(rows) {
    // Load documents count for stat
    try {
      const docsRes = await fetch("https://veridoc-api-xnmf.onrender.com/api/documents");
      const docsData = await docsRes.json();
      if (statDocsUsed) statDocsUsed.textContent = String((docsData.documents || []).length);
    } catch (e) {
      if (statDocsUsed) statDocsUsed.textContent = "0";
    }

    if (rows.length === 0) {
      questionsContainer.innerHTML = `
        <div class="bg-surface-container-low rounded-xl p-8 text-center">
          <span class="material-symbols-outlined text-[48px] text-outline">history</span>
          <p class="mt-3 text-on-surface-variant">No questions yet. Head to <a href="ask.html" class="text-primary hover:underline">Ask</a> and try your first query.</p>
        </div>
      `;
      if (paginationLabel) paginationLabel.textContent = "Showing 0 questions";
      return;
    }

    // Sort newest first
    rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const html = rows.map(row => renderRow(row)).join("");
    questionsContainer.innerHTML = html;

    // Wire "View Source" buttons
    questionsContainer.querySelectorAll(".view-source-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const file = btn.getAttribute("data-file");
        const page = btn.getAttribute("data-page");
        if (!file) return;
        const params = new URLSearchParams({ file, page: page || "1" });
        window.location.href = `viewer.html?${params.toString()}`;
      });
    });

    // Update pagination label
    if (paginationLabel) {
      paginationLabel.innerHTML = `Showing <span class="text-on-surface font-semibold">1-${rows.length}</span> of <span class="text-on-surface font-semibold">${rows.length}</span> questions`;
    }
  }

  function renderRow(row) {
    const status = row.status || "anchored";
    const isAnchored = status === "anchored";
    const isPartial = status === "partial";
    const isUnverified = status === "unverified" || status === "not_found";

    const statusLabel = isAnchored ? "Anchored" : isPartial ? "Partial" : "Unverified";
    const statusColorClass = isAnchored ? "text-secondary" : isPartial ? "text-tertiary" : "text-error";
    const statusDotClass = isAnchored ? "bg-secondary" : isPartial ? "bg-tertiary" : "bg-error";
    const iconClass = isAnchored ? "text-secondary" : isPartial ? "text-tertiary" : "text-error";
    const iconName = isAnchored ? "verified" : isPartial ? "emergency" : "warning";

    const q = escapeHtml(row.question || "");
    const timeAgo = formatTimeAgo(row.created_at);

    // Sources
    const sources = row.sources || [];
    const firstSource = sources[0];
    const sourceFile = firstSource?.filename || "";
    const sourcePage = firstSource?.page || "";
    const sourcesHtml = firstSource
      ? `
        <div class="flex items-center gap-space-xs mt-2 text-on-surface-variant font-body-sm text-body-sm flex-wrap">
          <span class="material-symbols-outlined text-outline text-[16px]">description</span>
          <span class="font-label-sm text-label-sm text-primary bg-primary-container/10 px-2 py-0.5 rounded">${escapeHtml(sourceFile)} (Page ${sourcePage})</span>
          ${sources.length > 1 ? `<span class="text-outline font-label-sm text-label-sm">+ ${sources.length - 1} others</span>` : ""}
        </div>
      `
      : `
        <div class="flex items-center gap-space-xs mt-2 text-on-surface-variant font-body-sm text-body-sm flex-wrap">
          <span class="material-symbols-outlined ${iconClass} text-[16px]">search_off</span>
          <span class="font-label-sm text-label-sm ${iconClass}">No source anchored</span>
        </div>
      `;

    const actionLabel = isAnchored || isPartial ? "View Source" : "Review Question";
    const actionDisabled = !firstSource ? "disabled opacity-50 cursor-not-allowed" : "view-source-btn";

    return `
      <article class="question-row bg-surface-container hover:bg-surface-container-high rounded-xl p-space-md transition-all duration-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md group" data-status="${status}">
        <div class="flex items-start gap-space-md min-w-0 flex-1">
          <div class="mt-1 w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 ${iconClass} group-hover:scale-105 transition-transform">
            <span class="material-symbols-outlined text-[18px]">${iconName}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-space-sm flex-wrap mb-1">
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-lowest font-label-sm text-label-sm ${statusColorClass}">
                <span class="w-1.5 h-1.5 rounded-full ${statusDotClass} shadow-[0_0_6px_currentColor]"></span>
                ${statusLabel}
              </span>
              <span class="font-label-sm text-label-sm text-outline flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">schedule</span>
                ${timeAgo}
              </span>
            </div>
            <h2 class="font-body-lg text-body-lg text-on-surface font-semibold group-hover:text-primary transition-colors line-clamp-2">
              ${q}
            </h2>
            ${sourcesHtml}
          </div>
        </div>
        <div class="flex items-center gap-space-md shrink-0 self-end md:self-center">
          <button class="${actionDisabled} bg-surface-container-low hover:bg-surface-container-lowest ${isUnverified ? 'text-error' : 'text-primary'} font-label-md text-label-md px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
            data-file="${escapeHtml(sourceFile)}" data-page="${sourcePage}">
            <span>${actionLabel}</span>
            <span class="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
          </button>
        </div>
      </article>
    `;
  }

  // ---- Filters ----
  function applyFilters() {
    const rows = questionsContainer.querySelectorAll(".question-row");
    rows.forEach(row => {
      const status = row.getAttribute("data-status");
      const title = (row.querySelector("h2")?.textContent || "").toLowerCase();

      const matchesStatus = currentFilter === "all" || status === currentFilter;
      const matchesSearch = title.includes(searchQuery.toLowerCase());

      row.style.display = (matchesStatus && matchesSearch) ? "flex" : "none";
    });
  }

  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      filterTabs.forEach(t => {
        t.classList.remove("bg-primary-container", "text-on-primary", "shadow-sm", "active");
        t.classList.add("bg-surface-container-low", "text-on-surface-variant");
      });
      tab.classList.remove("bg-surface-container-low", "text-on-surface-variant");
      tab.classList.add("bg-primary-container", "text-on-primary", "shadow-sm", "active");

      currentFilter = tab.getAttribute("data-filter");
      applyFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      applyFilters();
    });
  }

  // ---- Export (real JSON download) ----
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      if (!allRows || allRows.length === 0) {
        alert("No history to export yet.");
        return;
      }
      const dataStr = JSON.stringify(allRows, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veridoc-history-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // ---- Helpers ----
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function formatTimeAgo(iso) {
    if (!iso) return "recently";
    const then = new Date(iso).getTime();
    if (isNaN(then)) return "recently";
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
    return new Date(iso).toLocaleDateString();
  }

  // ---- Load on start ----
  loadHistory();
});