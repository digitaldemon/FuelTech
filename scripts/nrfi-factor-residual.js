// Do our own factors still predict the outcome after our own p has spoken?
//
//   node scripts/nrfi-factor-residual.js [cache]
//
// This asks nothing about the tout. Every factor here is an INPUT to pNRFI, so
// if one of them still carries a coefficient once logit(p) is in the model, we
// weighted it wrong — the information was in our hands and the evaluator threw
// part of it away. That is a defect we can fix without copying anyone.
//
// WHY THIS IS THE RIGHT TEST AND THE p-MATCHED TOUT WORK WAS NOT. Chasing his
// profile answers "what does he like", and the answer came back: taste, not
// reason — every factor that separated his legs kept its full edge when the
// peers were matched on it (nrfi-tout-mediate.js). Whereas a factor with a
// nonzero coefficient CONDITIONAL ON OUR OWN p is a mis-weighting, and the fix
// is a number in the evaluator rather than a habit to imitate.
//
// THE CACHE HOLDS RAW pNRFI, NOT THE SHIPPED PROBABILITY. nrfi-tout-vs-model.js
// stores ev.pNRFI, which is upstream of applyCalibration, so mean p (0.544) sits
// well above the base rate (0.501) here. That gap is what the live Platt shift
// exists to absorb and is NOT evidence of a bug. It also does not touch anything
// below: a shift in logit space is monotone, so it cannot change a ranking, an
// AUC, or the sign of a conditional coefficient. The slope row does read on it,
// and is labelled accordingly.
//
// COLLINEARITY IS THE REASON THE MDE COLUMN MATTERS HERE. A factor the evaluator
// leans on hard is nearly a function of logit(p) on this sample, so its
// conditional coefficient is estimated with very little independent variation
// and its confidence band is wide. A null on such a factor means "we cannot
// see it from 1,282 games", not "it is correctly weighted". The bootstrap gets
// this right automatically; the printed MDE is what stops it being misread.
//
// DATES ARE THE CLUSTER. A slate shares weather, parks and one fetch of our
// feeds, so games on a date are not independent draws. Every band below
// resamples DATES.

const fs = require("fs");
const path = require("path");

const CACHE = process.argv[2] || "nrfi-tout-vs-model.json";
const B = 2000;
const FOLDS = 5;

const p0 = path.isAbsolute(CACHE) ? CACHE : path.join(__dirname, CACHE);
const J = JSON.parse(fs.readFileSync(p0, "utf8"));

let _s = 0x9e3779b9 >>> 0;
const rnd = () => { _s ^= _s << 13; _s >>>= 0; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0; return _s / 4294967296; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const lg = (p) => Math.log(p / (1 - p));
const ul = (x) => 1 / (1 + Math.exp(-x));

// ---- load ------------------------------------------------------------------
const raw = [];
for (const [d, gs] of J.slates) for (const g of gs) {
  if (!Number.isFinite(g.p) || !g.factors || (g.actual !== 0 && g.actual !== 1)) continue;
  raw.push({ d, pk: g.gamePk, p: g.p, y: g.actual, f: g.factors });
}
const G = [...new Map(raw.map((r) => [r.pk, r])).values()];
const FACTORS = [...new Set(G.flatMap((r) => Object.keys(r.f)))].sort()
  .filter((k) => { const v = G.map((r) => r.f[k]).filter(Number.isFinite); return v.length === G.length && sd(v) > 0; });

// Standardised so every coefficient below reads in the same unit: the change in
// log-odds per one board-wide SD of the factor. Without this a term whose
// natural scale is 0.01 wide would show a huge coefficient and mean nothing.
const MU = {}, SD = {};
for (const k of FACTORS) { const v = G.map((r) => r.f[k]); MU[k] = mean(v); SD[k] = sd(v); }
const z = (r, k) => (r.f[k] - MU[k]) / SD[k];

const dates = [...new Set(G.map((r) => r.d))];
const byDate = new Map(dates.map((d) => [d, G.filter((r) => r.d === d)]));
console.log(`${G.length} games, ${dates.length} dates, ${FACTORS.length} usable factors`);
console.log(`base rate ${mean(G.map((r) => r.y)).toFixed(4)}, mean raw p ${mean(G.map((r) => r.p)).toFixed(4)}\n`);

// ---- logistic fit ----------------------------------------------------------
/* Newton-Raphson with a ridge penalty on every column but the intercept. The
 * ridge is 0 for the single-factor fits and only earns its keep in the 33-factor
 * block at the end; it is here at all because a Newton step on a near-separable
 * or near-collinear design otherwise walks off to infinity and returns a
 * coefficient that looks enormous and means nothing. */
function fit(rows, cols, lambda) {
  const n = rows.length, d = cols.length + 1;
  const X = rows.map((r) => [1, ...cols.map((c) => c(r))]);
  const y = rows.map((r) => r.y);
  let b = new Array(d).fill(0);
  for (let it = 0; it < 40; it++) {
    const g = new Array(d).fill(0);
    const H = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let i = 0; i < n; i++) {
      let e = 0; for (let j = 0; j < d; j++) e += b[j] * X[i][j];
      const mu = ul(e), w = Math.max(1e-6, mu * (1 - mu)), res = y[i] - mu;
      for (let j = 0; j < d; j++) {
        g[j] += res * X[i][j];
        for (let k = j; k < d; k++) H[j][k] += w * X[i][j] * X[i][k];
      }
    }
    for (let j = 1; j < d; j++) { g[j] -= lambda * b[j]; H[j][j] += lambda; }
    for (let j = 0; j < d; j++) for (let k = 0; k < j; k++) H[j][k] = H[k][j];
    const step = solve(H, g);
    if (!step) break;
    let m = 0; for (let j = 0; j < d; j++) { b[j] += step[j]; m = Math.max(m, Math.abs(step[j])); }
    if (m < 1e-9) break;
  }
  return b;
}
function solve(A, v) {
  const d = v.length;
  const M = A.map((r, i) => [...r, v[i]]);
  for (let c = 0; c < d; c++) {
    let piv = c;
    for (let r = c + 1; r < d; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < d; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= d; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[d] / M[i][i]);
}
const resampleDates = () => {
  const s = [];
  for (let i = 0; i < dates.length; i++) s.push(...byDate.get(dates[(rnd() * dates.length) | 0]));
  return s;
};

// ---- how good is p on its own ----------------------------------------------
const auc = (rows, score) => {
  const pos = rows.filter((r) => r.y === 1).map(score), neg = rows.filter((r) => r.y === 0).map(score);
  let w = 0;
  for (const a of pos) for (const b of neg) w += a > b ? 1 : a === b ? 0.5 : 0;
  return w / (pos.length * neg.length);
};
const base = fit(G, [(r) => lg(r.p)], 0);
const bootSlope = [], bootAuc = [];
for (let b = 0; b < 500; b++) {
  const s = resampleDates();
  bootSlope.push(fit(s, [(r) => lg(r.p)], 0)[1]);
  bootAuc.push(auc(s, (r) => r.p));
}
console.log("OUR p ON ITS OWN");
console.log(`  AUC ${auc(G, (r) => r.p).toFixed(4)} +/- ${sd(bootAuc).toFixed(4)}   (0.5 is a coin)`);
console.log(`  recalibration slope on logit(p): ${base[1].toFixed(3)} +/- ${sd(bootSlope).toFixed(3)}`);
console.log(`  ${base[1] < 1 - 2 * sd(bootSlope) ? "BELOW 1 — our probabilities are more spread out than the outcomes justify (overconfident)"
  : base[1] > 1 + 2 * sd(bootSlope) ? "ABOVE 1 — our probabilities are too timid; the ranking deserves wider spacing"
  : "indistinguishable from 1 — the spacing of our probabilities is about right"}\n`);

// ---- one factor at a time, conditional on p --------------------------------
const BAR = 2.807;   // two-sided 0.005, Bonferroni-ish for 33 tests
const rows = [];
for (const k of FACTORS) {
  const cols = [(r) => lg(r.p), (r) => z(r, k)];
  const point = fit(G, cols, 0)[2];
  const boot = [];
  for (let b = 0; b < B / 4; b++) boot.push(fit(resampleDates(), cols, 0)[2]);
  const se = sd(boot);
  rows.push({ k, point, se, t: se > 0 ? point / se : 0 });
}
rows.sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
console.log("EACH FACTOR, CONDITIONAL ON logit(p)");
console.log("  a nonzero coefficient means the evaluator under- or over-weighted this input");
console.log(`  bar |t| > ${BAR}\n`);
console.log("    factor            coef/sd      t      detectable at this n");
for (const r of rows.slice(0, 14))
  console.log(`    ${r.k.padEnd(16)} ${(r.point >= 0 ? "+" : "") + r.point.toFixed(3)}  ${r.t.toFixed(2).padStart(6)}` +
    `${Math.abs(r.t) > BAR ? " **" : "   "}   +/-${(BAR * r.se).toFixed(3)}`);
const clear = rows.filter((r) => Math.abs(r.t) > BAR);
if (!clear.length)
  console.log(`\n  NOTHING CLEARS. Median detectable coefficient ${(BAR * rows.map((r) => r.se).sort((a, b) => a - b)[rows.length >> 1]).toFixed(3)} log-odds/sd.` +
    `\n  Below that size this sample cannot tell a mis-weighting from zero.`);
else console.log(`\n  CLEARS: ${clear.map((r) => r.k).join(", ")}`);

// ---- can the whole set beat p out of sample --------------------------------
/* The question that decides whether any of this ships.
 *
 * Single-coefficient tests can all miss while the set still carries signal, so
 * the honest final check is out-of-sample: fit logit(p) plus all 33 factors on
 * four fifths of the DATES and score the fifth, and see whether it beats logit(p)
 * alone on the same held-out games. Folds are blocked by date for the same
 * reason the bootstrap clusters on it — splitting a slate across the boundary
 * leaks the day's weather and our own feed state from train into test and
 * manufactures an improvement that will not survive contact with tomorrow.
 *
 * The lambda path is printed in full rather than tuned. Reporting only the best
 * lambda would be selecting on the test set and would turn noise into a result;
 * a real gain shows up as a RANGE of lambdas beating the baseline, not a spike
 * at one. */
const shuffled = [...dates].sort(() => rnd() - 0.5);
const foldOf = new Map(shuffled.map((d, i) => [d, i % FOLDS]));
const brier = (rows2, pr) => mean(rows2.map((r, i) => (pr[i] - r.y) ** 2));

console.log("\nOUT OF SAMPLE — all 33 factors on top of logit(p), " + FOLDS + "-fold blocked by date");
console.log("  lambda      Brier      vs p-alone       AUC      vs p-alone");
const cols = [(r) => lg(r.p), ...FACTORS.map((k) => (r) => z(r, k))];
const oosBase = new Array(G.length);
const idx = new Map(G.map((r, i) => [r, i]));
for (let f = 0; f < FOLDS; f++) {
  const tr = G.filter((r) => foldOf.get(r.d) !== f), te = G.filter((r) => foldOf.get(r.d) === f);
  const b = fit(tr, [(x) => lg(x.p)], 0);
  for (const r of te) oosBase[idx.get(r)] = ul(b[0] + b[1] * lg(r.p));
}
const bBase = brier(G, oosBase), aBase = auc(G, (r) => oosBase[idx.get(r)]);
console.log(`  p alone   ${bBase.toFixed(5)}         --        ${aBase.toFixed(4)}        --`);
let best = null;
for (const lam of [300, 100, 30, 10, 3, 1]) {
  const oos = new Array(G.length);
  for (let f = 0; f < FOLDS; f++) {
    const tr = G.filter((r) => foldOf.get(r.d) !== f), te = G.filter((r) => foldOf.get(r.d) === f);
    const b = fit(tr, cols, lam);
    for (const r of te) oos[idx.get(r)] = ul(b[0] + cols.reduce((s, c, j) => s + b[j + 1] * c(r), 0));
  }
  const bb = brier(G, oos), aa = auc(G, (r) => oos[idx.get(r)]);
  console.log(`  ${String(lam).padStart(6)}    ${bb.toFixed(5)}   ${(bb - bBase >= 0 ? "+" : "") + (bb - bBase).toFixed(5)}` +
    `    ${aa.toFixed(4)}   ${(aa - aBase >= 0 ? "+" : "") + (aa - aBase).toFixed(4)}`);
  if (!best || bb < best.b) best = { lam, b: bb, a: aa, oos };
}

/* A Brier that improves by 0.0004 is not a finding without a band on the
 * DIFFERENCE, paired game by game and clustered on date. */
const dB = [];
for (let b = 0; b < 500; b++) {
  const s = resampleDates();
  dB.push(mean(s.map((r) => (best.oos[idx.get(r)] - r.y) ** 2 - (oosBase[idx.get(r)] - r.y) ** 2)));
}
const dPoint = best.b - bBase, dSe = sd(dB);
console.log(`\n  best lambda ${best.lam}: Brier change ${(dPoint >= 0 ? "+" : "") + dPoint.toFixed(5)} +/- ${dSe.toFixed(5)} (${(dPoint / (dSe || 1)).toFixed(1)}se, negative is better)`);
console.log("=".repeat(72));
if (dPoint < -2 * dSe && best.a > aBase)
  console.log("THE FACTOR SET ADDS SIGNAL our p is not using. Worth re-weighting the evaluator.");
else if (dPoint > 2 * dSe)
  console.log("ADDING THE FACTORS MAKES IT WORSE out of sample — the evaluator is already\n" +
    "extracting more from them than a linear correction can, and this road is closed.");
else
  console.log(`NO OUT-OF-SAMPLE GAIN, and none detectable smaller than ${(2 * dSe).toFixed(5)} Brier.\n` +
    "Conditional on our own p, the 33 factors we record hold no further linear signal\n" +
    "at this sample size. Any real improvement has to come from a factor we do not\n" +
    "record yet, or from a nonlinearity this fit cannot see — not from re-weighting.");
