// Which identifiers does the model bundle reference but never define?
//
// The slice list moved from desk-nrfi-backtest.js to nrfi-model-lib.js when the
// loader was shared. This file kept reading the old path and cheerfully reported
// "slices in backtest: 0 / referenced but NOT defined: (nothing)" — a clean bill
// of health from a checker that was no longer looking at anything. Hence the
// guard below: an empty slice list is a broken checker, not a healthy bundle.
const fs = require("fs"), path = require("path");
const LIB = "nrfi-model-lib.js";
const bt = fs.readFileSync(path.join(__dirname, LIB), "utf8");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
function slice(a, b) {
  const i = src.indexOf(a); if (i < 0) throw new Error("start: " + a);
  const j = src.indexOf(b, i); if (j < 0) throw new Error("end: " + a);
  return src.slice(i, j + b.length);
}
// Two slice lists live in the library and both can go stale: the model bundle
// and VERDICT_SLICES. Only scanning the first missed nClamp out of the verdict
// bundle, which threw ReferenceError at the first call — the same failure this
// file exists to catch, in the one list it was not reading.
//
// IMPORT the lists; do not scrape them. This file used to recover both by
// regexing nrfi-model-lib.js source for `slice("a", "b")` calls and `["a", "b"]`
// pairs. On 2026-08-15 VERDICT_SLICES gained a third element (a fingerprint
// scope tag) and three entries moved to a declMarker() helper, and both regexes
// silently stopped describing the file: the pair matcher fed `";", "cache"` to
// JSON.parse and the whole checker died. A drift detector taken out by exactly
// the kind of drift it exists to detect is worse than no detector, because the
// green light it used to give was still believed. Reading the exported arrays
// cannot go stale — if the shape changes, this file changes with it or fails to
// destructure, and either way it cannot quietly pass.
const { MODEL_SLICES, VERDICT_SLICES } = require("./" + LIB.replace(/\.js$/, ""));
const callList = MODEL_SLICES.map(([a, b]) => [a, b]);
const pairList = VERDICT_SLICES.map(([a, b]) => [a, b]);
const list = [...callList, ...pairList];
if (callList.length < 10) throw new Error(`only ${callList.length} model slices exported by ${LIB} — the list moved again, ` +
  "and this checker was about to pass by looking at nothing");
if (pairList.length < 5) throw new Error(`only ${pairList.length} verdict slices exported by ${LIB} — VERDICT_SLICES moved or changed shape`);
const model = list.map(([a, b]) => slice(a, b)).join("\n");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const clean = strip(model);
// crude but sufficient: every top-level declaration name in the bundle
const defined = new Set();
for (const m of clean.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)) defined.add(m[1]);
for (const m of clean.matchAll(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) defined.add(m[1]);
// every identifier used in a call or value position
const used = new Map();
for (const m of clean.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) used.set(m[1], (used.get(m[1]) || 0) + 1);
for (const m of clean.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) used.set(m[1], (used.get(m[1]) || 0) + 1);
const GLOBALS = new Set(["Math","Number","String","Object","Array","JSON","isFinite","parseFloat","parseInt",
  "Boolean","Date","Map","Set","Promise","console","if","for","while","switch","catch","return","function",
  "typeof","new","of","in","filter","map","reduce","forEach","find","slice","push","join","toFixed","test",
  "match","replace","split","sort","some","every","includes","keys","values","entries","abs","min","max",
  "round","floor","ceil","pow","exp","log","sqrt","sign","isArray","isFinite","isInteger","from","fill"]);
const missing = [...used.keys()].filter((k) => !defined.has(k) && !GLOBALS.has(k) && !/^[a-z]$/.test(k));
console.log("slices in backtest: " + list.length);
console.log("\nreferenced but NOT defined in the bundle:");
for (const k of missing.sort()) {
  const decl = new RegExp("^(?:const|function)\\s+" + k.replace(/\$/g, "\\$") + "\\b", "m");
  const inApp = decl.test(src);
  console.log("  " + k.padEnd(28) + (inApp ? "<- IS a top-level decl in app.jsx (needs a slice)" : "(method/local/global — ignore)"));
}
