from pathlib import Path
from typing import Optional

# File extension -> modality. Anything not listed here is rejected.
ALLOWED_EXTENSIONS = {
    ".txt": "document",
    ".pdf": "document",
    ".docx": "document",
    ".csv": "structured_data",
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
    ".webp": "image",
    ".mp4": "video",
    ".mov": "video",
    ".webm": "video",
    ".mp3": "audio",
    ".wav": "audio",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def detect_modality(filename: str) -> Optional[str]:
    """Return the modality for a filename, or None if the type is not allowed."""
    extension = Path(filename).suffix.lower()
    return ALLOWED_EXTENSIONS.get(extension)
