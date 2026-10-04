// Backend API Integration for Clue Classifier
// Connects the frontend UI to the FastAPI server running at http://127.0.0.1:8000
// with fallback support if offline.

const API_BASE = "http://127.0.0.1:8000";
let isBackendConnected = false;

// ---------- Connection & Health ----------
async function checkBackendOnline() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { method: "GET", cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      isBackendConnected = data && data.status === "ok";
      return isBackendConnected;
    }
  } catch (e) {
    isBackendConnected = false;
  }
  return false;
}

// ---------- API Endpoint Calls ----------
async function fetchCasesApi() {
  const res = await fetch(`${API_BASE}/api/cases`);
  if (!res.ok) throw new Error("Failed to fetch cases");
  return await res.json();
}

async function createCaseApi(title, description = "") {
  const res = await fetch(`${API_BASE}/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
  if (!res.ok) throw new Error("Failed to create case");
  return await res.json();
}

// Remove a case and everything in it from the backend. Resolves to true once it is gone.
async function deleteCaseApi(caseId) {
  try {
    const res = await fetch(`${API_BASE}/api/cases/${caseId}`, { method: "DELETE" });
    return res.ok || res.status === 404; // 404: it was already gone
  } catch (e) {
    return false;
  }
}

async function fetchCaseReportApi(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/report`);
  if (!res.ok) throw new Error(`Failed to fetch report for case ${caseId}`);
  return await res.json();
}

async function uploadEvidenceBatchApi(caseId, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const res = await fetch(`${API_BASE}/api/cases/${caseId}/evidence/batch`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload evidence files");
  return await res.json();
}

async function runCrossReferenceApi(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/cross-reference`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Cross-referencing failed");
  return await res.json();
}

async function runWebResearchApi(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/search`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Web research failed");
  return await res.json();
}

async function fetchEvidenceListApi(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/evidence`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch the evidence list");
  return await res.json();
}

// Tell the backend about a change made on the review screen. Best effort: an older backend without these
// endpoints simply answers with an error, which is ignored.
function setEvidenceTypeApi(evidenceId, type) {
  return fetch(`${API_BASE}/api/evidence/${evidenceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classification: type }),
  }).catch(() => {});
}
function deleteEvidenceApi(evidenceId) {
  return fetch(`${API_BASE}/api/evidence/${evidenceId}`, { method: "DELETE" }).catch(() => {});
}

// ---------- turning what the backend sends into what the page uses ----------
// The id a piece of backend evidence has on the page. "B" keeps it apart from the sample evidence ("E1", "E2", ...).
const backendEvId = (id) => "B" + id;

// The names of one kind ("person", "place", "object") found in a piece of evidence, without repeats.
// A newer backend sends ready-made lists (people, places, objects) holding only the details that matter.
// An older one sends every entity, so incidental ones (key: false) are left out here.
function namesIn(card, type) {
  const ready = { person: card.people, place: card.places, object: card.objects }[type];
  const names = Array.isArray(ready)
    ? ready
    : (card.entities || []).filter((e) => e && e.type === type && e.key !== false).map((e) => e.name);
  return [...new Set(names.filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim()))];
}

// One evidence card from the backend report, as the analysis the page keeps with a piece of evidence.
function cardAnalysis(card) {
  const failed = card.status === "failed";
  return {
    backendEvidenceId: card.id,
    summary: failed ? "Analysis failed: " + (card.error || "the file could not be read.") : card.description || "",
    people: namesIn(card, "person"),
    places: namesIn(card, "place"),
    objects: namesIn(card, "object"),
    confidence: card.confidence,
    needs_review: card.needs_review,
    extracted_text: card.extracted_text || "",
    file_url: card.file_url ? `${API_BASE}${card.file_url}` : "",
  };
}

// Backend cases made while their files were being reviewed, by title, waiting for the folder to be created.
const PENDING_CASES = {};
function takePendingCase(title) {
  const id = PENDING_CASES[title] || null;
  delete PENDING_CASES[title];
  return id;
}

// ---------- review: what type is each uploaded file? ----------
// Takes the chosen File objects. Returns a promise of one result per file, in the same order:
//   { name, type, summary, people, places, objects, backendEvidenceId, ... }
// type is one of FILE_TYPES (config.js). The rest is that file's analysis, kept with it as evidence.
//   caseId: the backend case the files belong to, when the folder already has one
//   opts:   { title, description, onProgress(done, total) }
//           title is used to make the backend case when there is none yet (a new case file)
async function reviewFiles(files, caseId = null, opts = {}) {
  const online = await checkBackendOnline();

  if (online) {
    try {
      // A new case file has no backend case yet: make it now, so its files have somewhere to go.
      if (!caseId && opts.title) {
        caseId = PENDING_CASES[opts.title] || (await createCaseApi(opts.title, opts.description || "")).id;
        if (CM[opts.title]) CM[opts.title].backendId = caseId;
        else PENDING_CASES[opts.title] = caseId;
      }
      if (!caseId) throw new Error("No backend case to file these under");

      const uploadRes = await uploadEvidenceBatchApi(caseId, files);
      const accepted = uploadRes.accepted || [];

      // Which backend evidence belongs to each chosen file. A file the backend already holds (rejected as
      // a duplicate) is matched to the copy it already has.
      let list = await fetchEvidenceListApi(caseId);
      const idFor = (f) => {
        const a = accepted.find((x) => x.original_filename === f.name);
        if (a) return a.id;
        const old = list.find((x) => x.original_filename === f.name);
        return old ? old.id : null;
      };
      const ids = files.map(idFor);
      const waiting = () =>
        ids.filter((id) => {
          const row = list.find((x) => x.id === id);
          return row && row.status !== "analyzed" && row.status !== "failed";
        }).length;

      // Wait for the analysis. Files are analysed one after another, so a large upload takes minutes.
      const total = ids.filter(Boolean).length;
      const deadline = Date.now() + 20 * 60 * 1000;
      while (waiting() > 0 && Date.now() < deadline) {
        if (opts.onProgress) opts.onProgress(total - waiting(), total);
        await new Promise((r) => setTimeout(r, 2000));
        list = await fetchEvidenceListApi(caseId);
      }
      if (opts.onProgress) opts.onProgress(total - waiting(), total);

      const report = await fetchCaseReportApi(caseId);
      const cards = [...(report.categories || []).flatMap((c) => c.evidence || []), ...(report.not_analyzed || [])];
      const reasons = uploadRes.rejected || [];

      return files.map((f, i) => {
        const card = cards.find((c) => c.id === ids[i]);
        if (card)
          return {
            name: f.name,
            type: card.classification || "other",
            isNew: accepted.some((x) => x.id === card.id), // sent just now, not a copy the backend already had
            ...cardAnalysis(card),
          };
        const no = reasons.find((r) => r.filename === f.name);
        return { name: f.name, type: "other", summary: no ? "Not accepted by the backend: " + no.reason : "" };
      });
    } catch (err) {
      // The backend is running but the review failed. Say so, rather than showing a guess as if it were analysis.
      console.warn("Backend upload/review failed:", err);
      throw err;
    }
  }

  // The backend is not running: guess the type from the file's name and kind. No analysis comes with it.
  const guess = (f) => {
    const n = f.name.toLowerCase(),
      t = f.type || "";
    if (/witness|statement|interview|testimon|affidavit/.test(n)) return "witness_statement";
    if (/suspect|mugshot|profile|record|background|alias/.test(n)) return "suspect_information";
    if (/timeline|chronolog|schedule|calendar|log\b|log[_.-]/.test(n)) return "timeline_event";
    if (/map|location|address|gps|route|floor.?plan/.test(n) || /\.(kml|gpx|geojson)$/.test(n))
      return "location_information";
    if (/osint|web|screenshot|social|tweet|post|profile.?page|whois/.test(n) || /\.(html?|url|webloc|mhtml)$/.test(n))
      return "web_osint";
    if (
      /email|e-mail|letter|message|chat|sms|text|call|voicemail|correspond/.test(n) ||
      /\.(eml|msg|mbox)$/.test(n) ||
      t.startsWith("audio/")
    )
      return "communication";
    if (
      /scene|evidence|exhibit|photo|cctv|footage|forensic|img|dsc/.test(n) ||
      t.startsWith("image/") ||
      t.startsWith("video/")
    )
      return "crime_scene_evidence";
    return "other";
  };
  const wait = typeof reducedMotion === "function" && reducedMotion() ? 300 : Math.min(2200, 900 + files.length * 140);
  return new Promise((res) => setTimeout(() => res(files.map((f) => ({ name: f.name, type: guess(f) }))), wait));
}

// ---------- connections: how is everything in a case related? ----------
// Takes a case's evidence and cross-references. Returns { nodes, links } for the pin board:
//   nodes: every person, place and object named in the evidence   { id, type, label, evidence: [ids] }
//   links: two nodes that appear in the same piece of evidence, or are tied by a cross-reference
//          { key, source, target, evidence: [ids], xrefs: [...] }   (each link keeps the evidence behind it)
// pinboard is the backend's own { pins, strings } for the case, when it sent one. The backend keeps unnamed
// people apart (one pin per file), which a list of names cannot do, so its pins are used where it has them.
// Evidence the backend's pin board does not cover (sample evidence, or files added since) is worked out here.
const BOARD_TYPES = ["person", "place", "object"];
const BOARD_MAX_STRINGS = 70; // above this, strings resting on a single piece of evidence are left off
function connections(evidence, xrefs, pinboard = null) {
  const nodes = new Map(),
    links = new Map(),
    byLabel = new Map();
  const has = (id) => evidence.some((e) => e.id === id);
  const link = (a, b) => {
    const k = [a.id, b.id].sort().join("|");
    let l = links.get(k);
    if (!l) {
      l = { key: k, source: a.id, target: b.id, evidence: [], xrefs: [] };
      links.set(k, l);
    }
    return l;
  };

  // 1. The backend's pins and strings.
  const covered = new Set();
  const pinId = (id) => String(id).replace(/^entity:/, ""); // "entity:person:x" -> "person:x", as made below
  if (pinboard && Array.isArray(pinboard.pins)) {
    pinboard.pins.forEach((p) => {
      if (!BOARD_TYPES.includes(p.type)) return;
      const ev = (p.evidence_ids || []).map(backendEvId).filter(has);
      if (!ev.length) return;
      ev.forEach((id) => covered.add(id));
      const n = { id: pinId(p.id), type: p.type, label: p.label, evidence: ev };
      nodes.set(n.id, n);
      byLabel.set(String(p.label).toLowerCase(), n);
    });
    let strings = (pinboard.strings || []).filter((s) => nodes.has(pinId(s.source)) && nodes.has(pinId(s.target)));
    if (strings.length > BOARD_MAX_STRINGS)
      strings = strings.filter((s) => s.kind === "cross_reference" || (s.weight || 0) >= 2);
    strings.forEach((s) => {
      const a = nodes.get(pinId(s.source)),
        b = nodes.get(pinId(s.target)),
        l = link(a, b),
        ev = (s.evidence_ids || []).map(backendEvId).filter(has);
      if (s.kind === "cross_reference")
        l.xrefs.push({ a: a.label, b: b.label, ev, rel: s.relation, note: s.explanation || "" });
      else ev.forEach((id) => l.evidence.includes(id) || l.evidence.push(id));
    });
  }

  // 2. Evidence the backend's pin board does not cover: pins from its lists of people, places and objects.
  const node = (label, type, eid) => {
    const id = type + ":" + label.toLowerCase();
    let n = nodes.get(id);
    if (!n) {
      n = { id, type, label, evidence: [] };
      nodes.set(id, n);
      byLabel.set(label.toLowerCase(), n);
    }
    if (eid && !n.evidence.includes(eid)) n.evidence.push(eid);
    return n;
  };
  evidence
    .filter((e) => !covered.has(e.id))
    .forEach((e) => {
      const ns = [
        ...(e.people || []).map((x) => node(x, "person", e.id)),
        ...(e.places || []).map((x) => node(x, "place", e.id)),
        ...(e.objects || []).map((x) => node(x, "object", e.id)),
      ];
      for (let i = 0; i < ns.length; i++)
        for (let j = i + 1; j < ns.length; j++) {
          if (ns[i] === ns[j]) continue;
          const l = link(ns[i], ns[j]);
          if (!l.evidence.includes(e.id)) l.evidence.push(e.id);
        }
    });

  // 3. Cross-references kept on the page (the sample cases have these).
  (xrefs || []).forEach((x) => {
    const a = byLabel.get(String(x.a).toLowerCase()),
      b = byLabel.get(String(x.b).toLowerCase());
    if (a && b && a !== b && (x.ev || []).every(has)) link(a, b).xrefs.push(x);
  });
  return { nodes: [...nodes.values()], links: [...links.values()] };
}
