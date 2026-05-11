from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import verify, cv

app = FastAPI(
    title="Conic Deliverable Verification AI",
    description="AI-powered content verification for deliverables (CV + NLP)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(verify.router, prefix="/verify", tags=["verify"])
app.include_router(cv.router, prefix="/cv", tags=["cv"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "deliverable-verification-ai"}
