import logging

from fastapi import APIRouter, HTTPException
from app.models.schemas import ContractGenRequest, ContractGenResponse, ClauseDetail
from app.services.openai_service import generate_with_gpt, calculate_risk_score

router = APIRouter()
logger = logging.getLogger("conic.contract_ai.generate")

SYSTEM_PROMPT = """You are a legal expert specializing in influencer marketing contracts.
Generate professional, comprehensive contract text. Be specific about deliverables, 
payment terms, usage rights, and IP provisions. Return the full contract text."""


def build_contract_prompt(req: ContractGenRequest) -> str:
    return f"""Generate a complete influencer marketing contract with the following specifications:

Campaign Type: {req.campaign_type}
Platforms: {", ".join(req.platforms)}
Total Compensation: ${req.total_value / 100:.2f} USD
Usage Rights: {req.usage_rights}
Exclusivity: {"Yes, " + str(req.exclusivity_days) + " days" if req.exclusivity else "No"}
Brand: {req.brand_name or "Brand"}
Creator: {req.creator_name or "Creator"}

Include sections for:
1. Parties and Recitals
2. Campaign Scope & Deliverables
3. Compensation & Payment Schedule
4. Content Standards & Brand Guidelines
5. Usage Rights & Licensing
6. Intellectual Property
7. Exclusivity (if applicable)
8. Representations & Warranties
9. Confidentiality
10. Term & Termination
11. Dispute Resolution & Governing Law
12. General Provisions

Make it legally sound with specific dates, obligations, and measurable criteria."""


def detect_risk_flags(req: ContractGenRequest, content: str) -> list[str]:
    flags = []
    content_lower = content.lower()
    if "payment" not in content_lower:
        flags.append("missing_payment_terms")
    if "intellectual property" not in content_lower and "ip" not in content_lower:
        flags.append("no_ip_clause")
    if "terminat" not in content_lower:
        flags.append("no_termination_clause")
    if "revision" not in content_lower:
        flags.append("no_revision_limit")
    if "confidential" not in content_lower:
        flags.append("no_confidentiality")
    if req.exclusivity and "exclusivity" not in content_lower:
        flags.append("no_exclusivity_limit")
    return flags


def build_fallback_contract(req: ContractGenRequest) -> str:
    return f"""INFLUENCER MARKETING AGREEMENT

This Influencer Marketing Agreement ("Agreement") is entered into as of the Effective Date 
between {req.brand_name or "the Brand"} ("Brand") and {req.creator_name or "the Creator"} ("Creator").

1. CAMPAIGN OVERVIEW
Campaign Type: {req.campaign_type}
Platforms: {", ".join(req.platforms)}
Total Compensation: ${req.total_value / 100:.2f} USD

2. DELIVERABLES
Creator agrees to produce and publish content as mutually agreed upon by both parties.
Content must meet Brand's quality standards and community guidelines.

3. PAYMENT TERMS
Total compensation of ${req.total_value / 100:.2f} USD will be paid upon deliverable approval.
Payment will be processed within 5 business days of approval via the agreed payment method.

4. USAGE RIGHTS
{req.usage_rights}

5. EXCLUSIVITY
{"Creator agrees not to promote competing brands for " + str(req.exclusivity_days) + " days." if req.exclusivity else "No exclusivity restrictions apply."}

6. INTELLECTUAL PROPERTY
Creator grants Brand a non-exclusive, royalty-free license to use, reproduce, and distribute
the created content across Brand's marketing channels for 12 months.

7. REPRESENTATIONS & WARRANTIES
Both parties represent that they have the authority to enter into this Agreement and will
comply with all applicable platform community guidelines and laws.

8. CONFIDENTIALITY
Both parties agree to keep the terms of this Agreement and all campaign information confidential.

9. TERMINATION
Either party may terminate this Agreement with 7 days written notice. Upon termination,
Creator shall retain compensation for approved deliverables.

10. DISPUTE RESOLUTION
Any disputes will be resolved through binding arbitration in accordance with the rules
of the American Arbitration Association.

11. GOVERNING LAW
This Agreement shall be governed by the laws of the State of New York.

By proceeding with this campaign, both parties acknowledge and agree to these terms."""


@router.post("", response_model=ContractGenResponse)
async def generate_contract(req: ContractGenRequest) -> ContractGenResponse:
    prompt = build_contract_prompt(req)

    try:
        content = await generate_with_gpt(prompt, SYSTEM_PROMPT)
    except Exception as exc:
        logger.error("OpenAI request failed during contract generation: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="AI contract generation temporarily unavailable. Please retry.",
        ) from exc

    if not content or len(content.strip()) < 100:
        logger.error(
            "OpenAI returned empty or truncated contract content (length=%d). "
            "Not falling back to template — returning error to caller.",
            len(content) if content else 0,
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "AI returned insufficient contract content. "
                "Please retry or contact support."
            ),
        )

    flags = detect_risk_flags(req, content)
    risk_score = calculate_risk_score(flags)

    logger.info(
        "Contract generated. risk_score=%d flags=%s word_count=%d",
        risk_score,
        flags,
        len(content.split()),
    )

    clauses = [
        ClauseDetail(
            type="payment",
            title="Payment Terms",
            content="Payment released upon deliverable approval.",
            risk_level="low",
        ),
        ClauseDetail(
            type="ip",
            title="Intellectual Property",
            content="Brand receives 12-month license to created content.",
            risk_level="medium" if req.total_value > 500000 else "low",
        ),
        ClauseDetail(
            type="usage_rights",
            title="Usage Rights",
            content=req.usage_rights,
            risk_level="medium",
        ),
    ]

    if req.exclusivity:
        clauses.append(
            ClauseDetail(
                type="exclusivity",
                title="Exclusivity",
                content=f"No competing brand promotions for {req.exclusivity_days} days.",
                risk_level="high" if (req.exclusivity_days or 0) > 90 else "medium",
            )
        )

    suggestions: list[str] = []
    if risk_score > 50:
        suggestions.append("Consider adding clearer revision limits to protect both parties.")
    if req.exclusivity and (req.exclusivity_days or 0) > 90:
        suggestions.append("Long exclusivity period may discourage creator adoption. Consider reducing to 30–60 days.")
    if req.total_value > 1000000:
        suggestions.append("High-value contract: consider milestone-based payments and escrow.")

    return ContractGenResponse(
        content=content,
        risk_score=risk_score,
        risk_flags=flags,
        clauses=clauses,
        suggestions=suggestions,
        word_count=len(content.split()),
    )
