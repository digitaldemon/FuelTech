// Which identifiers does the backtest's model bundle reference but never define?
const fs = require("fs"), path = require("path");
const bt = fs.readFileSync(path.join(__dirname, "desk-nrfi-backtest.js"), "utf8");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
function slice(a, b) {
  const i = src.indexOf(a); if (i < 0) throw new Error("start: " + a);
  const j = src.indexOf(b, i); if (j < 0) throw new Error("end: " + a);
  return src.slice(i, j + b.length);
}
// re-run the exact slice list the backtest uses
const list = [...bt.matchAll(/slice\((".*?"),\s*(".*?")\)/g)].map((m) => [JSON.parse(m[1]), JSON.parse(m[2])]);
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
