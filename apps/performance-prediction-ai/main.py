import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import predict, benchmark, batch
from app.middleware.internal_auth import InternalAuthMiddleware

app = FastAPI(
    title="Conic Performance Prediction AI",
    description="PyTorch-based creator performance prediction: reach, engagement, conversion, ROI",
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

app.include_router(predict.router, prefix="/predict", tags=["predict"])
app.include_router(benchmark.router, prefix="/benchmark", tags=["benchmark"])
app.include_router(batch.router, prefix="/batch", tags=["batch"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "performance-prediction-ai"}
