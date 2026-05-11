from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import math

from app.features import build_feature_vector, infer_tier, TIER_INFO, PLATFORM_BASE, NICHE_MULTIPLIER
from app.model import get_model, scale_outputs

router = APIRouter()


class PredictRequest(BaseModel):
    followers: int = Field(..., ge=1)
    engagement_rate: float = Field(..., ge=0, le=100)
    audience_score: float = Field(0.7, ge=0, le=1.0)
    fraud_score: float = Field(0.0, ge=0, le=1.0)
    niche: str = "lifestyle"
    platform: str = "instagram"
    avg_views: Optional[float] = None
    post_frequency_per_week: float = 3.0
    historical_roi: Optional[float] = None
    campaign_budget: float = 5000.0


class Recommendation(BaseModel):
    type: str
    message: str
    priority: str  # high | medium | low


class PredictResponse(BaseModel):
    tier: str
    reach_estimate: float
    engagement_rate_predicted: float
    conversion_rate: float
    roi_estimate: float
    confidence_score: float
    percentile_rank: float
    estimated_cpm: float
    estimated_cpe: float
    recommendations: List[Recommendation]


def _confidence(features: list, followers: int, has_history: bool) -> float:
    """Rough heuristic confidence 0–100."""
    score = 50.0
    if has_history:
        score += 20
    if followers >= 10_000:
        score += 10
    if features[2] > 0.6:  # audience_score
        score += 10
    if features[3] < 0.2:  # fraud_score (inverted)
        score += 10
    return min(score, 99.0)


def _percentile(tier: str, er: float, niche: str) -> float:
    """Rough percentile estimate based on tier and ER."""
    tier_order = ["nano", "micro", "mid", "macro", "mega", "celebrity"]
    tier_base = (tier_order.index(tier) / (len(tier_order) - 1)) * 60
    er_base = min(er / 10, 1.0) * 40
    return round(tier_base + er_base, 1)


def _build_recommendations(
    tier: str, er: float, fraud: float, audience: float, platform: str
) -> List[Recommendation]:
    recs: List[Recommendation] = []
    if fraud > 0.3:
        recs.append(Recommendation(
            type="fraud_risk",
            message="Audience fraud score is elevated. Verify follower authenticity before contracting.",
            priority="high",
        ))
    if audience < 0.5:
        recs.append(Recommendation(
            type="audience_quality",
            message="Audience quality is below average. Request detailed demo breakdown before campaign launch.",
            priority="medium",
        ))
    if er < 1.0 and tier in ("macro", "mega", "celebrity"):
        recs.append(Recommendation(
            type="engagement",
            message="Engagement rate is below average for this tier. Consider a smaller creator for better authenticity.",
            priority="medium",
        ))
    if platform == "tiktok" and er < 3.0:
        recs.append(Recommendation(
            type="platform_fit",
            message="TikTok creators typically see 3%+ ER; this creator may be better suited for Instagram.",
            priority="low",
        ))
    return recs


@router.post("/creator", response_model=PredictResponse)
def predict_creator(req: PredictRequest):
    features = build_feature_vector({
        "followers": req.followers,
        "engagement_rate": req.engagement_rate,
        "audience_score": req.audience_score,
        "fraud_score": req.fraud_score,
        "niche": req.niche,
        "platform": req.platform,
        "avg_views": req.avg_views or req.followers * 0.15,
        "post_frequency_per_week": req.post_frequency_per_week,
        "historical_roi": req.historical_roi,
    })

    model = get_model()
    raw = model.predict(features)
    scaled = scale_outputs(raw)

    tier = infer_tier(req.followers)
    tier_info = TIER_INFO[tier]

    # Post-process reach (bounded by followers)
    reach = min(req.followers * scaled["reach_multiplier"], req.followers * 2)
    er_pred = max(scaled["engagement_rate"], 0.1)
    conv = scaled["conversion_rate"]
    roi = scaled["predicted_roi"] if req.historical_roi is None else (
        0.4 * scaled["predicted_roi"] + 0.6 * (req.historical_roi / 10)
    )

    base = PLATFORM_BASE.get(req.platform, PLATFORM_BASE["instagram"])
    niche_mul = NICHE_MULTIPLIER.get(req.niche, 1.0)
    cpm = base["cpm"] * niche_mul
    cpe = cpm / max(er_pred, 0.01) * 10

    confidence = _confidence(features, req.followers, req.historical_roi is not None)
    percentile = _percentile(tier, er_pred, req.niche)
    recs = _build_recommendations(tier, er_pred, req.fraud_score, req.audience_score, req.platform)

    return PredictResponse(
        tier=tier,
        reach_estimate=round(reach),
        engagement_rate_predicted=round(er_pred, 2),
        conversion_rate=round(conv, 4),
        roi_estimate=round(roi, 2),
        confidence_score=round(confidence, 1),
        percentile_rank=percentile,
        estimated_cpm=round(cpm, 2),
        estimated_cpe=round(cpe, 2),
        recommendations=recs,
    )
