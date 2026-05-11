from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import timeline, debrief, insights

app = FastAPI(
    title="Conic Campaign Agent AI",
    description="Autonomous AI agent for campaign management: timelines, debriefs, and summaries",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
app.include_router(debrief.router, prefix="/debrief", tags=["debrief"])
app.include_router(insights.router, prefix="/insights", tags=["insights"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "campaign-agent-ai"}
