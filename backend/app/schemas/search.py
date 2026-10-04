from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# What the backend sends back about one web research finding.
class WebFindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    check_type: str
    question: str
    query: str
    engine: str
    summary: str
    verdict: str
    confidence: float
    sources: Optional[list] = None
    evidence_ids: Optional[list] = None
    created_at: datetime
