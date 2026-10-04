// The page around the cabinet and the open drawer: the header and counts that follow the lock state, the front-on
// stack of case files, pointing at and opening a file, and the sort menu.
// The cabinets list beside the drawer is in cabinet-list.js.
const Drawer = (function () {
  const page = document.getElementById("page"),
    lockCard = document.querySelector(".login"),
    overlay = document.getElementById("bw");
  const sec = document.getElementById("secnote"),
    status = document.getElementById("statusText");
  const sf = document.getElementById("statFiles"),
    sd = document.getElementById("statDocs");
  const copy = document.querySelector(".copy"),
    lockedCopy = document.querySelector(".locked-copy"),
    openCopy = document.querySelector(".open-copy");
  const deck = document.getElementById("deck"),
    files = document.getElementById("files"),
    visual = document.querySelector(".visual"),
    sortBtn = document.getElementById("sortBtn"),
    newCase = document.getElementById("newCase"), // the "Add or remove" control
    caseMenu = document.getElementById("caseMenu"),
    rmBar = document.getElementById("rmBar");

  // ---------- the page follows the lock state ----------
  // The copy block takes the height of whichever statement is showing, so the cabinet gets the spare room once it is open.
  function size() {
    const cs = getComputedStyle(copy),
      show = page.classList.contains("archive-open") ? openCopy : lockedCopy;
    copy.style.height = show.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + "px";
  }
  function showDeck(on) {
    page.classList.toggle("deck-on", on);
    deck.setAttribute("aria-hidden", String(!on));
  }
  // Bring everything on the page up to date: called when the cabinet is locked or unlocked, a folder opens or
  // closes, and whenever case files or evidence change.
  function sync() {
    const open = lockCard.classList.contains("ok");
    page.classList.toggle("archive-open", open);
    lockedCopy.setAttribute("aria-hidden", open);
    openCopy.setAttribute("aria-hidden", !open);
    sec.textContent = open ? "Identity verified" : "Protected & encrypted";
    status.textContent = open ? "Authorized archive" : "Archive secured";
    const list = foldersIn(curCab);
    let docs = 0; // evidence in this cabinet: from a folder's state once opened, from the sample data before
    list.forEach((f) => {
      const s = SS[f.label],
        c = CM[f.label];
      // a case that has not been opened yet uses the count fetched when the cabinet was loaded (state.js)
      docs += s && s.evidence.length ? s.evidence.length : (c && c.evidenceCount) || ((c && EVID[c.cf]) || []).length;
    });
    sf.textContent = pad2(list.length);
    sd.textContent = pad2(docs);
    const cb = CABS[curCab],
      no = pad2(curCab + 1);
    document.getElementById("cabName").textContent = "Cabinet " + no;
    document.getElementById("statWord").textContent = list.length === 1 ? cb.word.replace(/s$/, "") : cb.word;
    document.getElementById("deckLabel").textContent = cb.bar;
    document.getElementById("deckWhere").innerHTML = "Cabinet " + no + '<span class="lg"> / Drawer 01</span>';
    document.getElementById("grantSmall").textContent = "Access granted / Cabinet " + no;
    document.getElementById("grantName").textContent = cb.name;
    CabinetList.render();
    size();
    if (CabinetList.switching()) return; // mid-switch, cabinet-list.js decides what is on screen
    // the front-on drawer view takes over as the drawer flings open, and steps aside the moment it is locked
    if (open) {
      render();
      if (!page.classList.contains("deck-on")) {
        showDeck(true);
        layout();
      }
    } else {
      showDeck(false);
      setActive(null);
      sortOpen(false);
      caseMenuOpen(false);
      removeMode(false);
      files.classList.remove("quick");
      CabinetList.stopNaming();
    }
  }

  // ---------- the stack of case files ----------
  // the back file's tab sits left; the rest cycle across the right so they do not cover the title behind them
  const tabX = (i, small) =>
    i === 0 ? (small ? "5%" : "6%") : (small ? ["70%", "68%", "69%"] : ["50%", "62%", "74%"])[(i - 1) % 3];
  let sortI = 0, // which of SORTS is in use
    sig = "", // what the stack was last drawn from, so it is only redrawn when something changed
    cards = [], // the case-file buttons, back to front
    active = null, // the file that is lifted
    down = 46; // how far the files in front of it slide down
  // Lift one file out of the stack (or none).
  function setActive(c) {
    if (active === c) return;
    active = c;
    const at = cards.indexOf(c);
    if (c) {
      // how far the files in front must slide for their tabs to clear this file's last line
      const foot = c.querySelector(".case-foot"),
        pitch = parseFloat(files.style.getPropertyValue("--pitch")) || 80;
      down = Math.max(40, Math.round(foot.offsetTop + foot.offsetHeight + 12 + 30 - 72 - pitch));
      files.style.setProperty("--down", down + "px");
    }
    cards.forEach((el, i) => {
      el.classList.toggle("lift", el === c);
      el.classList.toggle("down", at > -1 && i > at);
    });
  }
  function layout() {
    // spread the files over the height the drawer has
    const n = cards.length,
      top = 46,
      front = 58,
      lift = 72,
      lead = lift + 14,
      fv = 88;
    visual.style.setProperty("--deck-min", top + front + lead + fv + Math.max(0, n - 1) * 56 + "px");
    const well = deck.clientHeight - top - front;
    files.style.setProperty("--n", n);
    files.style.setProperty("--pitch", (n > 1 ? Math.max(56, Math.min(92, (well - lead - fv) / (n - 1))) : 92) + "px");
  }
  // Draw the open cabinet's case files, in the chosen order.
  function render() {
    const list = foldersIn(curCab).sort((a, b) => SORTS[sortI][3](CM[a.label], CM[b.label]));
    const next = wsVer + "|" + curCab + "|" + sortI + "|" + list.map((f) => f.label).join("|");
    if (next === sig) return;
    sig = next;
    active = null;
    const small = innerWidth <= 640;
    files.textContent = "";
    cards = list.map((fo, i) => {
      const c = CM[fo.label],
        b = document.createElement("button");
      b.type = "button";
      b.className = "case";
      b.style.setProperty("--i", i);
      b.style.setProperty("--x", tabX(i, small));
      b.setAttribute("aria-label", `${c.title}, case file ${c.cf}, ${c.status}. ${c.sum} Open dossier.`);
      b.innerHTML =
        `<span class="case-tab">${esc(c.cf)}</span><span class="case-body"><span class="case-head"><small>Case file ${esc(c.cf)}</small><strong>${esc(c.title)}</strong><i class="dot" style="--dot:${STATUS[c.status] || "#28565D"}"></i></span>` +
        `<span class="case-more"><span class="meta"><span>${esc(c.place)}</span><span>${esc(c.date)}</span></span><span class="sum">${esc(c.sum)}</span></span>` +
        `<span class="case-foot"><span>${esc(c.status)}</span><span class="open">Open dossier <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg></span></span></span>`;
      fo.card = b;
      b._fo = fo; // the folder this card opens
      files.appendChild(b);
      return b;
    });
    if (!cards.length) {
      // an empty cabinet says what it is for and how to start it
      files.innerHTML = `<div class="empty-drawer"><strong>Nothing filed here yet</strong><span>${esc(CABS[curCab].name)} has no case files yet. Add the first one to start it.</span><button class="tool" type="button" id="emptyNew">New case file</button></div>`;
      document.getElementById("emptyNew").onclick = startNewCase;
    }
    layout();
  }
  // Deal the files again from scratch (after the cabinet or the window size changes).
  function redeal() {
    sig = "";
    render();
  }

  // ---------- pointing at a file and opening it ----------
  // Which file is the pointer on? Worked out from the stack geometry rather than from whatever element is on top,
  // so a lifted file keeps hold of the pointer and moving up or down steps through the files one at a time.
  function pick(y) {
    const n = cards.length;
    if (!n) return -1;
    const pitch = parseFloat(files.style.getPropertyValue("--pitch")) || 80,
      lead = 86,
      lift = 72,
      tab = 30;
    const T = (i) => lead + i * pitch,
      rest = () => (y < T(0) - tab ? -1 : Math.min(n - 1, Math.max(0, Math.floor((y - lead) / pitch))));
    const a = cards.indexOf(active);
    if (a < 0) return rest();
    const top = T(a) - lift,
      bottom = a < n - 1 ? T(a + 1) + down : Infinity;
    if (y >= top && y < bottom) return a;
    if (y >= bottom) return Math.min(n - 1, a + 1 + Math.floor((y - bottom) / pitch));
    if (a === 0) return y < top - tab ? -1 : 0;
    return y >= T(a - 1) - lift ? a - 1 : rest();
  }
  files.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const tab = !active && e.target.closest(".case-tab"); // pointing at a tab picks that file
    if (tab) {
      setActive(tab.parentNode);
      return;
    }
    const i = pick(e.clientY - files.getBoundingClientRect().top);
    setActive(i < 0 ? null : cards[i]);
  });
  let lastPointer = "mouse";
  deck.addEventListener("pointerdown", (e) => {
    lastPointer = e.pointerType || "mouse";
  });
  files.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "touch") setActive(null);
  });
  files.addEventListener("focusin", (e) => {
    const c = e.target.closest(".case");
    if (c && c.matches(":focus-visible")) setActive(c);
  });
  deck.addEventListener("click", (e) => {
    const c = e.target.closest(".case");
    if (removing) {
      // remove mode: the file pointed at is chosen for removal instead of being opened
      const chosen = lastPointer !== "touch" && active ? active : c;
      if (chosen && !e.target.closest("#rmBar")) {
        rmTarget = chosen._fo;
        setActive(chosen);
        drawRmBar();
      }
      return;
    }
    if (!c) {
      if (!e.target.closest("button")) setActive(null);
      return;
    }
    if (e.detail === 0) {
      openBook(c._fo);
      return;
    } // keyboard: Enter opens the focused file
    if (lastPointer !== "touch") {
      if (active) openBook(active._fo);
      else setActive(c);
      return;
    } // mouse: the lifted file is the one being pointed at
    if (active !== c) {
      setActive(c);
      return;
    } // touch: first tap lifts the file, second opens it
    openBook(c._fo);
  });
  // ---------- adding or removing a case file ----------
  // One control does both. It opens a small menu: "New case file" starts a new one, "Remove a case file" turns on
  // remove mode (below). While remove mode is on, the control reads "Done removing" and pressing it ends the mode.
  function startNewCase() {
    caseMenuOpen(false);
    removeMode(false);
    const add = drawer.folders.find((f) => f.isAdd);
    add.card = newCase;
    openBook(add);
  }
  function caseMenuOpen(v) {
    if (v) {
      caseMenu.innerHTML =
        '<div class="k">Case files</div>' +
        '<button type="button" role="menuitem" data-a="new"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>New case file<small>name it, add files</small></button>' +
        '<button type="button" role="menuitem" data-a="remove"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.500h10M6.500 4.500V3h3v1.500M4.500 4.500l.6 8.500h5.800l.6-8.500M7 7v3.500M9 7v3.500"/></svg>Remove a case file<small>choose one to delete</small></button>';
      sortOpen(false);
    }
    caseMenu.hidden = !v;
    newCase.setAttribute("aria-expanded", v);
    if (v) caseMenu.querySelector("button").focus({ preventScroll: true });
  }
  newCase.onclick = () => {
    if (removing) removeMode(false);
    else caseMenuOpen(caseMenu.hidden);
  };
  caseMenu.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.a === "new") startNewCase();
    else {
      caseMenuOpen(false);
      removeMode(true);
      newCase.focus({ preventScroll: true });
    }
  });
  caseMenu.addEventListener("keydown", (e) => {
    const items = [...caseMenu.querySelectorAll("button")],
      at = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
      e.preventDefault();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      caseMenuOpen(false);
      newCase.focus({ preventScroll: true });
    } else if (e.key === "Tab") caseMenuOpen(false);
  });
  document.addEventListener("pointerdown", (e) => {
    if (!caseMenu.hidden && !e.target.closest(".case-wrap")) caseMenuOpen(false);
  });
  document.getElementById("deckPull").onclick = () => document.getElementById("btn").click();

  // ---------- removing a case file ----------
  // Remove mode is turned on from the "Add or remove" menu: the next file chosen is the one to remove, and the
  // bar across the top of the drawer asks before anything is deleted. Removing a case file deletes it from the
  // backend too (its evidence and analysis with it), so it cannot be undone.
  let removing = false, // remove mode is on
    rmTarget = null, // the folder chosen for removal, waiting for a yes
    rmSaid = ""; // what the last removal did, shown in the bar
  function removeMode(on) {
    removing = on;
    rmTarget = null;
    rmSaid = "";
    page.classList.toggle("rm-mode", on);
    newCase.classList.toggle("removing", on);
    document.getElementById("caseBtnText").textContent = on ? "Done removing" : "Add or remove";
    newCase.setAttribute("aria-label", on ? "Done removing case files" : "Add or remove a case file");
    drawRmBar();
  }
  function drawRmBar() {
    rmBar.hidden = !removing;
    if (!removing) return;
    if (!rmTarget) {
      rmBar.textContent =
        (rmSaid ? rmSaid + " " : "") +
        (foldersIn(curCab).length ? "Choose the case file to remove." : "There are no case files to remove.");
      return;
    }
    rmBar.innerHTML = `<span>Remove <b>${esc(rmTarget.label)}</b> and all its evidence? This cannot be undone.</span><button type="button" class="yes" id="rmYes">Yes, remove it</button><button type="button" id="rmNo">Keep it</button>`;
    document.getElementById("rmYes").onclick = () => removeCaseFile(rmTarget);
    document.getElementById("rmNo").onclick = () => {
      rmTarget = null;
      rmSaid = "";
      setActive(null);
      drawRmBar();
    };
    document.getElementById("rmNo").focus({ preventScroll: true });
  }
  async function removeCaseFile(fo) {
    const c = CM[fo.label],
      name = fo.label;
    rmBar.textContent = "Removing…";
    if (c && c.backendId && !(await deleteCaseApi(c.backendId))) {
      rmTarget = null;
      rmSaid = "The backend could not remove that case, so it has been left in place.";
      drawRmBar();
      return;
    }
    drawer.removeFolder(fo);
    delete CM[name];
    delete SS[name];
    rmTarget = null;
    rmSaid = "Removed.";
    sync(); // redraw the drawer and its counts without the file
    drawRmBar();
  }
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && removing && !bookOpen) removeMode(false);
  });

  // ---------- sorting ----------
  // Every way the files can be ordered: [name, short name for phones, what it means, comparison].
  // To add one, add a row here; the menu is drawn from this list.
  const bare = (t) => t.replace(/^(the|an|a)\s+/i, ""), // titles sort without their leading "The"
    rank = (c) => {
      const i = STATUS_ORDER.indexOf(c.status);
      return i < 0 ? STATUS_ORDER.length : i;
    };
  const SORTS = [
    ["recently updated", "Recent", "newest first", (a, b) => b.upd - a.upd],
    ["case number", "Number", "lowest first", (a, b) => a.cf.localeCompare(b.cf)],
    ["title", "Title", "A to Z", (a, b) => bare(a.title).localeCompare(bare(b.title))],
    ["case date", "Date", "oldest first", (a, b) => (a.iso || "").localeCompare(b.iso || "")],
    ["status", "Status", "active first", (a, b) => rank(a) - rank(b) || a.cf.localeCompare(b.cf)],
  ];
  // the sort control opens a menu listing every option, with the current one marked
  const sortMenu = document.getElementById("sortMenu");
  function drawSortMenu() {
    sortMenu.innerHTML =
      '<div class="k">Sort case files by</div>' +
      SORTS.map(
        (o, i) =>
          `<button type="button" role="menuitemradio" aria-checked="${i === sortI}" data-i="${i}">${o[0]}<small>${o[2]}</small></button>`,
      ).join("");
  }
  function sortOpen(v) {
    if (v) {
      drawSortMenu();
      caseMenuOpen(false);
    }
    sortMenu.hidden = !v;
    sortBtn.setAttribute("aria-expanded", v);
    if (v) sortMenu.querySelector("[aria-checked=true]").focus({ preventScroll: true });
  }
  sortBtn.onclick = () => sortOpen(sortMenu.hidden);
  sortMenu.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    sortI = +b.dataset.i;
    document.getElementById("sortName").textContent = SORTS[sortI][0];
    document.getElementById("sortShort").textContent = SORTS[sortI][1];
    sortOpen(false);
    sortBtn.focus({ preventScroll: true });
    files.classList.add("quick");
    render(); // re-deal the files in the new order without the opening pause
  });
  sortMenu.addEventListener("keydown", (e) => {
    const items = [...sortMenu.querySelectorAll("button")],
      at = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
      e.preventDefault();
    } else if (e.key === "Home") {
      items[0].focus();
      e.preventDefault();
    } else if (e.key === "End") {
      items[items.length - 1].focus();
      e.preventDefault();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      sortOpen(false);
      sortBtn.focus({ preventScroll: true });
    } else if (e.key === "Tab") sortOpen(false);
  });
  document.addEventListener("pointerdown", (e) => {
    if (!sortMenu.hidden && !e.target.closest(".sort-wrap")) sortOpen(false);
  });

  // ---------- keeping up with changes ----------
  if (window.ResizeObserver) new ResizeObserver(layout).observe(deck);
  addEventListener("resize", () => {
    if (lockCard.classList.contains("ok")) redeal();
    else sig = "";
    size();
  });
  new MutationObserver(sync).observe(lockCard, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(sync).observe(overlay, { attributes: true, attributeFilter: ["class"] });
  // Focusing a field must never scroll the clipped cabinet frame (older browsers without overflow:clip)
  [page, document.querySelector(".stagewrap")].forEach((el) =>
    el.addEventListener("scroll", () => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }),
  );
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(size);
    ro.observe(lockedCopy);
    ro.observe(openCopy);
  }

  return { sync, layout, setActive, showDeck, redeal };
})();
