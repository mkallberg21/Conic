"""
fmv.py — Fair Market Value (FMV) assessment for NIL athletes.

POST /fmv/assess — Calculate FMV for a specific deal type given athlete metrics
"""

import json
import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

router = APIRouter()
logger = logging.getLogger("conic.nil_compliance.fmv")

_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


# ─── Request / Response models ───────────────────────────────────────────────

class AthleteMetrics(BaseModel):
    socialFollowersTotal: Optional[int] = None
    engagementRatePct: Optional[float] = None
    sport: Optional[str] = None
    position: Optional[str] = None
    division: Optional[str] = None
    schoolRanking: Optional[int] = None  # AP ranking if applicable
    nilEarnedYtdCents: Optional[int] = None
    activeDealsCount: Optional[int] = None


class FmvAssessRequest(BaseModel):
    athleteId: str
    dealType: str  # endorsement | appearance | social_post | licensing | camp_clinic
    brandName: str
    proposedValueCents: Optional[int] = None
    metrics: AthleteMetrics = Field(default_factory=AthleteMetrics)
    platforms: list[str] = Field(default_factory=list)
    campaignDetails: Optional[str] = None


class FmvAssessResponse(BaseModel):
    fmvLowCents: int
    fmvMidCents: int
    fmvHighCents: int
    isProposedFair: Optional[bool]  # null if no proposed value
    adjustmentFactors: list[str]
    methodology: str
    confidence: str  # low | medium | high
    summary: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def _call_openai(system: str, user: str) -> str:
    response = await _client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
        max_tokens=1200,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content or "{}"


# ─── Routes ──────────────────────────────────────────────────────────────────

_FMV_SYSTEM = """You are a NIL market valuation expert specializing in collegiate athlete compensation.
Assess the fair market value for a NIL deal given the athlete's metrics.

Return JSON with these exact keys:
{
  "fmv_low_cents": <integer>,
  "fmv_mid_cents": <integer>,
  "fmv_high_cents": <integer>,
  "is_proposed_fair": true|false|null,
  "adjustment_factors": ["<factor1>", ...],
  "methodology": "<brief methodology description>",
  "confidence": "low|medium|high",
  "summary": "<two-sentence summary>"
}

Methodology guidelines:
- Social media posts: $0.01-$0.05 per follower adjusted for engagement rate
- Appearances: $500-$10,000+ based on sport prominence, team ranking, market size
- Endorsements: 1-5% of social audience value annually
- Licensing: 5-15% of projected product revenue from athlete's likeness
- Adjust for: division (D1 > D2 > D3), sport (football/basketball premium), school ranking, local market
Only return valid JSON. No markdown fences."""


@router.post("/assess", response_model=FmvAssessResponse)
async def assess_fmv(req: FmvAssessRequest) -> FmvAssessResponse:
    proposed_str = ""
    if req.proposedValueCents is not None:
        proposed_str = f"Proposed deal value: ${req.proposedValueCents / 100:,.2f}\n"

    user_prompt = (
        f"Deal type: {req.dealType}\n"
        f"Brand: {req.brandName}\n"
        f"Platforms: {', '.join(req.platforms) or 'none'}\n"
        f"{proposed_str}"
        f"Athlete sport: {req.metrics.sport or 'unknown'}\n"
        f"Division: {req.metrics.division or 'unknown'}\n"
        f"Social followers: {req.metrics.socialFollowersTotal or 'unknown'}\n"
        f"Engagement rate: {req.metrics.engagementRatePct or 'unknown'}%\n"
        f"School AP ranking: {req.metrics.schoolRanking or 'unranked'}\n"
        f"YTD NIL earnings: {'$' + f'{req.metrics.nilEarnedYtdCents / 100:,.2f}' if req.metrics.nilEarnedYtdCents else 'unknown'}\n"
        f"Active NIL deals: {req.metrics.activeDealsCount or 0}\n"
        f"Campaign details: {(req.campaignDetails or 'none provided')[:500]}\n\n"
        "Provide a fair market value range for this NIL deal."
    )

    try:
        raw = await _call_openai(_FMV_SYSTEM, user_prompt)
    except Exception as exc:
        logger.error("OpenAI call failed for FMV assess: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable") from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Malformed JSON for FMV assessment: %s", raw[:300])
        raise HTTPException(status_code=502, detail="AI returned malformed response")

    def _safe_int(val, default: int = 0) -> int:
        try:
            return max(0, int(val))
        except (TypeError, ValueError):
            return default

    fmv_low = _safe_int(data.get("fmv_low_cents"), 0)
    fmv_mid = _safe_int(data.get("fmv_mid_cents"), 0)
    fmv_high = _safe_int(data.get("fmv_high_cents"), 0)

    _CONFIDENCE = frozenset({"low", "medium", "high"})
    confidence = str(data.get("confidence", "medium"))
    if confidence not in _CONFIDENCE:
        confidence = "medium"

    is_fair = data.get("is_proposed_fair")
    if is_fair is not None:
        is_fair = bool(is_fair)

    return FmvAssessResponse(
        fmvLowCents=fmv_low,
        fmvMidCents=fmv_mid,
        fmvHighCents=fmv_high,
        isProposedFair=is_fair,
        adjustmentFactors=[str(f)[:300] for f in data.get("adjustment_factors", []) if isinstance(f, str)][:15],
        methodology=str(data.get("methodology", ""))[:1000],
        confidence=confidence,
        summary=str(data.get("summary", ""))[:1000],
    )
