from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()


class Template(BaseModel):
    id: str
    name: str
    category: str
    description: str


TEMPLATES: List[Template] = [
    Template(id="tpl_influencer_post", name="Influencer Post", category="social", description="Standard sponsored post agreement"),
    Template(id="tpl_ugc", name="UGC Creator", category="ugc", description="User-generated content license agreement"),
    Template(id="tpl_ambassador", name="Brand Ambassador", category="ambassador", description="Long-term brand ambassador program"),
    Template(id="tpl_affiliate", name="Affiliate", category="affiliate", description="Performance-based affiliate partnership"),
    Template(id="tpl_event", name="Event Appearance", category="event", description="Creator event appearance agreement"),
]


@router.get("", response_model=List[Template])
def list_templates():
    return TEMPLATES
