/* What explains the residual against his live board?
 *
 *   node scripts/nrfi-king-resid.js
 *
 * nrfi-king-compare.js says the shipped equation reproduces his gates and tiers
 * but runs about a point high on the score. A constant bias is a specific claim
 * -- it means we are missing a term that is roughly the same on every game, not
 * that the blend is wrong. This tests the candidates ONE FREE PARAMETER AT A
 * TIME, leave-one-out, because 13 observations will happily fit four.
 *
 * Read the LOO column, not the in-sample column.
 *
 * This used to carry the caveat "he prints whole percents, so ~0.5-0.9 of any
 * RMSE here is unrecoverable rounding". THAT WAS WRONG. He prints the
 * denominator beside every percent, so nrfi-king-cells.js inverts each cell to
 * its exact k/n (all 110 cells on this board invert uniquely). Swapping exact
 * cells in moves RMSE 1.424 -> 1.403 and bias +1.00 -> +0.95, i.e. the residual
 * was never rounding. There is no display floor to hide behind here. */
const { exact } = require("./nrfi-king-cells.js");
const B = require("./nrfi-king-board-2026-08-18.json").games.filter((g) => g.ds != null);

const pct = (c) => exact(c);
const raw = (p, wS) => {
  const s = pct(p.SZN), l = pct(p.L30);
  if (s == null && l == null) return null;
  if (l == null) return s;
  if (s == null) return l;
  return wS * s + (1 - wS) * l;
};
/* One scorer, parameterised by every candidate at once; each model below frees
 * exactly one of these and pins the rest at the shipped value. */
function score(g, p) {
  const arm = (side, park) => {
    const r = raw(side, p.wS);
    if (r == null) return null;
    const n = side.SZN[1];
    return (n * r + p.K * p.LG) / (n + p.K) + park - p.dock;
  };
  const a = arm(g.a, g.park), h = arm(g.h, g.park);
  return a == null || h == null ? null : (a * h) / 100;
}
const SHIPPED = { wS: 0.6, K: 10, LG: 78, dock: 0 };
const rmse = (set, p) =>
  Math.sqrt(set.reduce((s, g) => s + (score(g, p) - g.ds) ** 2, 0) / set.length);
const bias = (set, p) =>
  set.reduce((s, g) => s + (score(g, p) - g.ds), 0) / set.length;

function range(a, b, s) { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(4)); return o; }
function fit(set, key, grid) {
  let best = null;
  for (const v of grid) {
    const p = { ...SHIPPED, [key]: v }, r = rmse(set, p);
    if (!best || r < best.r) best = { v, r };
  }
  return best;
}
const MODELS = [
  ["shipped (0 free params)", null, null],
  ["dock: flat % off each arm", "dock", range(0, 3, 0.01)],
  ["LG: shrink target", "LG", range(60, 90, 0.1)],
  ["K: phantom starts", "K", range(0, 60, 0.5)],
  ["wS: season weight in blend", "wS", range(0, 1, 0.005)],
];

console.log("model                          best      insample   LOO     bias");
console.log("-".repeat(68));
for (const [name, key, grid] of MODELS) {
  if (!key) {
    console.log(name.padEnd(30) + "-".padStart(6) +
      rmse(B, SHIPPED).toFixed(2).padStart(11) + "-".padStart(9) +
      (bias(B, SHIPPED) >= 0 ? "+" : "") + bias(B, SHIPPED).toFixed(2).padStart(6));
    continue;
  }
  const b = fit(B, key, grid);
  let ss = 0;
  for (let i = 0; i < B.length; i++) {
    const bb = fit(B.filter((_, j) => j !== i), key, grid);
    ss += (score(B[i], { ...SHIPPED, [key]: bb.v }) - B[i].ds) ** 2;
  }
  const p = { ...SHIPPED, [key]: b.v };
  console.log(name.padEnd(30) + String(b.v).padStart(6) +
    b.r.toFixed(2).padStart(11) + Math.sqrt(ss / B.length).toFixed(2).padStart(9) +
    ((bias(B, p) >= 0 ? "+" : "") + bias(B, p).toFixed(2)).padStart(7));
}
console.log("-".repeat(68));
console.log("cells are exact (k/n recovered), so there is NO display floor here.");

console.log("\nper-game residual, shipped:");
for (const g of B) {
  const d = score(g, SHIPPED) - g.ds;
  console.log("  " + g.g.padEnd(10) + (d >= 0 ? "+" : "") + d.toFixed(2).padStart(6) +
    "   szn n " + String(g.a.SZN[1]).padStart(2) + "/" + String(g.h.SZN[1]).padStart(2) +
    "   park " + (g.park > 0 ? "+" : " ") + g.park);
}
