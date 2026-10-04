// Uploading files to a folder, in two steps.
//   1. On the folder's Upload documents page, chosen files wait in a list. More can be added or taken out.
//   2. "Send for review" sends the list to reviewFiles() (backend.js). The review screen (#review) then shows each
//      file with the type it was given, to be checked or changed before "Go" files them as evidence.
const Upload = (function () {
  const review = document.getElementById("review"),
    listEl = document.getElementById("rvList"),
    goBtn = document.getElementById("rvGo"),
    sumEl = document.getElementById("rvSum");
  const NEW = "__new__"; // the dropdown option that starts a new type
  let rows = [], // the files on the review screen
    fo = null, // the folder they are being filed in
    note = null, // the message under the uploader: { fo, text, bad? }
    busyUp = false, // files are away being reviewed
    seq = 0; // counts sends, so a late reply to an old one is ignored
  const kindOf = (f) =>
    f.type.startsWith("image/")
      ? "photo"
      : f.type.startsWith("video/")
        ? "video"
        : f.type.startsWith("audio/")
          ? "audio"
          : "document";
  const ext = (n) => {
    const m = /\.([a-z0-9]{1,5})$/i.exec(n);
    return m ? m[1] : "file";
  };
  const idOf = (label) =>
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  // ---------- the Upload documents page ----------
  // Chosen files wait in a list on the page. More can be added, or taken out, for as long as the user likes;
  // nothing goes for review until they press the button that sends the whole list.
  const staged = new WeakMap(),
    listOf = (f) => {
      if (!staged.has(f)) staged.set(f, []);
      return staged.get(f);
    };
  // A half-made case does not carry over to another account.
  function clearStaged() {
    const add = drawer.folders.find((f) => f.isAdd);
    if (add) listOf(add).length = 0;
  }
  const nameOf = (f) => (f.isAdd ? tidy(DRAFT.name) : f.label);
  const same = (a, b) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
  function showNote() {
    const z = document.getElementById("upZone"),
      n = document.getElementById("upNote");
    if (!z) return;
    z.classList.toggle("busy", busyUp);
    z.classList.toggle("bad", !!note && note.bad);
    n.hidden = !note || note.fo !== cur;
    if (!n.hidden) n.textContent = note.text;
    document.getElementById("upIn").disabled = busyUp;
  }
  // Draw the list of waiting files and the buttons under it.
  function drawStage(focus) {
    const box = document.getElementById("upList"),
      go = document.getElementById("upGo"),
      z = document.getElementById("upZone");
    if (!box) return;
    const list = listOf(cur),
      n = list.length;
    z.classList.toggle("has", n > 0);
    document.getElementById("upBtnText").textContent = n ? "Add more files" : "Choose files";
    pg.classList.toggle("pinned", n > 0);
    box.innerHTML = n
      ? `<div class="ct2">${plural(n, "file")} ready to send</div>
   <ul class="stage">${list.map((f, i) => `<li><span class="ext">${esc(ext(f.name))}</span><span class="nm"><b>${esc(f.name)}</b><small>${kindOf(f)} / ${fileSize(f.size)}</small></span><button type="button" class="rm" data-i="${i}" aria-label="Take ${esc(f.name)} off the list"${busyUp ? " disabled" : ""}>×</button></li>`).join("")}</ul>`
      : "";
    go.innerHTML = n
      ? `<div class="stage-go"><button type="button" class="pill" id="upSend"${busyUp ? " disabled" : ""}>${busyUp ? "Sending…" : `Send ${plural(n, "file")} for review`}</button><button type="button" class="lnk" id="upClear"${busyUp ? " disabled" : ""}>Clear the list</button></div>`
      : "";
    if (!n) return;
    box.querySelectorAll(".rm").forEach(
      (b) =>
        (b.onclick = () => {
          list.splice(+b.dataset.i, 1);
          note = null;
          showNote();
          drawStage("list");
        }),
    );
    document.getElementById("upClear").onclick = () => {
      list.length = 0;
      note = null;
      showNote();
      drawStage();
      document.getElementById("upIn").focus({ preventScroll: true });
    };
    document.getElementById("upSend").onclick = send;
    if (focus === "list") {
      const b = box.querySelector(".rm") || document.getElementById("upIn");
      b.focus({ preventScroll: true });
    }
  }
  // Add the chosen files to the list. They are not reviewed yet.
  function take(fileList) {
    if (busyUp || !cur) return;
    const list = listOf(cur);
    let files = [...fileList].filter((f) => f && f.name);
    if (!files.length) return;
    const dup = files.filter((f) => list.some((x) => same(x, f))).length;
    files = files.filter((f) => !list.some((x) => same(x, f)));
    const room = MAX_FILES_PER_UPLOAD - list.length,
      over = Math.max(0, files.length - room);
    list.push(...files.slice(0, Math.max(0, room)));
    const said = [
      dup && `${plural(dup, "file")} already on the list`,
      over && `${plural(over, "file")} left out: an upload takes ${MAX_FILES_PER_UPLOAD} at most`,
    ]
      .filter(Boolean)
      .join("; ");
    note = said ? { fo: cur, text: said.replace(/^./, (m) => m.toUpperCase()) + ".", bad: true } : null;
    showNote();
    drawStage();
  }
  // The user has confirmed the list: it goes for review (reviewFiles in backend.js), and the review screen opens
  // with the result.
  function send() {
    const folder = cur,
      files = [...listOf(folder)];
    if (busyUp || !files.length) return;
    if (folder.isAdd) {
      const bad = newCaseError();
      showNewCaseError(bad);
      if (bad) return;
    } // a new case needs its name first
    const run = ++seq;
    busyUp = true;
    note = { fo: folder, text: `Sending ${plural(files.length, "file")} for review…` };
    showNote();
    drawStage();
    const c = CM[folder.label];
    const backendId = c ? c.backendId : null;
    reviewFiles(files, backendId, {
      // a new case file has no backend case yet: reviewFiles makes one under this title
      title: folder.isAdd ? tidy(DRAFT.name) : folder.label,
      description: folder.isAdd ? tidy(DRAFT.sum) : (c && c.sum) || "",
      onProgress: (done, total) => {
        if (run !== seq || !total) return;
        note = { fo: folder, text: `Analysing the files: ${done} of ${total} done. Large uploads take a few minutes.` };
        showNote();
      },
    })
      .then((res) => {
        if (run !== seq) return;
        busyUp = false;
        note = null;
        showNote();
        drawStage();
        openReview(
          folder,
          files.map((f, i) => ({ file: f, suggested: (res[i] && res[i].type) || "other", analysis: res[i] || {} })),
        );
      })
      .catch(() => {
        if (run !== seq) return;
        busyUp = false;
        note = { fo: folder, text: "The files could not be reviewed. Try sending them again.", bad: true };
        showNote();
        drawStage();
      });
  }
  // Wire up the uploader. Called each time the Upload documents page is drawn.
  function bind() {
    const inp = document.getElementById("upIn");
    if (!inp) return;
    inp.onchange = () => {
      take(inp.files);
      inp.value = "";
    };
    showNote();
    drawStage();
  }
  // files can be dropped anywhere on the right page while the Upload documents tab is showing
  const zone = () => document.getElementById("upZone");
  pg.addEventListener("dragover", (e) => {
    const z = zone();
    if (z && e.dataTransfer && [...e.dataTransfer.types].includes("Files")) {
      e.preventDefault();
      z.classList.add("over");
    }
  });
  pg.addEventListener("dragleave", (e) => {
    const z = zone();
    if (z && !pg.contains(e.relatedTarget)) z.classList.remove("over");
  });
  pg.addEventListener("drop", (e) => {
    const z = zone();
    if (!z) return;
    e.preventDefault();
    z.classList.remove("over");
    take(e.dataTransfer.files);
  });

  // ---------- the review screen ----------
  const options = (sel) =>
    FILE_TYPES.map((t) => `<option value="${t}"${t === sel ? " selected" : ""}>${esc(typeLabel(t))}</option>`).join(
      "",
    ) +
    (CUSTOM_TYPES.length
      ? `<optgroup label="Your types">${CUSTOM_TYPES.map((t) => `<option value="${esc(t.id)}"${t.id === sel ? " selected" : ""}>${esc(t.label)}</option>`).join("")}</optgroup>`
      : "") +
    `<option value="${NEW}">Add a new type…</option>`;
  function why(r) {
    return r.type === r.suggested ? "Suggested by the review" : "Changed from " + typeLabel(r.suggested);
  }
  function draw(focusRow, what) {
    const n = rows.length;
    document.getElementById("rvCount").textContent = n ? `${plural(n, "file")} to review` : "Nothing left to review";
    listEl.innerHTML =
      rows
        .map(
          (r, i) => `<li class="rv-row" data-k="${r.k}" style="--i:${i}">
    <span class="rv-thumb">${r.url ? `<img src="${r.url}" alt="">` : esc(ext(r.file.name))}</span>
    <span class="rv-name"><strong>${esc(r.file.name)}</strong><small>${r.kind} / ${fileSize(r.file.size)}</small></span>
    <span class="rv-type"><label for="rvT${r.k}">Type</label>${
      r.adding
        ? `<span class="rv-new"><input id="rvT${r.k}" class="rv-in" maxlength="32" autocomplete="off" placeholder="Name the new type"><button type="button" class="save" data-a="save">Save</button><button type="button" data-a="back" aria-label="Cancel the new type">Cancel</button></span><span class="rv-why${r.err ? " err" : ""}" role="alert">${esc(r.err || "It will be offered for every file from now on.")}</span>`
        : `<select id="rvT${r.k}" class="rv-sel">${options(r.type)}</select><span class="rv-why">${esc(why(r))}</span>`
    }</span>
    <button type="button" class="rv-rm" data-a="rm" aria-label="Leave ${esc(r.file.name)} out">×</button></li>`,
        )
        .join("") ||
      '<li class="rv-none">Every file was taken out of this upload. Go back to the folder to choose files again.</li>';
    goBtn.disabled = !n;
    sumEl.textContent = n
      ? fo.isAdd
        ? `Go creates ${nameOf(fo)} and files ${plural(n, "file")} as evidence.`
        : `Go files ${plural(n, "file")} as evidence in ${fo.label}.`
      : "";
    if (focusRow != null) {
      const li = listEl.querySelector(`[data-k="${focusRow}"]`),
        t = li && li.querySelector(what || ".rv-sel,.rv-in");
      if (t) t.focus({ preventScroll: true });
    }
  }
  const rowOf = (el) => {
    listEl.classList.remove("fresh");
    return rows.find((r) => r.k === +el.closest(".rv-row").dataset.k);
  };
  listEl.addEventListener("change", (e) => {
    if (!e.target.matches(".rv-sel")) return;
    const r = rowOf(e.target);
    if (e.target.value === NEW) {
      r.adding = true;
      r.err = "";
      draw(r.k);
    } else {
      r.type = e.target.value;
      draw(r.k);
    }
  });
  function saveNew(r, input) {
    const label = tidy(input.value),
      id = idOf(label);
    if (!id) {
      r.err = "Give the type a name.";
      draw(r.k);
      return;
    }
    const known = FILE_TYPES.includes(id) ? id : (CUSTOM_TYPES.find((t) => t.id === id) || {}).id;
    if (!known) {
      CUSTOM_TYPES.push({ id, label });
      saveTypes();
    } // kept for next time
    r.type = id;
    r.adding = false;
    r.err = "";
    draw(r.k);
  }
  listEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    const r = rowOf(b),
      a = b.dataset.a;
    if (a === "rm") {
      dropFromBackend(r);
      if (r.url) URL.revokeObjectURL(r.url);
      const at = rows.indexOf(r);
      rows.splice(at, 1);
      draw(rows[Math.min(at, rows.length - 1)]?.k);
      if (!rows.length) document.getElementById("rvBack").focus();
    } else if (a === "back") {
      r.adding = false;
      r.err = "";
      draw(r.k);
    } else if (a === "save") saveNew(r, b.parentNode.querySelector("input"));
  });
  listEl.addEventListener("input", (e) => {
    // typing clears an earlier complaint
    if (!e.target.matches(".rv-in")) return;
    const r = rowOf(e.target);
    if (!r.err) return;
    r.err = "";
    const w = e.target.closest(".rv-type").querySelector(".rv-why");
    w.classList.remove("err");
    w.textContent = "It will be offered for every file from now on.";
  });
  listEl.addEventListener("keydown", (e) => {
    if (!e.target.matches(".rv-in")) return;
    const r = rowOf(e.target);
    if (e.key === "Enter") {
      e.preventDefault();
      saveNew(r, e.target);
    }
  });
  // The files on the review screen have already been sent to the backend for analysis. A file left out here is
  // taken out there too, unless the backend already had it before this upload.
  const backendWork = []; // requests on their way to the backend
  function dropFromBackend(r) {
    const a = r.analysis || {};
    if (a.backendEvidenceId && a.isNew) backendWork.push(deleteEvidenceApi(a.backendEvidenceId));
  }
  function openReview(folder, items) {
    fo = folder;
    rows = items.map((x, i) => ({
      k: i,
      file: x.file,
      kind: kindOf(x.file),
      suggested: x.suggested,
      analysis: x.analysis || {},
      type: x.suggested,
      adding: false,
      err: "",
      url: x.file.type.startsWith("image/") ? URL.createObjectURL(x.file) : "",
    }));
    const c = CM[fo.label];
    document.getElementById("rvKick").textContent =
      "Review upload" + (fo.isAdd ? " / New case file" : c ? " / Case file " + c.cf : "");
    document.getElementById("rvTitle").textContent = nameOf(fo);
    review.hidden = false;
    listEl.classList.add("fresh");
    draw();
    requestAnimationFrame(() => {
      review.classList.add("on");
      const s = listEl.querySelector(".rv-sel");
      (s || goBtn).focus({ preventScroll: true });
    });
  }
  function closeReview(firstNew) {
    review.classList.remove("on");
    rows.forEach((r) => {
      if (r.url && !r.kept) URL.revokeObjectURL(r.url);
    });
    rows = [];
    setTimeout(
      () => {
        review.hidden = true;
        listEl.textContent = "";
        if (cur === fo) {
          if (firstNew) {
            const s = folderState(fo);
            s.filter = "all";
            s.sel = firstNew;
            setTab(T_EV);
            tabsEl.children[T_EV].focus({ preventScroll: true });
          } // straight to what was just filed
          else {
            if (!cur.isAdd) setTab(curTab, true);
            const i = document.getElementById("upSend") || document.getElementById("upIn");
            if (i) i.focus({ preventScroll: true });
          }
        }
      },
      reducedMotion() ? 0 : 300,
    );
  }
  // Go: every file still on the list is filed in the folder as a piece of evidence, under the type shown beside it.
  // Anything the review returned about a file (summary, people, places, objects) is kept with it as its analysis.
  goBtn.onclick = () => {
    if (!rows.length) return;
    if (fo.isAdd) {
      // a new case: create its folder now, and turn the open book into that folder
      const add = fo,
        made = createCase();
      if (!made) {
        const bad = newCaseError();
        closeReview(null);
        showNewCaseError(bad);
        return;
      }
      listOf(add).length = 0;
      Drawer.sync();
      adoptFolder(made);
      fo = made;
    }
    const s = folderState(fo),
      date = longToday();
    let first = null;
    rows.forEach((r) => {
      const a = r.analysis,
        bid = a.backendEvidenceId || null, // the backend's number for this file, when it has one
        id = bid ? backendEvId(bid) : nextEvidenceId(s),
        changed = r.type !== r.suggested,
        list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
      r.kept = true; // the file stays viewable from the Evidence tab
      // a type changed here is the user's choice: tell the backend, so it is kept when the file is analysed again
      if (bid && changed && FILE_TYPES.includes(r.type)) backendWork.push(setEvidenceTypeApi(bid, r.type));
      const at = s.evidence.findIndex((e) => e.id === id); // already in the folder (sent a second time)
      if (at >= 0) s.evidence.splice(at, 1);
      s.evidence.push({
        id,
        backendEvidenceId: bid,
        type: r.type,
        typeByUser: changed,
        confidence: a.confidence,
        extracted_text: typeof a.extracted_text === "string" ? a.extracted_text : "",
        date,
        title: r.file.name,
        summary: typeof a.summary === "string" ? a.summary : "",
        notes: "",
        people: list(a.people),
        places: list(a.places),
        objects: list(a.objects),
        src: r.url || URL.createObjectURL(r.file),
        file: { name: r.file.name, kind: r.kind, size: fileSize(r.file.size), mime: r.file.type },
      });
      first = first || id;
    });
    delete s.pinsSet; // new evidence may add items to the pin board
    Drawer.sync(); // the drawer's counts include the new evidence
    listOf(fo).length = 0;
    note = { fo, text: `Filed ${plural(rows.length, "file")} as evidence.` };
    // Once the backend has the changes made here, bring the folder in line with it (this also fills the pin board).
    const bc = CM[fo.label],
      filedIn = fo;
    if (bc && bc.backendId) Promise.all(backendWork.splice(0)).then(() => loadBackendReport(filedIn, bc.backendId));
    closeReview(first);
  };
  const cancel = () => {
    rows.forEach(dropFromBackend); // nothing is filed, so the backend should not keep these files either
    note = null;
    closeReview(null);
  };
  document.getElementById("rvCancel").onclick = cancel;
  document.getElementById("rvBack").onclick = cancel;
  // Escape leaves the review without filing anything; it must not also close the folder underneath
  addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || review.hidden) return;
      e.stopImmediatePropagation();
      if (e.target.matches && e.target.matches(".rv-in")) {
        const r = rowOf(e.target);
        r.adding = false;
        r.err = "";
        draw(r.k);
        return;
      } // only backs out of naming a type
      cancel();
    },
    true,
  );

  return { bind, clearStaged };
})();
