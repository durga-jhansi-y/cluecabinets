from sqlalchemy.orm import Session

from app.agents import cross_reference_agent
from app.models.cross_reference import Comparison, CrossReference
from app.models.evidence import Evidence


def run_cross_reference(db: Session, case_id: int) -> list:
    """Compare all analyzed evidence in a case, and save the comparisons and links."""
    # 1. Gather the evidence that has been analyzed.
    evidence_list = (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id, Evidence.status == "analyzed")
        .order_by(Evidence.id)
        .all()
    )
    if len(evidence_list) < 2:
        raise ValueError("Need at least two analyzed pieces of evidence to cross-reference")

    # 2. Ask the AI for the comparisons and the links.
    result = cross_reference_agent.find_links(summarize(evidence_list))
    valid_ids = {evidence.id for evidence in evidence_list}

    # 3. Replace any old results for this case with the new ones.
    db.query(CrossReference).filter(CrossReference.case_id == case_id).delete()
    db.query(Comparison).filter(Comparison.case_id == case_id).delete()

    for comparison in result.comparisons:
        # Never trust the AI blindly: keep only entries that point at real evidence.
        entries = [
            {"evidence_id": entry.evidence_id, "value": entry.value}
            for entry in comparison.entries
            if entry.evidence_id in valid_ids
        ]
        if len(entries) < 2:
            continue  # a comparison needs at least two items
        db.add(
            Comparison(
                case_id=case_id,
                topic=comparison.topic,
                status=comparison.status,
                note=comparison.note,
                entries=entries,
            )
        )

    # The AI sometimes lists the same pair twice. Merge those into one link.
    merged = {}
    for link in result.links:
        # The ids must be real and different.
        if link.evidence_a_id not in valid_ids or link.evidence_b_id not in valid_ids:
            continue
        if link.evidence_a_id == link.evidence_b_id:
            continue
        pair = (
            min(link.evidence_a_id, link.evidence_b_id),
            max(link.evidence_a_id, link.evidence_b_id),
        )
        if pair not in merged:
            merged[pair] = {
                "relation": link.relation,
                "explanation": link.explanation,
                "confidence": link.confidence,
            }
        else:
            existing = merged[pair]
            existing["explanation"] += " " + link.explanation
            existing["confidence"] = max(existing["confidence"], link.confidence)
            if link.relation == "conflicts":
                existing["relation"] = "conflicts"  # a conflict outranks agreement

    for (evidence_a_id, evidence_b_id), details in merged.items():
        db.add(
            CrossReference(
                case_id=case_id,
                evidence_a_id=evidence_a_id,
                evidence_b_id=evidence_b_id,
                relation=details["relation"],
                explanation=details["explanation"],
                confidence=details["confidence"],
            )
        )
    db.commit()

    return list_links(db, case_id)


def list_links(db: Session, case_id: int) -> list:
    return (
        db.query(CrossReference)
        .filter(CrossReference.case_id == case_id)
        .order_by(CrossReference.id)
        .all()
    )


def list_comparisons(db: Session, case_id: int) -> list:
    return (
        db.query(Comparison)
        .filter(Comparison.case_id == case_id)
        .order_by(Comparison.id)
        .all()
    )


def summarize(evidence_list: list) -> str:
    """Write a short text summary of each piece of evidence for the AI to compare."""
    blocks = []
    for evidence in evidence_list:
        claims = "\n".join(
            f"  - {claim['statement']}" for claim in (evidence.claims or [])
        )
        blocks.append(
            f"Evidence id {evidence.id} ({evidence.classification}, {evidence.modality})\n"
            f"Description: {evidence.description}\n"
            f"Claims:\n{claims}"
        )
    return "\n\n".join(blocks)
