"""
identity.py — Identity fraud detection: mismatched social handles, impersonation,
account takeover signals, and cross-platform identity consistency checks.
"""

import os
import logging
import re
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel
import openai
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger("conic.fraud_detection.identity")
router = APIRouter()

_client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))


class SocialHandle(BaseModel):
    platform: str
    handle: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    profile_url: Optional[str] = None


class IdentityCheckRequest(BaseModel):
    full_name: str  # Name on legal documents
    email: str
    registered_handles: list[SocialHandle]  # What user claimed in profile
    sport: Optional[str] = None
    university: Optional[str] = None


class IdentityRisk(BaseModel):
    risk_type: str
    severity: str  # low | medium | high | critical
    description: str


class IdentityCheckResult(BaseModel):
    identity_score: float  # 0-100 (100 = severe identity mismatch)
    is_consistent: bool
    risks: list[IdentityRisk]
    ai_assessment: str
    recommendation: str  # verified | needs_review | flag_for_manual


def _name_similarity(name1: str, name2: str) -> float:
    """Simple token overlap similarity."""
    t1 = set(name1.lower().split())
    t2 = set(name2.lower().split())
    if not t1 or not t2:
        return 0.0
    return len(t1 & t2) / max(len(t1), len(t2))


def _check_handle_name_consistency(full_name: str, handles: list[SocialHandle]) -> list[IdentityRisk]:
    risks: list[IdentityRisk] = []
    name_parts = set(full_name.lower().split())

    for handle in handles:
        # Check if handle contains parts of full name
        handle_lower = handle.handle.lower()
        has_name_overlap = any(part in handle_lower for part in name_parts if len(part) > 2)
        
        if not has_name_overlap and handle.display_name:
            sim = _name_similarity(full_name, handle.display_name)
            if sim < 0.3:
                risks.append(IdentityRisk(
                    risk_type="display_name_mismatch",
                    severity="medium",
                    description=f"Display name '{handle.display_name}' on {handle.platform} "
                                f"has low similarity ({sim:.0%}) to registered name '{full_name}'",
                ))
        elif not has_name_overlap and not handle.display_name:
            risks.append(IdentityRisk(
                risk_type="handle_name_mismatch",
                severity="low",
                description=f"Handle '{handle.handle}' on {handle.platform} may not belong to '{full_name}'",
            ))
    return risks


def _detect_suspicious_patterns(handles: list[SocialHandle]) -> list[IdentityRisk]:
    risks: list[IdentityRisk] = []

    # Look for handles that look like bots (random strings, numeric suffixes)
    bot_pattern = re.compile(r'[0-9]{4,}$|_+\d{3,}$|xxxx', re.IGNORECASE)
    for handle in handles:
        if bot_pattern.search(handle.handle):
            risks.append(IdentityRisk(
                risk_type="bot_pattern_handle",
                severity="medium",
                description=f"Handle '{handle.handle}' on {handle.platform} matches common bot naming patterns",
            ))

    # Cross-platform display name inconsistency
    display_names = [h.display_name for h in handles if h.display_name]
    if len(display_names) >= 2:
        for i in range(len(display_names)):
            for j in range(i + 1, len(display_names)):
                sim = _name_similarity(display_names[i], display_names[j])
                if sim < 0.3:
                    risks.append(IdentityRisk(
                        risk_type="cross_platform_name_inconsistency",
                        severity="high",
                        description=f"Display names differ significantly across platforms: "
                                    f"'{display_names[i]}' vs '{display_names[j]}'",
                    ))
    return risks


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _ai_identity_assessment(
    full_name: str,
    handles: list[SocialHandle],
    risks: list[IdentityRisk],
    sport: Optional[str],
    university: Optional[str],
) -> str:
    handle_desc = "; ".join(
        f"{h.platform}: @{h.handle}" + (f" ({h.display_name})" if h.display_name else "")
        for h in handles
    )
    risk_lines = "\n".join(f"- [{r.severity.upper()}] {r.risk_type}: {r.description}" for r in risks)
    context = f"Sport: {sport or 'N/A'}, University: {university or 'N/A'}"

    prompt = f"""You are a trust & safety analyst for a sports creator monetization platform.

Registered name: {full_name}
{context}
Social handles: {handle_desc or 'None provided'}
Identity risks detected:
{risk_lines or 'None'}

Write a single professional sentence summarizing the identity consistency assessment."""

    response = await _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150,
        temperature=0.1,
    )
    return response.choices[0].message.content or "Identity check inconclusive."


@router.post("/check", response_model=IdentityCheckResult)
async def check_identity(req: IdentityCheckRequest) -> IdentityCheckResult:
    """Analyze identity consistency across registered name and social handles."""
    risks: list[IdentityRisk] = []
    risks.extend(_check_handle_name_consistency(req.full_name, req.registered_handles))
    risks.extend(_detect_suspicious_patterns(req.registered_handles))

    critical_count = sum(1 for r in risks if r.severity == "critical")
    high_count = sum(1 for r in risks if r.severity == "high")
    medium_count = sum(1 for r in risks if r.severity == "medium")

    identity_score = min(
        critical_count * 40 + high_count * 20 + medium_count * 10,
        100.0,
    )
    is_consistent = identity_score < 30

    if identity_score < 20:
        recommendation = "verified"
    elif identity_score < 50:
        recommendation = "needs_review"
    else:
        recommendation = "flag_for_manual"

    ai_assessment = await _ai_identity_assessment(
        req.full_name, req.registered_handles, risks, req.sport, req.university
    )

    return IdentityCheckResult(
        identity_score=round(identity_score, 1),
        is_consistent=is_consistent,
        risks=risks,
        ai_assessment=ai_assessment,
        recommendation=recommendation,
    )
