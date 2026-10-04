from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# What the backend sends back about a piece of evidence.
# Notice stored_path is NOT here: the frontend never sees where files live.
class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    original_filename: str
    modality: str
    size_bytes: int
    sha256: str
    status: str
    created_at: datetime

    extracted_text: Optional[str] = None
    classification: Optional[str] = None
    confidence: Optional[float] = None
    description: Optional[str] = None
    entities: Optional[list] = None
    claims: Optional[list] = None
    error: Optional[str] = None
