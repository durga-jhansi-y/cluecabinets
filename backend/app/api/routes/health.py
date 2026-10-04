from fastapi import APIRouter

# A router is a group of related addresses (endpoints).
router = APIRouter()


# When someone sends a GET request to /health, run this function
# and send back whatever it returns.
@router.get("/health")
def health_check():
    return {"status": "ok", "service": "clue-classifier"}
