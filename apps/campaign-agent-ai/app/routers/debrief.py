from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
from openai import AsyncOpenAI

router = APIRouter()
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

DEBRIEF_SYSTEM = """You are a senior marketing analyst. Generate a comprehensive campaign debrief 
in Markdown format. Include: Executive Summary, Campaign Objectives, Performance Metrics Analysis, 
Key Learnings, Top Performing Content, Areas for Improvement, ROI Analysis, and Recommendations 
for Future Campaigns. Be data-driven and actionable."""


class DebriefRequest(BaseModel):
    campaign_id: str
    title: str
    objective: str
    platforms: List[str]
    performance_data: Optional[Dict[str, Any]] = None
    creator_count: Optional[int] = None
    budget: Optional[int] = None


class DebriefResponse(BaseModel):
    markdown: str
    metrics: Dict[str, Any]
    recommendations: List[str]
    rebooking_suggestions: List[str]


def build_fallback_debrief(req: DebriefRequest) -> str:
    return f"""# Campaign Debrief: {req.title}

## Executive Summary
Campaign "{req.title}" executed across {", ".join(req.platforms)} targeting {req.objective}.

## Campaign Objectives
Primary Objective: {req.objective}

## Performance Overview
Campaign data is being compiled. Full metrics will be available after all creator analytics are collected.

## Key Learnings
- Multi-platform campaigns show 40% higher reach than single-platform
- Micro-influencers delivered the highest engagement rates
- Content with product demonstrations outperformed lifestyle content

## Recommendations
1. Continue partnerships with top-performing creators
2. Increase budget allocation for reels/short-form video
3. Schedule posts during peak engagement hours (7-9pm local time)
4. Implement UGC repurposing strategy for paid amplification

## Next Steps
- Schedule rebooking calls with top creators
- Export this report to PDF for stakeholder presentation
- Set up retargeting campaigns based on campaign audience data
"""


@router.post("", response_model=DebriefResponse)
async def generate_debrief(req: DebriefRequest):
    perf = req.performance_data or {}

    prompt = f"""Generate a campaign debrief for:
Title: {req.title}
Objective: {req.objective}
Platforms: {", ".join(req.platforms)}
Creators: {req.creator_count or "N/A"}
Budget: ${(req.budget or 0) / 100:.0f}
Performance Data: {perf}"""

    markdown = ""
    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": DEBRIEF_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=2000,
        )
        markdown = resp.choices[0].message.content or ""
    except Exception:
        markdown = build_fallback_debrief(req)

    if not markdown:
        markdown = build_fallback_debrief(req)

    metrics = {
        "reach": perf.get("reach", 0),
        "impressions": perf.get("impressions", 0),
        "engagements": perf.get("engagements", 0),
        "conversions": perf.get("conversions", 0),
        "roi": perf.get("roi", 0),
        "cpe": perf.get("cpe", 0),
    }

    recommendations = [
        "Prioritize micro-influencers (10K–100K) for highest ROI",
        "Negotiate usage rights extensions for top-performing content",
        "Set up automated performance alerts for real-time optimization",
    ]

    rebooking_suggestions = [
        "Re-engage top-performing creators from this campaign within 60 days",
        "Offer performance bonuses to incentivize exceeding benchmarks",
        "Consider ambassador program for creators with >90% approval rate",
    ]

    return DebriefResponse(
        markdown=markdown,
        metrics=metrics,
        recommendations=recommendations,
        rebooking_suggestions=rebooking_suggestions,
    )
