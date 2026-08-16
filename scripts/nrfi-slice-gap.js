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
/* Scope analysis, not regexes. The regexes are why this report was unreadable.
 *
 * The old detector collected "used" names with /\b([A-Z][A-Z0-9_]{2,})\b/ over
 * comment-stripped text, so it matched inside string literals and property
 * names. On 2026-08-16 it printed 80 findings and every single one carried the
 * "(method/local/global — ignore)" tag — team codes out of string literals
 * (ARI, BOS, WSH), label text (BET, YRFI, TOSS), method names (indexOf, map,
 * toLowerCase). Zero were real. A checker with a 100% false positive rate is
 * not noisy, it is off: the one line that ever matters would arrive in the
 * middle of eighty lines telling the reader to ignore them.
 *
 * It also carried its own hand-written GLOBALS list, which is the failure this
 * codebase keeps rediscovering — a guessed list that cannot see a thing will
 * always call it missing. `slice` and `filter` were on it as bare words, so a
 * genuine top-level helper named either would have been silently excused.
 *
 * Babel answers the real question instead: which ReferencedIdentifiers have no
 * binding in scope. String contents are not identifiers, `o.map` is not a
 * reference to `map`, and a name bound by an inner `const` resolves. The
 * globals list comes from check-scope.js so there is one copy, not two. */
const Babel = require("@babel/standalone");
const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;
const { KNOWN_GLOBALS } = require("./check-scope");

/* The two bundles are parsed SEPARATELY because they are eval'd separately,
 * and because concatenating them is a syntax error: both define nClamp, and a
 * duplicate top-level const does not parse. Names defined in either one still
 * count as defined for the other, which is the cross-bundle reference this
 * file was merging the lists to model in the first place. */
function analyse(modelSlices, verdictSlices) {
  const bundles = [
    ["model", modelSlices.map(([a, b]) => slice(a, b)).join("\n")],
    ["verdict", verdictSlices.map(([a, b]) => slice(a, b)).join("\n")],
  ];
  const defined = new Set();
  const refs = new Map(); // name -> { count, bundles:Set }
  for (const [name, code] of bundles) {
    let ast;
    try {
      ast = parser.parse(code, { sourceType: "script", plugins: ["jsx"], allowReturnOutsideFunction: true });
    } catch (e) {
      // Not a soft failure. An unparseable bundle is one that cannot be eval'd
      // either, so the model is already broken — say so instead of reporting
      // "nothing missing" from a bundle nobody could read.
      throw new Error("the " + name + " bundle does not parse (" + e.message + "). The slice " +
        "markers are cutting mid-statement, so this checker cannot see it and neither can the eval " +
        "in nrfi-model-lib.js. Fix the slice bounds; do not skip the bundle.");
    }
    traverse(ast, {
      Program(p) { for (const k of Object.keys(p.scope.bindings)) defined.add(k); },
      ReferencedIdentifier(p) {
        const n = p.node.name;
        if (p.scope.hasBinding(n, true)) return;
        const e = refs.get(n) || { count: 0, bundles: new Set() };
        e.count++; e.bundles.add(name);
        refs.set(n, e);
      },
    });
  }
  const missing = [...refs.entries()]
    .filter(([k]) => !defined.has(k) && !KNOWN_GLOBALS.has(k))
    .sort((a, b) => a[0].localeCompare(b[0]));
  return { defined, missing };
}

/* Prove the green light means something, on every run.
 *
 * The old detector's whole output was noise, so the honest reaction to this
 * rewrite printing "none" is to doubt it — the failure this file already has a
 * paragraph about is a checker that was looking at nothing and said it was
 * healthy. So before reporting, drop one slice the model provably calls and
 * confirm the analysis notices. If removing a function from the list does not
 * produce a finding, nothing this file prints afterwards is worth reading.
 *
 * The probe is a real MODEL_SLICES entry rather than a synthetic bundle,
 * because a synthetic one would only prove the analyser works on synthetic
 * input. If pitcherVenueFactor is ever renamed or stops being called, this
 * throws and asks for a new probe target — loudly, which is the point. */
const PROBE = "function pitcherVenueFactor(";
(() => {
  const i = MODEL_SLICES.findIndex((s) => s[0] === PROBE);
  if (i < 0) {
    throw new Error("self-test target " + JSON.stringify(PROBE) + " is no longer in MODEL_SLICES. " +
      "Pick another sliced function that the bundle calls and update PROBE — do not delete this check, " +
      "it is the only thing that makes a 'none' result believable.");
  }
  const short = MODEL_SLICES.filter((_, k) => k !== i);
  const name = PROBE.replace(/^function\s+/, "").replace(/\($/, "");
  const found = analyse(short, VERDICT_SLICES).missing.some(([k]) => k === name);
  if (!found) {
    throw new Error("self-test FAILED: removed " + name + " from the slice list and the analysis still " +
      "reported nothing missing. This checker cannot see gaps, so its clean results are meaningless. " +
      "Fix the analysis before trusting any output below.");
  }
})();

const { defined, missing } = analyse(MODEL_SLICES, VERDICT_SLICES);

console.log("slices: " + list.length + " (" + callList.length + " model, " + pairList.length + " verdict)");
console.log("top-level names defined by the bundles: " + defined.size);

if (!missing.length) {
  console.log("\nreferenced but NOT defined: none — every name the bundles use is either " +
    "declared in them or a known global.");
} else {
  console.log("\nreferenced but NOT defined in the bundles:");
  for (const [k, e] of missing) {
    // A name that IS a top-level declaration in app.jsx is the real finding:
    // the model uses it and the slice list forgot to bring it along, which
    // throws ReferenceError at the first call rather than at load.
    const decl = new RegExp("^(?:const|let|var|function|class)\\s+" + k.replace(/\$/g, "\\$") + "\\b", "m");
    console.log("  " + k.padEnd(26) + String(e.count).padStart(3) + "x in " +
      [...e.bundles].join("+").padEnd(14) +
      (decl.test(src) ? "<- IS a top-level decl in app.jsx: THE SLICE LIST IS MISSING IT"
        : "<- not declared anywhere in app.jsx either"));
  }
}
// Exit non-zero only for the actionable half. A name that is nowhere in
// app.jsx is usually a Node/browser global this list has not met yet, and
// failing the build on it would teach people to stop running this.
const actionable = missing.filter(([k]) =>
  new RegExp("^(?:const|let|var|function|class)\\s+" + k.replace(/\$/g, "\\$") + "\\b", "m").test(src));
if (actionable.length) {
  console.log("\n" + actionable.length + " slice-list gap(s) — add these to MODEL_SLICES/VERDICT_SLICES.");
  process.exit(1);
}
