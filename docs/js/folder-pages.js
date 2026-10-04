// What is drawn on the two pages of an open folder, for each tab.
//   left page  (#lp): the inside of the cover, or the evidence grid on the Evidence tab
//   right page (#pg): Case summary, the chosen piece of evidence (or its edit form), or the uploader

// ---------- shared pieces ----------
const typeTag = (x) => (x.type ? `<i class="ty" title="${esc(typeLabel(x.type))}">${esc(typeLabel(x.type))}</i>` : "");
const TYPE_ART = {
  witness_statement: '<path d="M4 5h16v11H10l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
  suspect_information: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.6-4 3.300-6 7-6s6.400 2 7 6"/>',
  crime_scene_evidence: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m14.500 14.500 5 5"/>',
  communication: '<path d="M3.500 6.500h17v11h-17z"/><path d="m3.500 7 8.500 6.500L20.500 7"/>',
  timeline_event: '<circle cx="12" cy="12" r="8"/><path d="M12 7.500V12l3 2"/>',
  location_information:
    '<path d="M12 21s6-5.600 6-10.500a6 6 0 0 0-12 0C6 15.400 12 21 12 21z"/><circle cx="12" cy="10.5" r="2"/>',
  web_osint:
    '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.500 2.500 2.500 13.500 0 16M12 4c-2.500 2.500-2.500 13.500 0 16"/>',
  other: '<path d="M7 3.500h7l4 4v13H7z"/><path d="M14 3.500v4h4M9.500 12h6M9.500 15h6"/>',
};
const typeArt = (t) => `<svg viewBox="0 0 24 24" aria-hidden="true">${TYPE_ART[t] || TYPE_ART.other}</svg>`;
const PIN_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5" r="3.4"/><path d="M8 8.400V15"/></svg>';
const evNo = (e) => {
  const c = CM[cur.label];
  return (c ? c.cf.slice(3) : "0000") + "-" + String(e.backendEvidenceId || (+String(e.id).slice(1) || 0)).padStart(2, "0");
};
const analysed = (e) => !!(e.summary || (e.people && e.people.length) || (e.places && e.places.length) || (e.objects && e.objects.length));
let editing = null;
const PEN_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.500 13.500 3 10.500l7.500-7.500 2.500 2.500L5.500 13z"/><path d="m9 4.500 2.500 2.500"/></svg>';

function evArt(e, big) {
  const f = e.file;
  if (e.src && f && f.kind === "photo") return `<img src="${e.src}" alt="">`;
  if (big && e.src && f && f.kind === "video") return `<video src="${e.src}" controls preload="metadata"></video>`;
  if (big && e.src && f && f.kind === "audio") return evArt(e) + `<audio src="${e.src}" controls></audio>`;
  if (f && f.kind === "video")
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.500 5.500h17v13h-17z"/><path d="m10 9 5 3-5 3z"/></svg>';
  if (f && f.kind === "audio")
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-4M8 17V7M12 20V4M16 17V7M20 14v-4"/></svg>';
  return typeArt(e.type);
}

const uploaderHTML = (title, intro) => `<h3>${esc(title)}</h3>
   <p class="ov">${esc(intro)}</p>
   <div id="upList"></div>
   <div class="up-foot">
   <div class="drop" id="upZone"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7.500 9.500 12 5l4.500 4.500M4.500 15.500v4h15v-4"/></svg><label class="pill pick" id="upBtn"><span id="upBtnText">Choose files</span><input id="upIn" type="file" multiple></label><span class="hint" id="upHint">or drop files anywhere on this page</span><p class="up-note" id="upNote" role="status" hidden></p></div>
   <div id="upGo"></div>
   </div>`;

// ---------- left page ----------
function renderLeft() {
  const s = folderState(cur);
  if (curTab === T_EV) drawEvidenceGrid(s);
  else drawCover(s);
}

function drawCover(s) {
  const c = CM[cur.label] || {},
    ev = s.evidence;
  const cb = c.cab || 0,
    list = foldersIn(cb),
    wait = ev.filter((e) => !analysed(e)).length;
  lp.innerHTML = `<div class="cat">Case file ${esc(c.cf || "")}</div><h2>${esc(cur.label)}</h2><div class="rule"></div>
  <dl class="idf"><dt>Status</dt><dd>${esc(c.status || "Active")}</dd><dt>Location</dt><dd>${esc(c.place || "Not recorded")}</dd><dt>Date</dt><dd>${esc(c.date || "")}</dd><dt>Kept in</dt><dd>Cabinet ${cb + 1} (${esc((CABS[cb] || {}).name || "")}), file ${list.indexOf(cur) + 1} of ${list.length}</dd></dl>
  <div class="ct">Contents</div>
  <ol>${TABS.map((t, i) => `<li><button type="button" data-i="${i}">${esc(t)}<i></i><b>${i + 1}</b></button></li>`).join("")}</ol>
  <p class="stat">${ev.length ? plural(ev.length, "piece") + " of evidence" + (wait ? `<br>${wait} awaiting analysis` : "") : "No evidence yet"}</p>`;
  lp.querySelectorAll("ol button").forEach((b) => (b.onclick = () => setTab(+b.dataset.i)));
}

function drawEvidenceGrid(s) {
  const ev = s.evidence;
  const count = (t) => ev.filter((e) => e.type === t).length,
    shown = s.filter === "all" ? ev : ev.filter((e) => e.type === s.filter);
  if (!shown.some((e) => e.id === s.sel)) s.sel = shown.length ? shown[0].id : null;
  lp.innerHTML = `<div class="ev-bar"><label for="evType">Sort by type</label><select id="evType"><option value="all">All types (${ev.length})</option>${allTypes(
    s,
  )
    .map(
      (t) =>
        `<option value="${esc(t)}"${s.filter === t ? " selected" : ""}>${esc(typeLabel(t))} (${count(t)})</option>`,
    )
    .join("")}</select></div>
 ${
   shown.length
     ? `<ul class="ev-grid">${shown
         .map((e) => {
           const k = e.file && e.file.kind;
           return `<li><button type="button" class="tile${e.id === s.sel ? " sel" : ""}" data-id="${esc(e.id)}" aria-pressed="${e.id === s.sel}" aria-label="${esc(e.title)}, ${esc(typeLabel(e.type))}"><span class="art">${evArt(e)}</span>${k === "photo" || k === "video" || k === "audio" ? `<i class="kind">${k}</i>` : ""}<span class="cap">${esc(e.title)}</span></button></li>`;
         })
         .join("")}</ul>`
     : `<p class="ev-none">${ev.length ? "No evidence of this type in this case." : "No evidence yet."}</p>${ev.length ? "" : '<button type="button" class="pill" id="evUp">Upload documents</button>'}`
 }`;
  document.getElementById("evType").onchange = (e) => {
    editing = null;
    s.filter = e.target.value;
    setTab(T_EV, true);
    document.getElementById("evType").focus({ preventScroll: true });
  };
  lp.querySelectorAll(".tile").forEach(
    (b) =>
      (b.onclick = () => {
        editing = null;
        s.sel = b.dataset.id;
        lp.querySelectorAll(".tile").forEach((x) => {
          const on = x === b;
          x.classList.toggle("sel", on);
          x.setAttribute("aria-pressed", on);
        });
        renderRight(true);
      }),
  );
  const up = document.getElementById("evUp");
  if (up) up.onclick = () => setTab(T_UP);
  const on = lp.querySelector(".tile.sel");
  if (on) {
    const a = on.getBoundingClientRect(),
      b = lp.getBoundingClientRect();
    if (a.bottom > b.bottom || a.top < b.top) lp.scrollTop += a.top - b.top - 60;
  }
}

// ---------- right page ----------
function renderRight(swap) {
  pg.classList.remove("pinned");
  const s = folderState(cur);
  if (curTab === T_SUM) drawSummary(s);
  else if (curTab === T_EV) drawEvidence(s);
  else drawUploader(s);
  if (swap) {
    pg.scrollTop = 0;
    pg.classList.remove("swap");
    void pg.offsetWidth;
    pg.classList.add("swap");
  }
}

function drawSummary(s) {
  const c = CM[cur.label] || {},
    ev = s.evidence;

  // The cross-reference and the web research run by themselves (autoAnalyse in state.js).
  // While they are running, this line says what is happening.
  const statusHTML = s.autoStatus
    ? `<p id="aiStatus" class="quiet" role="status" style="margin: 0.6rem 0 1rem 0;">${esc(s.autoStatus)}</p>`
    : "";

  let comparisonsHTML = "";
  if (s.comparisons && s.comparisons.length > 0) {
    comparisonsHTML = `<div class="ct2">Discrepancy Analysis</div>
    <ul style="list-style: none; padding: 0; margin: 0 0 1rem 0;">
      ${s.comparisons
        .map((comp) => {
          const color = comp.status === "agree" ? "#2e7d32" : comp.status === "differ" ? "#c62828" : "#666";
          const bg = comp.status === "differ" ? "rgba(198, 40, 40, 0.08)" : "rgba(0,0,0,0.03)";
          return `<li style="padding: 10px; margin-bottom: 8px; border-radius: 4px; background: ${bg}; border-left: 4px solid ${color};">
            <div style="display: flex; justify-content: space-between; font-weight: 600;">
              <span>${esc(comp.topic)}</span>
              <span style="color: ${color}; text-transform: uppercase; font-size: 0.75rem;">${esc(comp.status)}</span>
            </div>
            ${comp.note ? `<p style="margin: 4px 0 6px 0; font-size: 0.85rem; color: #444;">${esc(comp.note)}</p>` : ""}
            ${(comp.entries || [])
              .map(
                (entry) =>
                  `<div style="font-size: 0.8rem; color: #666;">• <b>${esc(entry.filename || "File")}:</b> ${esc(entry.value)}</div>`,
              )
              .join("")}
          </li>`;
        })
        .join("")}
    </ul>`;
  }

  // Pairs of evidence the cross-reference tied together: supports, conflicts or related.
  let linksHTML = "";
  if (s.links && s.links.length > 0) {
    const REL = { supports: "#2e7d32", conflicts: "#c62828", related: "#666" };
    linksHTML = `<div class="ct2">Links between evidence</div>
    <ul style="list-style: none; padding: 0; margin: 0 0 1rem 0;">
      ${s.links
        .map((l) => {
          const color = REL[l.relation] || "#666";
          const a = l.evidence_a ? l.evidence_a.filename : "",
            b = l.evidence_b ? l.evidence_b.filename : "";
          return `<li style="padding: 10px; margin-bottom: 8px; border-radius: 4px; background: rgba(0,0,0,0.03); border-left: 4px solid ${color};">
            <div style="display: flex; justify-content: space-between; gap: 8px; font-weight: 600;">
              <span>${esc(a)} &harr; ${esc(b)}</span>
              <span style="color: ${color}; text-transform: uppercase; font-size: 0.75rem; white-space: nowrap;">${esc(l.relation || "")}${typeof l.confidence === "number" ? " / " + Math.round(l.confidence * 100) + "%" : ""}</span>
            </div>
            <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #444;">${esc(l.explanation || "")}</p>
          </li>`;
        })
        .join("")}
    </ul>`;
  }

  let webFindingsHTML = "";
  if (s.web_findings && s.web_findings.length > 0) {
    webFindingsHTML = `<div class="ct2">Web OSINT Findings</div>
    <ul style="list-style: none; padding: 0; margin: 0 0 1rem 0;">
      ${s.web_findings
        .map((wf) => {
          const color = wf.verdict === "consistent" ? "#2e7d32" : wf.verdict === "inconsistent" ? "#c62828" : "#666";
          return `<li style="padding: 10px; margin-bottom: 8px; border-radius: 4px; background: rgba(0,0,0,0.02); border-left: 4px solid ${color};">
            <div style="font-weight: 600;">${esc(wf.question || wf.query || "OSINT Check")}</div>
            <p style="margin: 4px 0; font-size: 0.85rem; color: #333;">${esc(wf.summary || "")}</p>
            ${(wf.sources || [])
              .map(
                (src) =>
                  `<div style="font-size: 0.75rem;"><a href="${esc(src.link)}" target="_blank" rel="noopener">${esc(src.title || src.link)}</a></div>`,
              )
              .join("")}
          </li>`;
        })
        .join("")}
    </ul>`;
  }

  pg.innerHTML =
    `<h3>Case summary</h3><p class="ov">${esc(c.long || c.sum || "")}</p>` +
    statusHTML +
    (ev.length
      ? ""
      : `<div class="blank"><p>No evidence has been uploaded to this case yet.</p><button type="button" class="pill" id="sumUp">Upload documents</button></div>`) +
    comparisonsHTML +
    linksHTML +
    webFindingsHTML;

  const up = document.getElementById("sumUp");
  if (up) up.onclick = () => setTab(T_UP);
}

function drawEvidence(s) {
  const ev = s.evidence,
    e = ev.find((x) => x.id === s.sel);
  if (!e) {
    pg.innerHTML = `<h3>Evidence</h3><p class="quiet">${ev.length ? "Choose a piece of evidence on the left to see it here." : "Nothing has been filed in this case yet."}</p>`;
    return;
  }
  if (editing === e.id) {
    drawEvidenceEdit(e, s);
    return;
  }
  const f = e.file,
    media = e.src && f && (f.kind === "photo" || f.kind === "video"),
    pts = [
      ["People", e.people || []],
      ["Places", e.places || []],
      ["Objects", e.objects || []],
    ].filter((g) => g[1].length);

  pg.innerHTML = `<div class="ev-head">${PIN_SVG}<h3>${esc(e.title)}</h3><span class="no">No.<b>${evNo(e)}</b></span></div>
  <div class="ev-view${media ? " media" : ""}">${evArt(e, true)}${media ? "" : `<span class="plc">${esc(f ? f.name : "Sample record: no file attached")}</span>`}</div>
  <p class="ev-meta">${typeTag(e)}<span>${esc(e.date || "")}</span>${f ? `<span>${esc(f.kind)} / ${esc(f.size)}</span>` : ""}<button type="button" class="ev-edit" id="evEdit">${PEN_SVG}Edit</button></p>
  <div class="ev-sum"><h4><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.500 2.500h11v11h-11z"/><path d="m5 8 2.200 2.200L11 6"/></svg>Summary${e.edited ? "<small>Edited by hand</small>" : ""}</h4>
  ${
    analysed(e)
      ? `${pts.length ? `<ul class="ev-points">${pts.map((g) => `<li><b>${g[0]}:</b> ${g[1].map(esc).join(", ")}</li>`).join("")}</ul>` : ""}${e.summary ? `<p>${esc(e.summary)}</p>` : ""}`
      : `<p class="pending"><b>Analysis pending.</b> The back end has not returned a summary for this file yet. Use Edit to fill it in yourself.</p>`
  }</div>
  <div class="ev-notes"><h4>${PEN_SVG}Notes</h4>
  ${e.notes ? `<p id="evNotes">${esc(e.notes)}</p>` : e.extracted_text ? "" : `<p class="quiet" id="evNotes">No notes yet. Use Edit to add some.</p>`}
  ${e.extracted_text ? `<pre style="white-space: pre-wrap; font-family: inherit; font-size: 0.85rem; max-height: 220px; overflow-y: auto; background: rgba(0,0,0,0.03); padding: 8px; border-radius: 4px; margin: 6px 0 0 0;">${esc(e.extracted_text)}</pre>` : ""}</div>
  <p class="tab-rm"><button type="button" id="evRm">Remove from this folder</button></p>`;
  document.getElementById("evEdit").onclick = () => {
    editing = e.id;
    renderRight(true);
    document.getElementById("efT").focus({ preventScroll: true });
  };
  document.getElementById("evRm").onclick = () => {
    if (e.backendEvidenceId) deleteEvidenceApi(e.backendEvidenceId); // or it would come back with the next report
    ev.splice(ev.indexOf(e), 1);
    if (e.src) URL.revokeObjectURL(e.src);
    s.xrefs = s.xrefs.filter((r) => !r.ev.includes(e.id));
    delete s.pinsSet;
    s.sel = null;
    setTab(T_EV, true);
  };
}

function drawUploader(s) {
  const has = s.evidence.length > 0;
  pg.innerHTML = uploaderHTML(
    has ? "Upload documents" : "This folder is empty",
    (has ? "Add more files to this case." : "Upload the first files to start this case.") +
      " Choose everything you want to add, then send the files for review. Each one comes back with a type, which you check before it is filed as evidence.",
  );
  Upload.bind();
}

function evEditHTML(e, s) {
  const f = e.file,
    media = e.src && f && (f.kind === "photo" || f.kind === "video");
  return `<div class="ev-head">${PIN_SVG}<h3>Edit evidence</h3><span class="no">No.<b>${evNo(e)}</b></span></div>
  ${media ? `<div class="ev-view media small">${evArt(e, true)}</div>` : ""}
  <form class="ev-form" id="evForm" novalidate>
   <label>Title<input id="efT" maxlength="80" autocomplete="off" value="${esc(e.title)}"></label>
   <div class="two"><label>Type<select id="efY">${allTypes(s)
     .map((t) => `<option value="${esc(t)}"${t === e.type ? " selected" : ""}>${esc(typeLabel(t))}</option>`)
     .join("")}</select></label>
   <label>Date<input id="efD" maxlength="40" autocomplete="off" value="${esc(e.date || "")}" placeholder="e.g. 4 March 1958"></label></div>
   <label>Summary<textarea id="efN" rows="4" maxlength="600" placeholder="What this piece of evidence shows">${esc(e.summary || "")}</textarea></label>
   <label>People in it<input id="efP" maxlength="200" autocomplete="off" value="${esc(e.people.join(", "))}" placeholder="Names, separated by commas"></label>
   <label>Places in it<input id="efL" maxlength="200" autocomplete="off" value="${esc(e.places.join(", "))}" placeholder="Separated by commas"></label>
   <label>Objects in it<input id="efO" maxlength="200" autocomplete="off" value="${esc(e.objects.join(", "))}" placeholder="Separated by commas"></label>
   <label>Notes<textarea id="efM" rows="3" maxlength="${MAX_NOTES_LENGTH}" placeholder="Anything else worth keeping with this evidence">${esc(e.notes || "")}</textarea></label>
   <div class="row"><button type="submit" class="pill">Save changes</button><button type="button" class="lnk" id="efCancel">Cancel</button></div>
  </form>`;
}

function drawEvidenceEdit(e, s) {
  pg.innerHTML = evEditHTML(e, s);
  const form = document.getElementById("evForm");
  form.onsubmit = (evt) => {
    evt.preventDefault();
    const split = (v) =>
      v
        .split(",")
        .map(tidy)
        .filter(Boolean);
    e.title = tidy(document.getElementById("efT").value) || e.title;
    const newType = document.getElementById("efY").value;
    if (newType !== e.type) {
      e.typeByUser = true;
      if (e.backendEvidenceId && FILE_TYPES.includes(newType)) setEvidenceTypeApi(e.backendEvidenceId, newType);
    }
    e.type = newType;
    e.date = tidy(document.getElementById("efD").value);
    e.summary = tidy(document.getElementById("efN").value);
    e.people = split(document.getElementById("efP").value);
    e.places = split(document.getElementById("efL").value);
    e.objects = split(document.getElementById("efO").value);
    e.notes = tidy(document.getElementById("efM").value);
    e.edited = true;
    delete s.pinsSet;
    editing = null;
    setTab(T_EV, true);
  };
  document.getElementById("efCancel").onclick = () => {
    editing = null;
    renderRight(true);
  };
}
