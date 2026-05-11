from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter()


class TimelineRequest(BaseModel):
    objective: Optional[str] = "awareness"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    platforms: List[str] = []
    budget: Optional[int] = None
    creator_count: Optional[int] = 1


class TaskItem(BaseModel):
    title: str
    description: str
    days_from_start: int
    category: str
    priority: str  # high, medium, low


class TimelineResponse(BaseModel):
    tasks: List[TaskItem]
    total_days: int
    milestones: List[Dict[str, Any]]


def build_default_timeline(req: TimelineRequest) -> List[TaskItem]:
    tasks = [
        TaskItem(title="Campaign Strategy & Brief", description="Define campaign goals, KPIs, and creator brief document.", days_from_start=0, category="planning", priority="high"),
        TaskItem(title="Creator Outreach & Selection", description="Identify and invite preferred creators based on audience match.", days_from_start=1, category="outreach", priority="high"),
        TaskItem(title="Contract Preparation", description="Generate and send contracts to selected creators.", days_from_start=3, category="legal", priority="high"),
        TaskItem(title="Contract Execution", description="Ensure all contracts are signed by both parties.", days_from_start=7, category="legal", priority="high"),
        TaskItem(title="Brand Guidelines Delivery", description="Send brand assets, messaging guidelines, and do/don't list to creators.", days_from_start=8, category="content", priority="medium"),
        TaskItem(title="Content Creation Phase", description="Creators produce campaign content as per brief.", days_from_start=10, category="content", priority="high"),
        TaskItem(title="First Draft Review", description="Review initial content submissions from creators.", days_from_start=17, category="review", priority="high"),
        TaskItem(title="Feedback & Revisions", description="Provide feedback and request revisions if needed.", days_from_start=19, category="review", priority="medium"),
        TaskItem(title="Final Approval", description="Approve final content for all deliverables.", days_from_start=22, category="review", priority="high"),
        TaskItem(title="Content Publishing", description="Creators publish approved content on scheduled dates.", days_from_start=24, category="publishing", priority="high"),
        TaskItem(title="Performance Monitoring", description="Track engagement, reach, and conversion metrics.", days_from_start=25, category="analytics", priority="medium"),
        TaskItem(title="Mid-Campaign Check-in", description="Review performance data and optimize if needed.", days_from_start=28, category="analytics", priority="medium"),
        TaskItem(title="Payment Processing", description="Release approved payments to creators.", days_from_start=30, category="payments", priority="high"),
        TaskItem(title="Final Performance Report", description="Compile all metrics and generate campaign debrief.", days_from_start=35, category="analytics", priority="high"),
    ]

    # Extend for longer campaigns
    if req.budget and req.budget > 500000:
        tasks.append(TaskItem(
            title="Phase 2 Creator Activation",
            description="Activate second wave of creators with learnings from Phase 1.",
            days_from_start=38,
            category="outreach",
            priority="medium",
        ))

    return tasks


@router.post("", response_model=TimelineResponse)
def generate_timeline(req: TimelineRequest):
    tasks = build_default_timeline(req)

    milestones = [
        {"day": 7, "name": "Contracts Executed", "status": "milestone"},
        {"day": 22, "name": "Content Approved", "status": "milestone"},
        {"day": 30, "name": "Payments Released", "status": "milestone"},
        {"day": 35, "name": "Campaign Complete", "status": "milestone"},
    ]

    return TimelineResponse(
        tasks=tasks,
        total_days=max(t.days_from_start for t in tasks) + 3,
        milestones=milestones,
    )
