/* Is the shipped calibration seed the right one, judged OUT OF SAMPLE?
 *
 * NRFI_CALIB_SEED is a bias shift in logit space, and its own note has said
 * since it was written that it rests on one 45-day window and should be re-run.
 * The 120-day artifact now on disk disagrees with it by a factor of three
 * (-0.063 against -0.191), which is either a stale seed or a regime change, and
 * the two want opposite actions.
 *
 * The naive way to settle it is to refit on everything and report a better
 * in-sample Brier. That is guaranteed to happen and means nothing — a shift fit
 * to land the mean on the observed rate will always land the mean on the
 * observed rate. The only honest question is whether a seed fit on the PAST
 * improves games in the FUTURE, so every arm here is scored strictly on days it
 * was not fit on.
 *
 * Walk-forward by DATE, not by row index. Games on the same day settle after
 * each other in wall-clock terms but none of them is available to calibrate any
 * other at the time the board prices them, so a leave-one-out over rows would
 * quietly let a 7:05 game calibrate the 7:10 next to it.
 *
 *   node scripts/nrfi-calib-walk.js [artifact.json] [burnInDays]
 */
const fs = require("fs");
const path = require("path");

const ART = process.argv[2] || "nrfi-backtest.json";
const BURN = Number(process.argv[3] || 30);
const art = JSON.parse(fs.readFileSync(path.join(__dirname, ART), "utf8"));

/* The shipped seed is READ FROM THE WORKING TREE, never retyped here. A test
 * that decides whether to replace a constant must be looking at the constant
 * that is actually shipping; hardcoding it is how a "no change" verdict gets
 * issued against a value nobody is running any more. */
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
const seedM = src.match(/const NRFI_CALIB_SEED = (\{[^}]*\})/);
if (!seedM) throw new Error("NRFI_CALIB_SEED not found in app.jsx — the shape changed, fix this reader");
const SEED = eval("(" + seedM[1] + ")");

const lg = (p) => Math.log(p / (1 - p));
const ul = (x) => 1 / (1 + Math.exp(-x));
const clamp = (p) => Math.min(0.98, Math.max(0.02, p));

/* Newton solve for the shift that lands the calibrated MEAN on the observed
 * rate. Deliberately the same objective nrfiCalibration uses for liveC rather
 * than a maximum-likelihood Platt intercept: the point is to evaluate the thing
 * that ships, and if the two disagreed this test would be scoring a solver the
 * app does not run. */
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

// Days, in order, each carrying its games.
const byDay = new Map();
for (const r of art.rows) {
  const d = r.k.slice(0, 10);
  if (!byDay.has(d)) byDay.set(d, []);
  byDay.get(d).push(r);
}
const days = [...byDay.keys()].sort();

/* Each arm is a function from (history, game) to a calibrated probability.
 * History is every game on a STRICTLY EARLIER day. */
const arms = {
  "raw (no calibration)": () => (p) => p,
  ["shipped seed c=" + SEED.c + " alone"]: () => (p) => ul(lg(clamp(p)) + SEED.c),
  "walk-forward fit, no seed": (hist) => {
    const c = solveShift(hist.map((r) => r.p), hist.reduce((s, r) => s + r.a, 0) / hist.length);
    return (p) => ul(lg(clamp(p)) + c);
  },
};
/* The two arms that matter, because they are what the app actually computes:
 *   lcW  = nLive / (nLive + seed.n)
 *   c    = lcW * liveC + (1 - lcW) * seed.c
 * A seed is therefore two numbers, and n is not bookkeeping — it is how long
 * the seed keeps outvoting the games you have actually graded. Comparing only
 * the c values would miss that entirely. */
const CANDIDATES = [
  { name: "app blend, shipped seed", c: SEED.c, n: SEED.n },
  { name: "app blend, 120d refit", c: art.c, n: art.n },
  // Same refit, but trusted no harder than the seed it replaces. Separates "the
  // number moved" from "the number should carry more weight", which are two
  // different claims and only one of them is measured by a refit.
  { name: "app blend, 120d refit @ n=558", c: art.c, n: SEED.n },
];
for (const cand of CANDIDATES) {
  arms[cand.name] = (hist) => {
    const liveC = solveShift(hist.map((r) => r.p), hist.reduce((s, r) => s + r.a, 0) / hist.length);
    const w = hist.length / (hist.length + cand.n);
    const c = w * liveC + (1 - w) * cand.c;
    return (p) => ul(lg(clamp(p)) + c);
  };
}

const score = {};
for (const k of Object.keys(arms)) score[k] = { se: 0, ll: 0, n: 0, hit: 0, picks: 0 };

let hist = [];
for (let i = 0; i < days.length; i++) {
  const games = byDay.get(days[i]);
  if (i >= BURN) {
    for (const [name, mk] of Object.entries(arms)) {
      const f = mk(hist);
      const s = score[name];
      for (const g of games) {
        const q = clamp(f(g.p));
        s.se += (q - g.a) ** 2;
        s.ll += -(g.a * Math.log(q) + (1 - g.a) * Math.log(1 - q));
        s.n++;
        // Pick side only counts where the arm has an opinion. A calibration
        // shift CAN flip a coin-flip game across 50%, so this is not constant
        // across arms and is worth reporting alongside Brier.
        if (Math.abs(q - 0.5) > 1e-9) { s.picks++; if ((q >= 0.5 ? 1 : 0) === g.a) s.hit++; }
      }
    }
  }
  hist = hist.concat(games);
}

const evalN = score[Object.keys(arms)[0]].n;
const rate = (() => { let a = 0, n = 0; for (let i = BURN; i < days.length; i++) for (const g of byDay.get(days[i])) { a += g.a; n++; } return a / n; })();
console.log("artifact " + ART + "   modelSig " + art.modelSig + "   ablations " + (art.ablations || "none"));
console.log(days.length + " days, " + art.rows.length + " games; scoring the last " +
  (days.length - BURN) + " days = " + evalN + " games, actual NRFI rate " + (rate * 100).toFixed(2) + "%");
console.log("shipped seed as read from app.jsx: c=" + SEED.c + " n=" + SEED.n);
console.log("120d artifact refit:               c=" + art.c.toFixed(5) + " n=" + art.n + "\n");

const base = score["raw (no calibration)"];
const rows = Object.entries(score).map(([name, s]) => ({
  name, brier: s.se / s.n, ll: s.ll / s.n, acc: s.picks ? s.hit / s.picks : 0, picks: s.picks,
}));
rows.sort((a, b) => a.brier - b.brier);
console.log("arm                                   Brier      vs raw   logloss   pick acc");
for (const r of rows) {
  const d = r.brier - base.se / base.n;
  console.log("  " + r.name.padEnd(35) + r.brier.toFixed(5) + "  " +
    (d <= 0 ? "" : "+") + d.toFixed(5) + "  " + r.ll.toFixed(5) + "   " +
    (r.acc * 100).toFixed(2) + "% of " + r.picks);
}
console.log("\nLower Brier is better; 'vs raw' negative means the calibration earned its place.");
