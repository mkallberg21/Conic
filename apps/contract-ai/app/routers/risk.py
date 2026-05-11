from fastapi import APIRouter
from app.models.schemas import RiskAnalysisRequest, RiskAnalysisResponse
from app.services.openai_service import generate_with_gpt, calculate_risk_score
import json

router = APIRouter()

RISK_SYSTEM = """You are a contract risk analyst. Analyze the contract text and identify:
1. Risk flags (from: missing_payment_terms, no_ip_clause, no_termination_clause, 
   ambiguous_deliverables, no_exclusivity_limit, no_revision_limit, missing_dispute_resolution, no_confidentiality)
2. Ambiguous terms that need clarification
3. Missing standard clauses
4. Recommendations for improvement

Respond ONLY with valid JSON matching: 
{"risk_flags": [], "ambiguous_terms": [], "missing_clauses": [], "recommendations": []}"""


@router.post("", response_model=RiskAnalysisResponse)
async def analyze_risk(req: RiskAnalysisRequest):
    prompt = f"Analyze this contract:\n\n{req.contract_text[:8000]}"
    result_text = await generate_with_gpt(prompt, RISK_SYSTEM)

    try:
        result = json.loads(result_text)
        flags = result.get("risk_flags", [])
        score = calculate_risk_score(flags)
        return RiskAnalysisResponse(
            risk_score=score,
            risk_flags=flags,
            ambiguous_terms=result.get("ambiguous_terms", []),
            missing_clauses=result.get("missing_clauses", []),
            recommendations=result.get("recommendations", []),
        )
    except Exception:
        # Fallback rule-based analysis
        content_lower = req.contract_text.lower()
        flags = []
        if "payment" not in content_lower:
            flags.append("missing_payment_terms")
        if "intellectual property" not in content_lower:
            flags.append("no_ip_clause")
        if "terminat" not in content_lower:
            flags.append("no_termination_clause")
        score = calculate_risk_score(flags)
        return RiskAnalysisResponse(
            risk_score=score,
            risk_flags=flags,
            ambiguous_terms=[],
            missing_clauses=[],
            recommendations=["Review contract manually for completeness."],
        )
