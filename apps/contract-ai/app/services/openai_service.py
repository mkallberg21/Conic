import os
from openai import AsyncOpenAI
from typing import Optional

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))


async def generate_with_gpt(prompt: str, system: str, model: str = "gpt-4o-mini") -> str:
    """Call OpenAI and return text content. Falls back to template on failure."""
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=4000,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return ""


def calculate_risk_score(flags: list[str]) -> int:
    """Simple rule-based risk scoring based on red flags found."""
    weights = {
        "missing_payment_terms": 20,
        "no_ip_clause": 15,
        "no_termination_clause": 15,
        "ambiguous_deliverables": 25,
        "no_exclusivity_limit": 10,
        "no_revision_limit": 10,
        "missing_dispute_resolution": 15,
        "no_confidentiality": 10,
    }
    score = sum(weights.get(flag, 5) for flag in flags)
    return min(score, 100)
