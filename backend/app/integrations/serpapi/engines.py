import json
from urllib.parse import urlencode

from sqlalchemy.orm import Session

from app.integrations.serpapi.client import serpapi_search


def web_search(db: Session, query: str) -> dict:
    """Google search. Returns numbered text for the AI to read, plus the sources."""
    data = serpapi_search(db, {"engine": "google", "q": query, "hl": "en", "num": "5"})

    sources = []
    answer_box = data.get("answer_box")
    if answer_box:
        sources.append(
            {
                "title": "Google direct answer",
                "link": answer_box.get("link")
                or "https://www.google.com/search?" + urlencode({"q": query}),
                "snippet": json.dumps(answer_box)[:800],
            }
        )
    for result in data.get("organic_results", [])[:5]:
        sources.append(
            {
                "title": result.get("title", ""),
                "link": result.get("link", ""),
                "snippet": result.get("snippet", ""),
            }
        )

    # Number each result so the AI can say which ones it relied on.
    lines = [
        f"[{number}] {source['title']} ({source['link']}): {source['snippet']}"
        for number, source in enumerate(sources, start=1)
    ]
    return {"text": "\n".join(lines) or "No results found.", "sources": sources}


def travel_time(db: Session, start_place: str, end_place: str) -> dict:
    """Google Maps directions between two places."""
    data = serpapi_search(
        db,
        {
            "engine": "google_maps_directions",
            "start_addr": start_place,
            "end_addr": end_place,
            "hl": "en",
            "distance_unit": "0",  # kilometres
        },
    )

    # Which places did Google Maps actually use? A made-up or ambiguous name can
    # be matched to the wrong place, so we report this and let the AI check it.
    places = data.get("places_info") or []
    understood_start = places[0].get("address", "") if len(places) > 0 else ""
    understood_end = places[1].get("address", "") if len(places) > 1 else ""

    routes = []
    for route in data.get("directions", [])[:5]:
        mode = route.get("travel_mode", "unknown")
        duration = route.get("formatted_duration", "?")
        distance = route.get("formatted_distance", "?")
        line = f"{mode}: {duration}, {distance}"
        if line not in routes:  # skip repeated routes
            routes.append(line)

    if not routes:
        return {"text": "No route found.", "sources": []}

    maps_link = "https://www.google.com/maps/dir/?" + urlencode(
        {"api": "1", "origin": start_place, "destination": end_place}
    )
    title = f"Google Maps directions: {start_place} to {end_place}"
    understood = (
        f"Google Maps understood the start as: {understood_start or 'not reported'}. "
        f"Google Maps understood the end as: {understood_end or 'not reported'}."
    )
    sources = [
        {"title": title, "link": maps_link, "snippet": understood + " " + "; ".join(routes)}
    ]
    text = f"[1] {title}\n{understood}\n" + "\n".join(f"- {route}" for route in routes)
    return {"text": text, "sources": sources}
