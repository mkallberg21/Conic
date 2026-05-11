from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import math
import random

router = APIRouter()


class PredictRequest(BaseModel):
    creator_id: str
    followers_count: int = 10000
    engagement_rate: float = 3.5
    avg_reach: Optional[int] = None
    platforms: Optional[Dict[str, Any]] = None
    niche: Optional[List[str]] = None


class PredictResponse(BaseModel):
    predicted_reach: int
    predicted_engagement: float
    predicted_roi: float
    audience_authenticity: float  # 0-1
    fraud_likelihood: float  # 0-1
    confidence: float  # 0-1
    tier: str
    insights: List[str]


def calculate_predicted_reach(followers: int, engagement_rate: float) -> int:
    """Estimate organic reach based on algorithm approximations."""
    base_rate = 0.08  # ~8% organic reach
    # Adjust based on engagement (high engagement = better reach)
    engagement_multiplier = min(engagement_rate / 3.0, 2.5)
    return int(followers * base_rate * engagement_multiplier)


def estimate_audience_authenticity(followers: int, engagement_rate: float) -> float:
    """
    Real accounts tend to have engagement rates inversely correlated with follower count.
    Very high engagement on large accounts or very low on small accounts suggests issues.
    """
    if followers < 1000:
        return 0.70
    if followers < 10000:
        expected = 8.0
    elif followers < 100000:
        expected = 4.5
    elif followers < 1000000:
        expected = 2.5
    else:
        expected = 1.5

    ratio = engagement_rate / expected
    if 0.4 <= ratio <= 2.5:
        authenticity = 0.85 + (1.0 - abs(1.0 - ratio)) * 0.1
    else:
        authenticity = max(0.3, 0.6 - abs(ratio - 1.0) * 0.1)

    return round(min(1.0, max(0.0, authenticity)), 3)


def estimate_fraud_likelihood(authenticity: float) -> float:
    return round(max(0.0, 1.0 - authenticity - random.uniform(0.0, 0.1)), 3)


def get_tier(followers: int) -> str:
    if followers < 10000:
        return "nano"
    if followers < 100000:
        return "micro"
    if followers < 500000:
        return "mid"
    if followers < 1000000:
        return "macro"
    return "mega"


def generate_insights(tier: str, auth: float, engagement: float) -> List[str]:
    insights = []
    if auth > 0.85:
        insights.append("High audience authenticity detected — organic growth pattern.")
    elif auth < 0.6:
        insights.append("Low authenticity score — potential inflated follower count.")
    if engagement > 6.0:
        insights.append("Above-average engagement rate indicates highly engaged audience.")
    elif engagement < 1.5:
        insights.append("Below-average engagement — content resonance may be low.")
    if tier == "micro":
        insights.append("Micro-influencers typically deliver 60% higher ROI than macro.")
    return insights


@router.post("", response_model=PredictResponse)
def predict_performance(req: PredictRequest):
    reach = calculate_predicted_reach(req.followers_count, req.engagement_rate)
    auth = estimate_audience_authenticity(req.followers_count, req.engagement_rate)
    fraud = estimate_fraud_likelihood(auth)
    tier = get_tier(req.followers_count)

    # ROI model: micro-influencers have higher ROI
    tier_roi_multiplier = {"nano": 3.5, "micro": 2.8, "mid": 2.0, "macro": 1.5, "mega": 1.1}
    roi = tier_roi_multiplier.get(tier, 2.0) * (req.engagement_rate / 3.5)

    confidence = 0.6 + (auth * 0.25) + (min(req.followers_count, 100000) / 500000)

    return PredictResponse(
        predicted_reach=reach,
        predicted_engagement=round(req.engagement_rate * 0.95, 2),
        predicted_roi=round(roi, 2),
        audience_authenticity=auth,
        fraud_likelihood=fraud,
        confidence=round(min(1.0, confidence), 3),
        tier=tier,
        insights=generate_insights(tier, auth, req.engagement_rate),
    )
