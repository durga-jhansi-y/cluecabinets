import json
import urllib.error
import urllib.request
from urllib.parse import urlencode

from sqlalchemy.orm import Session

from app import config
from app.models.source import SearchCache


def serpapi_search(db: Session, params: dict) -> dict:
    """Run one SerpAPI search. Reuses a saved result when we have one."""
    if not config.SERPAPI_API_KEY:
        raise RuntimeError("SERPAPI_API_KEY is missing. Add it to backend/.env")

    # The same search always produces the same key, so we can look it up.
    cache_key = json.dumps(params, sort_keys=True).lower()
    saved = db.query(SearchCache).filter(SearchCache.cache_key == cache_key).first()
    if saved is not None:
        print("SerpAPI: used a saved result (no credit used)")
        return saved.response

    url = "https://serpapi.com/search?" + urlencode(
        {**params, "api_key": config.SERPAPI_API_KEY}
    )
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"SerpAPI returned {error.code}: {details}")

    if data.get("error"):
        raise RuntimeError(f"SerpAPI error: {data['error']}")

    db.add(SearchCache(cache_key=cache_key, response=data))
    db.commit()
    print("SerpAPI: new search (1 credit used)")
    return data
