from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.case import Case
from app.schemas.search import WebFindingResponse
from app.services.search_service import list_findings, run_web_research

router = APIRouter()


# Run web research for a case. Waits for the searches, then returns the findings.
@router.post("/cases/{case_id}/search", response_model=list[WebFindingResponse])
def research_case(case_id: int, db: Session = Depends(get_db)):
    if db.get(Case, case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        return run_web_research(db, case_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Web research failed: {error}")


# Get the saved findings for a case.
@router.get("/cases/{case_id}/search", response_model=list[WebFindingResponse])
def get_findings(case_id: int, db: Session = Depends(get_db)):
    return list_findings(db, case_id)
