from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import recommend

app = FastAPI(
    title="Conic Pricing Engine AI",
    description="Market-aware pricing recommendations for influencer campaigns",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recommend.router, prefix="/recommend", tags=["recommend"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "pricing-engine-ai"}
