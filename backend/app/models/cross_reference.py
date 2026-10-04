from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


# One link between two pieces of evidence in the same case.
class CrossReference(Base):
    __tablename__ = "cross_references"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    evidence_a_id: Mapped[int] = mapped_column(ForeignKey("evidence.id"))
    evidence_b_id: Mapped[int] = mapped_column(ForeignKey("evidence.id"))

    relation: Mapped[str] = mapped_column(String(20))  # supports / conflicts / related
    explanation: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


# One detail lined up across several pieces of evidence,
# for example what each item says about the tattoo.
class Comparison(Base):
    __tablename__ = "comparisons"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)

    topic: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20))  # agree / differ / unclear
    note: Mapped[str] = mapped_column(Text)
    # A list like [{"evidence_id": 35, "value": "left forearm, maybe a rose"}, ...]
    entries: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
