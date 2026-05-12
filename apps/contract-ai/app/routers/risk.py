import json
import logging

from fastapi import APIRouter, HTTPException
from app.models.schemas import RiskAnalysisRequest, RiskAnalysisResponse
from app.services.openai_service import generate_with_gpt, calculate_risk_score

router = APIRouter()
logger = logging.getLogger("conic.contract_ai.risk")

RISK_SYSTEM = """You are a contract risk analyst. Analyze the contract text and identify:
1. Risk flags (from: missing_payment_terms, no_ip_clause, no_termination_clause,
   ambiguous_deliverables, no_exclusivity_limit, no_revision_limit, missing_dispute_resolution, no_confidentiality)
2. Ambiguous terms that need clarification
3. Missing standard clauses
4. Recommendations for improvement

Respond ONLY with valid JSON matching exactly:
{"risk_flags": [], "ambiguous_terms": [], "missing_clauses": [], "recommendations": []}"""

_KNOWN_FLAGS = frozenset({
    "missing_payment_terms",
    "no_ip_clause",
    "no_termination_clause",
    "ambiguous_deliverables",
    "no_exclusivity_limit",
    "no_revision_limit",
    "missing_dispute_resolution",
    "no_confidentiality",
})


def _validate_flags(flags: list) -> list[str]:
    """Return only recognised flag strings to prevent injection of arbitrary values."""
    return [f for f in flags if isinstance(f, str) and f in _KNOWN_FLAGS]


@router.post("", response_model=RiskAnalysisResponse)
async def analyze_risk(req: RiskAnalysisRequest) -> RiskAnalysisResponse:
    prompt = f"Analyze this contract:\n\n{req.contract_text[:8000]}"

    try:
        result_text = await generate_with_gpt(prompt, RISK_SYSTEM)
    except Exception as exc:
        logger.error("OpenAI request failed during risk analysis: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="AI service temporarily unavailable. Please retry.",
        ) from exc

    try:
        result = json.loads(result_text)
    except json.JSONDecodeError as exc:
        logger.error(
            "Failed to parse OpenAI JSON response for risk analysis. "
            "Raw response (first 500 chars): %s",
            result_text[:500],
            exc_info=True,
        )
        raise HTTPException(
            status_code=502,
            detail="AI returned malformed response. Please retry.",
        ) from exc

    # Validate and sanitise fields from the AI response
    flags = _validate_flags(result.get("risk_flags", []))
    ambiguous = [str(t)[:500] for t in result.get("ambiguous_terms", []) if isinstance(t, str)][:20]
    missing = [str(c)[:500] for c in result.get("missing_clauses", []) if isinstance(c, str)][:20]
    recommendations = [str(r)[:1000] for r in result.get("recommendations", []) if isinstance(r, str)][:10]

    score = calculate_risk_score(flags)

    logger.info(
        "Risk analysis complete. score=%d flags=%s",
        score,
        flags,
    )

    return RiskAnalysisResponse(
        risk_score=score,
        risk_flags=flags,
        ambiguous_terms=ambiguous,
        missing_clauses=missing,
        recommendations=recommendations,
    )
