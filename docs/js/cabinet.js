// The 3D cabinet: the shell, its trim, the drawer with its sign-in face and folders, and the spring that moves it.
// Everything here is built from flat <div> faces placed with CSS 3D transforms. Sizes are in scene pixels.

// ---------- building blocks ----------
const W = document.getElementById("world"),
  ST = document.getElementById("stage");
function face(p, w, h, tf, bg, extra) {
  const e = document.createElement("div");
  e.className = "f";
  e.style.cssText = `width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px;background:${bg};transform:${tf};${extra || ""}`;
  p.appendChild(e);
  return e;
}
function box(p, w, h, d, c) {
  // 6-face box centred at origin
  face(p, w, h, `translateZ(${d / 2}px)`, c);
  face(p, w, h, `rotateY(180deg) translateZ(${d / 2}px)`, c);
  face(p, d, h, `rotateY(90deg) translateZ(${w / 2}px)`, c);
  face(p, d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, c);
  face(p, w, d, `rotateX(90deg) translateZ(${h / 2}px)`, c);
  face(p, w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, c);
}

// ---------- the cabinet shell (open at the front; the dark cavity shows behind the drawer) ----------
const cab = document.createElement("div");
cab.className = "d3";
W.appendChild(cab);
const BW = 240,
  BH = 150,
  BD = 300;
face(cab, BW, BH, `translateZ(${-BD / 2}px)`, "#0f3035");
face(cab, BD, BH, `rotateY(90deg) translateZ(${BW / 2}px)`, "linear-gradient(90deg,#28565D,#1b444b)");
face(cab, BD, BH, `rotateY(-90deg) translateZ(${BW / 2}px)`, "#1b444b");
face(cab, BW, BD, `rotateX(90deg) translateZ(${BH / 2}px)`, "linear-gradient(#2B6E7C,#27616d)");
face(cab, BW, BD, `rotateX(-90deg) translateZ(${BH / 2}px)`, "#0b2428");
face(cab, BW, BH, `translateZ(${BD / 2 - 2}px)`, "#071516");
cab.querySelectorAll(":scope>.f").forEach((e) => {
  e.style.pointerEvents = "none";
}); // the shell never needs the mouse

// ---------- trim: an overhanging top lip, a plinth and two feet ----------
function trim(w, h, d, y, x, z, front, top) {
  const t = document.createElement("div");
  t.className = "d3";
  t.style.transform = `translate3d(${x}px,${y}px,${z}px)`;
  cab.appendChild(t);
  box(t, w, h, d, "#17393f");
  const fc = t.children;
  fc[0].style.background = front;
  fc[4].style.background = top;
  [...fc].forEach((e) => {
    e.style.pointerEvents = "none";
  });
  return t;
}
trim(
  BW + 10,
  7,
  BD + 8,
  -BH / 2 - 3.5,
  0,
  0,
  "linear-gradient(#3b7c88,#28565D)",
  "linear-gradient(#2f6772,#2B6E7C)",
).children[0].insertAdjacentHTML(
  "beforeend",
  '<i style="position:absolute;left:15%;right:15%;top:1.5px;height:1px;background:linear-gradient(90deg,transparent,#d3e3e366,transparent)"></i>',
);
trim(BW + 12, 6, BD + 6, BH / 2 + 3, 0, 0, "linear-gradient(#23545c,#0d2a2f)", "#1b444b");
trim(24, 8, BD - 16, BH / 2 + 10, -(BW / 2 - 18), 0, "#0b2226", "#0b2226");
trim(24, 8, BD - 16, BH / 2 + 10, BW / 2 - 18, 0, "#0b2226", "#0b2226");

// ---------- the drawer: tray, front panel with the sign-in card, and one folder per case file ----------
function buildDrawer() {
  const g = document.createElement("div");
  g.className = "d3";
  cab.appendChild(g);
  const inner = document.createElement("div");
  inner.className = "d3";
  g.appendChild(inner);
  const TW = 212,
    TH = 110,
    TD = 270,
    z0 = BD / 2 - TD / 2; // tray centre z when closed
  const tray = document.createElement("div");
  tray.className = "d3";
  tray.style.transform = `translateZ(${z0 - 6}px)`;
  inner.appendChild(tray);
  const shade = "#173c42";
  face(tray, TW, TH, `translateZ(${-TD / 2}px)`, shade);
  face(tray, TD, TH, `rotateY(90deg) translateZ(${TW / 2}px)`, "#235058");
  face(tray, TD, TH, `rotateY(-90deg) translateZ(${TW / 2}px)`, "#1b444b");
  face(tray, TW, TD, `rotateX(-90deg) translateZ(${TH / 2}px)`, "#0f2e33");
  tray.querySelectorAll(":scope>.f").forEach((e) => {
    e.style.pointerEvents = "none";
  });
  // front panel
  const fp = document.createElement("div");
  fp.className = "d3";
  fp.style.transform = `translateZ(${BD / 2}px)`;
  inner.appendChild(fp);
  box(fp, BW - 10, 140, 6, "#1e474e");
  const pull = face(
    fp,
    52,
    10,
    "translateZ(6px) translateY(60px)",
    "linear-gradient(#0d2a2f,#071516)",
    "box-sizing:border-box;border:2px solid #7fb8c0;border-top:3px solid #2B6E7C;border-radius:1.5px 1.5px 8px 8px;box-shadow:0 2px 3px #000a",
  );
  pull.innerHTML =
    '<i style="position:absolute;left:7px;right:7px;bottom:1px;height:1px;background:linear-gradient(90deg,#2B6E7C,#d3e3e3,#2B6E7C)"></i>';
  // the whole drawer face is the sign-in panel: laid out at 920x560 and shown at quarter scale
  const card = face(
    fp,
    920,
    560,
    "translateZ(3.3px) scale(.25)",
    "radial-gradient(circle at 35% 15%,rgba(255,255,255,.08),transparent 36%),linear-gradient(155deg,#34707b,#28565D 48%,#1e474e)",
    "",
  );
  card.classList.add("login");
  card.innerHTML =
    '<div class="in"><div class="drawer-login-heading"><span class="ttl" id="ttl">SECURE ACCESS</span><strong id="loginTitle">Unlock your archive</strong></div>' +
    '<div class="auth-tabs" role="tablist" aria-label="Account access"><button id="tabIn" class="active" role="tab" aria-selected="true" type="button">Sign in</button><button id="tabNew" role="tab" aria-selected="false" type="button">Create account</button></div>' +
    '<div class="drawer-form">' +
    '<label class="f-name" hidden><span>Full name</span><input id="nam" type="text" placeholder="Your full name" autocomplete="off" spellcheck="false"></label>' +
    '<label class="f-mail"><span>Email address</span><input id="usr" type="email" placeholder="name@organization.com" autocomplete="off" spellcheck="false"></label>' +
    '<label class="f-pass"><span>Password</span><input id="pwd" type="password" placeholder="At least 8 characters" autocomplete="off"></label>' +
    '<button class="go" id="go" type="button"><span id="goText">Unlock drawer</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7l5 5-5 5"/></svg></button>' +
    "</div></div>" +
    '<div class="grant"><small id="grantSmall">Access granted / Cabinet 01</small><strong id="grantName">Active cases</strong></div>';
  // folders (front of the drawer = slot 0; the "+ New folder" folder is always last, at the back)
  const folders = [];
  let made = 0;
  function relayout(snap) {
    const sp = Math.min(28, (TD - 60) / Math.max(1, folders.length));
    folders.forEach((fo, k) => {
      fo.k = k;
      fo.zt = z0 + TD / 2 - 26 - k * sp;
      if (snap) fo.z = fo.zt;
    });
  }
  function makeFolder(spec, front) {
    const f = document.createElement("div");
    f.className = "d3 fold";
    const pivot = document.createElement("div");
    pivot.className = "d3";
    f.appendChild(pivot);
    const c = spec.color,
      white = spec.white,
      n = spec.n,
      ink = FOLDER_INK;
    const bg = spec.isAdd
      ? "linear-gradient(#c9dbda,#c9dbda 75%,#0000001c)"
      : `linear-gradient(${c},${c} 75%,#0000001c)`;
    const sheet = face(
      pivot,
      204,
      90,
      "translateY(-45px)",
      bg,
      "border-radius:2px 2px 0 0;box-shadow:inset 0 0 0 1px #0002" +
        (spec.isAdd ? ";border:2px dashed #2B6E7C;box-sizing:border-box" : ""),
    );
    const tab = document.createElement("div");
    tab.style.cssText = white
      ? `position:absolute;top:-16px;right:${spec.isAdd ? 14 : 10 + ((n * 37) % 50)}px;width:${spec.isAdd ? 98 : 78}px;height:18px;background:#e6eeec;border:1px solid #0003;font:600 10px var(--sans);letter-spacing:.03em;color:#071516;text-align:center;line-height:17px;box-sizing:border-box;padding:0 4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis`
      : `position:absolute;top:-16px;left:${4 + ((n * 29) % 44)}px;width:118px;height:18px;background:${c};border-radius:3px 3px 0 0;font:600 10px var(--sans);letter-spacing:.03em;color:${ink};text-align:center;line-height:19px;box-shadow:inset 0 0 0 1px #0002;overflow:hidden;white-space:nowrap`;
    tab.textContent = spec.tab || spec.label;
    sheet.appendChild(tab);
    face(pivot, 204, 90, "translateY(-45px) translateZ(-3px)", "#0000001a");
    inner.appendChild(f);
    const fo = {
      pivot,
      sheet,
      el: f,
      t: 0,
      v: 0,
      k: 0,
      z: 0,
      zt: 0,
      zs: -999,
      label: spec.label,
      tab: spec.tab,
      color: c,
      ink,
      white,
      isAdd: !!spec.isAdd,
    };
    if (front) folders.unshift(fo);
    else folders.push(fo);
    return fo;
  }
  [...CASES]
    .reverse()
    .forEach((c, i) => makeFolder({ label: c.title, tab: c.cf, color: FOLDER_COLOR, white: false, n: i }));
  makeFolder({ label: "+ New case file", color: "#a9c9cc", white: true, isAdd: true, n: 99 });
  relayout(true);
  function addFolder(label) {
    // new folders drop in at the front of the drawer
    const n = CASES.length + made++;
    const fo = makeFolder({ label, tab: CM[label] && CM[label].cf, color: FOLDER_COLOR, white: false, n }, true);
    relayout(false);
    fo.z = fo.zt;
    return fo;
  }
  // Take a folder out of the drawer for good. The "+ New case file" folder cannot be removed.
  function removeFolder(fo) {
    const at = folders.indexOf(fo);
    if (at < 0 || fo.isAdd) return;
    folders.splice(at, 1);
    fo.el.remove();
    relayout(false);
  }
  // pos runs from 0 (shut) to 1 (fully open); target is where the spring is pulling it
  return { g, inner, pos: 0, vel: 0, target: 0, prevVel: 0, folders, addFolder, removeFolder };
}
const drawer = buildDrawer();

// ---------- motion: a damped spring pulls the drawer to open or shut, and the camera follows ----------
const PULL = 240, // how far the drawer travels, in scene pixels
  K = 40, // spring stiffness
  C = 8; // damping. Lower K = a slower drawer.
let viewS = 0,
  jolt = 0,
  joltV = 0,
  last = performance.now();
// Open the drawer if it is shut, shut it if it is open.
function fling() {
  const opening = drawer.target === 0;
  drawer.target = opening ? 1 : 0;
  drawer.vel += opening ? 4 : -4; // the fling impulse
}
// Move everything on by dt seconds.
function step(dt) {
  const d = drawer;
  const a = (d.target - d.pos) * K - d.vel * C;
  d.vel += a * dt;
  d.pos += d.vel * dt;
  if (d.pos > 1) {
    d.pos = 1;
    if (d.vel > 0.6) joltV += d.vel * 40;
    d.vel = -d.vel * 0.38;
  }
  if (d.pos < 0) {
    d.pos = 0;
    if (d.vel < -0.6) joltV -= d.vel * -40;
    d.vel = -d.vel * 0.3;
  }
  const acc = (d.vel - d.prevVel) / dt;
  d.prevVel = d.vel;
  d.inner.style.transform = `translateZ(${d.pos * PULL}px)`;
  d.folders.forEach((f) => {
    // folders lean with the drawer's motion and lag behind it (inertia)
    const want = Math.max(
      -8,
      Math.min(
        24,
        5 + d.pos * 14 + Math.max(-9, Math.min(9, acc * 0.004)) + (f.k % 2 ? 1 : -1) * Math.abs(d.vel) * 0.5,
      ),
    );
    const fa = (want - f.t) * Math.max(90, 260 - f.k * 14) - f.v * (7 + f.k * 0.4);
    f.v += fa * dt;
    f.t += f.v * dt;
    f.pivot.style.transform = `rotateX(${f.t}deg)`;
    f.z += (f.zt - f.z) * Math.min(1, dt * 9);
    if (Math.abs(f.z - f.zs) > 0.01) {
      f.zs = f.z;
      f.el.style.transform = `translate3d(0,52px,${f.z}px)`;
    }
  });
  // the camera: it tips further over the drawer the further the drawer is open
  viewS += (d.pos - viewS) * Math.min(1, dt * 5);
  const vv = Math.max(0, Math.min(1, viewS));
  const P = 1100,
    an = -8 - vv * 10,
    ar = (an * Math.PI) / 180,
    ca = Math.cos(ar),
    sa = Math.sin(ar);
  const y0 = -90,
    y1 = 90,
    z0 = -150,
    z1 = 156,
    xs = [],
    ys = []; // frame the closed cabinet; the opening drawer is allowed to come past the frame
  for (const x of [-125, 125])
    for (const y of [y0, y1])
      for (const z of [z0, z1]) {
        const yy = y * ca - z * sa,
          zz = y * sa + z * ca,
          k = P / (P - zz);
        xs.push(x * k);
        ys.push(yy * k);
      }
  const mnx = Math.min(...xs),
    mxx = Math.max(...xs),
    mny = Math.min(...ys),
    mxy = Math.max(...ys);
  const sc = Math.min((ST.clientWidth * 0.94) / (mxx - mnx), (ST.clientHeight * 0.94) / (mxy - mny), 3.2);
  ST.style.transform = `translate(${(-(mnx + mxx) / 2) * sc}px,${(-(mny + mxy) / 2) * sc}px) scale(${sc})`;
  W.style.transform = `rotateX(${an}deg)`;
  const ja = -jolt * 220 - joltV * 9;
  joltV += ja * dt;
  jolt += joltV * dt;
  cab.style.transform = `rotateZ(${jolt * 0.02}deg) translateZ(${jolt * -0.04}px)`;
}
// One animation frame, taken in four small steps so the spring stays stable. main.js starts it.
function loop(n) {
  const dt = Math.min(0.032, (n - last) / 1000);
  last = n;
  const sub = 4;
  for (let i = 0; i < sub; i++) step(dt / sub);
  requestAnimationFrame(loop);
}
