from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# What the backend sends back about one link between two pieces of evidence.
class CrossReferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    evidence_a_id: int
    evidence_b_id: int
    relation: str
    explanation: str
    confidence: float
    created_at: datetime


# What the backend sends back about one detail compared across evidence.
class ComparisonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    topic: str
    status: str
    note: str
    entries: Optional[list] = None
    created_at: datetime
