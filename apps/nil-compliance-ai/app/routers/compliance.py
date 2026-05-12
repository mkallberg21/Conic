"""
compliance.py — NIL disclosure analysis, deal risk scoring, and eligibility checks.

Endpoints:
  POST /compliance/analyze-disclosure  — analyze a new NIL disclosure
  POST /compliance/assess-deal-risk    — risk-score a proposed NIL deal
  POST /compliance/check-eligibility  — full eligibility analysis for an athlete
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
logger = logging.getLogger("conic.nil_compliance.compliance")

_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


# ─── Request / Response models ───────────────────────────────────────────────

class AnalyzeDisclosureRequest(BaseModel):
    athleteId: str
    dealType: str
    brandName: str
    dealValueCents: int
    platforms: list[str] = Field(default_factory=list)
    state: Optional[str] = None
    division: Optional[str] = None
    sport: Optional[str] = None


class AnalyzeDisclosureResponse(BaseModel):
    aiGeneratedSummary: str
    aiComplianceFlags: list[str]
    aiStateRules: dict
    aiNcaaRules: dict
    riskLevel: str  # low | medium | high | critical
    recommendation: str


class AssessDealRiskRequest(BaseModel):
    athleteId: str
    dealType: str
    brandName: str
    dealValueCents: int
    platforms: list[str] = Field(default_factory=list)
    state: Optional[str] = None
    sport: Optional[str] = None
    athleteNilEarnedYtdCents: Optional[int] = None
    athleteNilCapCents: Optional[int] = None
    contractTerms: Optional[str] = None


class AssessDealRiskResponse(BaseModel):
    riskScore: int  # 0-100
    riskLevel: str  # low | medium | high | critical
    flags: list[str]
    recommendations: list[str]
    summary: str


class CheckEligibilityRequest(BaseModel):
    athleteId: str
    sport: Optional[str] = None
    division: Optional[str] = None
    state: Optional[str] = None
    nilEarnedYtdCents: Optional[int] = None
    nilCapCents: Optional[int] = None
    activeDeals: int = 0
    hasPendingDisclosures: bool = False


class CheckEligibilityResponse(BaseModel):
    isEligible: bool
    eligibilityStatus: str  # eligible | at_risk | probation | ineligible
    flags: list[str]
    recommendations: list[str]
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
        max_tokens=1500,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content or "{}"


_RISK_LEVELS = ["low", "medium", "high", "critical"]

def _clamp_risk(level: str) -> str:
    return level if level in _RISK_LEVELS else "medium"

def _score_to_level(score: int) -> str:
    if score < 25:
        return "low"
    if score < 50:
        return "medium"
    if score < 75:
        return "high"
    return "critical"


# ─── Routes ──────────────────────────────────────────────────────────────────

_DISCLOSURE_SYSTEM = """You are a NIL (Name, Image, Likeness) compliance expert for US collegiate athletics.
Analyze the NIL disclosure and return JSON with these exact keys:
{
  "summary": "<two-sentence human explanation>",
  "compliance_flags": ["<flag1>", ...],
  "state_rules": {"requires_reporting": true|false, "disclosure_window_days": <int>, "notes": "<string>"},
  "ncaa_rules": {"allowed": true|false, "restrictions": ["<restriction1>", ...], "notes": "<string>"},
  "risk_level": "low|medium|high|critical",
  "recommendation": "<actionable recommendation>"
}
Only return valid JSON. Do not include markdown fences."""


@router.post("/analyze-disclosure", response_model=AnalyzeDisclosureResponse)
async def analyze_disclosure(req: AnalyzeDisclosureRequest) -> AnalyzeDisclosureResponse:
    deal_value_dollars = req.dealValueCents / 100
    user_prompt = (
        f"Athlete sport: {req.sport or 'unknown'}\n"
        f"Division: {req.division or 'unknown'}\n"
        f"State: {req.state or 'unknown'}\n"
        f"Deal type: {req.dealType}\n"
        f"Brand: {req.brandName}\n"
        f"Deal value: ${deal_value_dollars:,.2f}\n"
        f"Platforms: {', '.join(req.platforms) or 'none specified'}\n\n"
        "Analyze this NIL disclosure for NCAA compliance and any state-specific rules."
    )

    try:
        raw = await _call_openai(_DISCLOSURE_SYSTEM, user_prompt)
    except Exception as exc:
        logger.error("OpenAI call failed for analyze-disclosure: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable") from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Malformed JSON from OpenAI: %s", raw[:300])
        raise HTTPException(status_code=502, detail="AI returned malformed response")

    flags = [str(f)[:200] for f in data.get("compliance_flags", []) if isinstance(f, str)][:20]
    state_rules = data.get("state_rules", {})
    ncaa_rules = data.get("ncaa_rules", {})
    risk_level = _clamp_risk(str(data.get("risk_level", "medium")))

    return AnalyzeDisclosureResponse(
        aiGeneratedSummary=str(data.get("summary", ""))[:1000],
        aiComplianceFlags=flags,
        aiStateRules=state_rules if isinstance(state_rules, dict) else {},
        aiNcaaRules=ncaa_rules if isinstance(ncaa_rules, dict) else {},
        riskLevel=risk_level,
        recommendation=str(data.get("recommendation", ""))[:1000],
    )


_DEAL_RISK_SYSTEM = """You are a NIL deal risk analyst. Score the proposed NIL deal for compliance risk.
Return JSON with these exact keys:
{
  "risk_score": <integer 0-100>,
  "risk_level": "low|medium|high|critical",
  "flags": ["<flag1>", ...],
  "recommendations": ["<recommendation1>", ...],
  "summary": "<two-sentence summary>"
}
Risk factors: deal value vs NIL cap, number of active deals, deal type restrictions by state/division,
brand category restrictions, disclosure requirements, guardian approval needs for minors.
Only return valid JSON. No markdown fences."""


@router.post("/assess-deal-risk", response_model=AssessDealRiskResponse)
async def assess_deal_risk(req: AssessDealRiskRequest) -> AssessDealRiskResponse:
    deal_value_dollars = req.dealValueCents / 100
    cap_remaining = None
    if req.athleteNilCapCents is not None and req.athleteNilEarnedYtdCents is not None:
        cap_remaining = (req.athleteNilCapCents - req.athleteNilEarnedYtdCents) / 100

    user_prompt = (
        f"Sport: {req.sport or 'unknown'}, State: {req.state or 'unknown'}\n"
        f"Deal type: {req.dealType}, Brand: {req.brandName}\n"
        f"Deal value: ${deal_value_dollars:,.2f}\n"
        f"NIL cap remaining: {'$' + f'{cap_remaining:,.2f}' if cap_remaining is not None else 'unknown'}\n"
        f"YTD earnings: {'$' + f'{req.athleteNilEarnedYtdCents / 100:,.2f}' if req.athleteNilEarnedYtdCents else 'unknown'}\n"
        f"Platforms: {', '.join(req.platforms) or 'none'}\n"
        f"Contract terms snippet: {(req.contractTerms or 'not provided')[:500]}\n\n"
        "Score this NIL deal for compliance risk."
    )

    try:
        raw = await _call_openai(_DEAL_RISK_SYSTEM, user_prompt)
    except Exception as exc:
        logger.error("OpenAI call failed for assess-deal-risk: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable") from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned malformed response")

    raw_score = data.get("risk_score", 50)
    score = max(0, min(100, int(raw_score) if isinstance(raw_score, (int, float)) else 50))
    risk_level = _clamp_risk(str(data.get("risk_level", _score_to_level(score))))
    flags = [str(f)[:200] for f in data.get("flags", []) if isinstance(f, str)][:20]
    recs = [str(r)[:500] for r in data.get("recommendations", []) if isinstance(r, str)][:10]

    return AssessDealRiskResponse(
        riskScore=score,
        riskLevel=risk_level,
        flags=flags,
        recommendations=recs,
        summary=str(data.get("summary", ""))[:1000],
    )


_ELIGIBILITY_SYSTEM = """You are an NCAA eligibility compliance expert.
Analyze the athlete's NIL profile and return eligibility assessment as JSON:
{
  "is_eligible": true|false,
  "eligibility_status": "eligible|at_risk|probation|ineligible",
  "flags": ["<flag1>", ...],
  "recommendations": ["<rec1>", ...],
  "summary": "<two-sentence summary>"
}
Consider: disclosure compliance, deal count, cap adherence, pending disclosures, division rules.
Only return valid JSON. No markdown fences."""


@router.post("/check-eligibility", response_model=CheckEligibilityResponse)
async def check_eligibility(req: CheckEligibilityRequest) -> CheckEligibilityResponse:
    user_prompt = (
        f"Sport: {req.sport or 'unknown'}, Division: {req.division or 'unknown'}, State: {req.state or 'unknown'}\n"
        f"NIL earned YTD: {'$' + f'{req.nilEarnedYtdCents / 100:,.2f}' if req.nilEarnedYtdCents else 'unknown'}\n"
        f"NIL cap: {'$' + f'{req.nilCapCents / 100:,.2f}' if req.nilCapCents else 'none set'}\n"
        f"Active deals: {req.activeDeals}\n"
        f"Has pending disclosures: {req.hasPendingDisclosures}\n\n"
        "Assess this athlete's NIL eligibility status."
    )

    try:
        raw = await _call_openai(_ELIGIBILITY_SYSTEM, user_prompt)
    except Exception as exc:
        logger.error("OpenAI call failed for check-eligibility: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable") from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned malformed response")

    _STATUSES = frozenset({"eligible", "at_risk", "probation", "ineligible"})
    status = str(data.get("eligibility_status", "at_risk"))
    if status not in _STATUSES:
        status = "at_risk"

    return CheckEligibilityResponse(
        isEligible=bool(data.get("is_eligible", False)),
        eligibilityStatus=status,
        flags=[str(f)[:200] for f in data.get("flags", []) if isinstance(f, str)][:20],
        recommendations=[str(r)[:500] for r in data.get("recommendations", []) if isinstance(r, str)][:10],
        summary=str(data.get("summary", ""))[:1000],
    )
