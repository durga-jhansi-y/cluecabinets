// The data the page is working with: cabinets, case files, each folder's evidence, the user's own file types,
// and the signed-in account. Fully synchronized with backend API with fallback support.

// ---------- cabinets and case files ----------
// CM: every case file by title. Each has { cf, title, place, date, iso, status, upd, sum, long?, cab, backendId? }.
// There is no built-in sample data any more: every case comes from the backend, or is made on the page.
// These three stay as empty lists because the cabinet and the drawer still read them.
const CASES = [],
  EVID = {},
  XREF = {};
const CM = {};
CASES.forEach((c) => {
  c.cab = 0;
  CM[c.title] = c;
});
// CABS: the cabinets, in order. Each case file belongs to one: its cab is an index into this list.
const CABS = [{ ...FIRST_CABINET }];
let curCab = 0; // the cabinet that is open
// The folders (see cabinet.js) of the case files kept in one cabinet.
const foldersIn = (cab) => drawer.folders.filter((f) => !f.isAdd && CM[f.label] && CM[f.label].cab === cab);
// Case numbers: each new case file takes the next one.
let cfSeq = CASE_NUMBER_START;
const nextCf = () => "CF-" + String(++cfSeq).padStart(4, "0");

// ---------- folders ----------
// SS: the working state of each folder that has been opened, by case title.
const SS = {};

// A folder's state. The first time a backend case is opened, its report is loaded.
function folderState(fo) {
  const c = CM[fo.label];
  if (!SS[fo.label]) {
    SS[fo.label] = {
      evidence: ((c && EVID[c.cf]) || []).map((e) => ({
        ...e,
        people: [...(e.people || [])],
        places: [...(e.places || [])],
        objects: [...(e.objects || [])],
      })),
      xrefs: ((c && XREF[c.cf]) || []).map((x) => ({ ...x })),
      comparisons: [],
      web_findings: [],
      links: [],
      pinboard: null,
      aiSummary: "",
      autoStatus: "", // what the automatic analysis is doing right now, shown on the Case summary tab
      autoBusy: false,
      pins: {},
      sel: null,
      filter: "all",
      backendId: c ? c.backendId : null,
      isLoadingReport: false,
    };

    // If case has a backendId, fetch its report from live backend
    if (c && c.backendId) {
      loadBackendReport(fo, c.backendId);
    }
  }
  return SS[fo.label];
}

async function loadBackendReport(fo, backendId) {
  const s = SS[fo.label];
  if (!s) return;
  if (s.isLoadingReport) {
    s.loadAgain = true; // something changed while the report was on its way: fetch it once more afterwards
    return;
  }
  s.isLoadingReport = true;
  try {
    const report = await fetchCaseReportApi(backendId);
    if (!report) return;

    s.backendReport = report;
    s.comparisons = report.comparisons || [];
    s.web_findings = report.web_findings || [];
    s.links = report.links || [];
    s.pinboard = report.pinboard || null; // the backend's own pins and strings (newer backends)
    s.aiSummary = (report.case && report.case.summary) || "";
    s.outOfDate = !!report.analysis_out_of_date;

    // Every file the backend holds for this case: the analysed ones, then any still waiting or failed.
    const cards = [...(report.categories || []).flatMap((cat) => cat.evidence || []), ...(report.not_analyzed || [])];
    const before = s.evidence;
    const fromBackend = cards.map((card) => {
      const id = backendEvId(card.id),
        old = before.find((e) => e.id === id),
        a = cardAnalysis(card);
      // Evidence the user edited by hand keeps what they wrote.
      if (old && old.edited) return old;
      return {
        id,
        backendEvidenceId: card.id,
        type: old && old.typeByUser ? old.type : card.classification || "other",
        typeByUser: !!(old && old.typeByUser),
        date: old ? old.date : card.created_at ? new Date(card.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "",
        title: card.filename,
        summary: a.summary,
        notes: old ? old.notes : card.note || "",
        people: a.people,
        places: a.places,
        objects: a.objects,
        src: (old && old.src) || a.file_url,
        file: (old && old.file) || {
          name: card.filename,
          kind: card.modality === "image" ? "photo" : card.modality === "video" ? "video" : card.modality === "audio" ? "audio" : "document",
          size: card.size_bytes ? fileSize(card.size_bytes) : "",
          mime: "",
        },
        confidence: a.confidence,
        needs_review: a.needs_review,
        extracted_text: a.extracted_text,
      };
    });
    // Evidence that lives only on the page (the sample cases) stays where it is.
    s.evidence = [...before.filter((e) => !e.backendEvidenceId), ...fromBackend];
    delete s.pinsSet; // the pin board is laid out again for what is in the case now

    // Refresh UI views if currently open
    if (typeof cur !== "undefined" && cur === fo) {
      if (typeof renderLeft === "function") renderLeft();
      if (typeof renderRight === "function") renderRight();
    }
    if (typeof PinBoard !== "undefined" && PinBoard.refresh) PinBoard.refresh(fo);
    autoAnalyse(fo, backendId, report);
  } catch (err) {
    console.warn(`Could not load backend report for case ${backendId}:`, err);
  } finally {
    s.isLoadingReport = false;
    if (s.loadAgain) {
      s.loadAgain = false;
      loadBackendReport(fo, backendId);
    }
  }
}

// ---------- automatic analysis ----------
// The cross-reference (comparisons and links) and the web research run by themselves, with no button:
//   - the cross-reference when the case holds evidence it has not compared yet
//   - the web research after a cross-reference, or when the case has no web findings yet
// AUTO_DONE remembers what has been run in this visit, so the same work is never started twice.
const AUTO_DONE = new Set();
async function autoAnalyse(fo, backendId, report) {
  const s = SS[fo.label];
  if (!s || s.autoBusy) return;
  const cards = (report.categories || []).flatMap((cat) => cat.evidence || []),
    stillWorking = (report.not_analyzed || []).some((x) => x.status !== "failed"),
    stamp = backendId + ":" + cards.length; // changes when evidence is added
  if (stillWorking || cards.length < 2) return;
  const doXref = report.analysis_out_of_date && !AUTO_DONE.has("x:" + stamp),
    doWeb = (doXref || !(report.web_findings || []).length) && !AUTO_DONE.has("w:" + stamp);
  if (!doXref && !doWeb) return;

  const say = (text) => {
    s.autoStatus = text;
    if (typeof cur !== "undefined" && cur === fo && typeof renderRight === "function" && curTab === T_SUM) renderRight();
  };
  s.autoBusy = true;
  try {
    if (doXref) {
      AUTO_DONE.add("x:" + stamp);
      say("Comparing the evidence. This takes a minute or two for a large case…");
      try {
        await runCrossReferenceApi(backendId);
      } catch (err) {
        console.warn("Cross-reference failed:", err);
      }
    }
    if (doWeb) {
      AUTO_DONE.add("w:" + stamp);
      say("Checking claims against public sources…");
      try {
        await runWebResearchApi(backendId);
      } catch (err) {
        console.warn("Web research failed:", err);
      }
    }
  } finally {
    s.autoBusy = false;
    say("");
    loadBackendReport(fo, backendId); // show what was found
  }
}

// The id for the next piece of evidence in a folder: "E1", "E2", ... skipping any already taken.
function nextEvidenceId(s) {
  let k = s.evidence.length + 1;
  while (s.evidence.some((e) => e.id === "E" + k)) k++;
  return "E" + k;
}

// ---------- file types ----------
let CUSTOM_TYPES = [];
const TYPE_MEM = {},
  typeKey = () => "caseCabinet.types." + (account || "guest");
function loadTypes() {
  let v = TYPE_MEM[typeKey()];
  try {
    const r = localStorage.getItem(typeKey());
    if (r) v = JSON.parse(r);
  } catch (e) {
    // storage is blocked
  }
  CUSTOM_TYPES = Array.isArray(v) ? v.filter((t) => t && typeof t.id === "string" && typeof t.label === "string") : [];
}
function saveTypes() {
  TYPE_MEM[typeKey()] = CUSTOM_TYPES;
  try {
    localStorage.setItem(typeKey(), JSON.stringify(CUSTOM_TYPES));
  } catch (e) {
    // storage is blocked
  }
}
const typeLabel = (id) => {
  const c = CUSTOM_TYPES.find((t) => t.id === id);
  return c
    ? c.label
    : TYPE_LABEL[id] ||
        String(id || "other")
          .replace(/_/g, " ")
          .replace(/^./, (m) => m.toUpperCase());
};
const allTypes = (s) => {
  const t = [...FILE_TYPES, ...CUSTOM_TYPES.map((x) => x.id)];
  s.evidence.forEach((e) => {
    if (!t.includes(e.type)) t.push(e.type);
  });
  return t;
};

// ---------- the case file being created ----------
let DRAFT = { name: "", place: "", sum: "" };

// ---------- accounts & workspace initialization ----------
const ACCOUNTS = {};
let account = null,
  wsVer = 0;

function saveWorkspace() {
  if (!account) return;
  ACCOUNTS[account] = {
    cabs: CABS.map((c) => ({ ...c })),
    cur: curCab,
    seq: cfSeq,
    cases: drawer.folders.filter((f) => !f.isAdd).map((f) => ({ ...CM[f.label] })),
    ss: { ...SS },
  };
}

async function loadWorkspace(email, fresh) {
  account = email;
  const w = fresh ? null : ACCOUNTS[email];
  drawer.folders.filter((f) => !f.isAdd).forEach((f) => f.el.remove());
  drawer.folders.splice(0, drawer.folders.length, ...drawer.folders.filter((f) => f.isAdd));
  [CM, SS].forEach((o) => Object.keys(o).forEach((k) => delete o[k]));
  CABS.length = 0;
  DRAFT = { name: "", place: "", sum: "" };
  Upload.clearStaged();

  if (w) {
    CABS.push(...w.cabs.map((c) => ({ ...c })));
    curCab = w.cur;
    cfSeq = w.seq;
    Object.assign(SS, w.ss);
    [...w.cases].reverse().forEach((c) => {
      CM[c.title] = { ...c };
      drawer.addFolder(c.title);
    });
  } else {
    CABS.push({ ...FIRST_CABINET });
    curCab = 0;
    cfSeq = CASE_NUMBER_START;

    // Check if live backend has cases available
    let backendCases = [];
    try {
      const online = await checkBackendOnline();
      if (online) {
        backendCases = await fetchCasesApi();
      }
    } catch (e) {
      console.warn("Backend unavailable during workspace load:", e);
    }

    if (backendCases && backendCases.length > 0) {
      backendCases.forEach((bc) => {
        const title = bc.title;
        const cf = `CF-${String(bc.id).padStart(4, "0")}`;
        const item = {
          cf,
          title,
          place: "Active Investigation",
          date: bc.created_at ? new Date(bc.created_at).toLocaleDateString("en-GB") : "Current",
          iso: bc.created_at || "",
          status: "Active",
          upd: bc.id,
          sum: bc.description || "Live AI Clue Classifier evidence investigation.",
          long: bc.description || "Live AI Clue Classifier evidence investigation.",
          cab: 0,
          backendId: bc.id,
        };
        CM[title] = item;
        drawer.addFolder(title);
      });
      // How much evidence each case holds, for the count over the drawer. Fetched in the background.
      Promise.all(
        backendCases.map((bc) =>
          fetchEvidenceListApi(bc.id)
            .then((list) => {
              if (CM[bc.title]) CM[bc.title].evidenceCount = list.length;
            })
            .catch(() => {}),
        ),
      ).then(() => {
        if (typeof Drawer !== "undefined") Drawer.sync();
      });
    }

    // Built-in cases, if there are any (CASES is empty now)
    CASES.forEach((c) => {
      if (!CM[c.title]) {
        CM[c.title] = { ...c, cab: 0 };
        drawer.addFolder(c.title);
      }
    });
  }
  loadTypes();
  wsVer++;
  // The case files have just arrived from the backend, after the cabinet opened: draw them now.
  if (typeof Drawer !== "undefined") Drawer.sync();
}
