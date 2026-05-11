from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import predict, graph, clusters

app = FastAPI(
    title="Conic Creator Graph AI",
    description="Graph ML for creator identity, influence clusters, and performance prediction",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router, prefix="/predict", tags=["predict"])
app.include_router(graph.router, prefix="/graph", tags=["graph"])
app.include_router(clusters.router, prefix="/clusters", tags=["clusters"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "creator-graph-ai"}
