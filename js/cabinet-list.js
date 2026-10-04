// The cabinets list beside the open drawer: choosing a cabinet, naming a new one, and the switch between two.
const CabinetList = (function () {
  const page = document.getElementById("page"),
    rail = document.getElementById("rail"),
    frame = document.querySelector(".frame"), // the window the cabinet is drawn in
    lockBtn = document.getElementById("btn");
  let swapping = false, // a switch between cabinets is playing
    naming = false, // the "New cabinet" option has turned into a name field
    railSig = ""; // what the list was last drawn from

  // ---------- the list ----------
  function renderRail() {
    // redrawn only when something it shows has changed
    const next =
      wsVer +
      "|" +
      curCab +
      "|" +
      swapping +
      "|" +
      naming +
      "|" +
      CABS.map((c, i) => c.name + foldersIn(i).length).join("|");
    if (next === railSig) return;
    railSig = next;
    const add =
      CABS.length >= MAX_CABINETS
        ? ""
        : naming
          ? `<form class="cab-form" id="cabForm" novalidate><label for="cabNameIn">Name the new cabinet</label><input id="cabNameIn" type="text" maxlength="24" placeholder="e.g. Closed cases" autocomplete="off" spellcheck="false"><div class="err" id="cabErr" role="alert"></div><div class="row"><button type="submit" class="mini go">Add</button><button type="button" class="mini" id="cabCancel">Cancel</button></div></form>`
          : `<button type="button" class="cab new" id="newCab"${swapping ? " disabled" : ""}><b>+</b><span>New cabinet</span><small>name it and open it</small></button>`;
    rail.innerHTML =
      '<div class="rail-k">Cabinets</div>' +
      CABS.map((c, i) => {
        const n = foldersIn(i).length;
        return `<button type="button" class="cab${i === curCab ? " on" : ""}" data-i="${i}"${i === curCab ? ' aria-current="true"' : ""}${swapping ? " disabled" : ""}><b>${pad2(i + 1)}</b><span>${esc(c.name)}</span><small>${plural(n, "case file")}</small></button>`;
      }).join("") +
      add;
  }
  function setNaming(v) {
    naming = v;
    renderRail();
    if (v) {
      document.getElementById("cabNameIn").focus({ preventScroll: true });
      rail.scrollLeft = rail.scrollWidth;
    } else {
      const b = document.getElementById("newCab");
      if (b && !swapping) b.focus({ preventScroll: true });
    }
  }
  rail.addEventListener("click", (e) => {
    if (swapping) return;
    if (e.target.closest("#cabCancel")) {
      setNaming(false);
      return;
    }
    const b = e.target.closest(".cab");
    if (!b) return;
    if (b.id === "newCab") {
      setNaming(true);
      return;
    }
    naming = false;
    switchTo(+b.dataset.i);
    renderRail();
  });
  rail.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && naming) {
      e.stopPropagation();
      setNaming(false);
    }
  });
  rail.addEventListener("submit", (e) => {
    e.preventDefault();
    if (swapping) return;
    const input = document.getElementById("cabNameIn"),
      err = document.getElementById("cabErr"),
      name = tidy(input.value);
    if (!name) {
      err.textContent = "Give the cabinet a name.";
      input.focus();
      return;
    }
    if (CABS.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      err.textContent = "A cabinet with that name already exists.";
      input.focus();
      return;
    }
    // the cabinet takes the name as typed; new files in it start as Closed or Cold case only if the name says so
    CABS.push({
      name,
      word: "files",
      bar: name,
      status: /closed/i.test(name) ? "Closed" : /cold/i.test(name) ? "Cold case" : "Active",
    });
    naming = false;
    switchTo(CABS.length - 1);
    renderRail();
  });

  // ---------- switching ----------
  // Change to cabinet i. With motion allowed this plays out in three steps (below); otherwise it just swaps.
  function switchTo(i) {
    if (swapping || i === curCab || bookOpen || busy) return;
    const show = () => {
      curCab = i;
      Drawer.redeal();
      Drawer.sync();
    };
    if (reducedMotion()) {
      show();
      return;
    }
    const later = (ms, fn) => setTimeout(fn, ms);
    swapping = true;
    Drawer.setActive(null);
    page.classList.add("swapping");
    frame.inert = true;
    lockBtn.disabled = true;
    renderRail();
    // 1. the view eases back out of the drawer, which shuts as the cabinet comes into view
    Drawer.showDeck(false);
    later(320, fling);
    // 2. the two cabinets trade places together: a still copy of this one leaves to the left
    //    while the real one, already relabelled and refilled, comes in from the right
    later(980, () => {
      const ghost = frame.cloneNode(true);
      ghost.classList.add("ghost");
      ghost.inert = true;
      ghost.setAttribute("aria-hidden", "true");
      frame.after(ghost);
      show();
      page.classList.add("cab-in");
      // 3. its drawer opens as it settles. This waits for the slide to finish and for one clean frame after it:
      //    a transition will not start on a property that an animation was still driving in the same frame.
      let opened = false;
      const open = () => {
        if (opened) return;
        opened = true;
        frame.removeEventListener("animationend", onEnd);
        ghost.remove();
        page.classList.remove("cab-in");
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            fling();
            Drawer.showDeck(true);
            Drawer.layout();
            later(1350, () => {
              swapping = false;
              page.classList.remove("swapping");
              frame.inert = false;
              lockBtn.disabled = false;
              railSig = "";
              renderRail();
            });
          }),
        );
      };
      const onEnd = (e) => {
        if (e.target === frame && e.animationName === "cab-in") open();
      };
      frame.addEventListener("animationend", onEnd);
      later(1300, open); // the timer is only a fallback
    });
  }

  return { render: renderRail, switching: () => swapping, stopNaming: () => (naming = false) };
})();
