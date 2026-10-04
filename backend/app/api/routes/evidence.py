from typing import List

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.case import Case
from app.models.evidence import Evidence
from app.schemas.evidence import EvidenceResponse
from app.services.evidence_service import ingest_evidence, process_evidence
from app.storage.file_storage import get_full_path

router = APIRouter()


# Upload one file into a case. Returns right away; analysis runs afterwards.
@router.post(
    "/cases/{case_id}/evidence", response_model=EvidenceResponse, status_code=201
)
def upload_evidence(
    case_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if db.get(Case, case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        evidence = ingest_evidence(db, case_id, file)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    # Do the slow work after the response has been sent.
    background_tasks.add_task(process_evidence, evidence.id)
    return evidence


# Upload several files in one request. Each is checked on its own:
# good files are accepted, bad ones are listed with the reason.
@router.post("/cases/{case_id}/evidence/batch")
def upload_many(
    case_id: int,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if db.get(Case, case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")

    accepted = []
    rejected = []
    for file in files:
        try:
            evidence = ingest_evidence(db, case_id, file)
        except ValueError as error:
            rejected.append({"filename": file.filename, "reason": str(error)})
            continue
        # These run one after another once the response has been sent.
        background_tasks.add_task(process_evidence, evidence.id)
        accepted.append(EvidenceResponse.model_validate(evidence))

    return {"accepted": accepted, "rejected": rejected}


# List all evidence in a case.
@router.get("/cases/{case_id}/evidence", response_model=list[EvidenceResponse])
def list_evidence(case_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id)
        .order_by(Evidence.id)
        .all()
    )


# Get one piece of evidence and its results.
@router.get("/evidence/{evidence_id}", response_model=EvidenceResponse)
def get_evidence(evidence_id: int, db: Session = Depends(get_db)):
    evidence = db.get(Evidence, evidence_id)
    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence


# Send back the original file, so the frontend can show or play it.
@router.get("/evidence/{evidence_id}/file")
def get_evidence_file(evidence_id: int, db: Session = Depends(get_db)):
    evidence = db.get(Evidence, evidence_id)
    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return FileResponse(get_full_path(evidence.stored_path))


# Re-run text extraction and AI analysis on existing evidence, in the background.
@router.post(
    "/evidence/{evidence_id}/analyze", response_model=EvidenceResponse, status_code=202
)
def analyze_evidence(
    evidence_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    evidence = db.get(Evidence, evidence_id)
    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    background_tasks.add_task(process_evidence, evidence.id)
    return evidence
