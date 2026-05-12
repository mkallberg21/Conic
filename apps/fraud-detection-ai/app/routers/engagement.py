"""
engagement.py — Engagement quality analysis. Detects engagement pods, comment spam,
and inauthentic growth patterns using statistical anomaly detection.
"""

import logging
import math
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger("conic.fraud_detection.engagement")
router = APIRouter()


class EngagementDataPoint(BaseModel):
    date: str           # ISO date string YYYY-MM-DD
    likes: int = 0
    comments: int = 0
    shares: int = 0
    views: int = 0
    followers_at_time: int = 0


class EngagementAnalysisRequest(BaseModel):
    platform: str
    creator_id: Optional[str] = None
    data_points: list[EngagementDataPoint] = Field(min_length=5)


class EngagementAnomalyResult(BaseModel):
    authenticity_score: float  # 0-100 (100 = very authentic)
    anomalies_detected: int
    spike_dates: list[str]
    avg_engagement_rate: float
    engagement_consistency: float  # coefficient of variation (lower = more consistent)
    ai_verdict: str  # authentic | pod_suspected | purchased | mixed
    details: str


def _compute_engagement_rate(point: EngagementDataPoint) -> float:
    denom = max(point.followers_at_time, 1)
    return (point.likes + point.comments + point.shares) / denom


def _zscore(values: list[float]) -> list[float]:
    if len(values) < 2:
        return [0.0] * len(values)
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std = math.sqrt(variance) if variance > 0 else 0.001
    return [(v - mean) / std for v in values]


@router.post("/analyze", response_model=EngagementAnomalyResult)
async def analyze_engagement(req: EngagementAnalysisRequest) -> EngagementAnomalyResult:
    """
    Statistical engagement authenticity analysis.
    Detects spikes, pod activity, and purchased engagement via z-score and
    coefficient of variation analysis.
    """
    if len(req.data_points) < 5:
        return EngagementAnomalyResult(
            authenticity_score=50.0,
            anomalies_detected=0,
            spike_dates=[],
            avg_engagement_rate=0.0,
            engagement_consistency=0.0,
            ai_verdict="insufficient_data",
            details="Need at least 5 data points for analysis.",
        )

    eng_rates = [_compute_engagement_rate(p) for p in req.data_points]
    z_scores = _zscore(eng_rates)

    # Spikes: z-score > 2.5
    spike_indices = [i for i, z in enumerate(z_scores) if z > 2.5]
    spike_dates = [req.data_points[i].date for i in spike_indices]

    avg_rate = sum(eng_rates) / len(eng_rates)

    # Coefficient of variation (std/mean) — low CoV = very consistent (pod behavior)
    mean = avg_rate
    std = math.sqrt(sum((r - mean) ** 2 for r in eng_rates) / len(eng_rates)) if mean > 0 else 0
    cov = std / mean if mean > 0 else 0

    # Anomaly scoring
    spike_penalty = len(spike_indices) * 10.0  # Each spike is -10 authenticity
    # Very low CoV (< 0.2) is suspicious — engagement pods maintain unnaturally consistent engagement
    cov_penalty = 25.0 if cov < 0.2 and avg_rate > 0.03 else 0.0

    authenticity_score = max(0.0, min(100.0, 100.0 - spike_penalty - cov_penalty))

    # Verdict
    if authenticity_score >= 75:
        verdict = "authentic"
    elif authenticity_score >= 50:
        verdict = "mixed"
    elif cov < 0.2 and len(spike_indices) > 2:
        verdict = "pod_suspected"
    elif len(spike_indices) > len(req.data_points) * 0.3:
        verdict = "purchased"
    else:
        verdict = "suspicious"

    details = (
        f"Analyzed {len(req.data_points)} data points on {req.platform}. "
        f"Average engagement rate: {avg_rate:.3%}. "
        f"Detected {len(spike_indices)} statistical spike(s). "
        f"Engagement consistency (CoV): {cov:.2f} "
        f"({'very consistent — pod risk' if cov < 0.2 else 'normal variation'})."
    )

    return EngagementAnomalyResult(
        authenticity_score=round(authenticity_score, 1),
        anomalies_detected=len(spike_indices),
        spike_dates=spike_dates,
        avg_engagement_rate=round(avg_rate * 100, 3),
        engagement_consistency=round(cov, 3),
        ai_verdict=verdict,
        details=details,
    )
