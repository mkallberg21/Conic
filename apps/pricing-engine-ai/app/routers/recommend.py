from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import math

router = APIRouter()


class PricingRequest(BaseModel):
    platform: str
    content_type: str
    niche: List[str]
    followers_count: int
    engagement_rate: float
    audience_authenticity: Optional[float] = 0.8
    exclusivity_days: Optional[int] = 0
    usage_rights_months: Optional[int] = 12


class PricingResponse(BaseModel):
    recommended_rate: int   # cents
    min_rate: int           # cents
    max_rate: int           # cents
    confidence: float
    factors: List[str]
    tier: str
    breakdown: dict


# Market benchmarks (cents per post type per 10k followers)
PLATFORM_RATES = {
    "instagram": {
        "post": 1000,
        "story": 400,
        "reel": 1500,
        "carousel": 1200,
    },
    "tiktok": {
        "video": 1200,
        "short": 800,
    },
    "youtube": {
        "video": 3000,
        "short": 600,
        "integration": 2000,
    },
    "twitter": {
        "tweet": 300,
        "thread": 500,
    },
    "linkedin": {
        "post": 800,
        "article": 1200,
    },
    "default": {
        "post": 800,
        "video": 1500,
    },
}

# High-value niches command premium (+%age)
NICHE_MULTIPLIERS = {
    "finance": 1.4,
    "fintech": 1.4,
    "tech": 1.3,
    "b2b": 1.3,
    "luxury": 1.35,
    "fashion": 1.2,
    "beauty": 1.15,
    "fitness": 1.1,
    "food": 1.0,
    "travel": 1.05,
    "gaming": 1.15,
    "entertainment": 0.95,
    "lifestyle": 1.0,
}


def get_base_rate(platform: str, content_type: str, followers: int) -> int:
    platform_data = PLATFORM_RATES.get(platform.lower(), PLATFORM_RATES["default"])
    rate_per_10k = platform_data.get(content_type.lower(), platform_data.get("post", 800))
    return int(rate_per_10k * (followers / 10000))


def get_niche_multiplier(niche: List[str]) -> float:
    multipliers = [NICHE_MULTIPLIERS.get(n.lower(), 1.0) for n in niche]
    return max(multipliers) if multipliers else 1.0


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


def tier_multiplier(tier: str) -> float:
    return {"nano": 0.8, "micro": 1.0, "mid": 1.2, "macro": 1.5, "mega": 2.5}.get(tier, 1.0)


@router.post("", response_model=PricingResponse)
def recommend_pricing(req: PricingRequest):
    base = get_base_rate(req.platform, req.content_type, req.followers_count)
    tier = get_tier(req.followers_count)

    # Apply multipliers
    niche_mult = get_niche_multiplier(req.niche)
    tier_mult = tier_multiplier(tier)

    # Engagement quality bonus
    expected_engagement = {"nano": 8.0, "micro": 5.0, "mid": 3.0, "macro": 2.0, "mega": 1.5}[tier]
    engagement_mult = min(1.5, max(0.7, req.engagement_rate / expected_engagement))

    # Authenticity premium
    auth_mult = 0.8 + (req.audience_authenticity or 0.8) * 0.3

    # Exclusivity premium
    exclusivity_mult = 1.0 + min(0.4, (req.exclusivity_days or 0) / 365 * 0.5)

    # Usage rights premium
    usage_mult = 1.0 + min(0.3, (req.usage_rights_months or 12) / 12 * 0.2)

    recommended = int(base * niche_mult * tier_mult * engagement_mult * auth_mult * exclusivity_mult * usage_mult)
    min_rate = int(recommended * 0.6)
    max_rate = int(recommended * 1.8)

    factors = []
    if niche_mult > 1.2:
        factors.append(f"Premium niche ({', '.join(req.niche)}) adds {int((niche_mult-1)*100)}%")
    if engagement_mult > 1.1:
        factors.append(f"Above-average engagement adds {int((engagement_mult-1)*100)}%")
    if (req.audience_authenticity or 0) > 0.85:
        factors.append("High audience authenticity premium")
    if (req.exclusivity_days or 0) > 0:
        factors.append(f"Exclusivity ({req.exclusivity_days}d) adds premium")
    if not factors:
        factors.append("Standard market rate for tier and platform")

    confidence = 0.6 + min(0.25, req.followers_count / 1000000 * 0.25) + \
                 min(0.1, (req.audience_authenticity or 0.8) * 0.1)

    return PricingResponse(
        recommended_rate=recommended,
        min_rate=min_rate,
        max_rate=max_rate,
        confidence=round(min(0.95, confidence), 3),
        factors=factors,
        tier=tier,
        breakdown={
            "base_rate": base,
            "niche_multiplier": round(niche_mult, 2),
            "tier_multiplier": round(tier_mult, 2),
            "engagement_multiplier": round(engagement_mult, 2),
            "authenticity_multiplier": round(auth_mult, 2),
            "exclusivity_multiplier": round(exclusivity_mult, 2),
            "usage_multiplier": round(usage_mult, 2),
        },
    )
