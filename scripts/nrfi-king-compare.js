/* Measures the shipped KING MODE against NRFIKINGKY's own live board.
 *
 *   node scripts/nrfi-king-compare.js
 *
 * nrfi-king-verify.js proves we implement his PUBLISHED equation (his worked
 * examples reproduce). This asks the harder question: given his own inputs, do
 * we print his own outputs? It runs the real kingArm/kingEvaluate out of
 * app.jsx over the 15 games on his 2026-08-18 board -- every window cell he
 * displays, his DS, his gate, his tier -- and reports where we differ.
 *
 * Two kinds of disagreement, and they mean different things:
 *   NUMBER  our DS vs his DS. His card rounds SZN/L30 to whole percents, so
 *           residuals under ~0.9 are the display floor, not a model error.
 *           Anything systematically larger is a missing term.
 *   SHAPE   gates and tiers. These are exact -- a mismatch is a real rule
 *           difference, not rounding, and cannot be explained away. */
const fs = require("fs");
const path = require("path");
const BOARD = require("./nrfi-king-board-2026-08-18.json");
const raw = fs.readFileSync(
  path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");

function slice(startRe, label) {
  const lines = raw.split(/\r?\n/);
  const i = lines.findIndex((l) => startRe.test(l));
  if (i < 0) throw new Error("could not find " + label + " in app.jsx");
  for (let j = i; j < lines.length; j++) {
    if (/^[}]/.test(lines[j])) return lines.slice(i, j + 1).join("\n");
  }
  throw new Error("unterminated " + label);
}
const mod = {};
new Function("exports", [
  slice(/^function dsTier\(/, "dsTier"),
  raw.split(/\r?\n/).filter((l) =>
    /^const KING_(PARK_ADJ|ADJ_CAP|W|LG|K|TIERS|YRFI_FLIP|THIN_GS)\b/.test(l)).join("\n"),
  slice(/^function kingArm\(/, "kingArm"),
  slice(/^function kingEvaluate\(/, "kingEvaluate"),
  slice(/^function kingTier\(/, "kingTier"),
  "Object.assign(exports, { kingEvaluate, kingTier });",
].join("\n"))(mod);

/* His board cells -> the shape kingEvaluate reads off a desk row. */
const armOf = (p) => ({
  name: p.who,
  rolling: { windows: ["SZN", "L50", "L30", "L10"].map((k) => {
    const c = p[k];
    return { key: k, pct: c ? c[0] : null, n: c ? c[1] : 0 };
  }) },
});
const rowOf = (g) => ({
  homeAbbr: g.home,
  pitProfiles: { away: armOf(g.a), home: armOf(g.h) },
});

console.log("game       his DS  ours    resid   his gates      ours");
console.log("-".repeat(64));
let n = 0, ss = 0, worst = { d: 0 }, gateMiss = 0, tierMiss = 0;
const rows = [];
for (const g of BOARD.games) {
  const k = mod.kingEvaluate(rowOf(g));
  const ours = k.score;
  const ourGates = k.gates.map((x) => x.tag);
  const hisG = g.gates.join(",") || "-";
  const ourG = ourGates.join(",") || "-";
  const sameGate = hisG === ourG || (hisG === "TBD" && ourG === "BLIND");
  if (!sameGate) gateMiss++;

  let resid = null;
  if (g.ds != null && ours != null) {
    resid = ours - g.ds;
    n++; ss += resid * resid;
    if (Math.abs(resid) > Math.abs(worst.d)) worst = { d: resid, g: g.g };
  }
  const ourTier = mod.kingTier(k).label;
  const hisTier = g.tier;
  const tierSame = hisTier === "FLAGGED" ? k.gates.length > 0
                                         : ourTier === hisTier;
  if (!tierSame) tierMiss++;
  rows.push({ g: g.g, hisTier, ourTier, tierSame });

  console.log(
    g.g.padEnd(10) +
    (g.ds == null ? "  -   " : g.ds.toFixed(1).padStart(6)) +
    (ours == null ? "    -  " : ours.toFixed(1).padStart(7)) +
    (resid == null ? "      -" : (resid > 0 ? "+" : "") + resid.toFixed(1)).padStart(8) +
    "   " + hisG.padEnd(14) + (sameGate ? "same" : "** " + ourG));
}
console.log("-".repeat(64));
console.log("DS  : n=" + n + "  RMSE " + Math.sqrt(ss / n).toFixed(2) +
  "  worst " + worst.d.toFixed(1) + " (" + worst.g + ")");
console.log("gate: " + (BOARD.games.length - gateMiss) + "/" + BOARD.games.length + " agree");

console.log("\ntier                his          ours");
for (const r of rows) {
  console.log("  " + (r.tierSame ? "ok   " : "MISS ") +
    r.g.padEnd(10) + r.hisTier.padEnd(13) + r.ourTier);
}
console.log("tier: " + (rows.length - tierMiss) + "/" + rows.length + " agree");
