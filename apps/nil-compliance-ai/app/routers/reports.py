"""
reports.py — AI-powered compliance report narrative generation.

POST /reports/generate-narrative — Generate an AI narrative for a compliance report
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
logger = logging.getLogger("conic.nil_compliance.reports")

_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


# ─── Request / Response models ───────────────────────────────────────────────

class ReportPeriodData(BaseModel):
    universityName: str
    periodType: str  # monthly | quarterly | annual
    periodLabel: str  # e.g. "2024-Q1", "2024-01", "2024"
    athleteCount: int
    activeAthletes: int
    totalDisclosures: int
    approvedDisclosures: int
    rejectedDisclosures: int
    pendingDisclosures: int
    totalDeals: int
    activeDeals: int
    totalNilValueCents: int
    totalAppearances: int
    topSports: list[str] = Field(default_factory=list)
    complianceIssuesSummary: Optional[str] = None
    previousPeriodStats: Optional[dict] = None


class GenerateNarrativeRequest(BaseModel):
    reportData: ReportPeriodData
    audienceType: str = "compliance_officer"  # compliance_officer | athletic_director | ncaa_submission


class GenerateNarrativeResponse(BaseModel):
    executiveSummary: str
    keyHighlights: list[str]
    complianceAssessment: str
    riskAreas: list[str]
    recommendations: list[str]
    periodOverPeriodInsights: Optional[str]
    fullNarrative: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def _call_openai(system: str, user: str) -> str:
    response = await _client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
        max_tokens=2000,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content or "{}"


# ─── Routes ──────────────────────────────────────────────────────────────────

_NARRATIVE_SYSTEMS = {
    "compliance_officer": """You are a compliance report writer for a university athletics department.
Write a clear, professional NIL compliance report narrative.
Return JSON with these exact keys:
{
  "executive_summary": "<2-3 sentence summary>",
  "key_highlights": ["<highlight1>", ...],
  "compliance_assessment": "<paragraph assessing overall compliance health>",
  "risk_areas": ["<risk1>", ...],
  "recommendations": ["<rec1>", ...],
  "period_over_period_insights": "<insights comparing to previous period or null>",
  "full_narrative": "<3-5 paragraph comprehensive narrative>"
}
Be objective, professional, and specific. Flag any compliance concerns clearly.
Only return valid JSON. No markdown fences.""",

    "athletic_director": """You are writing an executive-level NIL program summary for an Athletic Director.
Focus on program health, student-athlete benefit, and institutional risk management.
Return JSON with these exact keys:
{
  "executive_summary": "<3-4 sentence high-level summary>",
  "key_highlights": ["<highlight1>", ...],
  "compliance_assessment": "<paragraph on institutional compliance standing>",
  "risk_areas": ["<risk1>", ...],
  "recommendations": ["<strategic recommendation1>", ...],
  "period_over_period_insights": "<trend analysis>",
  "full_narrative": "<2-3 paragraph executive narrative>"
}
Avoid technical compliance jargon. Focus on strategic and institutional implications.
Only return valid JSON. No markdown fences.""",

    "ncaa_submission": """You are writing a formal NIL disclosure report for NCAA submission.
Use formal, precise language appropriate for regulatory review.
Return JSON with these exact keys:
{
  "executive_summary": "<formal summary of NIL activity>",
  "key_highlights": ["<data point 1>", ...],
  "compliance_assessment": "<formal compliance statement>",
  "risk_areas": ["<identified exception or concern1>", ...],
  "recommendations": ["<corrective action1>", ...],
  "period_over_period_insights": "<comparative period analysis>",
  "full_narrative": "<formal regulatory narrative with all required data elements>"
}
Only return valid JSON. No markdown fences.""",
}


@router.post("/generate-narrative", response_model=GenerateNarrativeResponse)
async def generate_narrative(req: GenerateNarrativeRequest) -> GenerateNarrativeResponse:
    d = req.reportData
    approval_rate = (
        round(d.approvedDisclosures / d.totalDisclosures * 100, 1)
        if d.totalDisclosures > 0 else 0
    )
    total_nil_dollars = d.totalNilValueCents / 100

    pop_str = ""
    if d.previousPeriodStats:
        prev = d.previousPeriodStats
        pop_str = (
            f"\nPrevious period: {prev.get('totalDisclosures', 'N/A')} disclosures, "
            f"{prev.get('totalDeals', 'N/A')} deals, "
            f"${prev.get('totalNilValueCents', 0) / 100:,.2f} total value"
        )

    user_prompt = (
        f"University: {d.universityName}\n"
        f"Report period: {d.periodType} — {d.periodLabel}\n"
        f"Total athletes: {d.athleteCount} ({d.activeAthletes} active in NIL)\n"
        f"Disclosures: {d.totalDisclosures} total — {d.approvedDisclosures} approved, "
        f"{d.rejectedDisclosures} rejected, {d.pendingDisclosures} pending\n"
        f"Approval rate: {approval_rate}%\n"
        f"Active NIL deals: {d.activeDeals} (of {d.totalDeals} total)\n"
        f"Total NIL value: ${total_nil_dollars:,.2f}\n"
        f"Appearances: {d.totalAppearances}\n"
        f"Top sports by NIL activity: {', '.join(d.topSports) or 'not specified'}\n"
        f"Known compliance issues: {d.complianceIssuesSummary or 'none reported'}\n"
        f"{pop_str}\n\n"
        f"Generate a {req.audienceType.replace('_', ' ')} compliance report narrative."
    )

    system = _NARRATIVE_SYSTEMS.get(req.audienceType, _NARRATIVE_SYSTEMS["compliance_officer"])

    try:
        raw = await _call_openai(system, user_prompt)
    except Exception as exc:
        logger.error("OpenAI call failed for generate-narrative: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable") from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Malformed JSON for narrative generation: %s", raw[:300])
        raise HTTPException(status_code=502, detail="AI returned malformed response")

    def _str_list(key: str, maxlen: int = 500, maxitems: int = 10) -> list[str]:
        return [str(x)[:maxlen] for x in data.get(key, []) if isinstance(x, str)][:maxitems]

    return GenerateNarrativeResponse(
        executiveSummary=str(data.get("executive_summary", ""))[:2000],
        keyHighlights=_str_list("key_highlights", 300, 10),
        complianceAssessment=str(data.get("compliance_assessment", ""))[:3000],
        riskAreas=_str_list("risk_areas", 300, 10),
        recommendations=_str_list("recommendations", 500, 10),
        periodOverPeriodInsights=str(data.get("period_over_period_insights", ""))[:2000] or None,
        fullNarrative=str(data.get("full_narrative", ""))[:5000],
    )
