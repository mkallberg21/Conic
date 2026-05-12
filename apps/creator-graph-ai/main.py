import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import predict, graph, clusters
from app.middleware.internal_auth import InternalAuthMiddleware

app = FastAPI(
    title="Conic Creator Graph AI",
    description="Graph ML for creator identity, influence clusters, and performance prediction",
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
app.include_router(graph.router, prefix="/graph", tags=["graph"])
app.include_router(clusters.router, prefix="/clusters", tags=["clusters"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "creator-graph-ai"}
