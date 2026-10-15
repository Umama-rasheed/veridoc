// Library page — upload, list, delete + real stats
document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const docList = document.getElementById("document-list");
  const searchInput = document.getElementById("doc-search");

  if (!dropZone || !fileInput || !docList) return;

  // =====================================================
  // Load documents + update stats
  // =====================================================
  async function loadDocuments() {
    try {
      const res = await fetch("https://veridoc-3ysg.onrender.com/api/documents");
      const data = await res.json();
      const docs = data.documents || [];

      // ---------- Update stats ----------
      const totalCount = docs.length;
      const totalBytes = docs.reduce((sum, d) => sum + (d.size || 0), 0);
      const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

      const statDocCount = document.getElementById("stat-doc-count");
      if (statDocCount) {
        statDocCount.textContent = `${totalCount} document${totalCount === 1 ? "" : "s"} · ${totalMB} MB`;
      }

      const workspaceStatus = document.getElementById("workspace-status");
      if (workspaceStatus) {
        workspaceStatus.textContent = totalCount > 0 ? "Ready" : "Empty";
      }

      const activeBadge = document.getElementById("active-collection-badge");
      if (activeBadge) {
        activeBadge.textContent = `${totalCount} Source File${totalCount === 1 ? "" : "s"}`;
      }

      // ---------- Format breakdown ----------
      const breakdown = document.getElementById("format-breakdown");
      if (breakdown) {
        const counts = { pdf: 0, docx: 0, pptx: 0, image: 0, text: 0 };
        docs.forEach(d => {
          const name = (d.filename || "").toLowerCase();
          if (name.endsWith(".pdf")) counts.pdf++;
          else if (name.endsWith(".docx")) counts.docx++;
          else if (name.endsWith(".pptx")) counts.pptx++;
          else if (/\.(png|jpg|jpeg|gif|webp)$/.test(name)) counts.image++;
          else counts.text++;
        });

        const chips = [];
        if (counts.pdf) chips.push(`<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm"><span class="material-symbols-outlined text-[14px] text-primary">text_snippet</span>${counts.pdf} PDF${counts.pdf > 1 ? "s" : ""}</span>`);
        if (counts.docx) chips.push(`<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm"><span class="material-symbols-outlined text-[14px] text-primary">article</span>${counts.docx} DOCX</span>`);
        if (counts.pptx) chips.push(`<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm"><span class="material-symbols-outlined text-[14px] text-primary">slideshow</span>${counts.pptx} PPTX</span>`);
        if (counts.image) chips.push(`<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm"><span class="material-symbols-outlined text-[14px] text-primary">image</span>${counts.image} Image${counts.image > 1 ? "s" : ""}</span>`);
        if (counts.text) chips.push(`<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm"><span class="material-symbols-outlined text-[14px] text-primary">description</span>${counts.text} Text</span>`);

        breakdown.innerHTML = chips.length > 0
          ? chips.join("")
          : `<span class="text-outline text-body-sm">No files yet</span>`;
      }

      // ---------- Recent uploads (top 3) ----------
      const recent = document.getElementById("recent-uploads");
      if (recent) {
        const top3 = [...docs]
          .sort((a, b) => (b.uploaded_at || 0) - (a.uploaded_at || 0))
          .slice(0, 3);
        if (top3.length === 0) {
          recent.innerHTML = `<span class="text-outline text-body-sm">Upload a document to get started</span>`;
        } else {
          recent.innerHTML = top3.map(d => {
            const name = escapeHtml(d.filename || "");
            const ago = timeAgo(d.uploaded_at);
            return `
              <div class="flex items-center justify-between gap-2 py-1 text-body-sm">
                <span class="text-on-surface-variant truncate font-mono text-[12px]">${name}</span>
                <span class="text-outline whitespace-nowrap text-[11px]">${ago}</span>
              </div>
            `;
          }).join("");
        }
      }

      // ---------- Render document list ----------
      docList.innerHTML = "";

      if (docs.length === 0) {
        docList.innerHTML = `
          <p class="text-outline text-body-sm text-center py-8">
            No documents yet. Upload your first file above.
          </p>
        `;
        return;
      }

      sortDocs(docs).forEach(doc => {
        docList.insertAdjacentHTML("beforeend", renderDocCard(doc));
      });

      // Wire delete buttons
      docList.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const storedName = btn.getAttribute("data-stored");
          const displayName = btn.getAttribute("data-display");
          if (!confirm(`Delete ${displayName}? This cannot be undone.`)) return;

          try {
            const res = await fetch(
              `https://veridoc-3ysg.onrender.com/api/documents/${encodeURIComponent(storedName)}`,
              { method: "DELETE" }
            );
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.detail || "Delete failed");
            }
            showToast(`✅ Deleted ${displayName}`, "success");
            loadDocuments();
          } catch (err) {
            showToast(`❌ Delete failed: ${err.message}`, "error");
          }
        });
      });
    } catch (err) {
      console.warn("Failed to load documents:", err);
      docList.innerHTML = `
        <p class="text-error text-body-sm text-center py-8">
          Failed to load documents. Is the server running?
        </p>
      `;
    }
  }

  // =====================================================
  // Render a document card
  // =====================================================
  function renderDocCard(doc) {
    const sizeMB = (doc.size / (1024 * 1024)).toFixed(2);
    const uploadedDate = new Date(doc.uploaded_at * 1000).toLocaleDateString();
    const escapedName = escapeHtml(doc.filename);
    const escapedStored = escapeHtml(doc.stored_name);

    // Icon by type
    const name = (doc.filename || "").toLowerCase();
    let icon = "picture_as_pdf";
    if (name.endsWith(".docx")) icon = "article";
    else if (name.endsWith(".pptx")) icon = "slideshow";
    else if (/\.(png|jpg|jpeg|gif|webp)$/.test(name)) icon = "image";
    else if (/\.(txt|md)$/.test(name)) icon = "description";

    return `
      <div class="doc-card group relative bg-surface-container-low hover:bg-surface-container transition-all duration-200 rounded-xl p-space-md flex items-center justify-between gap-space-md shadow-md">
        <div class="flex items-center gap-space-md min-w-0">
          <div class="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container shrink-0 group-hover:scale-105 transition-transform">
            <span class="material-symbols-outlined text-[26px]">${icon}</span>
          </div>
          <div class="min-w-0 flex flex-col">
            <div class="flex items-center gap-2">
              <span class="font-label-md text-label-md font-semibold text-on-surface truncate group-hover:text-primary transition-colors">${escapedName}</span>
            </div>
            <div class="flex items-center gap-space-xs text-outline font-body-sm text-body-sm mt-0.5">
              <span>${sizeMB} MB</span>
              <span>•</span>
              <span>Uploaded ${uploadedDate}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-space-md shrink-0">
          <a href="viewer.html?file=${encodeURIComponent(doc.filename)}&page=1" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-highest text-primary font-label-sm text-label-sm hover:bg-primary-container/20 transition-colors">
            <span class="material-symbols-outlined text-[16px]">visibility</span>
            <span>View</span>
          </a>
          <div class="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-highest text-secondary font-label-sm text-label-sm">
            <span class="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_currentColor]"></span>
            <span>Indexed</span>
          </div>
          <button aria-label="Delete document" class="delete-btn text-outline hover:text-error p-1.5 rounded-lg hover:bg-surface-container-high transition-colors" type="button" data-stored="${escapedStored}" data-display="${escapedName}">
            <span class="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      </div>
    `;
  }

  // =====================================================
  // Upload handling
  // =====================================================
  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) await handleUpload(file);
    fileInput.value = "";
    loadDocuments();
  });

  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    for (const file of files) await handleUpload(file);
    loadDocuments();
  });

  ["dragenter", "dragover"].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add("bg-surface-container");
    });
  });

  ["dragleave", "drop"].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove("bg-surface-container");
    });
  });

  async function handleUpload(file) {
    const allowedExts = [".pdf", ".docx", ".pptx", ".png", ".jpg", ".jpeg", ".txt", ".md"];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowedExts.includes(fileExt)) {
      showToast(`⚠️ Unsupported file type: ${file.name}`, "warning");
      return;
    }

    const tempId = `uploading-${Date.now()}`;
    docList.insertAdjacentHTML("afterbegin", `
      <div class="doc-card group relative bg-surface-container-low rounded-xl p-space-md flex items-center justify-between gap-space-md shadow-md" id="${tempId}">
        <div class="flex items-center gap-space-md min-w-0">
          <div class="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container shrink-0">
            <span class="material-symbols-outlined text-[26px] animate-spin">progress_activity</span>
          </div>
          <div class="min-w-0 flex flex-col">
            <span class="font-label-md text-label-md font-semibold text-on-surface truncate">${escapeHtml(file.name)}</span>
            <div class="flex items-center gap-space-xs text-outline font-body-sm text-body-sm mt-0.5">
              <span>Uploading & indexing…</span>
            </div>
          </div>
        </div>
      </div>
    `);

    try {
      const result = await window.VeridocAPI.uploadDocument(file);
      document.getElementById(tempId)?.remove();
      showToast(`✅ Indexed ${result.chunks_added} chunks from ${file.name}`, "success");
    } catch (err) {
      document.getElementById(tempId)?.remove();
      showToast(`❌ Upload failed: ${err.message}`, "error");
    }
  }

  // =====================================================
  // Search filter
  // =====================================================
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll(".doc-card").forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? "flex" : "none";
      });
    });
  }

    // =====================================================
  // Sort dropdown + logic
  // =====================================================
  const sortBtn = document.getElementById("sort-btn");
  const sortDropdown = document.getElementById("sort-dropdown");
  let currentSort = "newest";

  if (sortBtn && sortDropdown) {
    sortBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      sortDropdown.classList.toggle("hidden");
    });

    sortDropdown.querySelectorAll(".sort-option").forEach(btn => {
      btn.addEventListener("click", () => {
        currentSort = btn.getAttribute("data-sort");
        // Update checkmarks
        sortDropdown.querySelectorAll(".sort-check").forEach(c => {
          c.classList.toggle("hidden", c.getAttribute("data-for") !== currentSort);
        });
        sortDropdown.classList.add("hidden");
        loadDocuments();
      });
    });

    document.addEventListener("click", () => {
      sortDropdown.classList.add("hidden");
    });
    sortDropdown.addEventListener("click", (e) => e.stopPropagation());
  }

  function sortDocs(docs) {
    const sorted = [...docs];
    switch (currentSort) {
      case "oldest":
        sorted.sort((a, b) => (a.uploaded_at || 0) - (b.uploaded_at || 0));
        break;
      case "name-asc":
        sorted.sort((a, b) => (a.filename || "").localeCompare(b.filename || ""));
        break;
      case "name-desc":
        sorted.sort((a, b) => (b.filename || "").localeCompare(a.filename || ""));
        break;
      case "size-desc":
        sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
        break;
      case "type":
        sorted.sort((a, b) => {
          const extA = (a.filename || "").split(".").pop().toLowerCase();
          const extB = (b.filename || "").split(".").pop().toLowerCase();
          return extA.localeCompare(extB);
        });
        break;
      case "newest":
      default:
        sorted.sort((a, b) => (b.uploaded_at || 0) - (a.uploaded_at || 0));
        break;
    }
    return sorted;
  }

  // =====================================================
  // Helpers
  // =====================================================
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function timeAgo(epochSeconds) {
    if (!epochSeconds) return "recently";
    const diff = Date.now() - epochSeconds * 1000;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(epochSeconds * 1000).toLocaleDateString();
  }

  function showToast(msg, type) {
    const bg = type === "success" ? "bg-secondary-container" :
               type === "error" ? "bg-error-container" : "bg-surface-container-high";
    const color = type === "error" ? "text-on-error-container" : "text-on-surface";

    const toast = document.createElement("div");
    toast.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl ${bg} ${color} font-label-md text-label-md`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // Initial load
  loadDocuments();
});