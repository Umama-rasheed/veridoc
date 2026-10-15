"""FastAPI app for Veridoc — API-only backend for Render."""
from dotenv import load_dotenv
load_dotenv()  # Must be first, before any other import reads env

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router  # Imports routes AFTER env is loaded

app = FastAPI(title="Veridoc API", version="0.1.0")

# CORS — allow frontend on Vercel + local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://veridoc-frontend.vercel.app",
        "https://veridoc-frontend-8jjyk3ben-veridoc2.vercel.app",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all API routes at /api/*
app.include_router(router, prefix="/api")


# Root endpoint — confirms the service is alive
@app.get("/")
def root():
    return {
        "service": "veridoc",
        "status": "ok",
        "docs": "/docs",
        "api_base": "/api",
    }