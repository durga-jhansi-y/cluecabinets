import sys
import httpx
from pathlib import Path

SERVER = "http://127.0.0.1:8000"

# 1. Create Case 1
response = httpx.post(f"{SERVER}/api/cases", json={
    "title": "Case 1: The Metro Station Incident",
    "description": "Investigation into the robbery, assault, and discrepancies reported at Metro Station Lot A."
})

if response.status_code != 201:
    print(f"Failed to create case: {response.text}")
    sys.exit(1)

case = response.json()
case_id = case["id"]
print(f"Created Case ID {case_id}: {case['title']}")

# 2. Upload files from 'case 1' folder
folder = Path("../case 1").resolve()
if not folder.is_dir():
    print(f"Folder not found: {folder}")
    sys.exit(1)

paths = sorted([p for p in folder.rglob("*") if p.is_file()])
print(f"Uploading {len(paths)} files from {folder}...")

files = [("files", (path.name, path.open("rb"))) for path in paths]
up_resp = httpx.post(f"{SERVER}/api/cases/{case_id}/evidence/batch", files=files, timeout=None)

if up_resp.status_code != 200:
    print(f"Upload failed: {up_resp.text}")
    sys.exit(1)

result = up_resp.json()
print(f"Upload complete: {len(result['accepted'])} accepted, {len(result['rejected'])} rejected.")
