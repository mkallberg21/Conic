from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
from sklearn.cluster import KMeans
import numpy as np

router = APIRouter()


class ClusterRequest(BaseModel):
    creators: List[Dict[str, Any]]  # [{id, followers, engagement, niche_vector...}]
    n_clusters: int = 5


class ClusterResult(BaseModel):
    creator_id: str
    cluster_id: int
    cluster_label: str


CLUSTER_LABELS = {
    0: "Lifestyle & Fashion",
    1: "Tech & Gaming",
    2: "Food & Travel",
    3: "Fitness & Wellness",
    4: "Entertainment",
    5: "Business & Finance",
}


@router.post("", response_model=List[ClusterResult])
def cluster_creators(req: ClusterRequest):
    if len(req.creators) < req.n_clusters:
        return [
            ClusterResult(creator_id=c["id"], cluster_id=i, cluster_label=CLUSTER_LABELS.get(i % 6, "General"))
            for i, c in enumerate(req.creators)
        ]

    features = np.array([
        [
            c.get("followers_count", 10000) / 1000000,
            c.get("engagement_rate", 3.5) / 10,
        ]
        for c in req.creators
    ])

    kmeans = KMeans(n_clusters=req.n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(features)

    return [
        ClusterResult(
            creator_id=req.creators[i]["id"],
            cluster_id=int(labels[i]),
            cluster_label=CLUSTER_LABELS.get(int(labels[i]), f"Cluster {labels[i]}"),
        )
        for i in range(len(req.creators))
    ]
