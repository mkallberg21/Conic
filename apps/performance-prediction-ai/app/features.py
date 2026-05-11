"""
Feature engineering + normalization helpers shared across routes.
"""
import math
from typing import Dict, Any


PLATFORM_BASE = {
    "instagram": {"cpm": 6.0, "avg_er": 3.5, "conv_rate": 0.012},
    "tiktok":    {"cpm": 3.5, "avg_er": 8.0, "conv_rate": 0.020},
    "youtube":   {"cpm": 18.0, "avg_er": 2.0, "conv_rate": 0.015},
    "twitter":   {"cpm": 2.5, "avg_er": 1.5, "conv_rate": 0.006},
    "linkedin":  {"cpm": 45.0, "avg_er": 2.5, "conv_rate": 0.030},
}

NICHE_MULTIPLIER = {
    "finance":     1.8,
    "tech":        1.6,
    "beauty":      1.3,
    "fashion":     1.2,
    "fitness":     1.1,
    "food":        1.0,
    "gaming":      0.9,
    "lifestyle":   1.0,
    "travel":      1.1,
    "education":   1.4,
    "b2b":         2.0,
    "other":       1.0,
}

TIER_INFO = {
    "nano":      {"floor": 1_000,   "ceil": 10_000,    "bonus_er": 0.04},
    "micro":     {"floor": 10_000,  "ceil": 100_000,   "bonus_er": 0.02},
    "mid":       {"floor": 100_000, "ceil": 500_000,   "bonus_er": 0.0},
    "macro":     {"floor": 500_000, "ceil": 2_000_000, "bonus_er": -0.01},
    "mega":      {"floor": 2_000_000, "ceil": 50_000_000, "bonus_er": -0.015},
    "celebrity": {"floor": 50_000_000, "ceil": 999_999_999, "bonus_er": -0.02},
}


def infer_tier(followers: int) -> str:
    for tier, info in TIER_INFO.items():
        if info["floor"] <= followers < info["ceil"]:
            return tier
    return "mega"


def build_feature_vector(data: Dict[str, Any]) -> list:
    """Convert raw creator/campaign inputs to a float feature vector."""
    followers = max(data.get("followers", 0), 1)
    er = data.get("engagement_rate", 3.0)
    audience_score = data.get("audience_score", 0.7)    # 0-1 authenticity
    fraud_score = data.get("fraud_score", 0.1)           # 0-1
    niche = data.get("niche", "other").lower()
    platform = data.get("platform", "instagram").lower()
    avg_views = data.get("avg_views", followers * 0.1)
    post_frequency = data.get("post_frequency_per_week", 3.0)
    historical_roi = data.get("historical_roi", 1.5)

    pb = PLATFORM_BASE.get(platform, PLATFORM_BASE["instagram"])
    nm = NICHE_MULTIPLIER.get(niche, 1.0)
    tier = infer_tier(followers)
    bonus_er = TIER_INFO[tier]["bonus_er"]

    log_followers = math.log10(max(followers, 1))
    norm_er = er / 10.0
    norm_audience = float(audience_score)          # already 0-1
    fraud_penalty = 1.0 - (float(fraud_score) / 2.0)  # max 50% penalty
    norm_freq = min(post_frequency / 7.0, 1.0)
    norm_roi = min(historical_roi / 10.0, 1.0)
    log_views = math.log10(max(avg_views, 1))

    return [
        log_followers,
        norm_er + bonus_er,
        norm_audience * fraud_penalty,
        pb["avg_er"] / 10.0,
        pb["conv_rate"] * 10.0,
        pb["cpm"] / 50.0,
        nm / 2.0,
        norm_freq,
        norm_roi,
        log_views,
    ]
