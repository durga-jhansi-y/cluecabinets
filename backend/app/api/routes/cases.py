from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.case import Case
from app.models.cross_reference import Comparison, CrossReference
from app.models.evidence import Evidence
from app.models.source import WebFinding
from app.schemas.case import CaseCreate, CaseResponse
from app.services.report_service import build_report
from app.storage.file_storage import get_full_path

router = APIRouter()


# Create a case.
@router.post("/cases", response_model=CaseResponse, status_code=201)
def create_case(payload: CaseCreate, db: Session = Depends(get_db)):
    case = Case(title=payload.title, description=payload.description)
    db.add(case)
    db.commit()
    db.refresh(case)  # reload it so we get the id the database assigned
    return case


# List all cases, newest first.
@router.get("/cases", response_model=list[CaseResponse])
def list_cases(db: Session = Depends(get_db)):
    return db.query(Case).order_by(Case.id.desc()).all()


# Get one case by its id.
@router.get("/cases/{case_id}", response_model=CaseResponse)
def get_case(case_id: int, db: Session = Depends(get_db)):
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


# The full case report in one response: evidence grouped by category,
# comparisons, links, web findings, and the connections graph.
@router.get("/cases/{case_id}/report")
def case_report(case_id: int, db: Session = Depends(get_db)):
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return build_report(db, case)


# Delete a case and everything in it: its evidence records, its analysis,
# and the stored copies of its uploaded files. This cannot be undone.
@router.delete("/cases/{case_id}", status_code=204)
def delete_case(case_id: int, db: Session = Depends(get_db)):
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    db.query(CrossReference).filter(CrossReference.case_id == case_id).delete()
    db.query(Comparison).filter(Comparison.case_id == case_id).delete()
    db.query(WebFinding).filter(WebFinding.case_id == case_id).delete()
    for evidence in db.query(Evidence).filter(Evidence.case_id == case_id).all():
        get_full_path(evidence.stored_path).unlink(missing_ok=True)
        db.delete(evidence)
    db.delete(case)
    db.commit()
