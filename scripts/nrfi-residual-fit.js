// Does any factor still predict our own error?
//
//   node scripts/nrfi-residual-fit.js [--folds N]
//
// THE QUESTION. nrfi-tout-profile.js found that among games our model scores
// IDENTICALLY, NRFIKINGKY is long pitching and short run environment — and he
// wins. That is a claim about our exchange rate between two terms, and it is
// suspicious precisely because it arrived via a third party. A tout comparison
// can only ever say "he disagrees with us and he is right"; it cannot say which
// of us is miscalibrated on what, and it inherits every selection effect in his
// book.
//
// This script asks the same question with no tout in it at all. If our p is
// correct conditional on the factors, then no factor can predict the residual
// (actual - p). Every term already went into p; refitting an INCREMENTAL
// coefficient on top of it therefore asks exactly one thing:
//
//     should this term have counted for more, or for less?
//
// A coefficient of zero means the weight is right. A coefficient that clears the
// bar means the model is leaving signal in a term it already looks at, which is
// a weight to change and not a feature to add.
//
// WHY THE OFFSET FORM MATTERS. Fitting y on the factors from scratch would just
// rediscover the model and tell us nothing about where it is wrong. Holding
// logit(p) as a fixed offset makes the fit residual by construction, so a
// significant beta is a statement about the model's error rather than about
// baseball.
//
// WHAT WOULD MAKE THIS WRONG. Two things, and both are printed with the result:
//
//   1. IN-SAMPLE FIT ALWAYS IMPROVES. Any coefficient fit on these games will
//      lower the error on these games. So the decision number here is the
//      out-of-sample one, and the folds are split BY DATE, because games on the
//      same slate share weather, umpires and our own daily data pulls — a random
//      game-level split would leak a slate across the boundary and quietly hand
//      the fit part of its own answer.
//
//   2. LOOK-AHEAD IN THE INPUTS. The pitcher first-inning lines in this cache are
//      rewound to the scored date; the rest are not. `env` is built from the
//      weather the schedule reports, which for a past game is closer to what
//      happened than to what was forecast at pick time. A term whose inputs are
//      contaminated can show a real coefficient that no live board could have
//      used, so contaminated terms are flagged in the output rather than
//      silently ranked beside clean ones.
const fs = require("fs");
const path = require("path");

const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");
const mdl = JSON.parse(fs.readFileSync(CACHE, "utf8"));
const FOLDS = (() => {
  const i = process.argv.indexOf("--folds");
  return i > 0 && +process.argv[i + 1] > 1 ? Math.floor(+process.argv[i + 1]) : 5;
})();

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const clamp = (p) => Math.min(1 - 1e-6, Math.max(1e-6, p));
const logit = (p) => Math.log(clamp(p) / (1 - clamp(p)));
const sigm = (z) => 1 / (1 + Math.exp(-z));

/* SELF-TEST ON THE LINEAR SOLVER, run before anything reads a number out of it.
 *
 * This exists because of a specific bug. `solve` ended with
 *
 *     M.map((row, i) => row[k] / row[i][i])
 *
 * where row[i] is already the diagonal element, so the extra index divided by
 * undefined and every solution came back NaN. Each caller checked for a falsy
 * return, read NaN as "singular", and returned null — so the calibration slope,
 * the joint fit and all five cross-validation folds silently did not run. The
 * script still printed a complete-looking report, because the univariate table
 * is fit by a separate one-dimensional routine that was fine.
 *
 * That is the same failure this codebase keeps producing: a missing computation
 * that renders as an ordinary absence rather than as an error. Six lines of
 * known-answer test turn it into a crash on the first run instead.
 */
(function selfTest() {
  const A = [[4, 1, 0], [1, 3, 1], [0, 1, 2]], want = [1, -2, 3];
  const rhs = A.map((row) => row.reduce((s, v, j) => s + v * want[j], 0));
  const got = solve(A, rhs);
  if (!got || got.some((v, i) => !isFinite(v) || Math.abs(v - want[i]) > 1e-9))
    throw new Error("solve() is wrong: expected " + want.join(",") + " got " + (got ? got.join(",") : "null"));
  const inv = invert(A);
  if (!inv) throw new Error("invert() returned null on a well-conditioned matrix");
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const dot = A[i].reduce((s, v, l) => s + v * inv[l][j], 0);
      if (Math.abs(dot - (i === j ? 1 : 0)) > 1e-9)
        throw new Error(`invert() is wrong: A*inv is not the identity at [${i}][${j}] (${dot})`);
    }
})();

/* Inputs whose values in this cache are not what a live board would have had.
 * Named individually rather than filtered out: a flagged term with a large
 * coefficient is still worth knowing about, it just cannot be shipped on this
 * evidence alone. */
const CONTAMINATED = {
  env: "built from the weather the schedule reports for a completed game, which is nearer to observed than to forecast",
};

const games = [];
for (const [date, gs] of mdl.slates)
  for (const g of gs)
    if (g.p != null && g.actual != null && g.factors) games.push({ date, p: g.p, y: g.actual ? 1 : 0, f: g.factors });

console.log(`model ${mdl.modelSig || "?"}   games ${games.length}   dates ${new Set(games.map((g) => g.date)).size}`);
if (games.length < 400) {
  console.error(`\nOnly ${games.length} games carry both a result and a factor block — refusing to fit.`);
  console.error("Rebuild the cache first:  node scripts/nrfi-tout-vs-model.js 318949");
  process.exit(1);
}

const base = mean(games.map((g) => g.y));
const brier = (rows, pred) => mean(rows.map((g, i) => (pred[i] - g.y) ** 2));
const logloss = (rows, pred) => -mean(rows.map((g, i) => {
  const q = clamp(pred[i]);
  return g.y * Math.log(q) + (1 - g.y) * Math.log(1 - q);
}));
const basePred = games.map((g) => g.p);
console.log(`  NRFI base rate ${(base * 100).toFixed(1)}%   model Brier ${brier(games, basePred).toFixed(4)}   log loss ${logloss(games, basePred).toFixed(4)}`);

/* ---- SKILL, BEFORE ANY TALK OF WEIGHTS ----
 *
 * This block was added after the first run of the script, because the first run
 * answered the question it was asked and buried the more important one in a
 * header line. It reported Brier 0.2480 against a 50.0% base rate — and a
 * constant 50% scores 0.2500. Whether a particular term is weighted right is a
 * secondary question if the whole ranking is barely separating games, so the
 * separation is now measured first and stated plainly.
 *
 * Three numbers, because they fail differently:
 *
 *   SKILL SCORE   how much of the base-rate error the model removes. Near zero
 *                 means the ranking is not doing work, regardless of calibration.
 *   AUC           whether the ORDER is right, ignoring the levels. A model can
 *                 rank well and still be scaled wrong, and that is a fixable
 *                 problem; a model that cannot rank has nothing to rescale.
 *   CAL SLOPE     regress the outcome on logit(p) with a free slope. 1.0 is
 *                 correct. Below 1 means the spread of our probabilities is
 *                 wider than the evidence supports — overconfidence — and it is
 *                 the single number a Platt step exists to fix.
 */
const brierAtBase = mean(games.map((g) => (base - g.y) ** 2));
const auc = (() => {
  const idx = games.map((g, i) => i).sort((a, b) => games[a].p - games[b].p);
  // Midrank for ties, else a model that emits the same p on many games scores
  // itself on the order it happened to be stored in.
  const rank = new Array(games.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && games[idx[j + 1]].p === games[idx[i]].p) j++;
    const mid = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) rank[idx[k]] = mid;
    i = j + 1;
  }
  const pos = games.filter((g) => g.y === 1).length, neg = games.length - pos;
  if (!pos || !neg) return null;
  const rsum = games.reduce((s, g, i) => s + (g.y === 1 ? rank[i] : 0), 0);
  const A = (rsum - pos * (pos + 1) / 2) / (pos * neg);
  /* Hanley-McNeil standard error. Without it "0.572" is not a result: on 1283
   * games the noise band on an AUC is around 0.016, so 0.572 and 0.50 are four
   * standard errors apart while 0.52 would not be — and both look equally like
   * "a bit above chance" if only the point estimate is printed. */
  const q1 = A / (2 - A), q2 = 2 * A * A / (1 + A);
  const se = Math.sqrt((A * (1 - A) + (pos - 1) * (q1 - A * A) + (neg - 1) * (q2 - A * A)) / (pos * neg));
  return { a: A, se, z: se ? (A - 0.5) / se : 0 };
})();
const calib = (() => {
  // Offset must be zero for a free intercept+slope fit, so the rows are handed a
  // p of 0.5 (logit 0) and the real logit(p) rides in as a column.
  const rows = games.map((g) => ({ p: 0.5, y: g.y }));
  const one = games.map(() => 1), lp = games.map((g) => logit(g.p));
  const m = mean(lp);
  const f = fitN([one, lp.map((v) => v - m)], rows);
  return f ? { slope: f.b[1], se: f.se[1] } : null;
})();
const skill = 1 - brier(games, basePred) / brierAtBase;
console.log("\n=================== IS THE RANKING DOING ANYTHING? ===================");
console.log(`  constant ${(base * 100).toFixed(1)}% scores Brier ${brierAtBase.toFixed(4)};  the model scores ${brier(games, basePred).toFixed(4)}`);
console.log(`  skill score      ${(skill * 100).toFixed(2)}%  of the base-rate error removed`);
if (auc) console.log(`  AUC              ${auc.a.toFixed(4)} +/- ${auc.se.toFixed(4)}   ${auc.z.toFixed(1)}se above chance`);
if (calib) console.log(`  calibration slope ${calib.slope.toFixed(3)} +/- ${calib.se.toFixed(3)}   (1.0 = correctly scaled)`);
/* All three readings of the slope, because they call for opposite repairs and
 * the wrong one is worse than none. Each is gated on 2se, so a slope that is
 * merely NOT 1.0 by eye does not get a recommendation attached to it. */
if (calib) {
  const zFrom1 = (calib.slope - 1) / calib.se;
  if (Math.abs(calib.slope) < 1.96 * calib.se)
    console.log("  -> THE SLOPE IS NOT DISTINGUISHABLE FROM ZERO. On this sample the ranking carries\n     no measurable information, and no reweighting of its terms can be validated here.");
  else if (zFrom1 < -1.96)
    console.log(`  -> OVERCONFIDENT (${zFrom1.toFixed(1)}se below 1). Our probabilities are spread wider than the\n     evidence supports; shrinking them toward ${(base * 100).toFixed(0)}% would score better.`);
  else if (zFrom1 > 1.96)
    console.log(`  -> UNDERCONFIDENT (${zFrom1.toFixed(1)}se above 1). The ranking earns a wider spread than we\n     give it; the board is leaving edge on the table at the extremes.`);
  else
    console.log(`  -> correctly scaled: ${zFrom1.toFixed(1)}se from 1.0, so the SIZE of our probabilities is not\n     the problem. Any repair has to come from separating games better, not rescaling.`);
}

/* Terms. Every factor the evaluator reports, plus the same pair products the
 * tout profile tests, because the model applies each side's terms to its own
 * half and a term can be right on average while wrong on the product. */
const FKEYS = Object.keys(games[0].f);
const DERIVED = [
  ["pitMult product", (f) => f.awayPitMult * f.homePitMult],
  ["offMult product", (f) => f.awayOffMult * f.homeOffMult],
  ["trend product", (f) => f.awayTrend * f.homeTrend],
  ["offTrend product", (f) => f.awayOffTrend * f.homeOffTrend],
];
const TERMS = [...FKEYS.map((k) => [k, (f) => f[k]]), ...DERIVED];

/* Factors are multiplicative, so the natural scale for a linear fit is log.
 * Centred so the coefficient is about the SHAPE of the term and not about its
 * mean level — an uncentred fit would let beta absorb a constant shift in p,
 * which is a calibration intercept and not a statement about the term. */
const design = new Map();
for (const [name, get] of TERMS) {
  const raw = games.map((g) => { const v = get(g.f); return v != null && isFinite(v) && v > 0 ? Math.log(v) : null; });
  if (raw.some((v) => v == null)) continue;
  const s = sd(raw);
  if (s < 1e-9) continue;              // constant by design (the home-field split)
  const m = mean(raw);
  design.set(name, { x: raw.map((v) => v - m), sd: s });
}

/* One-dimensional IRLS with logit(p) held as an offset. Newton on a
 * one-parameter logistic is two or three iterations from any start; the loop
 * runs to a fixed point and asserts it got there rather than trusting a count. */
const fit1 = (x, rows) => {
  let b = 0;
  for (let it = 0; it < 60; it++) {
    let g = 0, h = 0;
    for (let i = 0; i < rows.length; i++) {
      const q = sigm(logit(rows[i].p) + b * x[i]);
      g += x[i] * (rows[i].y - q);
      h += x[i] * x[i] * q * (1 - q);
    }
    if (h < 1e-12) return null;
    const step = g / h;
    b += step;
    if (Math.abs(step) < 1e-10) {
      let info = 0;
      for (let i = 0; i < rows.length; i++) {
        const q = sigm(logit(rows[i].p) + b * x[i]);
        info += x[i] * x[i] * q * (1 - q);
      }
      return { b, se: 1 / Math.sqrt(info) };
    }
  }
  return null;                          // did not converge; reported as a skip, never as a zero
};

const erfc = (v) => {
  const z = Math.abs(v), t = 1 / (1 + z / 2);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return v >= 0 ? r : 2 - r;
};
const barFor = (m) => {
  const target = 0.05 / m;
  let lo = 0, hi = 8;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (erfc(mid / Math.SQRT2) > target) lo = mid; else hi = mid; }
  return Math.round((lo + hi) / 2 * 100) / 100;
};
const BAR = barFor(design.size);

console.log("\n=================== DOES ANY TERM PREDICT OUR ERROR? ===================");
console.log("  Coefficient is INCREMENTAL: it is what the term should have counted for on");
console.log("  top of what it already counted for. Zero means the weight is right.\n");
console.log("  term                   beta       t    1sd move in p    detectable");
const hits = [];
const mdes = [];
for (const [name, d] of design) {
  const r = fit1(d.x, games);
  if (!r) { console.log(`  ${name.padEnd(20)}  (fit did not converge — not scored)`); continue; }
  const t = r.b / r.se;
  // A coefficient in logit units is not a quantity anyone can price. Translate:
  // how far does p move, at the base rate, for a one-sd move in this term?
  const shift = sigm(logit(base) + r.b * d.sd) - base;
  /* MINIMUM DETECTABLE EFFECT, printed on every row including the null ones.
   * A table of blanks is not evidence of absence until it says how large an
   * error would have had to be before this sample could see it. The smallest
   * beta that clears the bar is BAR*se by definition; expressed in the same
   * points-of-p units as the column beside it, it is the size of weight error
   * this run is blind to. */
  const mde = sigm(logit(base) + BAR * r.se * d.sd) - base;
  mdes.push(mde);
  const star = Math.abs(t) > BAR ? "  *" : "";
  console.log(`  ${name.padEnd(20)}${r.b.toFixed(3).padStart(8)}${t.toFixed(2).padStart(8)}` +
    `${((shift >= 0 ? "+" : "") + (shift * 100).toFixed(2) + " pts").padStart(14)}` +
    `${("+/-" + (mde * 100).toFixed(2)).padStart(12)}${star}` +
    (name in CONTAMINATED ? "  [look-ahead]" : ""));
  if (Math.abs(t) > BAR) hits.push({ name, ...r, t, sd: d.sd, x: d.x, shift });
}
console.log(`\n  * = |t| > ${BAR}, the Bonferroni-adjusted 5% bar for ${design.size} terms.`);
const medMde = mdes.slice().sort((a, b) => a - b)[Math.floor(mdes.length / 2)];
console.log(`  "detectable" is the smallest weight error this sample could have found, in the`);
console.log(`  same units. Median across terms: ${(medMde * 100).toFixed(2)} pts of p per 1sd of the term.`);

if (!hits.length) {
  console.log("\n  NOTHING CLEARS — and the column above says how much that is worth. A weight");
  console.log(`  error smaller than about ${(medMde * 100).toFixed(1)} pts of p per 1sd would not have shown up here,`);
  console.log("  so this is 'no LARGE weight error', not 'no weight error'.");
  console.log("");
  console.log("  What it does settle: the tout's pitching-vs-environment tilt is not something");
  console.log("  our own residuals confirm. Do not reweight on the tout comparison alone — it");
  console.log("  cannot separate 'our weight is wrong' from 'his selection is good for reasons");
  console.log("  we do not record', and our own data declines to break the tie.");
  if (skill < 0.02) {
    console.log("");
    console.log(`  And the null is the smaller finding here. The ranking removes ${(skill * 100).toFixed(2)}% of the`);
    console.log("  base-rate error on this sample. Reweighting terms inside a ranking that is");
    console.log("  barely separating games is the wrong repair; the discrimination is.");
  }
  process.exit(0);
}

/* JOINT FIT. The univariate table is one test per term against a null of zero,
 * and the terms are correlated with each other — awayPitBase and pitMult product
 * are close to the same statement twice. Fitting them together says which of
 * them survives the presence of the others, which is the only version of the
 * question that can be turned into a weight change. */
function fitN(cols, rows) {
  const k = cols.length;
  let b = new Array(k).fill(0);
  for (let it = 0; it < 80; it++) {
    const g = new Array(k).fill(0);
    const H = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let i = 0; i < rows.length; i++) {
      let z = logit(rows[i].p);
      for (let j = 0; j < k; j++) z += b[j] * cols[j][i];
      const q = sigm(z), w = q * (1 - q), e = rows[i].y - q;
      for (let j = 0; j < k; j++) {
        g[j] += cols[j][i] * e;
        for (let l = j; l < k; l++) H[j][l] += cols[j][i] * cols[l][i] * w;
      }
    }
    for (let j = 0; j < k; j++) for (let l = 0; l < j; l++) H[j][l] = H[l][j];
    for (let j = 0; j < k; j++) H[j][j] += 1e-8;      // guard a singular design
    const step = solve(H, g);
    if (!step) return null;
    let big = 0;
    for (let j = 0; j < k; j++) { b[j] += step[j]; big = Math.max(big, Math.abs(step[j])); }
    if (big < 1e-10) {
      const inv = invert(H);
      return inv ? { b, se: b.map((_, j) => Math.sqrt(inv[j][j])) } : null;
    }
  }
  return null;
}
function solve(A, v) {
  const k = v.length;
  const M = A.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-14) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const fac = M[r][c] / M[c][c];
      for (let j = c; j <= k; j++) M[r][j] -= fac * M[c][j];
    }
  }
  // row[i] IS the diagonal element of the reduced row — an earlier row[i][i]
  // indexed into a number, produced NaN for every solution, and every caller
  // read that as "singular" and returned null. It cost the calibration slope,
  // the joint fit and all five CV folds, and none of them said anything: the
  // univariate table is fit by a separate one-dimensional routine and looked
  // fine, so the failure surfaced only as sections quietly not printing.
  return M.map((row, i) => row[k] / row[i]);
}
function invert(A) {
  const k = A.length, out = [];
  for (let j = 0; j < k; j++) {
    const e = new Array(k).fill(0); e[j] = 1;
    const col = solve(A, e);
    if (!col) return null;
    out.push(col);
  }
  return out[0].map((_, i) => out.map((c) => c[i]));
}

/* RANK-REVEAL BEFORE THE JOINT FIT, and it is not a nicety here.
 *
 * The derived products are EXACT linear combinations of their components on this
 * scale: log(pitMult product) = log(awayPitMult) + log(homePitMult), to the last
 * bit. Any design holding all three is singular by construction, not by bad luck
 * with the data — so a ridge is the wrong tool, because there is no amount of it
 * that makes the third column mean something. It has to come out.
 *
 * Done by modified Gram-Schmidt rather than by a hand-written list of which
 * terms imply which: a list would be correct today and wrong the moment someone
 * adds a derived term, and the failure would look like the joint fit "not
 * printing" — which is exactly how the solver bug hid.
 */
const independent = (cols) => {
  const keep = [], basis = [];
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  for (let j = 0; j < cols.length; j++) {
    let v = cols[j].slice();
    const n0 = Math.sqrt(dot(v, v));
    if (n0 < 1e-12) continue;
    for (const u of basis) { const c = dot(v, u); v = v.map((x, i) => x - c * u[i]); }
    const n1 = Math.sqrt(dot(v, v));
    // Relative tolerance: an absolute one would drop small-scale columns that
    // are perfectly informative and keep large-scale ones that are duplicates.
    if (n1 / n0 < 1e-6) continue;
    basis.push(v.map((x) => x / n1));
    keep.push(j);
  }
  return keep;
};

console.log("\n=================== JOINTLY ===================");
const keepIdx = independent(hits.map((h) => h.x));
const droppedNames = hits.filter((_, j) => !keepIdx.includes(j)).map((h) => h.name);
if (droppedNames.length)
  console.log(`  dropped as exact combinations of the terms kept: ${droppedNames.join(", ")}`);
const jointHits = keepIdx.map((j) => hits[j]);
const jointNames = jointHits.map((h) => h.name);
const joint = fitN(jointHits.map((h) => h.x), games);
if (!joint) {
  console.log("  Joint fit did not converge even after the rank-reveal — reporting nothing rather");
  console.log("  than reporting the univariate coefficients as if they were joint ones.");
} else {
  console.log("  term                   beta       t   (all cleared terms fit together)");
  for (let j = 0; j < jointNames.length; j++) {
    const t = joint.b[j] / joint.se[j];
    console.log(`  ${jointNames[j].padEnd(20)}${joint.b[j].toFixed(3).padStart(8)}${t.toFixed(2).padStart(8)}` +
      (Math.abs(t) > 1.96 ? "  survives" : "  absorbed by the others"));
  }
}

/* OUT OF SAMPLE, SPLIT BY DATE. The number that decides anything.
 *
 * A slate shares weather, park, umpires and one fetch of our own data, so two
 * games from the same day are not independent draws. Splitting by game would put
 * one of them in train and the other in test and score the fit on information it
 * effectively already had. Dates are assigned to folds round-robin after sorting,
 * so the split is deterministic and reproducible run to run. */
console.log(`\n=================== OUT OF SAMPLE (${FOLDS}-fold, split by date) ===================`);
const dates = [...new Set(games.map((g) => g.date))].sort();
const foldOf = new Map(dates.map((d, i) => [d, i % FOLDS]));
const oof = new Array(games.length).fill(null);
let foldFail = 0;
for (let k = 0; k < FOLDS; k++) {
  const trIdx = [], teIdx = [];
  games.forEach((g, i) => (foldOf.get(g.date) === k ? teIdx : trIdx).push(i));
  // Rank-revealed inside the fold, not once outside it: a fold is a different
  // design matrix and can be degenerate where the full sample is not.
  const cand = jointHits.map((h) => trIdx.map((i) => h.x[i]));
  const kIdx = independent(cand);
  const f = fitN(kIdx.map((j) => cand[j]), trIdx.map((i) => games[i]));
  if (!f) { foldFail++; teIdx.forEach((i) => (oof[i] = games[i].p)); continue; }
  for (const i of teIdx) {
    let z = logit(games[i].p);
    kIdx.forEach((j, c) => { z += f.b[c] * jointHits[j].x[i]; });
    oof[i] = sigm(z);
  }
}
if (foldFail) console.log(`  ${foldFail} fold(s) failed to fit and fell back to the unadjusted model.`);
const b0 = brier(games, basePred), b1 = brier(games, oof);
const l0 = logloss(games, basePred), l1 = logloss(games, oof);
console.log(`  Brier      ${b0.toFixed(4)}  ->  ${b1.toFixed(4)}   (${((b0 - b1) / b0 * 100).toFixed(2)}% ${b1 < b0 ? "better" : "WORSE"})`);
console.log(`  log loss   ${l0.toFixed(4)}  ->  ${l1.toFixed(4)}   (${((l0 - l1) / l0 * 100).toFixed(2)}% ${l1 < l0 ? "better" : "WORSE"})`);

/* Per-game paired test on the squared error, because a Brier difference of a few
 * ten-thousandths on 1283 games is well inside the range that noise produces and
 * the percentage alone gives no way to tell. */
const dsq = games.map((g, i) => (basePred[i] - g.y) ** 2 - (oof[i] - g.y) ** 2);
const dse = sd(dsq) / Math.sqrt(dsq.length - 1);
const dt = dse ? mean(dsq) / dse : 0;
console.log(`  paired t on per-game squared error: ${dt.toFixed(2)}  (positive = the refit helps)`);

console.log("\n=================== READING ===================");
const clean = hits.filter((h) => !(h.name in CONTAMINATED));
const dirty = hits.filter((h) => h.name in CONTAMINATED);
if (b1 < b0 && dt > 1.96) {
  console.log(`  THE WEIGHTS ARE WRONG AND THE CORRECTION HOLDS OUT OF SAMPLE (t=${dt.toFixed(2)}).`);
  console.log(`  ${clean.length} term(s) predict our residual on inputs that are point-in-time:`);
  for (const h of clean)
    console.log(`    ${h.name}: beta ${h.b.toFixed(3)} (t=${h.t.toFixed(2)}), ${(h.shift >= 0 ? "+" : "") + (h.shift * 100).toFixed(2)} pts of p per 1sd`);
  if (dirty.length) {
    console.log("  and these cleared but sit on contaminated inputs, so they cannot ship on this:");
    for (const h of dirty) console.log(`    ${h.name} — ${CONTAMINATED[h.name]}`);
  }
  console.log("\n  Next step is the model weights themselves, not this script. Change one term,");
  console.log("  rebuild, and confirm on a held-out stretch of dates before it reaches a board.");
} else if (b1 < b0) {
  console.log(`  A term predicts our residual in sample, but the correction does not clearly`);
  console.log(`  survive the date-split holdout (paired t=${dt.toFixed(2)}, below 1.96). That is the`);
  console.log("  expected shape of a coefficient fit on one season of correlated slates.");
  console.log("  It is worth carrying as a hypothesis and not worth shipping as a weight.");
} else {
  console.log(`  The refit is WORSE out of sample (paired t=${dt.toFixed(2)}). The in-sample coefficients`);
  console.log("  are fitting slate-level noise. The weights stand; do not change them on this.");
}
console.log("");
console.log("  Standing caveat: one season, one cache, a point-in-time re-score rather than a");
console.log("  walk-forward test. This can say a weight is wrong. It cannot say the fixed");
console.log("  weight would have made money, and only live CLV can.");
