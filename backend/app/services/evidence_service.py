from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.agents import evidence_classifier
from app.database import SessionLocal
from app.models.evidence import Evidence
from app.processors import (
    csv_processor,
    document_processor,
    image_processor,
    video_processor,
)
from app.storage.file_storage import get_full_path, save_upload
from app.utils.file_validation import MAX_FILE_SIZE, detect_modality

# Which processor handles which modality.
# This table is the only place where the file type matters.
PROCESSORS = {
    "document": document_processor.extract_text,
    "structured_data": csv_processor.extract_text,
    "image": image_processor.extract_text,
    "video": video_processor.extract_text,
}


def ingest_evidence(db: Session, case_id: int, upload: UploadFile) -> Evidence:
    """The fast part: validate, store, and record one uploaded file."""
    filename = upload.filename or "unnamed"

    # 1. Validate: is this a file type we accept?
    modality = detect_modality(filename)
    if modality is None:
        raise ValueError(f"File type not allowed: {filename}")

    # 2. Store the original file safely.
    stored_path, size, sha256 = save_upload(upload, case_id, MAX_FILE_SIZE)

    # 3. Refuse a file that is already in this case (same fingerprint).
    duplicate = (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id, Evidence.sha256 == sha256)
        .first()
    )
    if duplicate is not None:
        get_full_path(stored_path).unlink()
        raise ValueError(
            f"Already in this case, same content as evidence {duplicate.id}: {filename}"
        )

    # 4. Record it in the database.
    evidence = Evidence(
        case_id=case_id,
        original_filename=filename,
        stored_path=stored_path,
        modality=modality,
        size_bytes=size,
        sha256=sha256,
        status="uploaded",
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


def process_evidence(evidence_id: int) -> None:
    """The slow part: extract text, then ask the AI. Runs in the background."""
    db = SessionLocal()  # background work needs its own database session
    try:
        evidence = db.get(Evidence, evidence_id)
        if evidence is None:
            return
        evidence = run_processor(db, evidence)
        run_analysis(db, evidence)
    finally:
        db.close()


def run_processor(db: Session, evidence: Evidence) -> Evidence:
    """Turn the stored file into text and save it on the record."""
    processor = PROCESSORS.get(evidence.modality)
    if processor is None:
        return evidence  # no processor for this modality yet

    try:
        text = processor(get_full_path(evidence.stored_path))
        if not text or not text.strip():
            raise ValueError("no readable text was found in this file")
        evidence.extracted_text = text
        evidence.status = "extracted"
        evidence.error = None
    except Exception as error:
        # A broken file must not crash the server. Record what went wrong.
        evidence.extracted_text = None
        evidence.status = "failed"
        evidence.error = f"Text extraction failed: {error}"

    db.commit()
    db.refresh(evidence)
    return evidence


def run_analysis(db: Session, evidence: Evidence) -> Evidence:
    """Send the extracted text to the AI and save what it finds."""
    if evidence.status != "extracted" or not evidence.extracted_text:
        return evidence  # nothing to analyze

    # Tell the frontend the AI is working on it.
    evidence.status = "analyzing"
    db.commit()

    try:
        result = evidence_classifier.analyze(evidence.extracted_text, evidence.modality)
        evidence.classification = result.classification
        evidence.confidence = result.confidence
        evidence.description = result.description
        evidence.entities = [entity.model_dump() for entity in result.entities]
        evidence.claims = [claim.model_dump() for claim in result.claims]
        evidence.status = "analyzed"
        evidence.error = None
    except Exception as error:
        evidence.status = "failed"
        evidence.error = f"AI analysis failed: {error}"

    db.commit()
    db.refresh(evidence)
    return evidence
