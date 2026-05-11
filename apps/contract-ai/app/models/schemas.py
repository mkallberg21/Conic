from pydantic import BaseModel
from typing import Optional, List


class ContractGenRequest(BaseModel):
    campaign_type: str
    platforms: List[str]
    usage_rights: str
    exclusivity: bool
    exclusivity_days: Optional[int] = None
    total_value: int  # cents
    deliverable_types: Optional[List[str]] = None
    brand_name: Optional[str] = None
    creator_name: Optional[str] = None


class ClauseDetail(BaseModel):
    type: str
    title: str
    content: str
    risk_level: str  # low, medium, high
    ai_suggested: bool = True


class ContractGenResponse(BaseModel):
    content: str
    risk_score: int  # 0-100
    risk_flags: List[str]
    clauses: List[ClauseDetail]
    suggestions: List[str]
    word_count: int


class RiskAnalysisRequest(BaseModel):
    contract_text: str


class RiskAnalysisResponse(BaseModel):
    risk_score: int
    risk_flags: List[str]
    ambiguous_terms: List[str]
    missing_clauses: List[str]
    recommendations: List[str]
