// Veridoc API bridge
const API_BASE = "https://veridoc-3ysg.onrender.com/api";

async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

async function askQuestion(question) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Ask failed");
  }
  return res.json();
}

async function askUnverified(question) {
  const res = await fetch(`${API_BASE}/ask-unverified`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Unverified ask failed");
  }
  return res.json();
}
async function getPdfPage(filename, page) {
  const res = await fetch(`${API_BASE}/pdf-page`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, page }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load PDF page");
  }
  return res.json();
}
window.VeridocAPI = { uploadDocument, askQuestion, askUnverified, getPdfPage };