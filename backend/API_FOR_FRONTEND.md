# Clue Classifier backend: guide for the frontend

Everything the UI needs comes from one address, the case report. The other addresses are for uploading, re-running analysis, and showing original files.

## Connecting

- Base address when the frontend runs on the same laptop as the backend: `http://127.0.0.1:8000`
- Live, clickable list of every endpoint: `http://127.0.0.1:8000/docs`
- Cross-origin requests are allowed from any address, so `fetch` works from a dev server on another port.

## The one call that draws the whole case

`GET /api/cases/{case_id}/report`

No AI runs here, so it returns immediately and can be called as often as needed.

```
{
  "case":      { "id", "title", "description", "created_at" },
  "generated_at": "...",
  "analysis_out_of_date": true | false,
  "summary":   { ...headline numbers... },
  "categories":   [ ...evidence grouped by category... ],
  "not_analyzed": [ ...evidence still processing or failed... ],
  "comparisons":  [ ...one detail lined up across several files... ],
  "links":        [ ...pairs of evidence that support, conflict or relate... ],
  "web_findings": [ ...SerpAPI checks with sources... ],
  "graph":        { "nodes", "edges", "shared_entities" }
}
```

### `summary`

Numbers for a header or dashboard strip: `total_evidence`, `analyzed`, `not_analyzed`, `needs_review`, `by_modality`, `links`, `conflicts`, `supports`, `related`, `comparisons`, `comparisons_that_differ`, `web_findings`.

### `categories`

Always eight groups, in display order, including empty ones:

| `category` | `label` |
|---|---|
| `witness_statement` | Witness statements |
| `suspect_information` | Suspect information |
| `crime_scene_evidence` | Crime scene evidence |
| `communication` | Communications |
| `timeline_event` | Timeline records |
| `location_information` | Location information |
| `web_osint` | Web sources |
| `other` | Unsorted |

Each group: `{ "category", "label", "count", "evidence": [card, ...] }`

Each evidence card:

| Field | Meaning |
|---|---|
| `id` | Evidence id |
| `filename` | Original file name. The AI never sees this. |
| `modality` | `document`, `structured_data`, `image`, `video`, `audio` |
| `status` | `uploaded`, `extracted`, `analyzing`, `analyzed`, `failed` |
| `classification` | One of the eight categories |
| `confidence` | 0 to 1, how sure the AI is of the category |
| `needs_review` | `true` when the category is `other` or confidence is under 0.6 |
| `description` | One or two neutral sentences |
| `entities` | `[{ "type": person / place / time / object / organization, "name" }]` |
| `claims` | `[{ "statement", "subject", "time", "place" }]` |
| `extracted_text` | The text read from the file, or the AI's description of an image or video |
| `error` | Why it failed, when `status` is `failed` |
| `file_url` | Add to the base address to show or play the original file |

### `comparisons`

The discrepancy board. Each item is one detail compared across files.

`{ "id", "topic", "status", "note", "entries": [{ "evidence_id", "filename", "value" }] }`

`status` is `agree`, `differ`, or `unclear`. Suggested colours: green, red, grey.

### `links`

`{ "id", "relation", "confidence", "explanation", "evidence_a", "evidence_b" }`

- `relation` is `supports`, `conflicts`, or `related`.
- `evidence_a` and `evidence_b` are `{ "id", "filename", "classification", "modality" }`.
- Suggested display: solid for confidence 0.7 and above, lighter for 0.4 to 0.7, hidden or faded below 0.4.

### `web_findings`

`{ "id", "check_type", "question", "query", "engine", "summary", "verdict", "confidence", "sources", "evidence" }`

- `check_type` is `travel_time` or `web_search`.
- `verdict` is `consistent`, `inconsistent`, or `inconclusive`.
- `sources` is `[{ "title", "link", "snippet" }]`. Show these as clickable links.
- On a travel check, `inconsistent` means the journey does not fit in the time available. It is not a statement about any person.

### `graph`

For a network diagram.

- `nodes`: `{ "id", "kind", "type", "label", ... }` where `kind` is `evidence`, `entity`, or `web_finding`.
- `edges`: `{ "id", "source", "target", "relation", ... }` where `relation` is `mentions`, `supports`, `conflicts`, `related`, or `web_check`. `source` and `target` are node ids.
- `shared_entities`: entities that appear in more than one file, `{ "label", "type", "evidence_ids" }`.
- Unnamed people are kept as separate nodes per file and labelled "(unidentified)". The system does not assume two unnamed people are the same person.

### `analysis_out_of_date`

`true` when evidence was added after the last cross-reference. Show a "New evidence added, re-run analysis" banner with a button that calls the two POST endpoints below.

## Actions

| What the user does | Call | Notes |
|---|---|---|
| Create a case | `POST /api/cases` with JSON `{ "title", "description" }` | Returns the case with its `id` |
| List cases | `GET /api/cases` | |
| Upload one file | `POST /api/cases/{id}/evidence`, form field `file` | Returns at once; analysis runs in the background |
| Upload many files | `POST /api/cases/{id}/evidence/batch`, form field `files` repeated | Returns `{ "accepted", "rejected" }` |
| Watch progress | `GET /api/cases/{id}/evidence` every 2 seconds | Stop when every item is `analyzed` or `failed` |
| Run cross-referencing | `POST /api/cases/{id}/cross-reference` | Slow: 1 to 3 minutes for a large case. Show a loading state. |
| Run web research | `POST /api/cases/{id}/search` | Slow: 30 to 60 seconds. Uses search credits, so trigger it from a button only. |
| Re-run one file | `POST /api/evidence/{id}/analyze` | |
| Show or play a file | `GET /api/evidence/{id}/file` | Works directly as the `src` of an `img`, `video` or `audio` tag |

Allowed uploads: `.txt .pdf .docx .csv .jpg .jpeg .png .webp .mp4 .mov .webm .mp3 .wav`, up to 50 MB each. Other types and duplicate files are rejected with a reason.

## Things the UI should say

- Confidence is the AI's own estimate. Show it, do not hide it.
- Links and findings are leads to check, not conclusions. The system does not decide guilt and does not identify people in images or video.
