import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import timeline, debrief, insights, pdf_export
from app.middleware.internal_auth import InternalAuthMiddleware

app = FastAPI(
    title="Conic Campaign Agent AI",
    description="Autonomous AI agent for campaign management: timelines, debriefs, and summaries",
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

app.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
app.include_router(debrief.router, prefix="/debrief", tags=["debrief"])
app.include_router(insights.router, prefix="/insights", tags=["insights"])
app.include_router(pdf_export.router, prefix="/pdf", tags=["pdf"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "campaign-agent-ai"}
