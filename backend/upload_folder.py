"""Upload every file in a folder (and its subfolders) into a case, in one request.

Usage:  python upload_folder.py <case_id> "<path to folder>"
Example: python upload_folder.py 9 "C:\\Users\\me\\Downloads\\case 1"

The server must be running. Files are analyzed one after another in the
background, so check GET /api/cases/<case_id>/evidence for progress.
"""
import sys
from pathlib import Path

import httpx

SERVER = "http://127.0.0.1:8000"

if len(sys.argv) != 3:
    print('Usage: python upload_folder.py <case_id> "<path to folder>"')
    sys.exit(1)

case_id = sys.argv[1]
folder = Path(sys.argv[2])
if not folder.is_dir():
    print(f"Folder not found: {folder}")
    sys.exit(1)

paths = sorted(path for path in folder.rglob("*") if path.is_file())
print(f"Uploading {len(paths)} files into case {case_id}...")

files = [("files", (path.name, path.open("rb"))) for path in paths]
response = httpx.post(
    f"{SERVER}/api/cases/{case_id}/evidence/batch", files=files, timeout=None
)

if response.status_code != 200:
    print(f"Upload failed ({response.status_code}): {response.text}")
    sys.exit(1)

result = response.json()
for item in result["accepted"]:
    print(f"  accepted  id {item['id']:>3}  {item['modality']:<16} {item['original_filename']}")
for item in result["rejected"]:
    print(f"  REJECTED  {item['filename']}: {item['reason']}")
print(f"Done: {len(result['accepted'])} accepted, {len(result['rejected'])} rejected.")
