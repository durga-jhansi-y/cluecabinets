// Signing in and locking, on the sign-in card that sits on the drawer face (the card itself is built in cabinet.js).
// To require one fixed login, set CREDS in config.js.

// card is the sign-in panel. It carries the state other scripts watch: class "ok" = signed in, "create" = making
// an account, "bad" = the last attempt was refused.
const card = document.querySelector(".login"),
  usr = document.getElementById("usr"),
  pwd = document.getElementById("pwd"),
  nam = document.getElementById("nam"),
  go = document.getElementById("go"),
  ttl = document.getElementById("ttl"),
  btn = document.getElementById("btn");
let locked = true,
  badTimer = 0;
// Refuse an attempt: shake the card and say why for a moment.
function deny(msg) {
  ttl.textContent = msg;
  card.classList.remove("bad");
  void card.offsetWidth;
  card.classList.add("bad");
  clearTimeout(badTimer);
  badTimer = setTimeout(() => {
    card.classList.remove("bad");
    ttl.textContent = "SECURE ACCESS";
  }, 1600);
}
function setLocked(v) {
  locked = v;
  card.classList.toggle("ok", !v);
  if (v) {
    usr.value = "";
    pwd.value = "";
    nam.value = "";
  }
  btn.textContent = v ? "Sign in on the drawer" : "Lock cabinet";
}
// Check the form, then load that account's cabinets and fling the drawer open.
function tryUnlock() {
  const u = usr.value.trim(),
    p = pwd.value,
    creating = card.classList.contains("create");
  if (creating && !nam.value.trim()) {
    deny("ENTER YOUR NAME");
    nam.focus();
    return;
  }
  if (!u) {
    deny("ENTER YOUR EMAIL");
    usr.focus();
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(u)) {
    deny("CHECK THE EMAIL ADDRESS");
    usr.focus();
    return;
  }
  if (!p) {
    deny("ENTER PASSWORD");
    pwd.focus();
    return;
  }
  if (p.length < 8) {
    deny("PASSWORD NEEDS 8 CHARACTERS");
    pwd.focus();
    return;
  }
  if (CREDS && !creating && (u !== CREDS.user || p !== CREDS.pass)) {
    deny("ACCESS DENIED");
    pwd.value = "";
    pwd.focus();
    return;
  }
  loadWorkspace(u.toLowerCase(), creating);
  setLocked(false);
  usr.blur();
  pwd.blur();
  nam.blur();
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = 0;
  } else fling(); // signing straight back in: the drawer never got to shut
}

// ---------- locking ----------
// Locking: the drawer waits to shut until the cabinet is back on screen, so it is seen sliding in (the unlock in reverse).
const CLOSE_WAIT = 640;
let closeTimer = 0;
function lockCabinet() {
  saveWorkspace();
  setLocked(true);
  closeTimer = setTimeout(
    () => {
      closeTimer = 0;
      fling();
    },
    reducedMotion() ? 0 : CLOSE_WAIT,
  );
}
// The lock button and the drawer front do the same thing: lock when signed in, otherwise point at the form.
function lockOrPrompt() {
  if (locked) {
    deny("SIGN IN FIRST");
    (usr.value ? pwd : usr).focus();
  } else lockCabinet();
}

// ---------- wiring ----------
go.addEventListener("click", tryUnlock);
[usr, pwd, nam].forEach((el) =>
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryUnlock();
  }),
);
drawer.g.addEventListener("click", (e) => {
  if (!e.target.closest("input,button,label")) lockOrPrompt();
});
btn.onclick = lockOrPrompt;

// ---------- Sign in / Create account tabs ----------
const tabIn = document.getElementById("tabIn"),
  tabNew = document.getElementById("tabNew"),
  nameRow = card.querySelector(".f-name");
function setMode(create) {
  card.classList.toggle("create", create);
  nameRow.hidden = !create;
  tabIn.classList.toggle("active", !create);
  tabNew.classList.toggle("active", create);
  tabIn.setAttribute("aria-selected", !create);
  tabNew.setAttribute("aria-selected", create);
  document.getElementById("loginTitle").textContent = create ? "Open a new archive" : "Unlock your archive";
  document.getElementById("goText").textContent = create ? "Create cabinet" : "Unlock drawer";
}
tabIn.onclick = () => setMode(false);
tabNew.onclick = () => setMode(true);
