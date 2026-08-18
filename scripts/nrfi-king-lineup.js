/* Can his PRINTED lineup numbers explain the residual a constant cannot?
 *
 *   node scripts/nrfi-king-lineup.js
 *
 * nrfi-king-resid.js says the shipped equation runs ~1.0 high on his board and
 * that a flat dock erases the bias -- but the per-game residuals are bimodal
 * (+1.4..+2.4 on eight games, -0.4..+0.2 on five), so a constant is the wrong
 * shape. His dialog says the missing piece is a "capped +/-3% adjustment for
 * park tier AND opposing-lineup YRFI", and an EXPANDED card prints the inputs:
 *
 *     TEAM 1ST-INN RATES (YRFI%)   away 32.0%   home 27.2%
 *     K-BB% (away) 14.1%           K-BB% (home) 6.6%
 *
 * Every earlier attempt at this term fitted OUR estimate of a lineup against
 * HIS score and came back with a backwards sign. This uses his own published
 * numbers, so a backwards sign here is a real answer, not a data problem.
 *
 * Same discipline as nrfi-king-resid.js: ONE free parameter at a time, scored
 * leave-one-out on 13 observations. Read the LOO column. A candidate that only
 * wins in-sample is fitting his display rounding. The wrong-side controls are
 * there to be beaten -- if "own lineup" fits as well as "opposing lineup", the
 * feature is absorbing a level, not measuring an effect. */
const B = require("./nrfi-king-board-2026-08-18.json").games
  .filter((g) => g.ds != null && g.lineup);

if (!B.length) {
  console.error("no scored games carry a lineup panel — re-capture with the");
  console.error("cards EXPANDED (see nrfi-king-capture.js).");
  process.exit(1);
}

const pct = (c) => (c ? c[0] : null);
const raw = (p) => {
  const s = pct(p.SZN), l = pct(p.L30);
  if (s == null && l == null) return null;
  if (l == null) return s;
  if (s == null) return l;
  return 0.6 * s + 0.4 * l;
};

/* The league centre the adjustment pivots around. Pinned to this board's own
 * mean so the term is pure tilt and cannot smuggle in a constant offset --
 * that is what the flat dock is for, and the two must compete honestly. */
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const YRFI0 = mean(B.flatMap((g) => [g.lineup.yrfiA, g.lineup.yrfiH]).filter((v) => v != null));
const KBB0 = mean(B.flatMap((g) => [g.lineup.kbbA, g.lineup.kbbH]).filter((v) => v != null));

const clamp = (v) => Math.max(-3, Math.min(3, v));

/* feat(g, side) -> the number this candidate tilts on, for the away/home arm.
 * "opp" = the arm is graded against the lineup it actually faces: the AWAY arm
 * faces the HOME team, and vice versa. "own" is the same feature wired to the
 * wrong side, as a control. */
const FEATS = {
  "lineup YRFI, opposing": (g, s) => (s === "a" ? g.lineup.yrfiH : g.lineup.yrfiA) - YRFI0,
  "lineup YRFI, own (control)": (g, s) => (s === "a" ? g.lineup.yrfiA : g.lineup.yrfiH) - YRFI0,
  "lineup YRFI, game mean (control)": (g) => (g.lineup.yrfiA + g.lineup.yrfiH) / 2 - YRFI0,
  "K-BB%, own arm": (g, s) => (s === "a" ? g.lineup.kbbA : g.lineup.kbbH) - KBB0,
  "K-BB%, opposing arm (control)": (g, s) => (s === "a" ? g.lineup.kbbH : g.lineup.kbbA) - KBB0,
};

function score(g, feat, c, dock) {
  const arm = (side, key) => {
    const r = raw(side);
    if (r == null) return null;
    const n = side.SZN[1];
    const f = feat ? feat(g, key) : 0;
    if (f == null || !Number.isFinite(f)) return null;
    /* park and the lineup tilt share ONE cap, as his dialog describes it. */
    return (n * r + 10 * 78) / (n + 10) + clamp(g.park - c * f) - dock;
  };
  const a = arm(g.a, "a"), h = arm(g.h, "h");
  return a == null || h == null ? null : (a * h) / 100;
}

const usable = (set, feat) => set.filter((g) => score(g, feat, 0, 0) != null);
const rmse = (set, feat, c, dock) =>
  Math.sqrt(set.reduce((s, g) => s + (score(g, feat, c, dock) - g.ds) ** 2, 0) / set.length);
const bias = (set, feat, c, dock) =>
  set.reduce((s, g) => s + (score(g, feat, c, dock) - g.ds), 0) / set.length;

function grid(a, b, s) { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(4)); return o; }
function fit(set, feat, key, g) {
  let best = null;
  for (const v of g) {
    const r = key === "c" ? rmse(set, feat, v, 0) : rmse(set, feat, 0, v);
    if (!best || r < best.r) best = { v, r };
  }
  return best;
}
function loo(set, feat, key, g) {
  let ss = 0;
  for (let i = 0; i < set.length; i++) {
    const b = fit(set.filter((_, j) => j !== i), feat, key, g);
    const s = key === "c" ? score(set[i], feat, b.v, 0) : score(set[i], feat, 0, b.v);
    ss += (s - set[i].ds) ** 2;
  }
  return Math.sqrt(ss / set.length);
}

const C = grid(-0.4, 0.4, 0.002);
const D = grid(0, 3, 0.01);

console.log("board " + B.length + " scored games with a lineup panel");
console.log("centres pinned at this board's mean: YRFI " + YRFI0.toFixed(1) +
  "%  K-BB " + KBB0.toFixed(1) + "%\n");
console.log("candidate                            best c   insample    LOO     bias    n");
console.log("-".repeat(78));

const base = usable(B, null);
console.log("shipped, no term".padEnd(35) + "-".padStart(7) +
  rmse(base, null, 0, 0).toFixed(2).padStart(11) + "-".padStart(8) +
  ((bias(base, null, 0, 0) >= 0 ? "+" : "") + bias(base, null, 0, 0).toFixed(2)).padStart(8) +
  String(base.length).padStart(5));
const fd = fit(base, null, "dock", D);
console.log("flat dock (the thing to beat)".padEnd(35) + String(fd.v).padStart(7) +
  fd.r.toFixed(2).padStart(11) + loo(base, null, "dock", D).toFixed(2).padStart(8) +
  ((bias(base, null, 0, fd.v) >= 0 ? "+" : "") + bias(base, null, 0, fd.v).toFixed(2)).padStart(8) +
  String(base.length).padStart(5));
console.log("-".repeat(78));

const results = [];
for (const [name, feat] of Object.entries(FEATS)) {
  const set = usable(B, feat);
  if (set.length < 5) { console.log(name.padEnd(35) + "  too few games with this cell"); continue; }
  const b = fit(set, feat, "c", C);
  const l = loo(set, feat, "c", C);
  results.push({ name, feat, c: b.v, l });
  console.log(name.padEnd(35) + String(b.v).padStart(7) + b.r.toFixed(2).padStart(11) +
    l.toFixed(2).padStart(8) +
    ((bias(set, feat, b.v, 0) >= 0 ? "+" : "") + bias(set, feat, b.v, 0).toFixed(2)).padStart(8) +
    String(set.length).padStart(5));
}
console.log("-".repeat(78));
console.log("c > 0 means a HOTTER opposing lineup docks the arm — the sign his");
console.log("dialog implies. c < 0 is backwards and means the fit is absorbing");
console.log("something else. He prints arm cells to whole percents, so ~0.5-0.9");
console.log("of every RMSE here is unrecoverable rounding.");

const best = results.filter((r) => r.c > 0).sort((a, b) => a.l - b.l)[0];
const win = results.slice().sort((a, b) => a.l - b.l)[0];
console.log("\nbest LOO overall: " + win.name + " (c " + win.c + ", LOO " + win.l.toFixed(2) + ")");
console.log("flat dock LOO:    " + loo(base, null, "dock", D).toFixed(2));
if (best) {
  console.log("\nper-game residual under " + best.name + ", c=" + best.c + ":");
  for (const g of usable(B, best.feat)) {
    const d = score(g, best.feat, best.c, 0) - g.ds;
    console.log("  " + g.g.padEnd(10) + (d >= 0 ? "+" : "") + d.toFixed(2).padStart(6) +
      "   opp YRFI a/h " + String(g.lineup.yrfiH).padStart(4) + "/" +
      String(g.lineup.yrfiA).padStart(4));
  }
} else {
  console.log("\nNO candidate fits with the sign his own dialog implies.");
}
