import re

from sqlalchemy.orm import Session

from app.models.cross_reference import CrossReference
from app.models.evidence import Evidence
from app.models.source import WebFinding

PRONOUNS = {"i", "me", "my", "we", "us", "he", "him", "she", "her", "they", "them", "you"}


def normalize(name: str) -> str:
    """Tidy a name so small differences don't create separate nodes."""
    text = re.sub(r"\s+", " ", name.strip().lower())
    text = re.sub(r"^(a|an|the)\s+", "", text)
    return text.strip(" .,;:'\"")


def is_named_person(name: str) -> bool:
    """True for a proper name like 'Marc Dubois', False for 'a man' or 'the speaker'."""
    cleaned = re.sub(r"^(a|an|the)\s+", "", name.strip(), flags=re.IGNORECASE)
    return bool(cleaned) and cleaned[0].isupper()


def build_graph(db: Session, case_id: int) -> dict:
    """Turn a case into nodes and edges for a network diagram."""
    evidence_list = (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id, Evidence.status == "analyzed")
        .order_by(Evidence.id)
        .all()
    )

    nodes = {}  # node id -> node
    edges = []

    # 1. One node per evidence file, plus a node for each entity it mentions.
    for evidence in evidence_list:
        evidence_node = f"evidence:{evidence.id}"
        nodes[evidence_node] = {
            "id": evidence_node,
            "kind": "evidence",
            "type": evidence.classification,
            "label": evidence.original_filename,
            "description": evidence.description,
            "modality": evidence.modality,
            "evidence_id": evidence.id,
        }

        seen = set()
        for entity in evidence.entities or []:
            entity_type = entity.get("type", "object")
            name = (entity.get("name") or "").strip()
            key = normalize(name)
            if not key or key in PRONOUNS:
                continue

            if entity_type == "person" and not is_named_person(name):
                # Never assume two unnamed people are the same person:
                # each one gets its own node, tied to its own evidence.
                node_id = f"entity:person:{key}@{evidence.id}"
                label = f"{name} (unidentified)"
            else:
                node_id = f"entity:{entity_type}:{key}"
                label = name

            if node_id in seen:
                continue
            seen.add(node_id)

            node = nodes.setdefault(
                node_id,
                {
                    "id": node_id,
                    "kind": "entity",
                    "type": entity_type,
                    "label": label,
                    "evidence_ids": [],
                },
            )
            node["evidence_ids"].append(evidence.id)
            edges.append(
                {
                    "id": f"mentions:{evidence.id}:{node_id}",
                    "source": evidence_node,
                    "target": node_id,
                    "relation": "mentions",
                }
            )

    # 2. Cross-reference links between evidence files.
    links = db.query(CrossReference).filter(CrossReference.case_id == case_id).all()
    for link in links:
        source = f"evidence:{link.evidence_a_id}"
        target = f"evidence:{link.evidence_b_id}"
        if source in nodes and target in nodes:
            edges.append(
                {
                    "id": f"crossref:{link.id}",
                    "source": source,
                    "target": target,
                    "relation": link.relation,
                    "confidence": link.confidence,
                    "explanation": link.explanation,
                }
            )

    # 3. Web findings, linked to the evidence they tested.
    findings = db.query(WebFinding).filter(WebFinding.case_id == case_id).all()
    for finding in findings:
        finding_node = f"finding:{finding.id}"
        nodes[finding_node] = {
            "id": finding_node,
            "kind": "web_finding",
            "type": finding.check_type,
            "label": finding.question,
            "summary": finding.summary,
            "verdict": finding.verdict,
            "confidence": finding.confidence,
            "sources": finding.sources or [],
        }
        for evidence_id in finding.evidence_ids or []:
            target = f"evidence:{evidence_id}"
            if target in nodes:
                edges.append(
                    {
                        "id": f"webcheck:{finding.id}:{evidence_id}",
                        "source": finding_node,
                        "target": target,
                        "relation": "web_check",
                        "verdict": finding.verdict,
                    }
                )

    # 4. The hidden connections: entities that appear in more than one file.
    shared = [
        {"label": node["label"], "type": node["type"], "evidence_ids": node["evidence_ids"]}
        for node in nodes.values()
        if node["kind"] == "entity" and len(node["evidence_ids"]) > 1
    ]
    shared.sort(key=lambda item: len(item["evidence_ids"]), reverse=True)

    return {
        "case_id": case_id,
        "nodes": list(nodes.values()),
        "edges": edges,
        "shared_entities": shared,
    }
