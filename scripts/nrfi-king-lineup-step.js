/* Is the missing term a STEP (hot/cold lineup flag), not a continuous tilt?
 *
 *   node scripts/nrfi-king-lineup-step.js
 *
 * nrfi-king-lineup.js fitted a continuous tilt on his printed YRFI%/K-BB% cells
 * and it lost cleanly to a flat dock, with the wrong-side controls fitting
 * identically -- so a linear function of those numbers is not the missing
 * term. But the residual itself is suspicious: it is not a smooth cloud, it is
 * two clean clusters with a gap (five games -0.62..+0.30, eight +1.24..+2.26,
 * nothing between). A CONTINUOUS input does not usually produce a gap like
 * that; a THRESHOLD does. His dialog's own wording -- "capped +/-3%" -- is
 * also consistent with a flag that is either on or off, not a dial.
 *
 * This tries every YRFI%/K-BB% cell as a binary split (opposing arm above vs
 * below a threshold) and checks whether EITHER side of the split lines up with
 * the actual low/high residual groups. One board, 13 games: this cannot prove
 * a step rule, it can only fail to find one, which would remove a hypothesis
 * before it costs a future session another round trip. */
const { exact } = require("./nrfi-king-cells.js");
const B = require("./nrfi-king-board-2026-08-18.json").games
  .filter((g) => g.ds != null && g.lineup);

const raw = (p) => {
  const s = exact(p.SZN), l = exact(p.L30);
  if (s == null && l == null) return null;
  if (l == null) return s;
  if (s == null) return l;
  return 0.6 * s + 0.4 * l;
};
function shipped(g) {
  const arm = (side) => {
    const r = raw(side);
    if (r == null) return null;
    const n = side.SZN[1];
    return (n * r + 10 * 78) / (n + 10) + g.park;
  };
  const a = arm(g.a), h = arm(g.h);
  return a == null || h == null ? null : (a * h) / 100;
}
const rows = B.map((g) => ({ g, resid: shipped(g) - g.ds })).filter((r) => Number.isFinite(r.resid));
const LOW = rows.filter((r) => r.resid < 0.8);
const HIGH = rows.filter((r) => r.resid >= 0.8);
console.log("LOW  (n=" + LOW.length + "): " + LOW.map((r) => r.g.g).join(", "));
console.log("HIGH (n=" + HIGH.length + "): " + HIGH.map((r) => r.g.g).join(", "));
console.log("");

/* Every candidate cell, both arms, "opposing" wiring (away arm graded on the
 * HOME team's number and vice versa, matching what nrfi-king-lineup.js used). */
const CANDS = [
  ["opp YRFI%", (g, s) => (s === "a" ? g.lineup.yrfiH : g.lineup.yrfiA)],
  ["own YRFI%", (g, s) => (s === "a" ? g.lineup.yrfiA : g.lineup.yrfiH)],
  ["opp K-BB%", (g, s) => (s === "a" ? g.lineup.kbbH : g.lineup.kbbA)],
  ["own K-BB%", (g, s) => (s === "a" ? g.lineup.kbbA : g.lineup.kbbH)],
  ["game-mean YRFI%", (g) => (g.lineup.yrfiA + g.lineup.yrfiH) / 2],
  ["arm SZN GS (n)", (g, s) => (s === "a" ? g.a.SZN[1] : g.h.SZN[1])],
  ["GS gap |a-h|", (g) => Math.abs(g.a.SZN[1] - g.h.SZN[1])],
  ["park flag", (g) => g.park],
];

console.log("candidate            per-game max(away,home)   best split      LOW-side  HIGH-side  agree");
console.log("-".repeat(90));
let anyGood = false;
for (const [name, f] of CANDS) {
  const val = (g) => {
    if (name === "GS gap |a-h|" || name === "game-mean YRFI%" || name === "park flag") return f(g);
    const va = f(g, "a"), vb = f(g, "h");
    return Math.max(va, vb);
  };
  const withVal = rows.map((r) => ({ ...r, v: val(r.g) })).filter((r) => Number.isFinite(r.v));
  if (withVal.length < rows.length) continue;
  const vals = [...new Set(withVal.map((r) => r.v))].sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i < vals.length - 1; i++) {
    const t = (vals[i] + vals[i + 1]) / 2;
    const below = withVal.filter((r) => r.v < t), above = withVal.filter((r) => r.v >= t);
    const belowLow = below.filter((r) => r.resid < 0.8).length;
    const aboveHigh = above.filter((r) => r.resid >= 0.8).length;
    const agree = belowLow + aboveHigh;
    const agreeInv = (below.length - belowLow) + (above.length - aboveHigh);
    const a = Math.max(agree, agreeInv);
    if (!best || a > best.a) best = { t, a, agree, agreeInv };
  }
  if (best && best.a === rows.length) anyGood = true;
  console.log(name.padEnd(22) + "cutoff " + best.t.toFixed(2).padStart(7) +
    "                     " + String(best.a).padStart(2) + "/" + rows.length + " agree");
}
console.log("-".repeat(90));
console.log(anyGood
  ? "a perfect split exists above -- worth a second board before trusting it."
  : "NO single printed cell cleanly separates the two clusters on this board.");
