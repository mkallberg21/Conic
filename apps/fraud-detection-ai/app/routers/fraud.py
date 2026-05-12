"""
fraud.py — Composite fraud scoring: fake followers + engagement + payment anomalies.
Combines heuristic signals with GPT-4o-mini analysis for explainable fraud scores.
"""

import os
import logging
import math
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field
import openai
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger("conic.fraud_detection.fraud")
router = APIRouter()

_client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))


class SocialProfile(BaseModel):
    platform: str  # instagram | tiktok | youtube | twitter
    followers: int
    following: int = 0
    posts: int = 0
    avg_likes: float = 0.0
    avg_comments: float = 0.0
    avg_views: float = 0.0
    recent_follower_spike: Optional[float] = None  # % growth in last 30d
    account_age_days: Optional[int] = None
    verified: bool = False


class FraudAnalysisRequest(BaseModel):
    creator_id: Optional[str] = None
    athlete_id: Optional[str] = None
    profiles: list[SocialProfile]
    recent_payment_amounts: list[int] = Field(default_factory=list)  # cents
    reported_reach: Optional[int] = None
    country: Optional[str] = None


class FraudSignal(BaseModel):
    signal: str
    severity: str  # low | medium | high | critical
    details: str


class FraudAnalysisResult(BaseModel):
    fraud_score: float  # 0-100 (100 = very likely fraud)
    risk_tier: str  # clean | suspicious | high_risk | blocked
    fake_follower_estimate_pct: float
    engagement_fraud_pct: float
    signals: list[FraudSignal]
    ai_summary: str
    recommended_action: str  # approve | manual_review | block


# ─── Heuristic Engines ────────────────────────────────────────────────────────

def _follower_fraud_score(profile: SocialProfile) -> tuple[float, list[FraudSignal]]:
    """Returns estimated fake follower % and detected signals."""
    signals: list[FraudSignal] = []
    score = 0.0

    if profile.followers > 0:
        # Engagement rate = (likes + comments) / followers
        eng_rate = (profile.avg_likes + profile.avg_comments) / max(profile.followers, 1)

        # Platform benchmarks for expected engagement rates
        benchmarks = {
            "instagram": (0.01, 0.06),   # 1-6% healthy range
            "tiktok": (0.03, 0.15),       # 3-15%
            "youtube": (0.005, 0.04),    # 0.5-4%
            "twitter": (0.003, 0.02),    # 0.3-2%
        }
        lo, hi = benchmarks.get(profile.platform.lower(), (0.01, 0.06))

        if eng_rate < lo * 0.3:
            # Extremely low engagement → likely bot followers
            deficit = 1 - (eng_rate / (lo * 0.3))
            estimated_fake = min(deficit * 80, 80.0)
            score += estimated_fake
            signals.append(FraudSignal(
                signal="extremely_low_engagement",
                severity="high",
                details=f"Engagement rate {eng_rate:.3%} is far below platform floor of {lo:.1%}",
            ))
        elif eng_rate < lo:
            score += 20.0
            signals.append(FraudSignal(
                signal="below_benchmark_engagement",
                severity="medium",
                details=f"Engagement rate {eng_rate:.3%} below healthy floor {lo:.1%}",
            ))

        # Following/follower ratio (bot farms follow many accounts)
        if profile.following > 0 and profile.followers > 0:
            ratio = profile.following / profile.followers
            if ratio > 2.0:
                score += 15.0
                signals.append(FraudSignal(
                    signal="high_follow_ratio",
                    severity="medium",
                    details=f"Following/follower ratio {ratio:.1f}x suggests follow-farming",
                ))

        # Sudden follower spike
        if profile.recent_follower_spike and profile.recent_follower_spike > 50:
            spike_score = min((profile.recent_follower_spike - 50) * 0.8, 30.0)
            score += spike_score
            signals.append(FraudSignal(
                signal="follower_spike",
                severity="high" if profile.recent_follower_spike > 100 else "medium",
                details=f"{profile.recent_follower_spike:.0f}% follower growth in 30 days",
            ))

        # New account with high followers
        if profile.account_age_days and profile.account_age_days < 180 and profile.followers > 10000:
            score += 20.0
            signals.append(FraudSignal(
                signal="new_account_high_followers",
                severity="high",
                details=f"Account only {profile.account_age_days}d old but has {profile.followers:,} followers",
            ))

    fake_pct = min(score, 90.0)
    return fake_pct, signals


def _engagement_fraud_score(profile: SocialProfile) -> tuple[float, list[FraudSignal]]:
    """Detects purchased likes/comments (engagement pods, bots)."""
    signals: list[FraudSignal] = []
    score = 0.0

    if profile.followers > 0 and profile.avg_likes > 0:
        # Comments/likes ratio — real engagement: 1-5% of likes are comments.
        # Purchased likes rarely come with matching comments.
        like_comment_ratio = profile.avg_comments / max(profile.avg_likes, 1)
        if profile.avg_likes > 1000 and like_comment_ratio < 0.003:
            score += 25.0
            signals.append(FraudSignal(
                signal="suspiciously_low_comment_ratio",
                severity="medium",
                details=f"Only {like_comment_ratio:.4%} comments per like (expected 1-5%)",
            ))

        # Likes >> views on video platforms (YouTube, TikTok)
        if profile.platform.lower() in ("tiktok", "youtube") and profile.avg_views > 0:
            like_view_ratio = profile.avg_likes / max(profile.avg_views, 1)
            if like_view_ratio > 0.3:
                score += 20.0
                signals.append(FraudSignal(
                    signal="inflated_like_view_ratio",
                    severity="medium",
                    details=f"Like/view ratio {like_view_ratio:.2%} is abnormally high (expected <30%)",
                ))

    return min(score, 80.0), signals


def _payment_anomaly_score(amounts: list[int]) -> tuple[float, list[FraudSignal]]:
    """Detects structuring (Smurfing), round-number clustering, or outlier payments."""
    if not amounts or len(amounts) < 3:
        return 0.0, []

    signals: list[FraudSignal] = []
    score = 0.0

    # Round number clustering (>70% of payments are round thousand-dollar amounts)
    round_count = sum(1 for a in amounts if a % 100000 == 0)  # $1000 in cents
    if round_count / len(amounts) > 0.7:
        score += 20.0
        signals.append(FraudSignal(
            signal="round_number_clustering",
            severity="medium",
            details=f"{round_count}/{len(amounts)} payments are exact round-dollar amounts",
        ))

    # Structuring: many payments just below $10,000 (BSA threshold — $1,000,000 cents)
    threshold = 1_000_000  # $10,000 in cents
    near_threshold = sum(1 for a in amounts if threshold * 0.85 <= a < threshold)
    if near_threshold >= 3:
        score += 40.0
        signals.append(FraudSignal(
            signal="structuring_signals",
            severity="critical",
            details=f"{near_threshold} payments just below $10,000 threshold — potential structuring",
        ))

    # Statistical outlier: Z-score > 3 in any payment
    if len(amounts) >= 5:
        mean = sum(amounts) / len(amounts)
        variance = sum((a - mean) ** 2 for a in amounts) / len(amounts)
        std = math.sqrt(variance) if variance > 0 else 1
        outliers = [a for a in amounts if abs(a - mean) > 3 * std]
        if outliers:
            score += 15.0
            signals.append(FraudSignal(
                signal="payment_outlier",
                severity="medium",
                details=f"{len(outliers)} payment(s) with Z-score >3 detected",
            ))

    return min(score, 60.0), signals


# ─── AI Summary ───────────────────────────────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _generate_ai_summary(
    signals: list[FraudSignal],
    fraud_score: float,
    profile_summary: str,
) -> str:
    if not signals:
        return "No fraud signals detected. Profile appears authentic."

    signal_text = "\n".join(f"- [{s.severity.upper()}] {s.signal}: {s.details}" for s in signals)
    prompt = f"""You are a fraud analyst for a creator/athlete monetization platform.

Profile summary: {profile_summary}
Overall fraud score: {fraud_score:.0f}/100

Detected signals:
{signal_text}

Write a concise 2-3 sentence professional summary of the fraud risk for this profile.
Focus on the highest severity signals and their business implications.
Do NOT use bullet points. Plain prose only."""

    response = await _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.2,
        response_format={"type": "text"},
    )
    return response.choices[0].message.content or "Unable to generate AI summary."


# ─── Route ────────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=FraudAnalysisResult)
async def analyze_fraud(req: FraudAnalysisRequest) -> FraudAnalysisResult:
    """
    Full fraud analysis: fake followers + engagement manipulation + payment anomalies.
    Returns a 0-100 fraud score with explainable signals and AI summary.
    """
    all_signals: list[FraudSignal] = []
    total_follower_fraud = 0.0
    total_engagement_fraud = 0.0

    for profile in req.profiles:
        fake_pct, f_signals = _follower_fraud_score(profile)
        eng_pct, e_signals = _engagement_fraud_score(profile)
        total_follower_fraud = max(total_follower_fraud, fake_pct)
        total_engagement_fraud = max(total_engagement_fraud, eng_pct)
        all_signals.extend(f_signals)
        all_signals.extend(e_signals)

    payment_score, p_signals = _payment_anomaly_score(req.recent_payment_amounts)
    all_signals.extend(p_signals)

    # Weighted composite score
    composite = (
        total_follower_fraud * 0.40 +
        total_engagement_fraud * 0.35 +
        payment_score * 0.25
    )
    fraud_score = min(round(composite, 1), 100.0)

    # Risk tier
    if fraud_score < 20:
        risk_tier = "clean"
        recommended_action = "approve"
    elif fraud_score < 45:
        risk_tier = "suspicious"
        recommended_action = "manual_review"
    elif fraud_score < 70:
        risk_tier = "high_risk"
        recommended_action = "manual_review"
    else:
        risk_tier = "blocked"
        recommended_action = "block"

    profile_summary = (
        f"{len(req.profiles)} platform(s), "
        f"max {max((p.followers for p in req.profiles), default=0):,} followers"
        + (f", {len(req.recent_payment_amounts)} payments" if req.recent_payment_amounts else "")
    )
    ai_summary = await _generate_ai_summary(all_signals, fraud_score, profile_summary)

    return FraudAnalysisResult(
        fraud_score=fraud_score,
        risk_tier=risk_tier,
        fake_follower_estimate_pct=round(total_follower_fraud, 1),
        engagement_fraud_pct=round(total_engagement_fraud, 1),
        signals=all_signals,
        ai_summary=ai_summary,
        recommended_action=recommended_action,
    )
