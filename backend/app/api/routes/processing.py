from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.case import Case
from app.models.cross_reference import CrossReference
from app.schemas.processing import ComparisonResponse, CrossReferenceResponse
from app.services.cross_reference_service import (
    list_comparisons,
    list_links,
    run_cross_reference,
)
from app.services.graph_service import build_graph

router = APIRouter()


# Run cross-referencing for a case. Waits for the AI, then returns the links.
# The detail-by-detail comparisons are saved too: see /comparisons below.
@router.post(
    "/cases/{case_id}/cross-reference", response_model=list[CrossReferenceResponse]
)
def cross_reference_case(case_id: int, db: Session = Depends(get_db)):
    if db.get(Case, case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        return run_cross_reference(db, case_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Cross-referencing failed: {error}")


# Get the saved links for a case.
@router.get(
    "/cases/{case_id}/cross-references", response_model=list[CrossReferenceResponse]
)
def list_cross_references(case_id: int, db: Session = Depends(get_db)):
    return list_links(db, case_id)


# Get the saved comparisons for a case: each detail lined up across the evidence,
# marked agree, differ or unclear.
@router.get("/cases/{case_id}/comparisons", response_model=list[ComparisonResponse])
def get_comparisons(case_id: int, db: Session = Depends(get_db)):
    return list_comparisons(db, case_id)


# Get the links that involve one piece of evidence.
@router.get(
    "/evidence/{evidence_id}/related", response_model=list[CrossReferenceResponse]
)
def related_evidence(evidence_id: int, db: Session = Depends(get_db)):
    return (
        db.query(CrossReference)
        .filter(
            or_(
                CrossReference.evidence_a_id == evidence_id,
                CrossReference.evidence_b_id == evidence_id,
            )
        )
        .order_by(CrossReference.id)
        .all()
    )


# Get the whole case as a network of nodes and edges.
@router.get("/cases/{case_id}/graph")
def case_graph(case_id: int, db: Session = Depends(get_db)):
    if db.get(Case, case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return build_graph(db, case_id)
