// Is NRFI_CALIB_SEED still the right shift for the model that ships?
//
//   node scripts/nrfi-calib-fit.js
//
// nrfi-calib-audit.js answers the same question live, but it re-scans the API
// and so is limited to a ~10-day window — around 130 games, where the 95% CI on
// the level is +/-8pp and essentially any c is inside it. The tout cache holds
// 1,272 graded games scored by the current model, so the same arithmetic runs
// offline on ten times the sample. That is the only reason this exists.
//
// THE LEAKAGE CAVEAT, RESTATED. The cached `p` came from scanNrfi reading
// season-to-date pitcher and team feeds that were never rewound to the date
// being scored, so each game's inputs include that game and everything after it.
// That inflates DISCRIMINATION (AUC, and the spread of the reliability table
// below) and those numbers should be read as ceilings. It does not much move the
// MEAN prediction, which is the only quantity a single scalar `c` corrects — so
// the LEVEL section is the trustworthy part and the rest is context.
//
// It also does not tell you what to ship. `c` is blended live against the seed
// by weight n/(n+558), so a seed that is off by less than the noise band is not
// worth moving: it would be replacing one number inside the CI with another.
const fs = require("fs");
const path = require("path");
const { modelSig } = require("./nrfi-model-lib");

const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");
const APP = path.join(__dirname, "..", "public", "desk", "app.jsx");

const lg = (p) => Math.log(p / (1 - p));
const ul = (x) => 1 / (1 + Math.exp(-x));
const pct = (x) => (x * 100).toFixed(1) + "%";
const sp = (x) => ((x >= 0 ? "+" : "") + x.toFixed(2) + "pp");

if (!fs.existsSync(CACHE)) {
  console.error("no cached scores — run: node scripts/nrfi-tout-vs-model.js 318949");
  process.exit(1);
}
const cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));
// Same guard the ladder sweep runs, for the same reason: these are model
// outputs, the cache is committed, and a calibration fitted to a model that no
// longer exists would still print a plausible-looking number.
if (cache.modelSig !== modelSig) {
  console.error(`STALE CACHE: built ${cache.at} from model ${cache.modelSig || "(none)"}, but the model is now ${modelSig}.`);
  console.error("Rebuild: node scripts/nrfi-tout-vs-model.js 318949");
  process.exit(1);
}

const rows = [...new Map(cache.slates.flatMap(([, gs]) => gs).map((g) => [g.gamePk, g])).values()]
  .filter((g) => Number.isFinite(g.p) && (g.actual === 0 || g.actual === 1))
  .map((g) => ({ p: g.p, y: g.actual }));
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

console.log(`calibration fit over ${n} graded games (${cache.dates.length} slates, season ${cache.season})`);
console.log(`cache written ${cache.at}, model ${cache.modelSig}`);
console.log(`\nDiscrimination numbers below are CEILINGS — the cached inputs were not rewound (see header).`);

const [lo, hi] = wilson(k, n);
console.log("\n=================== LEVEL ===================");
console.log(`  mean raw pNRFI        ${pct(meanP)}`);
console.log(`  actual NRFI rate      ${pct(actual)}  [${pct(lo)}, ${pct(hi)}]`);
console.log(`  raw bias              ${sp((actual - meanP) * 100)}`);
console.log(`  implied shift         c = ${(lg(actual) - lg(meanP) >= 0 ? "+" : "") + (lg(actual) - lg(meanP)).toFixed(3)}`);

// The seed is only worth moving if the data can distinguish it from what ships.
// Bootstrap the fit so the answer is a band, not a point — a point estimate here
// invites exactly the over-reading that the pitcher table already fell for.
const B = 2000;
const boot = [];
for (let b = 0; b < B; b++) {
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = rows[(Math.random() * n) | 0];
  let sy = 0, sp2 = 0;
  for (const r of idx) { sy += r.y; sp2 += r.p; }
  const a = sy / n, m = sp2 / n;
  boot.push(lg(Math.min(0.999, Math.max(0.001, a))) - lg(m));
}
boot.sort((a, b2) => a - b2);
const bLo = boot[Math.floor(B * 0.025)], bHi = boot[Math.floor(B * 0.975)];

console.log("\n=================== c: SHIPPED vs FITTED ===================");
console.log(`  shipped seed          c = ${SEED_C >= 0 ? "+" : ""}${SEED_C.toFixed(3)}  (n=${SEED_N}, ${(src.match(/source: "([^"]+)"/) || [])[1] || "?"})`);
console.log(`  max-likelihood fit    c = ${cML >= 0 ? "+" : ""}${cML.toFixed(3)}`);
console.log(`  min-Brier fit         c = ${cBrier >= 0 ? "+" : ""}${cBrier.toFixed(3)}`);
console.log(`  bootstrap 95% CI      [${bLo >= 0 ? "+" : ""}${bLo.toFixed(3)}, ${bHi >= 0 ? "+" : ""}${bHi.toFixed(3)}]  (${B} resamples)`);
const inside = SEED_C >= bLo && SEED_C <= bHi;
console.log(`  => the shipped seed is ${inside ? "INSIDE" : "OUTSIDE"} the CI of the fit on this sample.`);
console.log(inside
  ? "     Changing it would swap one number inside the band for another. Leave it."
  : "     This sample says the shipped shift shows the board in the wrong direction.");

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
console.log(`  NOTE: leakage inflates slope here, so a value near 1 on this cache is`);
console.log(`  consistent with the live model being over-confident. Treat as a ceiling.`);

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
