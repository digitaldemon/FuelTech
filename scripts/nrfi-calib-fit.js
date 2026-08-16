// Is NRFI_CALIB_SEED still the right shift for the model that ships?
//
//   node scripts/nrfi-calib-fit.js              # tout cache: more games, leaks
//   node scripts/nrfi-calib-fit.js --backtest   # backtest rows: fewer, rewound
//
// nrfi-calib-audit.js answers the same question live, but it re-scans the API
// and so is limited to a ~10-day window — around 130 games, where the 95% CI on
// the level is +/-8pp and essentially any c is inside it. Both sources here run
// the same arithmetic offline on a bigger sample. That is the only reason this
// exists.
//
// TWO SOURCES, AND THEY ARE NOT INTERCHANGEABLE.
//
// The TOUT CACHE holds ~1,272 graded games, but its `p` came from scanNrfi
// reading season-to-date pitcher and team feeds that were never rewound to the
// date being scored, so each game's inputs include that game and everything
// after it. That inflates DISCRIMINATION (AUC, and the spread of the reliability
// table below) and those numbers should be read as ceilings. It does not much
// move the MEAN prediction, which is the only quantity a single scalar `c`
// corrects — so the LEVEL section is the trustworthy part and the rest is
// context.
//
// The BACKTEST rows are ~409 games with the pitcher side rewound to the date
// scored. Fewer games, wider band — but it is the source that MATCHES LIVE
// CONDITIONS, and that asymmetry is easy to get backwards. The tout cache's leak
// is an artifact of re-scoring finished games with today's feeds; when the desk
// scans tomorrow's slate, season-to-date genuinely excludes the game being
// scored. So the backtest is not merely the more conservative source, it is the
// one whose inputs the live board actually has. **Prefer --backtest for any
// decision about the shipped constant**; use the tout cache to ask whether the
// two agree, because a disagreement between them is a leak measurement, not a
// calibration measurement.
//
// Neither tells you what to ship on its own. `c` is blended live against the
// seed by weight n/(n+558), so a seed that is off by less than the noise band is
// not worth moving: it would be replacing one number inside the CI with another.
const fs = require("fs");
const path = require("path");
const { modelSig } = require("./nrfi-model-lib");

const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");
const APP = path.join(__dirname, "..", "public", "desk", "app.jsx");

const lg = (p) => Math.log(p / (1 - p));
const ul = (x) => 1 / (1 + Math.exp(-x));
const pct = (x) => (x * 100).toFixed(1) + "%";
const sp = (x) => ((x >= 0 ? "+" : "") + x.toFixed(2) + "pp");

const USE_BACKTEST = process.argv.includes("--backtest");
const BACKTEST = path.join(__dirname, "nrfi-backtest.json");

// Every row carries its DATE, because the bootstrap below resamples slates and
// not games — see the note there.
let rows, provenance, sourceNote, rebuildCmd;

if (USE_BACKTEST) {
  if (!fs.existsSync(BACKTEST)) {
    console.error("no backtest artifact — run: node scripts/desk-nrfi-backtest.js 30");
    process.exit(1);
  }
  const bt = JSON.parse(fs.readFileSync(BACKTEST, "utf8"));
  rebuildCmd = "node scripts/desk-nrfi-backtest.js 30";
  // An ablation artifact is a model that is not shipped. Fitting the live
  // constant on it would be the same class of mistake the ablation filename was
  // introduced to prevent, one step further downstream.
  if (bt.ablations) {
    console.error(`REFUSING: ${path.basename(BACKTEST)} was written by an ABLATED run (${bt.ablations}).`);
    console.error("That is not the shipped model, so a constant fitted on it does not belong in app.jsx.");
    process.exit(1);
  }
  if (!bt.modelSig) {
    console.error(`${path.basename(BACKTEST)} predates modelSig, so there is no way to tell whether these`);
    console.error(`scores came from the model that ships. Rebuild: ${rebuildCmd}`);
    process.exit(1);
  }
  if (bt.modelSig !== modelSig) {
    console.error(`STALE ARTIFACT: built ${bt.at} from model ${bt.modelSig}, but the model is now ${modelSig}.`);
    console.error(`Rebuild: ${rebuildCmd}`);
    process.exit(1);
  }
  rows = bt.rows.filter((r) => Number.isFinite(r.p) && (r.a === 0 || r.a === 1))
    .map((r) => ({ p: r.p, y: r.a, date: r.k.slice(0, 10) }));
  provenance = `backtest artifact, written ${bt.at}, model ${bt.modelSig}, window ${bt.days} days`;
  sourceNote = "Inputs are REWOUND to the date scored on the pitcher side — this is the source\n" +
    "that matches live conditions. Offence-side feeds still leak (see desk-nrfi-backtest.js).";
} else {
  if (!fs.existsSync(CACHE)) {
    console.error("no cached scores — run: node scripts/nrfi-tout-vs-model.js 318949");
    process.exit(1);
  }
  const cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  rebuildCmd = "node scripts/nrfi-tout-vs-model.js 318949";
  // Same guard the ladder sweep runs, for the same reason: these are model
  // outputs, the cache is committed, and a calibration fitted to a model that no
  // longer exists would still print a plausible-looking number.
  if (cache.modelSig !== modelSig) {
    console.error(`STALE CACHE: built ${cache.at} from model ${cache.modelSig || "(none)"}, but the model is now ${modelSig}.`);
    console.error(`Rebuild: ${rebuildCmd}`);
    process.exit(1);
  }
  rows = [...new Map(cache.slates.flatMap(([d, gs]) => gs.map((g) => [g.gamePk, { g, d }])).map(([k, v]) => [k, v])).values()]
    .filter(({ g }) => Number.isFinite(g.p) && (g.actual === 0 || g.actual === 1))
    .map(({ g, d }) => ({ p: g.p, y: g.actual, date: d }));
  provenance = `${cache.dates.length} slates, season ${cache.season}, cache written ${cache.at}, model ${cache.modelSig}`;
  sourceNote = "Inputs were NOT rewound — discrimination numbers below are CEILINGS (see header).";
}

if (rows.length < 200) { console.error(`only ${rows.length} graded games — not enough to fit a level`); process.exit(1); }

const src = fs.readFileSync(APP, "utf8");
const seed = src.match(/const NRFI_CALIB_SEED = \{ c: (-?[\d.]+), n: (\d+)/);
if (!seed) throw new Error("could not read NRFI_CALIB_SEED from app.jsx");
const SEED_C = Number(seed[1]), SEED_N = Number(seed[2]);

// The shipped shift clamps before and after, so the fit has to clamp too or it
// would be scoring a transform the desk never applies.
const shift = (p, c) => Math.min(0.98, Math.max(0.02, ul(lg(Math.min(0.98, Math.max(0.02, p))) + c)));

const n = rows.length;
const k = rows.filter((r) => r.y === 1).length;
const actual = k / n;
const meanP = rows.reduce((s, r) => s + r.p, 0) / n;

function wilson(kk, nn) {
  const p = kk / nn, z = 1.96, z2 = z * z;
  const c0 = (p + z2 / (2 * nn)) / (1 + z2 / nn);
  const h = z * Math.sqrt((p * (1 - p)) / nn + z2 / (4 * nn * nn)) / (1 + z2 / nn);
  return [c0 - h, c0 + h];
}
const brier = (c) => rows.reduce((s, r) => { const d = shift(r.p, c) - r.y; return s + d * d; }, 0) / n;
const logloss = (c) => -rows.reduce((s, r) => { const q = shift(r.p, c); return s + (r.y ? Math.log(q) : Math.log(1 - q)); }, 0) / n;

// Maximum-likelihood c, which is the estimator the seed claims to be. Brier has
// a different optimum than log-likelihood; both are printed so a disagreement is
// visible rather than hidden behind whichever one was chosen.
function fitC(score) {
  let best = { c: 0, v: Infinity };
  for (let c = -1.0; c <= 1.0; c += 0.001) { const v = score(c); if (v < best.v) best = { c, v }; }
  return best.c;
}
const cML = fitC(logloss);
const cBrier = fitC(brier);

console.log(`calibration fit over ${n} graded games — SOURCE: ${USE_BACKTEST ? "BACKTEST (rewound)" : "TOUT CACHE (leaky)"}`);
console.log(`  ${provenance}`);
console.log(`\n${sourceNote}`);

const [lo, hi] = wilson(k, n);
console.log("\n=================== LEVEL ===================");
console.log(`  mean raw pNRFI        ${pct(meanP)}`);
console.log(`  actual NRFI rate      ${pct(actual)}  [${pct(lo)}, ${pct(hi)}]`);
console.log(`  raw bias              ${sp((actual - meanP) * 100)}`);
console.log(`  implied shift         c = ${(lg(actual) - lg(meanP) >= 0 ? "+" : "") + (lg(actual) - lg(meanP)).toFixed(3)}`);

// The seed is only worth moving if the data can distinguish it from what ships.
// Bootstrap the fit so the answer is a band, not a point — a point estimate here
// invites exactly the over-reading that the pitcher table already fell for.
/* SEEDED, and that is not a style preference.
 *
 * This bootstrap ran on Math.random, and the shipped seed happens to sit within
 * 0.0005 of the band's upper edge, so the in/out verdict was being decided by
 * resampling noise. Measured on the 1,282-game cache: 40 runs of this script
 * over the SAME rows printed INSIDE twice and OUTSIDE thirty-eight times, with
 * the upper bound wandering -0.0734..-0.0602 around a seed of -0.063. The two
 * branches said opposite things — "leave it" versus "the shipped shift shows
 * the board in the wrong direction" — so running the tool twice produced
 * contradictory advice about a live constant, and neither run mentioned that it
 * was a coin flip.
 *
 * mulberry32 with a fixed seed: same cache in, same answer out, so a change in
 * this report means a change in the data. */
const B = 2000;
const mulberry32 = (a) => () => {
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rnd = mulberry32(0x9E3779B9);
/* Bootstrap the estimator that gets REPORTED, not a cousin of it.
 *
 * This resampled lg(actual)-lg(meanPred), the shortcut, while the headline
 * numbers beside it are the max-likelihood and min-Brier fits — and app.jsx
 * already notes the shortcut overshoots toward 50%. Comparing a shipped
 * constant against a band built from a different estimator is how a boundary
 * call goes wrong quietly. On this sample the two agree to 0.0017 (ML -0.1790
 * vs shortcut -0.1773), so this changes no conclusion today, which is the
 * reason to fix it while it is free. */
const mlOf = (rs) => {
  let c = 0;
  for (let it = 0; it < 60; it++) {
    let g = 0, h = 0;
    for (const r of rs) {
      const q = ul(lg(Math.min(0.98, Math.max(0.02, r.p))) + c);
      g += r.y - q; h += q * (1 - q);
    }
    if (!(h > 1e-12)) break;
    const step = g / h; c += step;
    if (Math.abs(step) < 1e-10) break;
  }
  return c;
};
/* Resample SLATES, not games.
 *
 * This drew n games i.i.d., which treats fifteen games off one schedule call as
 * fifteen independent draws. They are not: a slate shares the weather systems,
 * the umpire crews, the day/night mix, and one fetch of our own upstream feeds,
 * so a bad afternoon moves a whole cluster together. An i.i.d. bootstrap
 * therefore reports a band NARROWER than the data supports, which is the
 * dangerous direction — it makes the shipped seed look more distinguishable
 * from the fit than it is, on precisely the boundary call this section exists
 * to adjudicate.
 *
 * This widens the CI. That is the point, and it strengthens rather than
 * reverses the standing "leave it alone" verdict. Any percentile quoted from a
 * run before this change came from the narrow band. */
const dates = [...new Set(rows.map((r) => r.date))];
const byDate = new Map(dates.map((d) => [d, rows.filter((r) => r.date === d)]));
const boot = [];
for (let b = 0; b < B; b++) {
  const s = [];
  for (let i = 0; i < dates.length; i++) s.push(...byDate.get(dates[(rnd() * dates.length) | 0]));
  boot.push(mlOf(s));
}
boot.sort((a, b2) => a - b2);
const bLo = boot[Math.floor(B * 0.025)], bHi = boot[Math.floor(B * 0.975)];

console.log("\n=================== c: SHIPPED vs FITTED ===================");
console.log(`  shipped seed          c = ${SEED_C >= 0 ? "+" : ""}${SEED_C.toFixed(3)}  (n=${SEED_N}, ${(src.match(/source: "([^"]+)"/) || [])[1] || "?"})`);
console.log(`  max-likelihood fit    c = ${cML >= 0 ? "+" : ""}${cML.toFixed(3)}`);
console.log(`  min-Brier fit         c = ${cBrier >= 0 ? "+" : ""}${cBrier.toFixed(3)}`);
console.log(`  bootstrap 95% CI      [${bLo >= 0 ? "+" : ""}${bLo.toFixed(3)}, ${bHi >= 0 ? "+" : ""}${bHi.toFixed(3)}]  (${B} seeded resamples)`);
/* Report WHERE the constant sits, not just whether it cleared a line.
 *
 * A binary in/out is the wrong output shape for this question: it is most
 * likely to flip exactly when the constant is near an edge, which is exactly
 * when someone is deciding whether to move it. The percentile is continuous,
 * so a seed at the 2% mark reads as "barely inside" instead of "INSIDE". */
const below = boot.filter((x) => x < SEED_C).length / B;
const pctile = below * 100;
const edge = Math.min(pctile, 100 - pctile);
console.log(`  shipped seed sits at the ${pctile.toFixed(1)} percentile of that distribution`);
if (edge < 5) {
  console.log(`  => BOUNDARY CASE. The seed is ${edge.toFixed(1)}% from the tail, so "inside the 95%`);
  console.log(`     band" is not a stable statement — before this bootstrap was seeded, repeat runs`);
  console.log(`     on identical data flipped the call. Read it as: the sample leans toward a`);
  console.log(`     ${cML < SEED_C ? "MORE" : "LESS"} negative shift than ships, but not decisively. More games, not a new constant.`);
} else if (edge < 25) {
  console.log(`  => the sample leans toward a ${cML < SEED_C ? "more" : "less"} negative shift, well short of decisive.`);
  console.log(`     Changing it would swap one number inside the band for another. Leave it.`);
} else {
  console.log(`  => the shipped seed sits near the middle of the fit's own distribution. Nothing to do.`);
}

console.log("\n=================== SCORE ===================");
console.log("                          Brier     log loss");
for (const [name, c] of [["uncalibrated  c=0.000", 0], [`shipped       c=${SEED_C >= 0 ? "+" : ""}${SEED_C.toFixed(3)}`, SEED_C],
  [`ML fit        c=${cML >= 0 ? "+" : ""}${cML.toFixed(3)}`, cML]]) {
  console.log(`  ${name}   ${brier(c).toFixed(5)}   ${logloss(c).toFixed(5)}`);
}
// A Brier improvement of 0.0002 is not a reason to touch a constant. Say what
// the number is worth in the only unit that matters here.
const gain = brier(0) - brier(cML);
console.log(`\n  best possible Brier gain from ANY flat shift: ${gain.toFixed(5)}`);
console.log(`  For scale, the base-rate-only model scores ${(actual * (1 - actual)).toFixed(5)}, and the`);
console.log(`  shipped model ${brier(SEED_C).toFixed(5)} — a flat shift moves ${(gain / Math.max(1e-9, actual * (1 - actual) - brier(SEED_C)) * 100).toFixed(1)}% of the model's own edge over that.`);

// Level is what `c` fixes; slope is what it cannot. If the model is systematically
// over-confident, no intercept repairs it and the honest reading is that the
// ladder thresholds — not the calibration — are the wrong lever.
let a = 1, b0 = 0;
for (let it = 0; it < 200; it++) {
  let g1 = 0, g2 = 0, h11 = 0, h12 = 0, h22 = 0;
  for (const r of rows) {
    const x = lg(Math.min(0.98, Math.max(0.02, r.p)));
    const q = ul(a * x + b0), w = q * (1 - q), e = r.y - q;
    g1 += e * x; g2 += e; h11 += w * x * x; h12 += w * x; h22 += w;
  }
  const det = h11 * h22 - h12 * h12;
  if (!(Math.abs(det) > 1e-12)) break;
  a += (h22 * g1 - h12 * g2) / det;
  b0 += (h11 * g2 - h12 * g1) / det;
}
console.log("\n=================== SLOPE (full Platt) ===================");
console.log(`  logit(actual) = ${a.toFixed(3)} * logit(pred) ${b0 >= 0 ? "+" : "-"} ${Math.abs(b0).toFixed(3)}`);
console.log(`  slope 1.0 = correctly scaled; <1 = over-confident, >1 = under-confident.`);
if (USE_BACKTEST) {
  console.log(`  These inputs are rewound, so this slope is NOT inflated by leakage the way`);
  console.log(`  the tout cache's is — read it at face value, with the caveat that 409 games`);
  console.log(`  put roughly +/-0.5 around it, so it is about 1 SE from 1.0.`);
} else {
  console.log(`  NOTE: leakage inflates slope here, so a value near 1 on this cache is`);
  console.log(`  consistent with the live model being over-confident. Treat as a ceiling.`);
}

console.log("\n=================== RELIABILITY (shipped c) ===================");
const sorted = rows.map((r) => ({ q: shift(r.p, SEED_C), y: r.y })).sort((x, y) => x.q - y.q);
const BINS = 8, per = Math.ceil(sorted.length / BINS);
console.log("   bin        n    predicted    actual      gap");
for (let i = 0; i < sorted.length; i += per) {
  const b = sorted.slice(i, i + per);
  const pr = b.reduce((s, r) => s + r.q, 0) / b.length;
  const ac = b.reduce((s, r) => s + r.y, 0) / b.length;
  console.log(`  ${String(i / per + 1).padStart(3)}   ${String(b.length).padStart(5)}    ${pct(pr).padStart(7)}   ${pct(ac).padStart(7)}   ${sp((ac - pr) * 100).padStart(8)}`);
}
console.log("\n  Gaps should straddle zero with no trend. A monotone drift across bins is a");
console.log("  slope problem, which a flat c cannot fix; a constant offset is a level problem,");
console.log("  which is exactly what c is for.");
