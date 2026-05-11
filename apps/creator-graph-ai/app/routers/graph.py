from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import networkx as nx

router = APIRouter()

# In-memory graph (replace with DB-backed graph in production)
_graph = nx.DiGraph()


class AddNodeRequest(BaseModel):
    creator_id: str
    metadata: Optional[Dict[str, Any]] = None


class AddEdgeRequest(BaseModel):
    source_id: str
    target_id: str
    weight: float = 1.0
    edge_type: str = "audience_overlap"


class GraphStatsResponse(BaseModel):
    nodes: int
    edges: int
    top_influencers: List[Dict[str, Any]]
    density: float


@router.post("/nodes")
def add_node(req: AddNodeRequest):
    _graph.add_node(req.creator_id, **(req.metadata or {}))
    return {"nodeId": req.creator_id, "nodeCount": _graph.number_of_nodes()}


@router.post("/edges")
def add_edge(req: AddEdgeRequest):
    _graph.add_edge(req.source_id, req.target_id, weight=req.weight, type=req.edge_type)
    return {"edgeCount": _graph.number_of_edges()}


@router.get("/stats", response_model=GraphStatsResponse)
def graph_stats():
    if _graph.number_of_nodes() == 0:
        return GraphStatsResponse(nodes=0, edges=0, top_influencers=[], density=0.0)

    centrality = nx.degree_centrality(_graph)
    top = sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:10]

    return GraphStatsResponse(
        nodes=_graph.number_of_nodes(),
        edges=_graph.number_of_edges(),
        top_influencers=[{"creatorId": c, "centrality": round(v, 4)} for c, v in top],
        density=round(nx.density(_graph), 4),
    )


@router.get("/{creator_id}/neighbors")
def get_neighbors(creator_id: str, depth: int = 1):
    if creator_id not in _graph:
        return {"neighbors": []}
    ego = nx.ego_graph(_graph, creator_id, radius=depth)
    neighbors = [n for n in ego.nodes() if n != creator_id]
    return {"creatorId": creator_id, "neighbors": neighbors, "count": len(neighbors)}
