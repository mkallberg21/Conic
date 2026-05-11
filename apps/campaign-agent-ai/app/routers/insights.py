from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

router = APIRouter()


class InsightsRequest(BaseModel):
    campaign_id: str
    metrics: Dict[str, Any]
    days_elapsed: int
    days_total: int


class InsightItem(BaseModel):
    type: str  # alert, tip, highlight
    severity: str  # info, warning, critical
    message: str
    action: Optional[str] = None


class InsightsResponse(BaseModel):
    insights: List[InsightItem]
    health_score: int  # 0-100
    on_track: bool


@router.post("", response_model=InsightsResponse)
def generate_insights(req: InsightsRequest):
    insights: List[InsightItem] = []
    metrics = req.metrics
    progress = req.days_elapsed / max(req.days_total, 1)

    # Engagement check
    engagement_rate = metrics.get("engagement_rate", 0)
    if engagement_rate < 2.0:
        insights.append(InsightItem(
            type="alert",
            severity="warning",
            message=f"Below-average engagement rate ({engagement_rate:.1f}%). Industry benchmark is 3-5%.",
            action="Review content quality and posting times. Consider replacing underperforming creators.",
        ))
    elif engagement_rate > 6.0:
        insights.append(InsightItem(
            type="highlight",
            severity="info",
            message=f"Excellent engagement rate ({engagement_rate:.1f}%)! Content is resonating strongly.",
        ))

    # Budget pacing check
    budget_used_pct = metrics.get("budget_used_pct", 0)
    if abs(budget_used_pct - progress * 100) > 20:
        insights.append(InsightItem(
            type="alert",
            severity="warning",
            message=f"Budget pacing off track: {budget_used_pct:.0f}% spent at {progress*100:.0f}% campaign completion.",
            action="Reallocate budget to better-performing creators.",
        ))

    # Deliverable completion check
    deliverables_completed_pct = metrics.get("deliverables_completed_pct", 0)
    if deliverables_completed_pct < progress * 80:
        insights.append(InsightItem(
            type="alert",
            severity="critical",
            message=f"Only {deliverables_completed_pct:.0f}% of deliverables completed. Risk of campaign underdelivery.",
            action="Send immediate reminders to creators. Escalate if no response in 24 hours.",
        ))

    # General tip
    if not insights:
        insights.append(InsightItem(
            type="tip",
            severity="info",
            message="Campaign is performing on track. Consider capturing testimonials from engaged audience segments.",
        ))

    health_issues = sum(1 for i in insights if i.severity in ("warning", "critical"))
    health_score = max(20, 100 - health_issues * 20)

    return InsightsResponse(
        insights=insights,
        health_score=health_score,
        on_track=health_issues == 0,
    )
