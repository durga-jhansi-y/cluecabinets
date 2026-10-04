from sqlalchemy.orm import Session

from app.agents import web_research_agent
from app.integrations.serpapi import engines
from app.models.evidence import Evidence
from app.models.source import WebFinding
from app.services.cross_reference_service import summarize

MAX_CHECKS = 4  # at most this many searches per run, to protect our credits


def run_web_research(db: Session, case_id: int) -> list:
    """Plan checks, run them through SerpAPI, and save what was found."""
    # 1. Gather the evidence that has been analyzed.
    evidence_list = (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id, Evidence.status == "analyzed")
        .order_by(Evidence.id)
        .all()
    )
    if not evidence_list:
        raise ValueError("No analyzed evidence in this case yet")
    summaries = summarize(evidence_list)
    valid_ids = {evidence.id for evidence in evidence_list}

    # 2. Ask the AI what is worth checking.
    plan = web_research_agent.plan_checks(summaries, MAX_CHECKS)

    # 3. Replace any old findings for this case.
    db.query(WebFinding).filter(WebFinding.case_id == case_id).delete()
    db.commit()

    for check in plan.checks[:MAX_CHECKS]:
        # 4. Run the search.
        try:
            if check.type == "travel_time" and check.start_place and check.end_place:
                engine = "google_maps_directions"
                query = f"{check.start_place} to {check.end_place}"
                results = engines.travel_time(db, check.start_place, check.end_place)
            elif check.type == "web_search" and check.query:
                engine = "google"
                query = check.query
                results = engines.web_search(db, check.query)
            else:
                continue  # the AI left out a needed detail, skip this check
        except Exception as error:
            print(f"Search failed for '{check.question}': {error}")
            continue

        # 5. Ask the AI what the results mean.
        assessment = web_research_agent.assess(check.question, summaries, results["text"])

        # 6. Keep only the sources the AI actually relied on.
        all_sources = results["sources"]
        used_sources = [
            all_sources[number - 1]
            for number in assessment.relevant_sources
            if 1 <= number <= len(all_sources)
        ]

        # 7. Save the finding.
        db.add(
            WebFinding(
                case_id=case_id,
                check_type=check.type,
                question=check.question,
                query=query,
                engine=engine,
                summary=assessment.summary,
                verdict=assessment.verdict,
                confidence=assessment.confidence,
                sources=used_sources,
                evidence_ids=[i for i in check.evidence_ids if i in valid_ids],
            )
        )
        db.commit()

    return list_findings(db, case_id)


def list_findings(db: Session, case_id: int) -> list:
    return (
        db.query(WebFinding)
        .filter(WebFinding.case_id == case_id)
        .order_by(WebFinding.id)
        .all()
    )
