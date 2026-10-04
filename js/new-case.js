// Creating a case file.
// The new-case book has a single tab. The left page names the case, the right page takes its files. The folder itself
// is created when those files have been reviewed and filed, and the book then becomes that folder with all its tabs.

function newCaseError() {
  const name = tidy(DRAFT.name);
  if (!name) return "Give the case a title before sending its files.";
  if (drawer.folders.some((x) => x.label.toLowerCase() === name.toLowerCase()))
    return "A case with that title already exists.";
  if (drawer.folders.length >= MAX_CASES) return "The drawer is full.";
  return "";
}
function showNewCaseError(msg) {
  const er = document.getElementById("nfe"),
    nm = document.getElementById("nfn");
  if (!er) return;
  er.textContent = msg;
  if (msg) nm.focus({ preventScroll: true });
}
function renderNew() {
  curTab = T_UP;
  pg.classList.remove("pinned");
  buildTabs();
  lp.innerHTML = `<div class="cat">New case file</div><h2>Name the folder</h2><div class="rule"></div>
  <label>Case title<input id="nfn" maxlength="30" autocomplete="off" placeholder="e.g. The Carrow Ledger"></label>
  <label>Location<input id="nfc" maxlength="40" autocomplete="off" placeholder="e.g. Carrow Wharf, Limehouse"></label>
  <label>Short summary<textarea id="nfo" rows="3" maxlength="140" placeholder="One line on what this case is about"></textarea></label>
  <div class="err" id="nfe" role="alert"></div>
  <p class="stat">The folder is created once its first files are reviewed and filed. Its other tabs then fill in from those files.</p>`;
  pg.innerHTML = uploaderHTML(
    "Upload documents",
    "Choose the files for this case, then send them for review. Each one comes back with a type, which you check before it is filed as evidence.",
  );
  const nm = lp.querySelector("#nfn"),
    ct = lp.querySelector("#nfc"),
    ov = lp.querySelector("#nfo");
  nm.value = DRAFT.name;
  ct.value = DRAFT.place;
  ov.value = DRAFT.sum;
  nm.oninput = () => {
    DRAFT.name = nm.value;
    document.getElementById("nfe").textContent = "";
  };
  ct.oninput = () => {
    DRAFT.place = ct.value;
  };
  ov.oninput = () => {
    DRAFT.sum = ov.value;
  };
  [nm, ct].forEach(
    (el) =>
      (el.onkeydown = (e) => {
        if (e.key !== "Enter") return;
        const b = document.getElementById("upSend");
        b ? b.click() : document.getElementById("upIn").focus({ preventScroll: true });
      }),
  );
  Upload.bind();
}
function createCase() {
  if (newCaseError()) return null;
  const name = tidy(DRAFT.name),
    sum = DRAFT.sum.trim() || "No summary has been written for this case yet.";
  const c = {
    cf: nextCf(),
    title: name,
    place: DRAFT.place.trim() || "Location not recorded",
    date: longToday(),
    iso: isoToday(),
    status: CABS[curCab].status,
    cab: curCab,
    upd: Date.now(),
    sum,
  };
  CM[name] = c;

  // The backend case was made when this case's files went for review (reviewFiles in backend.js).
  // If there is none (the backend was offline then), try to make one now.
  const made = takePendingCase(name);
  if (made) c.backendId = made;
  else
    checkBackendOnline().then((online) => {
      if (online) {
        createCaseApi(name, sum)
          .then((bc) => {
            if (bc && bc.id) c.backendId = bc.id;
          })
          .catch((e) => console.warn("Could not register case on backend:", e));
      }
    });

  DRAFT = { name: "", place: "", sum: "" };
  return drawer.addFolder(name);
}
function adoptFolder(nf) {
  const add = cur;
  (add.card || add.pivot).style.opacity = "";
  cur = nf;
  book.classList.remove("newmode");
  bw.style.setProperty("--fc", nf.color);
  bw.style.setProperty("--fi", nf.ink);
  ctab.className = nf.white ? "w" : "m";
  ctab.textContent = nf.tab || nf.label;
  clab.textContent = nf.label;
  (nf.card || nf.pivot).style.opacity = "0";
  buildTabs();
}
