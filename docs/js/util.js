// Small helpers used by every other script.

// Make text safe to put inside HTML.
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Trim text and squeeze runs of spaces down to one.
const tidy = (t) => String(t).trim().replace(/\s+/g, " ");
// 3 -> "03"
const pad2 = (n) => String(n).padStart(2, "0");
// plural(1, "file") -> "1 file", plural(3, "file") -> "3 files"
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
// A file size in bytes as "340 KB" or "2.1 MB".
const fileSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
// Today as "2026-10-04" (local date, not UTC): used for sorting.
const isoToday = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
// Today as "4 October 2026": the date shown on new cases and new evidence.
const longToday = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
// True when the system asks for reduced motion: animations are skipped or shortened.
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
