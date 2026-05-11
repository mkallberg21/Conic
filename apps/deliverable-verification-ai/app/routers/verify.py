from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import re

router = APIRouter()


class VerifyRequest(BaseModel):
    proof_url: str
    platform: str
    content_type: str
    required_hashtags: List[str] = []
    required_mentions: List[str] = []
    caption: Optional[str] = None
    caption_keywords: Optional[List[str]] = None
    min_duration_seconds: Optional[int] = None


class CheckResult(BaseModel):
    check: str
    passed: bool
    detail: str


class VerifyResponse(BaseModel):
    verification_score: float  # 0-100
    status: str  # PASSED, FAILED, FLAGGED
    flags: List[str]
    checks: List[CheckResult]
    report: Dict[str, Any]


def check_hashtags(caption: str, required: List[str]) -> CheckResult:
    if not required:
        return CheckResult(check="hashtags", passed=True, detail="No required hashtags")
    found = [h for h in required if h.lower() in caption.lower()]
    missing = [h for h in required if h.lower() not in caption.lower()]
    passed = len(missing) == 0
    return CheckResult(
        check="hashtags",
        passed=passed,
        detail=f"Found: {found}. Missing: {missing}" if missing else f"All required hashtags found: {found}",
    )


def check_mentions(caption: str, required: List[str]) -> CheckResult:
    if not required:
        return CheckResult(check="mentions", passed=True, detail="No required mentions")
    found = [m for m in required if m.lower() in caption.lower()]
    missing = [m for m in required if m.lower() not in caption.lower()]
    passed = len(missing) == 0
    return CheckResult(
        check="mentions",
        passed=passed,
        detail=f"Found: {found}. Missing: {missing}" if missing else f"All required mentions found",
    )


def check_url_accessible(url: str) -> CheckResult:
    try:
        import httpx
        resp = httpx.head(url, timeout=5, follow_redirects=True)
        passed = resp.status_code < 400
        return CheckResult(
            check="url_accessible",
            passed=passed,
            detail=f"URL returned status {resp.status_code}",
        )
    except Exception as e:
        return CheckResult(check="url_accessible", passed=False, detail=f"URL unreachable: {e}")


def check_platform_domain(url: str, platform: str) -> CheckResult:
    platform_domains = {
        "instagram": ["instagram.com"],
        "tiktok": ["tiktok.com"],
        "youtube": ["youtube.com", "youtu.be"],
        "twitter": ["twitter.com", "x.com"],
        "linkedin": ["linkedin.com"],
        "facebook": ["facebook.com"],
    }
    domains = platform_domains.get(platform.lower(), [])
    if not domains:
        return CheckResult(check="platform_domain", passed=True, detail="Platform domain check skipped")
    passed = any(d in url.lower() for d in domains)
    return CheckResult(
        check="platform_domain",
        passed=passed,
        detail=f"URL matches {platform} domain" if passed else f"URL does not match expected {platform} domain",
    )


def check_keywords(caption: Optional[str], keywords: Optional[List[str]]) -> CheckResult:
    if not keywords or not caption:
        return CheckResult(check="caption_keywords", passed=True, detail="No keyword check required")
    found = [k for k in keywords if k.lower() in caption.lower()]
    passed = len(found) > 0
    return CheckResult(
        check="caption_keywords",
        passed=passed,
        detail=f"Found keywords: {found}" if found else "No required keywords found in caption",
    )


def calculate_score(checks: List[CheckResult], flags: List[str]) -> float:
    if not checks:
        return 80.0
    passed = sum(1 for c in checks if c.passed)
    base_score = (passed / len(checks)) * 100
    # Deduct for high-severity flags
    deductions = len(flags) * 8
    return max(0.0, min(100.0, base_score - deductions))


@router.post("", response_model=VerifyResponse)
async def verify_deliverable(req: VerifyRequest):
    checks: List[CheckResult] = []
    flags: List[str] = []

    # Check URL accessibility
    url_check = check_url_accessible(req.proof_url)
    checks.append(url_check)
    if not url_check.passed:
        flags.append("url_inaccessible")

    # Check platform domain
    domain_check = check_platform_domain(req.proof_url, req.platform)
    checks.append(domain_check)
    if not domain_check.passed:
        flags.append("wrong_platform")

    # Check hashtags in caption
    if req.caption:
        hashtag_check = check_hashtags(req.caption, req.required_hashtags)
        checks.append(hashtag_check)
        if not hashtag_check.passed:
            flags.append("missing_required_hashtags")

        mention_check = check_mentions(req.caption, req.required_mentions)
        checks.append(mention_check)
        if not mention_check.passed:
            flags.append("missing_required_mentions")

        keyword_check = check_keywords(req.caption, req.caption_keywords)
        checks.append(keyword_check)
        if not keyword_check.passed:
            flags.append("missing_caption_keywords")

    score = calculate_score(checks, flags)

    if score >= 80 and not flags:
        status = "PASSED"
    elif score >= 50 or (flags and all(f != "url_inaccessible" for f in flags)):
        status = "FLAGGED"
    else:
        status = "FAILED"

    passed_count = sum(1 for c in checks if c.passed)
    return VerifyResponse(
        verification_score=round(score, 1),
        status=status,
        flags=flags,
        checks=checks,
        report={
            "summary": f"{passed_count}/{len(checks)} checks passed",
            "platform": req.platform,
            "content_type": req.content_type,
            "proof_url": req.proof_url,
            "recommendation": "Approved" if status == "PASSED" else "Requires review",
        },
    )
