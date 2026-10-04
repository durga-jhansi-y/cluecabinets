import hashlib
import uuid
from pathlib import Path

from fastapi import UploadFile

# All originals live in backend/uploads/
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


def save_upload(upload: UploadFile, case_id: int, max_size: int) -> tuple:
    """Save an uploaded file under uploads/case_<id>/ with a name we generate.

    Returns (stored path, size in bytes, sha256 fingerprint).
    """
    extension = Path(upload.filename or "").suffix.lower()
    case_dir = UPLOAD_DIR / f"case_{case_id}"
    case_dir.mkdir(parents=True, exist_ok=True)

    # We never use the user's filename on disk. We make our own.
    stored_name = f"{uuid.uuid4().hex}{extension}"
    destination = case_dir / stored_name

    hasher = hashlib.sha256()
    size = 0
    too_large = False

    # Read the file in 1 MB pieces so big files don't fill up memory.
    with destination.open("wb") as out:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_size:
                too_large = True
                break
            hasher.update(chunk)
            out.write(chunk)

    if too_large:
        destination.unlink()
        raise ValueError("File is too large")

    # Store the path relative to uploads/, so the project can be moved.
    return f"case_{case_id}/{stored_name}", size, hasher.hexdigest()


def get_full_path(stored_path: str) -> Path:
    """Turn a stored path back into a real location on disk."""
    return UPLOAD_DIR / stored_path
