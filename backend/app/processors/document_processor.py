import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from pypdf import PdfReader

# The label Word uses for its text elements inside a .docx file.
WORD = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def extract_text(path: Path) -> str:
    """Read the text out of a .txt, .pdf or .docx file."""
    extension = path.suffix.lower()

    if extension == ".pdf":
        reader = PdfReader(path)
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages).strip()

    if extension == ".docx":
        return read_docx(path)

    # Plain text file. "utf-8-sig" also handles files saved by Windows Notepad.
    return path.read_text(encoding="utf-8-sig", errors="replace").strip()


def read_docx(path: Path) -> str:
    """A .docx file is a zip archive. The text lives in word/document.xml."""
    with zipfile.ZipFile(path) as archive:
        xml = archive.read("word/document.xml")

    paragraphs = []
    for paragraph in ET.fromstring(xml).iter(f"{WORD}p"):
        text = "".join(node.text or "" for node in paragraph.iter(f"{WORD}t"))
        if text.strip():
            paragraphs.append(text)
    return "\n".join(paragraphs).strip()
