from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


# One finding from checking the evidence against public information.
class WebFinding(Base):
    __tablename__ = "web_findings"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)

    check_type: Mapped[str] = mapped_column(String(30))  # travel_time / web_search
    question: Mapped[str] = mapped_column(Text)          # what we were checking
    query: Mapped[str] = mapped_column(Text)             # what we searched for
    engine: Mapped[str] = mapped_column(String(50))      # which SerpAPI engine

    summary: Mapped[str] = mapped_column(Text)
    verdict: Mapped[str] = mapped_column(String(20))     # consistent / inconsistent / inconclusive
    confidence: Mapped[float] = mapped_column(Float)

    sources: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)       # links we relied on
    evidence_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # evidence this relates to
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


# Saved search results, so the same search never costs a credit twice.
class SearchCache(Base):
    __tablename__ = "search_cache"

    id: Mapped[int] = mapped_column(primary_key=True)
    cache_key: Mapped[str] = mapped_column(String(1000), unique=True, index=True)
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
