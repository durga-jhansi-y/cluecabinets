from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.case import Case
from app.models.cross_reference import Comparison, CrossReference
from app.models.evidence import Evidence
from app.models.source import WebFinding
from app.services.graph_service import build_graph

# The categories, in the order the frontend should show them, with display names.
CATEGORY_LABELS = {
    "witness_statement": "Witness statements",
    "suspect_information": "Suspect information",
    "crime_scene_evidence": "Crime scene evidence",
    "communication": "Communications",
    "timeline_event": "Timeline records",
    "location_information": "Location information",
    "web_osint": "Web sources",
    "other": "Unsorted",
}

REVIEW_BELOW = 0.6  # flag evidence the AI was less sure about than this


def build_report(db: Session, case: Case) -> dict:
    """Everything about one case in a single response, already organized.

    No AI calls happen here. This only gathers and arranges what is saved.
    """
    evidence_list = (
        db.query(Evidence).filter(Evidence.case_id == case.id).order_by(Evidence.id).all()
    )
    by_id = {evidence.id: evidence for evidence in evidence_list}
    analyzed = [evidence for evidence in evidence_list if evidence.status == "analyzed"]

    def brief(evidence_id: int):
        """A short reference to a piece of evidence, for use inside links."""
        evidence = by_id.get(evidence_id)
        if evidence is None:
            return None
        return {
            "id": evidence.id,
            "filename": evidence.original_filename,
            "classification": evidence.classification,
            "modality": evidence.modality,
        }

    def card(evidence: Evidence) -> dict:
        """Everything the frontend needs to draw one evidence card."""
        needs_review = evidence.status == "analyzed" and (
            evidence.classification == "other"
            or (evidence.confidence is not None and evidence.confidence < REVIEW_BELOW)
        )
        return {
            "id": evidence.id,
            "filename": evidence.original_filename,
            "modality": evidence.modality,
            "status": evidence.status,
            "classification": evidence.classification,
            "confidence": evidence.confidence,
            "needs_review": needs_review,
            "description": evidence.description,
            "entities": evidence.entities or [],
            "claims": evidence.claims or [],
            "extracted_text": evidence.extracted_text,
            "error": evidence.error,
            "sha256": evidence.sha256,
            "size_bytes": evidence.size_bytes,
            "created_at": evidence.created_at,
            "file_url": f"/api/evidence/{evidence.id}/file",
        }

    # 1. Evidence grouped by category.
    categories = []
    for key, label in CATEGORY_LABELS.items():
        items = [card(evidence) for evidence in analyzed if evidence.classification == key]
        categories.append(
            {"category": key, "label": label, "count": len(items), "evidence": items}
        )
    not_analyzed = [card(evidence) for evidence in evidence_list if evidence.status != "analyzed"]

    # 2. Comparisons: each detail lined up across the evidence.
    comparison_rows = (
        db.query(Comparison).filter(Comparison.case_id == case.id).order_by(Comparison.id).all()
    )
    comparisons = []
    for row in comparison_rows:
        entries = []
        for entry in row.entries or []:
            evidence = by_id.get(entry.get("evidence_id"))
            entries.append(
                {
                    "evidence_id": entry.get("evidence_id"),
                    "filename": evidence.original_filename if evidence else None,
                    "value": entry.get("value"),
                }
            )
        comparisons.append(
            {
                "id": row.id,
                "topic": row.topic,
                "status": row.status,
                "note": row.note,
                "entries": entries,
            }
        )

    # 3. Links between pairs of evidence.
    link_rows = (
        db.query(CrossReference)
        .filter(CrossReference.case_id == case.id)
        .order_by(CrossReference.id)
        .all()
    )
    links = [
        {
            "id": row.id,
            "relation": row.relation,
            "confidence": row.confidence,
            "explanation": row.explanation,
            "evidence_a": brief(row.evidence_a_id),
            "evidence_b": brief(row.evidence_b_id),
        }
        for row in link_rows
    ]

    # 4. Web research findings.
    finding_rows = (
        db.query(WebFinding).filter(WebFinding.case_id == case.id).order_by(WebFinding.id).all()
    )
    web_findings = [
        {
            "id": row.id,
            "check_type": row.check_type,
            "question": row.question,
            "query": row.query,
            "engine": row.engine,
            "summary": row.summary,
            "verdict": row.verdict,
            "confidence": row.confidence,
            "sources": row.sources or [],
            "evidence": [item for item in (brief(i) for i in row.evidence_ids or []) if item],
        }
        for row in finding_rows
    ]

    # 5. Has evidence been added since the last cross-reference?
    last_analysis = max((row.created_at for row in link_rows), default=None)
    newest_evidence = max((evidence.created_at for evidence in analyzed), default=None)
    analysis_out_of_date = newest_evidence is not None and (
        last_analysis is None or newest_evidence > last_analysis
    )

    # 6. Headline numbers.
    by_modality = {}
    for evidence in evidence_list:
        by_modality[evidence.modality] = by_modality.get(evidence.modality, 0) + 1

    summary = {
        "total_evidence": len(evidence_list),
        "analyzed": len(analyzed),
        "not_analyzed": len(not_analyzed),
        "needs_review": sum(
            1 for group in categories for item in group["evidence"] if item["needs_review"]
        ),
        "by_modality": by_modality,
        "links": len(links),
        "conflicts": sum(1 for link in links if link["relation"] == "conflicts"),
        "supports": sum(1 for link in links if link["relation"] == "supports"),
        "related": sum(1 for link in links if link["relation"] == "related"),
        "comparisons": len(comparisons),
        "comparisons_that_differ": sum(1 for item in comparisons if item["status"] == "differ"),
        "web_findings": len(web_findings),
    }

    return {
        "case": {
            "id": case.id,
            "title": case.title,
            "description": case.description,
            "created_at": case.created_at,
        },
        "generated_at": datetime.now(timezone.utc),
        "analysis_out_of_date": analysis_out_of_date,
        "summary": summary,
        "categories": categories,
        "not_analyzed": not_analyzed,
        "comparisons": comparisons,
        "links": links,
        "web_findings": web_findings,
        "graph": build_graph(db, case.id),
    }
