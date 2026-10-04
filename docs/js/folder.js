// The folder (dossier): a book that flips open from a case file. This file holds the book itself: its state,
// its tabs, and the opening and closing animations. What is drawn on the pages is in folder-pages.js.

let bookOpen = false, // a folder is open
  busy = false, // it is in the middle of opening or closing
  cur = null, // the folder that is open (a folder object from cabinet.js)
  curTab = 0; // the tab that is showing
const bw = document.getElementById("bw"), // the overlay the folder opens in
  book = document.getElementById("book"),
  tabsEl = document.getElementById("tabs"),
  pg = document.getElementById("pg"), // right page
  lp = document.getElementById("lp"), // left page
  ctab = document.getElementById("ctab"), // the tab on the cover
  clab = document.getElementById("clab"), // the label on the cover
  xb = document.getElementById("xb"); // close button

// ---------- tabs ----------
function buildTabs() {
  // a folder that is still being created has one tab only: Upload documents
  tabsEl.textContent = "";
  if (cur.isAdd) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tb";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", "true");
    b.innerHTML = "<span>" + esc(TABS[T_UP]) + "</span>";
    tabsEl.appendChild(b);
    return;
  }
  TABS.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tb" + (i === T_BOARD ? " board" : "");
    b.setAttribute("role", "tab");
    b.innerHTML = (i === T_BOARD ? PIN_SVG : "") + "<span>" + esc(t) + "</span>";
    b.title = i === T_BOARD ? "Open the pin board" : t;
    b.onclick = () => setTab(i);
    tabsEl.appendChild(b);
  });
}
// Show a tab. quiet = redraw the pages without the page-turn animation.
function setTab(i, quiet) {
  if (i === T_BOARD) {
    if (!busy) PinBoard.open(cur);
    return;
  } // the folder stays on the tab it was on
  if (i !== T_EV) editing = null;
  curTab = i;
  [...tabsEl.children].forEach((b, j) => b.setAttribute("aria-selected", j === i));
  renderLeft();
  renderRight();
  if (!quiet) turn();
}
// Play the page-turn animation on the right page.
function turn() {
  pg.scrollTop = 0;
  pg.classList.remove("turn");
  void pg.offsetWidth;
  pg.classList.add("turn");
}
// Left and right arrow keys move between tabs.
tabsEl.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const all = [...tabsEl.children],
    at = all.indexOf(document.activeElement);
  if (at < 0) return;
  const n = (at + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length;
  all[n].focus();
  if (!all[n].classList.contains("board")) all[n].click();
  e.preventDefault();
});

// ---------- opening and closing ----------
function flipFrom(fo) {
  // transform that squeezes the closed cover onto the folder's on-screen rect
  const W = book.offsetWidth,
    H = book.offsetHeight,
    el = fo.card || fo.sheet;
  let r = el.getBoundingClientRect();
  if (el.classList.contains("case")) {
    // only the strip of the file that shows: above the next file and inside the drawer
    const well = el.parentNode.getBoundingClientRect(),
      nx = el.nextElementSibling;
    const bottom = Math.min(r.bottom, well.bottom, nx ? nx.getBoundingClientRect().top : Infinity);
    r = { left: r.left, top: r.top, width: r.width, height: Math.max(28, bottom - r.top) };
  }
  const dx = r.left + r.width / 2 - innerWidth / 2,
    dy = r.top + r.height / 2 - innerHeight / 2;
  return `translate(${dx}px,${dy}px) scale(${Math.max(0.05, r.width / (W / 2))},${Math.max(0.05, r.height / H)}) translateX(-25%)`;
}
// Open a folder: the cover grows out of its case file, then swings open.
function openBook(fo) {
  if (busy || bookOpen) return;
  busy = true;
  bookOpen = true;
  cur = fo;
  bw.style.setProperty("--fc", fo.color);
  bw.style.setProperty("--fi", fo.ink);
  book.classList.toggle("newmode", fo.isAdd);
  ctab.className = fo.white ? "w" : "m";
  ctab.textContent = fo.tab || fo.label;
  clab.textContent = fo.label;
  if (fo.isAdd) renderNew();
  else {
    buildTabs();
    setTab(folderState(fo).evidence.length ? T_SUM : T_UP, true);
  }
  book.classList.remove("open");
  book.classList.add("pre");
  bw.classList.add("on");
  book.style.transition = "none";
  book.style.transform = flipFrom(fo);
  (fo.card || fo.pivot).style.opacity = "0";
  void book.offsetWidth;
  bw.classList.add("vis");
  book.style.transition = "transform .55s cubic-bezier(.2,.8,.2,1)";
  book.style.transform = "";
  setTimeout(() => {
    book.style.transition = "";
    book.classList.remove("pre");
    book.classList.add("open");
  }, 580);
  setTimeout(() => {
    busy = false;
    (fo.isAdd ? lp.querySelector("input") : tabsEl.children[curTab]).focus({ preventScroll: true });
  }, 1500);
}
// Close the folder. after, if given, runs once it is back in the drawer.
function closeBook(after) {
  if (busy || !bookOpen) return;
  busy = true;
  const fo = cur,
    el = fo.card || fo.pivot,
    bd = document.getElementById("bd");
  // 1. the cover swings shut while the room behind comes back up
  book.classList.add("closing");
  book.classList.remove("open");
  bd.style.transition = "opacity .85s ease";
  bw.classList.remove("vis");
  setTimeout(() => {
    // 2. just before it finishes shutting, the folder is already on its way back to its place:
    //    an eased glide with a soft landing, dissolving into the file as the file fades in beneath it
    book.classList.add("pre");
    book.style.transition = "transform .6s cubic-bezier(.45,0,.2,1),opacity .26s ease .34s";
    book.style.transform = flipFrom(fo);
    book.style.opacity = "0";
    el.style.transition = "opacity .3s ease .28s";
    el.style.opacity = "";
    setTimeout(() => {
      bw.classList.remove("on");
      book.classList.remove("closing");
      book.style.transition = "none";
      book.style.transform = "";
      book.style.opacity = "";
      void book.offsetWidth;
      book.style.transition = "";
      el.style.transition = "";
      bd.style.transition = "";
      bookOpen = false;
      busy = false;
      cur = null;
      if (typeof after === "function") after();
    }, 620);
  }, 500);
}
xb.onclick = () => closeBook();
document.getElementById("bd").onclick = () => closeBook();
addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeBook();
});
