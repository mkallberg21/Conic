import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import recommend
from app.middleware.internal_auth import InternalAuthMiddleware

app = FastAPI(
    title="Conic Pricing Engine AI",
    description="Market-aware pricing recommendations for influencer campaigns",
    version="1.0.0",
    docs_url=None if os.environ.get("NODE_ENV") == "production" else "/docs",
    redoc_url=None if os.environ.get("NODE_ENV") == "production" else "/redoc",
)

app.add_middleware(InternalAuthMiddleware)

_backend_origin = os.environ.get("BACKEND_ORIGIN", "http://localhost:4000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_backend_origin],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "X-Internal-Secret"],
)

app.include_router(recommend.router, prefix="/recommend", tags=["recommend"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "pricing-engine-ai"}
