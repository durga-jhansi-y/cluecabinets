import csv
from pathlib import Path


def extract_text(path: Path) -> str:
    """Turn a CSV table into readable lines, one per row."""
    with path.open(newline="", encoding="utf-8-sig", errors="replace") as file:
        rows = list(csv.DictReader(file))

    lines = []
    for number, row in enumerate(rows, start=1):
        fields = "; ".join(f"{key}: {value}" for key, value in row.items())
        lines.append(f"Row {number}: {fields}")
    return "\n".join(lines)
