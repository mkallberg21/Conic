from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from app.features import build_feature_vector, infer_tier
from app.model import get_model, scale_outputs

router = APIRouter()


class CreatorInput(BaseModel):
    creator_id: str
    followers: int = Field(..., ge=1)
    engagement_rate: float = Field(..., ge=0, le=100)
    niche: str = "lifestyle"
    platform: str = "instagram"
    audience_score: float = 0.7
    fraud_score: float = 0.0
    avg_views: Optional[float] = None
    post_frequency_per_week: float = 3.0
    historical_roi: Optional[float] = None


class CreatorPrediction(BaseModel):
    creator_id: str
    tier: str
    reach_estimate: float
    engagement_rate_predicted: float
    roi_estimate: float
    confidence_score: float
    rank: int


class BatchRequest(BaseModel):
    creators: List[CreatorInput] = Field(..., min_length=1, max_length=100)
    sort_by: str = "roi_estimate"  # roi_estimate | reach_estimate | engagement_rate_predicted


class BatchResponse(BaseModel):
    total: int
    predictions: List[CreatorPrediction]


def _confidence(followers: int, has_history: bool, fraud: float) -> float:
    score = 50.0
    if has_history:
        score += 20
    if followers >= 10_000:
        score += 10
    if fraud < 0.2:
        score += 10
    return min(score, 99.0)


@router.post("/predict", response_model=BatchResponse)
def batch_predict(req: BatchRequest):
    if req.sort_by not in ("roi_estimate", "reach_estimate", "engagement_rate_predicted"):
        raise HTTPException(status_code=422, detail="Invalid sort_by field")

    model = get_model()
    results: List[CreatorPrediction] = []

    for c in req.creators:
        features = build_feature_vector({
            "followers": c.followers,
            "engagement_rate": c.engagement_rate,
            "audience_score": c.audience_score,
            "fraud_score": c.fraud_score,
            "niche": c.niche,
            "platform": c.platform,
            "avg_views": c.avg_views or c.followers * 0.15,
            "post_frequency_per_week": c.post_frequency_per_week,
            "historical_roi": c.historical_roi,
        })
        raw = model.predict(features)
        scaled = scale_outputs(raw)

        tier = infer_tier(c.followers)
        reach = min(c.followers * scaled["reach_multiplier"], c.followers * 2)
        roi = (
            scaled["predicted_roi"]
            if c.historical_roi is None
            else 0.4 * scaled["predicted_roi"] + 0.6 * (c.historical_roi / 10)
        )
        conf = _confidence(c.followers, c.historical_roi is not None, c.fraud_score)

        results.append(CreatorPrediction(
            creator_id=c.creator_id,
            tier=tier,
            reach_estimate=round(reach),
            engagement_rate_predicted=round(scaled["engagement_rate"], 2),
            roi_estimate=round(roi, 2),
            confidence_score=round(conf, 1),
            rank=0,  # assigned below
        ))

    # Sort
    results.sort(key=lambda r: getattr(r, req.sort_by), reverse=True)
    for i, r in enumerate(results):
        r.rank = i + 1

    return BatchResponse(total=len(results), predictions=results)
