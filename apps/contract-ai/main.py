from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import generate, risk, templates

app = FastAPI(
    title="Conic Contract AI",
    description="AI-powered contract generation, risk scoring, and clause analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate.router, prefix="/generate", tags=["generate"])
app.include_router(risk.router, prefix="/risk", tags=["risk"])
app.include_router(templates.router, prefix="/templates", tags=["templates"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "contract-ai"}
