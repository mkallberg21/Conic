from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter()

# ─── Flag → structured remedy map ────────────────────────────────────────────

_FLAG_REMEDIES: Dict[str, Dict[str, Any]] = {
    "missing_hashtag": {
        "severity": "high",
        "description": "One or more required hashtags are absent from the caption.",
        "fix": "Add all required campaign hashtags exactly as specified in your brief.",
        "example": "Add #{hashtag} anywhere in the caption — beginning, middle, or end.",
    },
    "missing_mention": {
        "severity": "high",
        "description": "One or more required @mentions are missing from the caption.",
        "fix": "Include all required @mentions in the caption.",
        "example": "Tag the brand account with @{mention} visibly in the caption.",
    },
    "wrong_platform": {
        "severity": "critical",
        "description": "The proof URL does not match the expected platform.",
        "fix": "Re-submit the correct URL from the contracted platform.",
        "example": "Ensure the link resolves to the contracted social media platform.",
    },
    "url_inaccessible": {
        "severity": "critical",
        "description": "The submitted proof URL is unreachable (private, deleted, or broken).",
        "fix": "Make the post public and re-submit a valid, accessible URL.",
        "example": "Switch the post from private/archive to public and copy the live URL.",
    },
    "missing_caption": {
        "severity": "medium",
        "description": "No caption was detected on the submission.",
        "fix": "Add a caption that includes all required hashtags, mentions, and disclosure text.",
        "example": "Write a caption of ≥ 5 words including all required elements.",
    },
    "duration_too_short": {
        "severity": "medium",
        "description": "Video content does not meet the minimum duration requirement.",
        "fix": "Re-submit a version that meets or exceeds the minimum duration specified in your brief.",
        "example": "Ensure the video is at least the contracted number of seconds long.",
    },
    "missing_disclosure": {
        "severity": "high",
        "description": "FTC/ASA paid partnership disclosure is not present.",
        "fix": "Add '#ad', '#sponsored', or the platform's native paid-partnership label.",
        "example": "Use the platform's built-in 'Paid partnership' feature or add #ad to the caption.",
    },
    "keyword_mismatch": {
        "severity": "medium",
        "description": "Expected campaign keywords are not present in the caption.",
        "fix": "Incorporate the key campaign messaging terms into your caption naturally.",
        "example": "Weave the required product or messaging keywords into the caption narrative.",
    },
}

_SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}

# ─── Models ───────────────────────────────────────────────────────────────────


class FeedbackRequest(BaseModel):
    verification_flags: List[str]
    platform: str
    content_type: str  # post | reel | story | video | image
    proof_url: str
    creator_name: Optional[str] = None
    campaign_name: Optional[str] = None


class FeedbackItem(BaseModel):
    flag: str
    severity: str        # critical | high | medium | low
    description: str
    fix: str
    example: str


class FeedbackResponse(BaseModel):
    remediationRequired: bool
    totalFlags: int
    criticalCount: int
    highCount: int
    mediumCount: int
    feedbackItems: List[FeedbackItem]
    priorityFixes: List[str]          # ordered: most critical first
    estimatedRevisionMinutes: int     # rough effort estimate
    summary: str


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _severity_for_flag(flag: str) -> str:
    remedy = _FLAG_REMEDIES.get(flag)
    if remedy:
        return remedy["severity"]
    # Generic fallback for unknown flags
    return "medium"


def _estimate_minutes(items: List[FeedbackItem]) -> int:
    effort_map = {"critical": 20, "high": 10, "medium": 5, "low": 2}
    return sum(effort_map.get(item.severity, 5) for item in items)


# ─── Endpoint ─────────────────────────────────────────────────────────────────


@router.post("", response_model=FeedbackResponse)
def generate_feedback(req: FeedbackRequest) -> FeedbackResponse:
    """
    Generate structured remediation feedback for a failed/flagged deliverable.

    Given the list of verification flags, returns actionable fix instructions
    ordered by severity so the creator knows exactly what to correct.
    """
    if not req.verification_flags:
        return FeedbackResponse(
            remediationRequired=False,
            totalFlags=0,
            criticalCount=0,
            highCount=0,
            mediumCount=0,
            feedbackItems=[],
            priorityFixes=[],
            estimatedRevisionMinutes=0,
            summary="No flags to remediate — deliverable appears compliant.",
        )

    items: List[FeedbackItem] = []
    for flag in req.verification_flags:
        remedy = _FLAG_REMEDIES.get(flag, {
            "severity": "medium",
            "description": f"Compliance issue detected: {flag}.",
            "fix": "Review the campaign brief and ensure all requirements are met.",
            "example": "Contact your campaign manager for clarification on this requirement.",
        })
        items.append(FeedbackItem(
            flag=flag,
            severity=remedy["severity"],
            description=remedy["description"],
            fix=remedy["fix"],
            example=remedy["example"],
        ))

    # Sort by severity (critical → high → medium → low)
    items.sort(key=lambda i: _SEVERITY_ORDER.get(i.severity, 99))

    critical_count = sum(1 for i in items if i.severity == "critical")
    high_count = sum(1 for i in items if i.severity == "high")
    medium_count = sum(1 for i in items if i.severity == "medium")

    priority_fixes = [i.fix for i in items if i.severity in ("critical", "high")]
    estimated_minutes = _estimate_minutes(items)

    # Human-readable summary
    parts: List[str] = []
    if critical_count:
        parts.append(f"{critical_count} critical issue{'s' if critical_count > 1 else ''}")
    if high_count:
        parts.append(f"{high_count} high-severity issue{'s' if high_count > 1 else ''}")
    if medium_count:
        parts.append(f"{medium_count} medium-severity issue{'s' if medium_count > 1 else ''}")

    creator_prefix = f"{req.creator_name}'s " if req.creator_name else "The "
    summary = (
        f"{creator_prefix}{req.content_type} for {req.platform} requires revision: "
        + ", ".join(parts)
        + f". Estimated revision time: ~{estimated_minutes} minutes."
    )

    return FeedbackResponse(
        remediationRequired=True,
        totalFlags=len(items),
        criticalCount=critical_count,
        highCount=high_count,
        mediumCount=medium_count,
        feedbackItems=items,
        priorityFixes=priority_fixes,
        estimatedRevisionMinutes=estimated_minutes,
        summary=summary,
    )
