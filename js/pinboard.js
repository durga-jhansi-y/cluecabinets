// The pin board: one case's people, places and objects pinned to a cork board, with a string between any two that
// the evidence ties together. It is its own screen (#board), opened from a folder's Pin board tab.
// The graph itself comes from connections() in backend.js.
//
// In this file, in order: building the board, laying it out, drawing it, highlighting and selecting,
// the card that shows the evidence, and opening and closing.
const PinBoard = (function () {
  const board = document.getElementById("board"),
    surface = document.getElementById("pbSurface"),
    svg = document.getElementById("pbLines"),
    nodesEl = document.getElementById("pbNodes"),
    panel = document.getElementById("pbPanel"),
    tip = document.getElementById("pbTip"),
    filtersEl = document.getElementById("pbFilters"),
    emptyEl = document.getElementById("pbEmpty");
  const TYPES = [
    ["person", "People", "Person", "people"],
    ["place", "Places", "Place", "places"],
    ["object", "Objects", "Object", "objects"],
  ];
  const WORD = { person: "Person", place: "Place", object: "Object" };
  const ICON = {
    person:
      '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="4" r="2.2"/><path d="M1.8 11c.4-2.4 2-3.6 4.2-3.6s3.8 1.2 4.2 3.6"/></svg>',
    place:
      '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 11s3.6-3.4 3.6-6.2a3.6 3.6 0 0 0-7.2 0C2.4 7.6 6 11 6 11z"/><circle cx="6" cy="4.8" r="1.2"/></svg>',
    object:
      '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 4 6 1.8 10.5 4v4.4L6 10.6 1.5 8.4z"/><path d="M1.5 4 6 6.2 10.5 4M6 6.2v4.4"/></svg>',
  };
  // what each kind of pin looks like on the board
  const ART = {
    person:
      '<svg viewBox="0 0 58 50" aria-hidden="true"><circle cx="29" cy="19" r="10.5"/><path d="M6 50c1.2-12.5 10-18 23-18s21.8 5.500 23 18z"/></svg>',
    place:
      '<svg viewBox="0 0 132 56" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="132" height="56" fill="#e3ebe7"/><g fill="#b9d3d2"><rect x="6" y="5" width="26" height="14"/><rect x="74" y="4" width="20" height="18"/><rect x="100" y="30" width="26" height="20"/><rect x="38" y="33" width="30" height="18"/></g><g fill="#2b6e7c"><rect x="38" y="6" width="14" height="20"/><rect x="100" y="6" width="12" height="16"/><rect x="8" y="30" width="14" height="12"/></g><path d="M0 26h132M70 0v56M33 0v56M96 26v30" stroke="#fff" stroke-width="3" fill="none"/><path d="M12 48 30 27h40l22-14" stroke="#c0392b" stroke-width="1.6" stroke-dasharray="3 3" fill="none"/><path d="m88 9 8 8m0-8-8 8" stroke="#c0392b" stroke-width="2.200" fill="none" stroke-linecap="round"/></svg>',
    object: ICON.object,
  };
  const NS = "http://www.w3.org/2000/svg";
  const pieces = (n) => plural(n, "piece") + " of evidence";
  let fo = null, // the folder whose board is open
    S = null, // that folder's state (state.js): its evidence, cross-references and where the pins were left
    G = { nodes: [], links: [] }, // the graph on the board, from connections() in backend.js
    sel = null, // what is selected: { node: id } or { link: key }
    hover = null, // what is pointed at: { node }, { link } or { ev: evidence id }
    showAll = false, // the card is listing all the evidence
    off = new Set(), // kinds of pin hidden by the filters
    el = {}, // each node's button, by node id
    lineEl = {}, // each link's string, by link key
    bdEl = {}, // each link's number badge, by link key
    opener = null; // what had focus when the board opened
  const N = (id) => G.nodes.find((n) => n.id === id),
    EV = (id) => S.evidence.find((e) => e.id === id);
  const shown = (n) => !off.has(n.type),
    linkShown = (l) => shown(N(l.source)) && shown(N(l.target));
  const weight = (l) => l.evidence.length + l.xrefs.length;

  // ---------- building the board ----------
  // Make the pins and strings for the folder's evidence, then lay them out and draw them.
  function build() {
    G = connections(S.evidence, S.xrefs, S.pinboard);
    nodesEl.textContent = "";
    svg.textContent = "";
    el = {};
    lineEl = {};
    bdEl = {};
    const top = document.createElementNS(NS, "g");
    emptyEl.hidden = G.nodes.length > 0;
    G.links.forEach((l) => {
      const g = document.createElementNS(NS, "g"),
        a = N(l.source),
        b = N(l.target),
        n = l.evidence.length;
      g.setAttribute("class", "ln" + (n ? "" : " x"));
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute(
        "aria-label",
        `${a.label} and ${b.label}: ${n ? pieces(n) : "cross-reference"}. Show the evidence.`,
      );
      g.innerHTML =
        '<line class="hit"/><line class="shd"/><line class="str"/><g class="bd"><circle r="9.5"/><text></text></g>';
      const wc = "w" + Math.min(3, weight(l));
      g.classList.add(wc);
      g.querySelector(".bd").classList.add(wc);
      g.querySelectorAll(".str,.shd").forEach((x) =>
        x.setAttribute("stroke-width", [1.2, 2.4, 3.6][Math.min(3, weight(l)) - 1]),
      );
      g.querySelector("text").textContent = weight(l);
      g.addEventListener("click", () => select({ link: l.key }));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select({ link: l.key });
        }
      });
      g.addEventListener("pointerenter", () => {
        hover = { link: l.key };
        paint();
      });
      g.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch") return;
        const r = surface.getBoundingClientRect();
        tip.innerHTML = `${esc(a.label)} and ${esc(b.label)}<small>${n ? pieces(n) : "No shared evidence"}${l.xrefs.length ? (n ? " and " : "; ") + "a cross-reference" : ""}. Click for the sources.</small>`;
        tip.hidden = false;
        tip.style.left = Math.min(r.width - 250, Math.max(8, e.clientX - r.left + 14)) + "px";
        tip.style.top = Math.max(8, e.clientY - r.top + 16) + "px";
      });
      g.addEventListener("pointerleave", () => {
        hover = null;
        tip.hidden = true;
        paint();
      });
      svg.appendChild(g);
      lineEl[l.key] = g;
      const bd = g.querySelector(".bd");
      top.appendChild(bd);
      bdEl[l.key] = bd;
      bd.addEventListener("click", () => select({ link: l.key }));
      ["pointerenter", "pointermove", "pointerleave"].forEach((t) =>
        bd.addEventListener(t, (e) => g.dispatchEvent(new PointerEvent(t, e))),
      );
      g.addEventListener("focus", () => bd.classList.toggle("kb", g.matches(":focus-visible")));
      g.addEventListener("blur", () => bd.classList.remove("kb"));
    });
    svg.appendChild(top);
    G.nodes.forEach((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pin " + n.type;
      b.setAttribute("aria-label", `${WORD[n.type]}: ${n.label}. In ${pieces(n.evidence.length)}.`);
      b.innerHTML = `<i class="head"></i><span class="art">${ART[n.type]}</span><small>${WORD[n.type]}</small><span class="nm">${esc(n.label)}</span>`;
      let h = 0;
      for (const ch of n.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
      n.tilt = ((h % 9) - 4) * 0.8;
      nodesEl.appendChild(b);
      el[n.id] = b;
      drag(b, n);
      b.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "touch") {
          hover = { node: n.id };
          paint();
        }
      });
      b.addEventListener("pointerleave", () => {
        hover = null;
        paint();
      });
      b.addEventListener("focus", () => {
        if (b.matches(":focus-visible")) {
          hover = { node: n.id };
          paint();
        }
      });
      b.addEventListener("blur", () => {
        hover = null;
        paint();
      });
    });
    filters();
    document.getElementById("pbEvN").textContent = S.evidence.length;
    if (sel && ((sel.link && !lineEl[sel.link]) || (sel.node && !el[sel.node]))) sel = null;
    layout(false);
    renderPanel();
    paint();
  }
  function filters() {
    filtersEl.innerHTML = TYPES.map((t) => {
      const n = G.nodes.filter((x) => x.type === t[0]).length;
      return `<button type="button" data-t="${t[0]}" aria-pressed="${!off.has(t[0])}">${ICON[t[0]]}${t[1]} <b>${n}</b></button>`;
    }).join("");
  }
  filtersEl.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const t = b.dataset.t;
    off.has(t) ? off.delete(t) : off.add(t);
    if (sel && ((sel.node && !shown(N(sel.node))) || (sel.link && !linkShown(G.links.find((l) => l.key === sel.link)))))
      sel = null;
    filters();
    draw();
    renderPanel();
    paint();
  });

  // ---------- layout: a small force simulation, then a pass that pushes apart any pins left touching ----------
  const PAD = 12,
    TOP = 24,
    BOTTOM = 14;
  function clamp(n, W, H) {
    n.x = Math.max(n.w / 2 + PAD, Math.min(W - n.w / 2 - PAD, n.x));
    n.y = Math.max(TOP, Math.min(H - n.h - BOTTOM, n.y));
  }
  function separate(W, H, movable) {
    const gap = 9;
    for (let pass = 0; pass < 160; pass++) {
      let moved = false;
      for (let i = 0; i < G.nodes.length; i++)
        for (let j = i + 1; j < G.nodes.length; j++) {
          const a = G.nodes[i],
            b = G.nodes[j],
            ox = (a.w + b.w) / 2 + gap - Math.abs(a.x - b.x),
            oy = (a.h + b.h) / 2 + gap + 6 - Math.abs(a.y + a.h / 2 - (b.y + b.h / 2));
          if (ox <= 0 || oy <= 0) continue;
          const ma = movable(a),
            mb = movable(b);
          if (!ma && !mb) continue;
          moved = true;
          const sa = ma && mb ? 0.5 : ma ? 1 : 0,
            sb = ma && mb ? 0.5 : mb ? 1 : 0;
          if (ox < oy) {
            const d = a.x <= b.x ? -1 : 1;
            a.x += d * ox * sa;
            b.x -= d * ox * sb;
          } else {
            const d = a.y <= b.y ? -1 : 1;
            a.y += d * oy * sa;
            b.y -= d * oy * sb;
          }
          clamp(a, W, H);
          clamp(b, W, H);
        }
      if (!moved) break;
    }
  }
  function layout(fresh) {
    surface.style.minHeight = matchMedia("(max-width:860px)").matches ? 170 + G.nodes.length * 64 + "px" : "";
    const W = surface.clientWidth,
      H = surface.clientHeight;
    if (!W || !H || !G.nodes.length) {
      draw();
      return;
    }
    if (fresh) S.pins = {};
    G.nodes.forEach((n) => {
      n.w = el[n.id].offsetWidth;
      n.h = el[n.id].offsetHeight;
    });
    const free = G.nodes.filter((n) => !S.pins[n.id]);
    G.nodes.forEach((n) => {
      const p = S.pins[n.id];
      if (p) {
        n.x = p.x * W;
        n.y = p.y * H;
        clamp(n, W, H);
      }
    });
    if (free.length) {
      const order = [...G.nodes].sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
      const k = Math.sqrt((W * H) / G.nodes.length) * 0.95,
        isFree = (n) => free.includes(n),
        held = G.nodes.filter((n) => !isFree(n)).map((n) => [n, n.x, n.y]);
      const touching = () =>
        G.nodes.some((a, i) =>
          G.nodes.some(
            (b, j) =>
              j > i &&
              (a.w + b.w) / 2 + 9 - Math.abs(a.x - b.x) > 0.5 &&
              (a.h + b.h) / 2 + 15 - Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) > 0.5,
          ),
        );
      // The same board always lays out the same way: the shuffles below are seeded from what is on it.
      let seed = 0;
      for (const n of order) for (const ch of n.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const rnd = () => {
        seed = (seed + 0x6d2b79f5) >>> 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const attempt = (slots) => {
        held.forEach(([n, x, y]) => {
          n.x = x;
          n.y = y;
        });
        free.forEach((n) => {
          const a = (slots.indexOf(n) / slots.length) * Math.PI * 2 - Math.PI / 2;
          n.x = W / 2 + Math.cos(a) * W * 0.36;
          n.y = H / 2 - 20 + Math.sin(a) * H * 0.32;
        });
        let t = Math.min(W, H) / 7;
        for (let it = 0; it < 300; it++) {
          G.nodes.forEach((n) => {
            n.dx = 0;
            n.dy = 0;
          });
          for (let i = 0; i < G.nodes.length; i++)
            for (let j = i + 1; j < G.nodes.length; j++) {
              const a = G.nodes[i],
                b = G.nodes[j];
              let dx = a.x - b.x,
                dy = (a.y - b.y) * 1.25;
              const d = Math.max(12, Math.hypot(dx, dy)),
                f = (k * k) / d;
              dx = (dx / d) * f;
              dy = (dy / d) * f;
              a.dx += dx;
              a.dy += dy;
              b.dx -= dx;
              b.dy -= dy;
            }
          G.links.forEach((l) => {
            const a = N(l.source),
              b = N(l.target);
            let dx = a.x - b.x,
              dy = a.y - b.y;
            const d = Math.max(12, Math.hypot(dx, dy)),
              f = ((d * d) / k) * (0.2 + 0.07 * Math.min(4, weight(l)));
            dx = (dx / d) * f;
            dy = (dy / d) * f;
            a.dx -= dx;
            a.dy -= dy;
            b.dx += dx;
            b.dy += dy;
          });
          G.nodes.forEach((n) => {
            if (!isFree(n)) return;
            n.dx += (W / 2 - n.x) * (W > H ? 0.012 : 0.03);
            n.dy += (H / 2 - 20 - n.y) * 0.03;
            const m = Math.hypot(n.dx, n.dy) || 1,
              s = Math.min(m, t) / m;
            n.x += n.dx * s;
            n.y += n.dy * s;
            clamp(n, W, H);
          });
          t *= 0.985;
        }
        // items pushed against an edge would sit in a straight row, with strings running through one another: stagger them
        [(n) => n.y <= TOP + 1, (n) => n.y >= H - n.h - BOTTOM - 1].forEach((edge, side) => {
          free
            .filter(edge)
            .sort((a, b) => a.x - b.x)
            .forEach((n, i) => {
              if (i % 2) n.y += (side ? -1 : 1) * Math.min(44, H * 0.07);
            });
        });
        [(n) => n.x <= n.w / 2 + PAD + 1, (n) => n.x >= W - n.w / 2 - PAD - 1].forEach((edge, side) => {
          free
            .filter(edge)
            .sort((a, b) => a.y - b.y)
            .forEach((n, i) => {
              if (i % 2) n.x += (side ? -1 : 1) * Math.min(40, W * 0.06);
            });
        });
        separate(W, H, S.pinsSet ? isFree : () => true);
        if (touching()) separate(W, H, () => true);
      };
      // How hard is this arrangement to read? Count strings crossing each other, strings running behind an item they
      // do not belong to, and strings leaving one pin at nearly the same angle (they read as one string).
      const cross = (a, b, c, d) => {
        const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
        return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
      };
      const behind = (a, b, n) => {
        const x0 = n.x - n.w / 2 - 4,
          x1 = n.x + n.w / 2 + 4,
          y0 = n.y - 10,
          y1 = n.y + n.h;
        let t0 = 0,
          t1 = 1;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        for (const [p, q] of [
          [-dx, a.x - x0],
          [dx, x1 - a.x],
          [-dy, a.y - y0],
          [dy, y1 - a.y],
        ]) {
          if (p === 0) {
            if (q < 0) return false;
          } else {
            const r = q / p;
            if (p < 0) {
              if (r > t1) return false;
              if (r > t0) t0 = r;
            } else {
              if (r < t0) return false;
              if (r < t1) t1 = r;
            }
          }
        }
        return t1 - t0 > 0.02;
      };
      const score = () => {
        let sc = 0;
        const L = G.links.map((l) => [N(l.source), N(l.target)]);
        for (let i = 0; i < L.length; i++) {
          const [a, b] = L[i];
          G.nodes.forEach((n) => {
            if (n !== a && n !== b && behind(a, b, n)) sc += 3;
          });
          if (
            Math.hypot(a.x - b.x, a.y - b.y) < Math.min(170, W * 0.3) ||
            (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < Math.max(a.h, b.h) + 40)
          )
            sc += 2;
          for (let j = i + 1; j < L.length; j++) {
            const [c, d] = L[j];
            if (a !== c && a !== d && b !== c && b !== d) {
              if (cross(a, b, c, d)) sc += 1;
              continue;
            }
            const hub = a === c || a === d ? a : b,
              p = hub === a ? b : a,
              q = hub === c ? d : c;
            let an = Math.abs(Math.atan2(p.y - hub.y, p.x - hub.x) - Math.atan2(q.y - hub.y, q.x - hub.x));
            if (an > Math.PI) an = 2 * Math.PI - an;
            if (an < 0.14) sc += 3;
          }
        }
        return sc;
      };
      let best = null;
      for (let a = 0, tries = held.length ? 6 : 36; a < tries; a++) {
        const slots = [...order];
        if (a)
          for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
          }
        attempt(slots);
        const sc = score();
        if (!best || sc < best.sc) best = { sc, at: G.nodes.map((n) => [n.x, n.y]) };
        if (!sc) break;
      }
      G.nodes.forEach((n, i) => {
        [n.x, n.y] = best.at[i];
      });
    }
    G.nodes.forEach((n) => {
      S.pins[n.id] = { x: n.x / W, y: n.y / H };
    });
    S.pinsSet = true;
    draw();
  }
  function reflow() {
    // the board changed size: keep each pin's place in proportion, then clear any touching
    const W = surface.clientWidth,
      H = surface.clientHeight;
    if (!W || !H || !G.nodes.length) return;
    G.nodes.forEach((n) => {
      const p = S.pins[n.id];
      n.w = el[n.id].offsetWidth;
      n.h = el[n.id].offsetHeight;
      n.x = p.x * W;
      n.y = p.y * H;
      clamp(n, W, H);
    });
    separate(W, H, () => true);
    draw();
  }
  // Put every pin and string where the layout says it is.
  function draw() {
    G.nodes.forEach((n) => {
      const b = el[n.id];
      b.hidden = !shown(n);
      b.style.transform = `translate(${n.x}px,${n.y}px) translate(-50%,-6px) rotate(${n.tilt}deg)`;
    });
    G.links.forEach((l) => {
      const g = lineEl[l.key],
        a = N(l.source),
        b = N(l.target),
        vis = linkShown(l);
      g.style.display = bdEl[l.key].style.display = vis ? "" : "none";
      if (!vis) return;
      g.querySelectorAll("line").forEach((x) => {
        x.setAttribute("x1", a.x);
        x.setAttribute("y1", a.y);
        x.setAttribute("x2", b.x);
        x.setAttribute("y2", b.y);
      });
      g.style.setProperty("--len", Math.ceil(Math.hypot(a.x - b.x, a.y - b.y)) + 2);
      // the number sits at the middle of the thread, or slides along it when a pinned item is in the way
      const under = (x, y) =>
        G.nodes.some((n) => shown(n) && Math.abs(x - n.x) < n.w / 2 + 11 && y > n.y - 16 && y < n.y + n.h + 9);
      const t =
        [0.5, 0.4, 0.6, 0.32, 0.68, 0.25, 0.75].find((t) => !under(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) ||
        0.5;
      bdEl[l.key].setAttribute("transform", `translate(${a.x + (b.x - a.x) * t},${a.y + (b.y - a.y) * t})`);
    });
  }
  function drag(b, n) {
    let start = null,
      moved = false;
    b.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      start = { x: e.clientX, y: e.clientY, nx: n.x, ny: n.y };
      moved = false;
      b.setPointerCapture(e.pointerId);
    });
    b.addEventListener("pointermove", (e) => {
      if (!start) return;
      const dx = e.clientX - start.x,
        dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      moved = true;
      n.x = start.nx + dx;
      n.y = start.ny + dy;
      clamp(n, surface.clientWidth, surface.clientHeight);
      draw();
    });
    const end = () => {
      if (!start) return;
      start = null;
      if (moved) S.pins[n.id] = { x: n.x / surface.clientWidth, y: n.y / surface.clientHeight };
    };
    b.addEventListener("pointerup", end);
    b.addEventListener("pointercancel", end);
    b.addEventListener("click", (e) => {
      if (moved) {
        moved = false;
        e.preventDefault();
        return;
      }
      select({ node: n.id });
    });
  }

  // ---------- highlighting and selecting ----------
  // Light up what is pointed at or selected, and everything joined to it.
  function paint() {
    const f = hover || sel,
      nodes = new Set(),
      links = new Set();
    if (f && f.node) {
      nodes.add(f.node);
      G.links.forEach((l) => {
        if (linkShown(l) && (l.source === f.node || l.target === f.node)) {
          links.add(l.key);
          nodes.add(l.source);
          nodes.add(l.target);
        }
      });
    }
    if (f && f.link) {
      const l = G.links.find((x) => x.key === f.link);
      if (l) {
        links.add(l.key);
        nodes.add(l.source);
        nodes.add(l.target);
      }
    }
    if (f && f.ev) {
      G.nodes.forEach((n) => {
        if (n.evidence.includes(f.ev)) nodes.add(n.id);
      });
      G.links.forEach((l) => {
        if (l.evidence.includes(f.ev) || l.xrefs.some((x) => x.ev.includes(f.ev))) links.add(l.key);
      });
    }
    surface.classList.toggle("focus", !!f);
    G.nodes.forEach((n) => {
      el[n.id].classList.toggle("lit", nodes.has(n.id));
      el[n.id].classList.toggle("sel", !!sel && sel.node === n.id);
    });
    G.links.forEach((l) =>
      [lineEl[l.key], bdEl[l.key]].forEach((x) => {
        x.classList.toggle("lit", links.has(l.key));
        x.classList.toggle("sel", !!sel && sel.link === l.key);
      }),
    );
  }
  function select(v) {
    sel = v;
    if (v) showAll = false;
    hover = null;
    tip.hidden = true;
    renderPanel();
    paint();
    if (v && matchMedia("(max-width:860px)").matches) {
      // on a phone the card is a sheet at the bottom: bring what was picked into view above it
      const r = (v.node ? el[v.node] : bdEl[v.link]).getBoundingClientRect();
      board.scrollBy({
        top: r.top + r.height / 2 - innerHeight * 0.24,
        behavior: reducedMotion() ? "auto" : "smooth",
      });
    }
  }
  function closeCard() {
    showAll = false;
    select(null);
  }
  function openAll(form) {
    sel = null;
    showAll = true;
    renderPanel();
    paint();
    if (form) {
      const d = document.getElementById("pbAdd");
      d.open = true;
      document.getElementById("pbT").focus({ preventScroll: true });
    }
  }

  // ---------- the card: what is behind a string or a pin, or the list of all evidence ----------
  const chip = (label, type, mark) => `<i class="${mark ? "mk" : ""}">${ICON[type]}${esc(label)}</i>`;
  function evItem(e, mark, removable) {
    const m = (x) => mark && mark.includes(x.toLowerCase());
    return `<li data-e="${e.id}"><small>${esc(typeLabel(e.type))} / ${esc(e.date)}</small><strong>${esc(e.title)}</strong>${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${e.notes ? `<p class="nt"><b>Note</b>${esc(e.notes)}</p>` : ""}
   <span class="chips">${e.people.map((x) => chip(x, "person", m(x))).join("")}${e.places.map((x) => chip(x, "place", m(x))).join("")}${e.objects.map((x) => chip(x, "object", m(x))).join("")}</span>
   ${removable ? `<button type="button" class="rm" data-rm="${e.id}" aria-label="Remove ${esc(e.title)} from the board">×</button>` : ""}</li>`;
  }
  function renderPanel() {
    // the card only exists while a string or a pinned item is selected, or the evidence list was asked for
    const evBtn = document.getElementById("pbEvBtn");
    evBtn.setAttribute("aria-expanded", showAll && !sel);
    if (!sel && !showAll) {
      panel.hidden = true;
      panel.textContent = "";
      board.classList.remove("card-open");
      return;
    }
    const back = '<button type="button" class="pb-close" id="pbClose" aria-label="Close">×</button>';
    let h;
    if (sel && sel.link) {
      const l = G.links.find((x) => x.key === sel.link),
        a = N(l.source),
        b = N(l.target),
        mark = [a.label.toLowerCase(), b.label.toLowerCase()],
        n = l.evidence.length;
      h =
        back +
        `<div class="pb-k">Link</div><h3>${esc(a.label)} <i>&harr;</i> ${esc(b.label)}</h3>
    <p class="pb-sum">${n ? `Appear together in <b>${n}</b> ${n === 1 ? "piece" : "pieces"} of evidence` : "Do not appear together in any single piece of evidence"}${l.xrefs.length ? (n ? ", and are also tied by a cross-reference" : ", but are tied by a cross-reference") : ""}.</p>
    ${n ? `<div class="pb-sep"></div><div class="pb-k">Supporting evidence</div><ol class="pb-ev">${l.evidence.map((id) => evItem(EV(id), mark)).join("")}</ol>` : ""}
    ${l.xrefs.map((x) => `<div class="pb-sep"></div><div class="pb-k">Cross-reference</div><div class="pb-x"><p>${esc(x.note)}</p>Read together:</div><ol class="pb-ev" style="margin-top:8px">${x.ev.map((id) => evItem(EV(id), mark)).join("")}</ol>`).join("")}`;
    } else if (sel && sel.node) {
      const n = N(sel.node),
        mark = [n.label.toLowerCase()],
        ls = G.links
          .filter((l) => linkShown(l) && (l.source === n.id || l.target === n.id))
          .sort((x, y) => weight(y) - weight(x));
      h =
        back +
        `<div class="pb-k">${WORD[n.type]}</div><h3>${esc(n.label)}</h3>
    <p class="pb-sum">In <b>${n.evidence.length}</b> ${n.evidence.length === 1 ? "piece" : "pieces"} of evidence, connected to <b>${ls.length}</b> other ${ls.length === 1 ? "pin" : "pins"}.</p>
    <div class="pb-sep"></div><div class="pb-k">Connected to</div><ul class="pb-nb">${
      ls
        .map((l) => {
          const o = N(l.source === n.id ? l.target : l.source);
          return `<li><button type="button" data-link="${esc(l.key)}">${ICON[o.type]}${esc(o.label)}<em>${l.evidence.length ? l.evidence.length + " shared" : "cross-ref"}</em></button></li>`;
        })
        .join("") || '<li class="pb-hint">Nothing yet.</li>'
    }</ul>
    <div class="pb-sep"></div><div class="pb-k">Appears in</div><ol class="pb-ev">${n.evidence.map((id) => evItem(EV(id), mark)).join("")}</ol>`;
    } else {
      const c = (t) => G.nodes.filter((n) => n.type === t).length;
      h =
        back +
        `<div class="pb-k">This board</div>
    ${S.evidence.length ? "" : '<p class="pb-sum">Nothing is pinned to this board yet.</p>'}
    <p class="pb-sum"${S.evidence.length ? "" : " hidden"}><b>${c("person")}</b> ${c("person") === 1 ? "person" : "people"}, <b>${c("place")}</b> ${c("place") === 1 ? "place" : "places"} and <b>${c("object")}</b> ${c("object") === 1 ? "object" : "objects"}, joined by <b>${G.links.length}</b> ${G.links.length === 1 ? "string" : "strings"} drawn from <b>${S.evidence.length}</b> ${S.evidence.length === 1 ? "piece" : "pieces"} of evidence.</p>
    <p class="pb-hint"${S.evidence.length ? "" : " hidden"}>Select a string to see which evidence ties two things together, or a pinned item to see everything it touches. Items can be dragged.</p>
    <div class="pb-k">Evidence on this board</div>
    ${S.evidence.length ? `<ol class="pb-ev">${S.evidence.map((e) => evItem(e, null, true)).join("")}</ol>` : '<p class="pb-hint">No evidence yet.</p>'}
    <details class="pb-add" id="pbAdd"${S.evidence.length ? "" : " open"}><summary>Add evidence</summary>
     <form id="pbForm" novalidate>
      <label>Title<input id="pbT" maxlength="60" autocomplete="off" placeholder="e.g. Statement of the cloakroom attendant"></label>
      <label>Type<select id="pbK">${[...FILE_TYPES, ...CUSTOM_TYPES.map((t) => t.id)].map((t) => `<option value="${esc(t)}">${esc(typeLabel(t))}</option>`).join("")}</select></label>
      <label>People in it<input id="pbP" maxlength="120" autocomplete="off" placeholder="Names, separated by commas"></label>
      <label>Places in it<input id="pbL" maxlength="120" autocomplete="off" placeholder="Separated by commas"></label>
      <label>Objects in it<input id="pbO" maxlength="120" autocomplete="off" placeholder="Separated by commas"></label>
      <div class="err" id="pbErr" role="alert"></div>
      <button type="submit" class="go">Pin to board</button>
     </form></details>`;
    }
    panel.innerHTML = h;
    panel.scrollTop = 0;
    panel.hidden = false;
    board.classList.add("card-open");
    // sit on the side away from what was selected, so the card never covers it
    let cx = 0;
    if (sel && sel.node) cx = N(sel.node).x;
    else if (sel && sel.link) {
      const l = G.links.find((x) => x.key === sel.link);
      cx = (N(l.source).x + N(l.target).x) / 2;
    }
    panel.classList.toggle("left", !!sel && cx > surface.clientWidth * 0.52);
    document.getElementById("pbClose").onclick = closeCard;
    panel.querySelectorAll("[data-link]").forEach((b) => (b.onclick = () => select({ link: b.dataset.link })));
    panel.querySelectorAll(".pb-ev li").forEach((li) => {
      li.addEventListener("pointerenter", () => {
        hover = { ev: li.dataset.e };
        paint();
      });
      li.addEventListener("pointerleave", () => {
        hover = null;
        paint();
      });
    });
    panel.querySelectorAll("[data-rm]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.rm,
            gone = S.evidence.find((e) => e.id === id);
          if (gone && gone.backendEvidenceId) deleteEvidenceApi(gone.backendEvidenceId);
          S.evidence = S.evidence.filter((e) => e.id !== id);
          S.xrefs = S.xrefs.filter((x) => !x.ev.includes(id));
          hover = null;
          build();
        }),
    );
    const form = document.getElementById("pbForm");
    if (form)
      form.onsubmit = (e) => {
        e.preventDefault();
        const list = (id) =>
            [...new Set(document.getElementById(id).value.split(",").map(tidy).filter(Boolean))].slice(0, 8),
          title = document.getElementById("pbT").value.trim(),
          err = document.getElementById("pbErr"),
          people = list("pbP"),
          places = list("pbL"),
          objects = list("pbO");
        if (!title) {
          err.textContent = "Give the evidence a title.";
          document.getElementById("pbT").focus();
          return;
        }
        if (!people.length && !places.length && !objects.length) {
          err.textContent = "Name at least one person, place or object in it.";
          document.getElementById("pbP").focus();
          return;
        }
        // reuse the spelling already on the board, so "julian vane" joins the existing Julian Vane pin
        const same = (x, t) => {
          const n = G.nodes.find((n) => n.type === t && n.label.toLowerCase() === x.toLowerCase());
          return n ? n.label : x;
        };
        S.evidence.push({
          id: nextEvidenceId(S),
          type: document.getElementById("pbK").value,
          date: longToday(),
          title,
          summary: "",
          notes: "",
          people: people.map((x) => same(x, "person")),
          places: places.map((x) => same(x, "place")),
          objects: objects.map((x) => same(x, "object")),
        });
        build();
      };
  }

  // ---------- opening and closing ----------
  function open(folder) {
    outT.forEach(clearTimeout);
    closing = false;
    surface.classList.remove("pb-outro");
    fo = folder;
    S = folderState(fo);
    sel = null;
    hover = null;
    showAll = false;
    off = new Set();
    board.classList.remove("card-open");
    board.scrollTop = 0;
    opener = document.activeElement;
    const c = CM[fo.label];
    document.getElementById("pbKick").textContent = "Pin board" + (c ? " / Case file " + c.cf : "");
    document.getElementById("pbTitle").textContent = fo.label;
    board.hidden = false;
    build();
    intro();
    requestAnimationFrame(() => {
      board.classList.add("on");
      document.getElementById("pbBack").focus({ preventScroll: true });
    });
  }
  let introT = 0;
  function intro() {
    // items go up left to right; strings follow, strongest first
    clearTimeout(introT);
    surface.classList.remove("pb-intro");
    if (reducedMotion()) return;
    const order = [...G.nodes].sort((a, b) => a.x - b.x),
      gap = Math.min(70, 600 / Math.max(1, order.length));
    order.forEach((n, i) => el[n.id].style.setProperty("--pd", Math.round(430 + i * gap) + "ms"));
    const base = 430 + order.length * gap + 200,
      ls = [...G.links].sort((a, b) => weight(b) - weight(a)),
      step = Math.min(30, 600 / Math.max(1, ls.length));
    ls.forEach((l, i) => {
      const d = Math.round(base + i * step) + "ms";
      lineEl[l.key].style.setProperty("--sd", d);
      bdEl[l.key].style.setProperty("--sd", d);
    });
    void surface.offsetWidth;
    surface.classList.add("pb-intro");
    introT = setTimeout(() => surface.classList.remove("pb-intro"), base + ls.length * step + 1000);
  }
  let closing = false,
    outT = [];
  function closeBoard() {
    if (closing) return;
    closing = true;
    clearTimeout(introT);
    surface.classList.remove("pb-intro");
    tip.hidden = true;
    showAll = false;
    sel = null;
    hover = null;
    renderPanel();
    paint();
    const still = reducedMotion();
    let lift = 0;
    if (!still) {
      // strings come out weakest first, then the items come down right to left, then the board lifts away
      const ls = [...G.links].sort((a, b) => weight(a) - weight(b)),
        step = Math.min(14, 240 / Math.max(1, ls.length));
      ls.forEach((l, i) => lineEl[l.key].style.setProperty("--sd", Math.round(i * step) + "ms"));
      const strings = ls.length ? ls.length * step + 300 : 0,
        order = [...G.nodes].sort((a, b) => b.x - a.x),
        gap = Math.min(40, 300 / Math.max(1, order.length));
      const from = Math.max(0, strings - 140);
      order.forEach((n, i) => el[n.id].style.setProperty("--pd", Math.round(from + i * gap) + "ms"));
      lift = order.length ? from + order.length * gap + 260 : 120;
      surface.style.setProperty("--bd", Math.round(lift) + "ms");
      void surface.offsetWidth;
      surface.classList.add("pb-outro");
    }
    const done = () => {
      board.hidden = true;
      closing = false;
      surface.classList.remove("pb-outro");
      nodesEl.textContent = "";
      svg.textContent = "";
      if (cur === fo) setTab(curTab, true); // the folder's evidence may have changed on the board
      const b = document.querySelector("#tabs .tb.board");
      (b || opener) && (b || opener).focus({ preventScroll: true });
    };
    outT = [
      setTimeout(() => board.classList.remove("on"), still ? 0 : lift + 140),
      setTimeout(done, still ? 0 : lift + 500),
    ];
  }
  document.getElementById("pbBack").onclick = closeBoard;
  document.getElementById("pbTidy").onclick = () => {
    layout(true);
    paint();
  };
  surface.addEventListener("click", (e) => {
    if (e.target === surface || e.target === svg || e.target === nodesEl) closeCard();
  });
  document.getElementById("pbEvBtn").onclick = () => {
    showAll && !sel ? closeCard() : openAll(false);
  };
  document.getElementById("pbEmptyAdd").onclick = () => openAll(true);
  // Escape steps back one level: selection first, then the board; it must not reach the folder underneath
  addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || board.hidden) return;
      e.stopImmediatePropagation();
      if (e.target.closest && e.target.closest("#pbAdd") && e.target.matches("input,select")) {
        e.target.blur();
        return;
      }
      sel || showAll ? closeCard() : closeBoard();
    },
    true,
  );
  if (window.ResizeObserver)
    new ResizeObserver(() => {
      if (!board.hidden && S) reflow();
    }).observe(surface);

  // The folder's evidence was reloaded from the backend while its board is open: draw the board again.
  function refresh(folder) {
    if (board.hidden || closing || folder !== fo) return;
    S = folderState(fo);
    sel = null;
    hover = null;
    build();
  }

  return { open, refresh };
})();
