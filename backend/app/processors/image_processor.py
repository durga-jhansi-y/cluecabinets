from pathlib import Path

from app.integrations.llm.client import describe_images

MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

MAX_IMAGE_BYTES = 15 * 1024 * 1024  # 15 MB

INSTRUCTIONS = """Describe this image for an evidence file. Write plain factual sentences.

Include:
- the setting: indoors or outdoors, the type of place, lighting, and time of day if it can be seen
- objects and vehicles, with colours and distinguishing details
- any visible text exactly as written: signs, labels, camera names, dates, timestamps, plates
- people only by what is visible: how many, their clothing, what they are doing
- tattoos and marks: the design as specifically as it can be seen (for example which kind of flower), and where on the body

Rules:
- Left and right: say whether a body part is the person's left or right only when the image makes it clear, and say how you know. For example, when a person is seen from behind, the arm on the left side of the image is their left arm; when they face the camera it is their right arm. If the image does not show enough to tell, say that the side cannot be determined from this image.
- Do not identify any person, and do not guess anyone's name, identity, age or background.
- Do not guess at things that cannot be seen. If something is unclear, say it is unclear.
- Do not interpret what the image means for a case. Describe only.
"""


def extract_text(path: Path) -> str:
    """Ask the AI for a factual description of an image."""
    data = path.read_bytes()
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("Image is too large to analyze (over 15 MB)")

    mime_type = MIME_TYPES.get(path.suffix.lower(), "image/jpeg")
    description = describe_images([(data, mime_type)], INSTRUCTIONS)
    return "Image description: " + description.strip()
