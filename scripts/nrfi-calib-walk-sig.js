/* Is the walk-forward gap between two calibration seeds bigger than the noise?
 *
 * nrfi-calib-walk.js ranks arms by out-of-sample Brier and stops there. On the
 * 1154-game window it separates the shipped seed from a 120-day refit by
 * 0.00022 Brier, which is the kind of number that looks decisive in a sorted
 * table and evaporates under a standard error. A ranking without error bars
 * cannot tell "the refit is better" from "the refit is the one that happened to
 * win this sample", and those recommend opposite actions.
 *
 * So: same arms, same walk-forward discipline, but score PER GAME and bootstrap
 * the paired difference. Paired, because both arms see identical games and the
 * game-to-game variance is enormous compared to the gap — an unpaired test here
 * would have no power at all.
 *
 * CLUSTERED BY DATE. Games on one slate share a weather regime, a set of
 * probable starters, and the same live-calibration history, so their residuals
 * are correlated and resampling rows independently would understate the error.
 * Resample whole days with replacement instead. Same choice nrfi-backtest-ab.js
 * makes, for the same reason.
 *
 *   node scripts/nrfi-calib-walk-sig.js [artifact.json] [burnInDays]
 *
 * ---------------------------------------------------------------------------
 * WHAT IT SAID, 2026-08-16, on nrfi-backtest.lambda-path.json (1154 games over
 * 88 slates, out of sample):
 *
 *   shipped - raw        -0.00204   se 0.00126   t -1.63
 *   refit - shipped      -0.00022   se 0.00023   t -0.94
 *   refit558 - shipped   -0.00016   se 0.00033   t -0.48
 *   refit - refit558     -0.00006   se 0.00011   t -0.55
 *
 * So NRFI_CALIB_SEED was left at c=-0.063, n=558. The 120-day refit says
 * c=-0.191 — three times as large, and its own note asked for exactly this
 * re-run — but the refit cannot be told apart from the shipped value on any
 * window, and the larger n buys nothing on top of the new c.
 *
 * THE BRIER COLUMN IS NOT THE INTERESTING PART, AND READING IT ALONE GETS THE
 * SECOND QUESTION WRONG. "Does calibrating beat not calibrating" comes out at
 * t -1.63 above, which reads as "cannot tell". That is a power problem, not a
 * result: Brier is a proper scoring rule but a blunt instrument for a pure
 * level shift, because the per-game variance of (p - outcome)^2 dwarfs a 5pp
 * move in the mean. Ask about the level directly instead and it is not close —
 * over the same games the uncalibrated model predicts NRFI at 53.96% against an
 * actual 49.13%, a 4.94pp lean with a date-clustered se of 1.56pp, t 3.16.
 * Under the shipped seed that residual is 0.48pp (t 0.31); under the refit,
 * -0.35pp (t -0.22). Both land it on zero.
 *
 * Which is the whole reason the seeds tie. The live fit converges regardless:
 * the effective c walks -0.120 -> -0.164 starting from the shipped seed and
 * -0.193 -> -0.196 starting from the refit, so the seed only decides the first
 * few weeks. Bucketing by accumulated live history to test that cold-start
 * argument does not rescue it either — the refit is ~1.5-3pp less NRFI-lean in
 * every bucket, but the buckets straddle zero and it is worse in one of them.
 *
 * Read together: the CALIBRATION is load-bearing and the SEED VALUE is not.
 * ---------------------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const ART = process.argv[2] || "nrfi-backtest.lambda-path.json";
const BURN = Number(process.argv[3] || 30);
const B = 4000;
const art = JSON.parse(fs.readFileSync(path.join(__dirname, ART), "utf8"));

// Read the shipped seed from the working tree, never retype it here.
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
const seedM = src.match(/const NRFI_CALIB_SEED = (\{[^}]*\})/);
if (!seedM) throw new Error("NRFI_CALIB_SEED not found in app.jsx — the shape changed, fix this reader");
const SEED = eval("(" + seedM[1] + ")");

const lg = (p) => Math.log(p / (1 - p));
const ul = (x) => 1 / (1 + Math.exp(-x));
const clamp = (p) => Math.min(0.98, Math.max(0.02, p));

function solveShift(ps, target) {
  let c = 0;
  for (let i = 0; i < 60; i++) {
    let m = 0, d = 0;
    for (const p of ps) { const q = ul(lg(clamp(p)) + c); m += q; d += q * (1 - q); }
    m /= ps.length; d /= ps.length;
    if (!(d > 1e-9)) break;
    const step = (target - m) / d;
    c += step;
    if (Math.abs(step) < 1e-12) break;
  }
  return Number.isFinite(c) ? c : 0;
}

const byDay = new Map();
for (const r of art.rows) {
  const d = r.k.slice(0, 10);
  if (!byDay.has(d)) byDay.set(d, []);
  byDay.get(d).push(r);
}
const days = [...byDay.keys()].sort();

/* The artifact's own n can be one too high: gamePk 824912 was suspended on
 * 2026-06-16 and resumed on 06-17, so the schedule listed it under both dates
 * and desk-nrfi-backtest.js scored it twice. Fixed at the source (that script
 * now filters on officialDate), but artifacts written before that fix still
 * carry the inflated header. Take n from the rows rather than the header, so
 * the seed weight matches the games it was actually fit on. */
const REFIT_N = art.rows.length;

const ARMS = [
  /* n = Infinity makes the live-fit weight zero, so this arm is the shipped seed
   * frozen forever; c = 0 on top of that is no calibration at all. Included as
   * the floor, because "which seed" is only worth arguing about if calibrating
   * beats not calibrating by more than the seeds differ from each other. */
  { key: "raw", name: "raw (no calibration at all)", c: 0, n: Infinity },
  { key: "shipped", name: `app blend, shipped seed (c=${SEED.c}, n=${SEED.n})`, c: SEED.c, n: SEED.n },
  { key: "refit", name: `app blend, refit (c=${art.c.toFixed(3)}, n=${REFIT_N})`, c: art.c, n: REFIT_N },
  { key: "refit558", name: `app blend, refit c @ shipped n (c=${art.c.toFixed(3)}, n=${SEED.n})`, c: art.c, n: SEED.n },
];

// Per-game squared error for every arm, walked forward by day.
const per = {}; for (const a of ARMS) per[a.key] = [];
const dayOf = [];
let hist = [];
for (let i = 0; i < days.length; i++) {
  const games = byDay.get(days[i]);
  if (i >= BURN) {
    const liveC = solveShift(hist.map((r) => r.p), hist.reduce((s, r) => s + r.a, 0) / hist.length);
    for (const a of ARMS) {
      const w = hist.length / (hist.length + a.n);
      const c = w * liveC + (1 - w) * a.c;
      for (const g of games) per[a.key].push((clamp(ul(lg(clamp(g.p)) + c)) - g.a) ** 2);
    }
    for (const g of games) dayOf.push(i);
  }
  hist = hist.concat(games);
}

const N = dayOf.length;
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;

// Deterministic RNG so a rerun reproduces the interval exactly.
let s = 0x9e3779b9;
const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };

// Row indices grouped by eval day, so a bootstrap draw takes a whole slate.
const slate = new Map();
dayOf.forEach((d, i) => { if (!slate.has(d)) slate.set(d, []); slate.get(d).push(i); });
const slates = [...slate.values()];

function pairedBoot(aKey, bKey) {
  const A = per[aKey], Bv = per[bKey];
  const obs = mean(A) - mean(Bv);
  const diffs = [];
  for (let b = 0; b < B; b++) {
    let sa = 0, sb = 0, k = 0;
    for (let j = 0; j < slates.length; j++) {
      const g = slates[Math.floor(rnd() * slates.length)];
      for (const i of g) { sa += A[i]; sb += Bv[i]; k++; }
    }
    diffs.push(sa / k - sb / k);
  }
  diffs.sort((x, y) => x - y);
  const se = Math.sqrt(mean(diffs.map((d) => (d - mean(diffs)) ** 2)));
  return { obs, se, lo: diffs[Math.floor(B * 0.025)], hi: diffs[Math.floor(B * 0.975)],
    t: se > 0 ? obs / se : 0 };
}

console.log(`artifact ${ART}   sig ${art.modelSig}`);
console.log(`${days.length} days, ${art.rows.length} games; scored the last ${days.length - BURN} days = ${N} games`);
console.log(`bootstrap B=${B}, resampling ${slates.length} whole slates\n`);
console.log("arm                                                    Brier (OOS)");
for (const a of ARMS) console.log("  " + a.name.padEnd(52) + mean(per[a.key]).toFixed(5));

console.log("\npaired differences (negative = the first arm is better)");
const pairs = [["shipped", "raw"], ["refit", "shipped"], ["refit558", "shipped"], ["refit", "refit558"]];
for (const [x, y] of pairs) {
  const r = pairedBoot(x, y);
  console.log(`  ${(x + " - " + y).padEnd(24)} ${(r.obs >= 0 ? "+" : "") + r.obs.toFixed(5)}` +
    `   se ${r.se.toFixed(5)}   t ${(r.t >= 0 ? "+" : "") + r.t.toFixed(2)}` +
    `   95% [${r.lo.toFixed(5)}, ${r.hi.toFixed(5)}]`);
}

/* The decision this is for. A seed is two numbers and they answer different
 * questions: c is where the model sits, n is how long that opinion outvotes the
 * games you have actually graded. Reporting only "the refit wins" collapses
 * them. */
console.log("\n  shipped - raw          = does calibrating beat not calibrating");
console.log("  refit - shipped        = changing BOTH c and n");
console.log("  refit558 - shipped     = changing c only, trusting it no harder than the seed it replaces");
console.log("  refit - refit558       = what the larger n buys on top of the new c");
console.log("\nAn interval straddling 0 means this window cannot separate the arms.");
