from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional

from app.features import PLATFORM_BASE, NICHE_MULTIPLIER, TIER_INFO, infer_tier, build_feature_vector
from app.model import get_model, scale_outputs

router = APIRouter()


class BenchmarkRequest(BaseModel):
    followers: int = Field(..., ge=1)
    engagement_rate: float = Field(..., ge=0, le=100)
    niche: str = "lifestyle"
    platform: str = "instagram"
    audience_score: float = 0.7
    fraud_score: float = 0.0
    avg_views: Optional[float] = None
    post_frequency_per_week: float = 3.0


class PeerStat(BaseModel):
    label: str
    creator_value: float
    niche_average: float
    delta_pct: float
    status: str  # above | below | on_par


class BenchmarkResponse(BaseModel):
    tier: str
    overall_percentile: float
    peer_count_estimate: int
    strengths: List[str]
    weaknesses: List[str]
    stats: List[PeerStat]


# Niche-tier average table (calibrated heuristics)
_NICHE_AVERAGES = {
    "engagement_rate": {"nano": 6.5, "micro": 4.2, "mid": 3.1, "macro": 2.0, "mega": 1.5, "celebrity": 1.0},
    "conversion_rate": {"nano": 0.045, "micro": 0.032, "mid": 0.022, "macro": 0.015, "mega": 0.010, "celebrity": 0.007},
    "roi": {"nano": 3.0, "micro": 2.5, "mid": 2.0, "macro": 1.6, "mega": 1.3, "celebrity": 1.1},
}

_CREATOR_COUNT = {
    "nano": 45_000_000, "micro": 8_000_000, "mid": 1_200_000,
    "macro": 150_000, "mega": 20_000, "celebrity": 2_000,
}


def _delta(creator: float, average: float) -> tuple[float, str]:
    if average == 0:
        return 0.0, "on_par"
    d = (creator - average) / average * 100
    status = "above" if d > 5 else ("below" if d < -5 else "on_par")
    return round(d, 1), status


@router.post("/niche", response_model=BenchmarkResponse)
def benchmark_niche(req: BenchmarkRequest):
    tier = infer_tier(req.followers)
    features = build_feature_vector({
        "followers": req.followers,
        "engagement_rate": req.engagement_rate,
        "audience_score": req.audience_score,
        "fraud_score": req.fraud_score,
        "niche": req.niche,
        "platform": req.platform,
        "avg_views": req.avg_views or req.followers * 0.15,
        "post_frequency_per_week": req.post_frequency_per_week,
        "historical_roi": None,
    })
    raw = get_model().predict(features)
    scaled = scale_outputs(raw)

    er_avg = _NICHE_AVERAGES["engagement_rate"][tier]
    conv_avg = _NICHE_AVERAGES["conversion_rate"][tier]
    roi_avg = _NICHE_AVERAGES["roi"][tier]

    # Apply niche multiplier to averages
    niche_mul = NICHE_MULTIPLIER.get(req.niche, 1.0)
    er_avg *= niche_mul ** 0.3   # modest adjustment — ER doesn't scale 1:1 with niche value

    er_d, er_s = _delta(req.engagement_rate, er_avg)
    conv_d, conv_s = _delta(scaled["conversion_rate"], conv_avg)
    roi_d, roi_s = _delta(scaled["predicted_roi"], roi_avg)

    stats = [
        PeerStat(label="Engagement Rate (%)", creator_value=round(req.engagement_rate, 2),
                 niche_average=round(er_avg, 2), delta_pct=er_d, status=er_s),
        PeerStat(label="Conversion Rate", creator_value=round(scaled["conversion_rate"], 4),
                 niche_average=round(conv_avg, 4), delta_pct=conv_d, status=conv_s),
        PeerStat(label="Predicted ROI", creator_value=round(scaled["predicted_roi"], 2),
                 niche_average=round(roi_avg, 2), delta_pct=roi_d, status=roi_s),
    ]

    strengths, weaknesses = [], []
    for s in stats:
        if s.status == "above":
            strengths.append(f"{s.label} is {s.delta_pct:.1f}% above niche average")
        elif s.status == "below":
            weaknesses.append(f"{s.label} is {abs(s.delta_pct):.1f}% below niche average")

    # Rough percentile
    positives = sum(1 for s in stats if s.status == "above")
    percentile = round(55 + positives * 12 + (0 if er_d <= 0 else min(er_d * 0.3, 15)), 1)
    percentile = min(percentile, 99.0)

    return BenchmarkResponse(
        tier=tier,
        overall_percentile=percentile,
        peer_count_estimate=_CREATOR_COUNT[tier],
        strengths=strengths,
        weaknesses=weaknesses,
        stats=stats,
    )
