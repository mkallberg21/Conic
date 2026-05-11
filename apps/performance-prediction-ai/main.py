from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import predict, benchmark, batch

app = FastAPI(
    title="Conic Performance Prediction AI",
    description="PyTorch-based creator performance prediction: reach, engagement, conversion, ROI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router, prefix="/predict", tags=["predict"])
app.include_router(benchmark.router, prefix="/benchmark", tags=["benchmark"])
app.include_router(batch.router, prefix="/batch", tags=["batch"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "performance-prediction-ai"}
