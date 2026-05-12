import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import generate, risk, templates
from app.middleware.internal_auth import InternalAuthMiddleware

app = FastAPI(
    title="Conic Contract AI",
    description="AI-powered contract generation, risk scoring, and clause analysis",
    version="1.0.0",
    # Hide docs in production
    docs_url=None if os.environ.get("NODE_ENV") == "production" else "/docs",
    redoc_url=None if os.environ.get("NODE_ENV") == "production" else "/redoc",
)

# Internal-secret auth — rejects any request without valid X-Internal-Secret header
app.add_middleware(InternalAuthMiddleware)

# CORS locked to the NestJS backend hostname only
_backend_origin = os.environ.get("BACKEND_ORIGIN", "http://localhost:4000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_backend_origin],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "X-Internal-Secret"],
)

app.include_router(generate.router, prefix="/generate", tags=["generate"])
app.include_router(risk.router, prefix="/risk", tags=["risk"])
app.include_router(templates.router, prefix="/templates", tags=["templates"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "contract-ai"}
