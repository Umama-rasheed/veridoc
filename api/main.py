"""FastAPI app for Veridoc."""
from dotenv import load_dotenv
load_dotenv()  # ← MUST be first, before any other import reads env

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api.routes import router  # ← imports routes AFTER env is loaded

app = FastAPI(title="Veridoc API", version="0.1.0")

# Allow frontend (Vercel/Netlify) to talk to backend (Render)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(router, prefix="/api")

# Serve frontend
FRONTEND_DIR = "frontend"

@app.get("/")
def serve_root():
    # Always serve login.html at root — it will redirect logged-in users to home
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))

# Mount static files (HTML, CSS, JS, images)
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")