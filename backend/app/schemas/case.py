from datetime import datetime

from pydantic import BaseModel, ConfigDict


# What the frontend sends to create a case.
class CaseCreate(BaseModel):
    title: str
    description: str = ""


# What the backend sends back.
class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    created_at: datetime
