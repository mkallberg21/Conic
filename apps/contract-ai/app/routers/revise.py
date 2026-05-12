from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional

from app.services.openai_service import generate_with_gpt, calculate_risk_score
from app.routers.generate import detect_risk_flags

router = APIRouter()

REVISE_SYSTEM = """You are a legal expert specialising in influencer marketing contracts.
You will receive a contract draft that has known risk issues and a list of specific risk flags
that must be corrected. Your task is to revise the contract by:
1. Adding or strengthening any missing clauses identified by the risk flags.
2. Removing or rewording any ambiguous language.
3. Keeping all other sections intact — do NOT remove content that is already correct.
4. Maintaining professional legal language throughout.
Return ONLY the complete revised contract text with no commentary."""

# How each flag maps to a plain-English revision instruction sent to the LLM
FLAG_INSTRUCTIONS: dict[str, str] = {
    "missing_payment_terms": (
        "Add a detailed Payment Terms clause specifying the exact payment amount, "
        "schedule (milestone or lump-sum), payment method, and a late-payment remedy."
    ),
    "no_ip_clause": (
        "Add a comprehensive Intellectual Property clause covering ownership of the created "
        "content, licence scope (platforms, duration, sublicensing), and moral rights waiver."
    ),
    "no_termination_clause": (
        "Add a Termination clause covering termination for convenience (with notice period), "
        "termination for cause, and consequences of termination including compensation for "
        "approved deliverables."
    ),
    "ambiguous_deliverables": (
        "Replace any vague deliverable language with specific deliverable descriptions including "
        "content format, platform, quantity, posting schedule, and approval process."
    ),
    "no_exclusivity_limit": (
        "Add an Exclusivity clause with a defined exclusivity period in days, a clear list of "
        "competing brand categories, and consequences of breach."
    ),
    "no_revision_limit": (
        "Add a Revisions clause specifying the maximum number of revision rounds the Brand may "
        "request, the turnaround time for each round, and the process for requesting revisions."
    ),
    "missing_dispute_resolution": (
        "Add a Dispute Resolution clause covering the escalation process (good-faith negotiation "
        "→ mediation → binding arbitration), the governing arbitration rules, seat of arbitration, "
        "and governing law."
    ),
    "no_confidentiality": (
        "Add a Confidentiality clause covering campaign terms, compensation, brand assets, and "
        "any non-public brand information. Include a survival clause for post-termination."
    ),
}


class ReviseRequest(BaseModel):
    contract_text: str = Field(..., min_length=50)
    risk_flags: List[str] = Field(..., min_items=1)
    # Optional original request context so the LLM can cross-check specs
    campaign_type: Optional[str] = None
    platforms: Optional[List[str]] = None
    total_value: Optional[int] = None
    exclusivity: Optional[bool] = None
    exclusivity_days: Optional[int] = None


class ReviseResponse(BaseModel):
    revised_content: str
    risk_score: int
    risk_flags_remaining: List[str]
    flags_resolved: List[str]
    revision_notes: List[str]
    word_count: int
    improved: bool


def build_revision_prompt(req: ReviseRequest) -> str:
    instructions = []
    for flag in req.risk_flags:
        if flag in FLAG_INSTRUCTIONS:
            instructions.append(f"• {FLAG_INSTRUCTIONS[flag]}")
        else:
            instructions.append(f"• Address risk issue: {flag}")

    context_parts = []
    if req.campaign_type:
        context_parts.append(f"Campaign type: {req.campaign_type}")
    if req.platforms:
        context_parts.append(f"Platforms: {', '.join(req.platforms)}")
    if req.total_value is not None:
        context_parts.append(f"Total compensation: ${req.total_value / 100:.2f} USD")
    if req.exclusivity is not None:
        context_parts.append(
            f"Exclusivity: {'Yes, ' + str(req.exclusivity_days) + ' days' if req.exclusivity else 'No'}"
        )

    context_block = ("\n\nCampaign context:\n" + "\n".join(context_parts)) if context_parts else ""

    return (
        f"The following contract has these risk issues that MUST be fixed:{context_block}\n\n"
        f"Required revisions:\n"
        + "\n".join(instructions)
        + f"\n\nOriginal contract:\n\n{req.contract_text[:10000]}\n\n"
        "Return ONLY the complete revised contract with all issues resolved."
    )


@router.post("", response_model=ReviseResponse)
async def revise_contract(req: ReviseRequest):
    prompt = build_revision_prompt(req)
    revised = await generate_with_gpt(prompt, REVISE_SYSTEM)

    if not revised or len(revised) < 100:
        # Fallback: return original with unchanged risk
        return ReviseResponse(
            revised_content=req.contract_text,
            risk_score=calculate_risk_score(req.risk_flags),
            risk_flags_remaining=req.risk_flags,
            flags_resolved=[],
            revision_notes=["LLM revision failed — original contract returned unchanged."],
            word_count=len(req.contract_text.split()),
            improved=False,
        )

    # Re-evaluate risk on the revised text
    remaining_flags = [
        flag
        for flag in req.risk_flags
        if flag.replace("_", " ").split("_")[0] not in revised.lower()
        and _flag_still_present(flag, revised)
    ]
    resolved = [f for f in req.risk_flags if f not in remaining_flags]
    new_score = calculate_risk_score(remaining_flags)
    original_score = calculate_risk_score(req.risk_flags)

    notes = [f"Resolved {len(resolved)} of {len(req.risk_flags)} flagged issue(s)."]
    if remaining_flags:
        notes.append(f"Remaining flags after revision: {', '.join(remaining_flags)}")
    notes.append(f"Risk score: {original_score} → {new_score}")

    return ReviseResponse(
        revised_content=revised,
        risk_score=new_score,
        risk_flags_remaining=remaining_flags,
        flags_resolved=resolved,
        revision_notes=notes,
        word_count=len(revised.split()),
        improved=new_score < original_score,
    )


def _flag_still_present(flag: str, text: str) -> bool:
    """Heuristic: check whether a flag's key clause keyword is now present."""
    lower = text.lower()
    checks: dict[str, list[str]] = {
        "missing_payment_terms": ["payment terms", "payment schedule", "compensation"],
        "no_ip_clause": ["intellectual property", "ip clause", "licence", "license"],
        "no_termination_clause": ["termination", "terminate"],
        "ambiguous_deliverables": ["deliverable", "content format", "posting schedule"],
        "no_exclusivity_limit": ["exclusivity", "exclusive"],
        "no_revision_limit": ["revision", "revisions"],
        "missing_dispute_resolution": ["dispute", "arbitration"],
        "no_confidentiality": ["confidential"],
    }
    keywords = checks.get(flag, [flag.replace("_", " ")])
    return not any(kw in lower for kw in keywords)
