/* What does each confidence rung earn AT THE MARKET'S PRICE?
 *
 * nrfi-walk-rungs.js answers "does the rung beat a coin flip" and that is the
 * wrong bar for money. A rung can hit 70% and still lose, because the market may
 * already be charging 70% for that side — hit rate is only edge relative to what
 * you paid. And nrfi-vs-kalshi.js sizes on |model - price|, which is a DIFFERENT
 * selector: it inverts (small disagreements pay, large ones lose), so its verdict
 * says nothing about the rungs the board actually publishes.
 *
 * So: walk forward exactly as nrfi-walk-rungs.js does, classify each game into
 * the rung the app would have shown, then buy the called side at the pre-first-
 * pitch Kalshi price and see what comes back.
 *
 *   node scripts/nrfi-rung-roi.js [artifact.json] [burnInDays]
 *
 * READ BEFORE BELIEVING ANY POSITIVE NUMBER HERE. Three separate reasons the
 * headline is softer than its t-stat:
 *
 * 1. NRFI_BET_MIN=57 WAS SELECTED IN-WINDOW. app.jsx's own note next to the
 *    threshold predicts "~2.7/day at 67.3%" — i.e. the cut was chosen partly to
 *    produce the rate this script then measures on overlapping data. The rung
 *    boundary is not independent of the result, so treat the interval as
 *    descriptive, not as a test that the rung generalises. Only forward slates
 *    settle that.
 * 2. Rung membership is a selection on a quantity fit to this same window
 *    (the live calibration), so the usual winner's-curse caution applies. It
 *    happens to run in the conservative direction here — see below — but that is
 *    a fact about this sample, not a guarantee.
 * 3. The offence-side splits still leak (top-of-order OBP, h2h, Statcast,
 *    platoon OPS; bounded by ablation at 0.0011-0.0021 AUC). The pitcher side is
 *    point-in-time in these artifacts. So a LOSS here is conclusive and a WIN is
 *    "probably real".
 *
 * Bootstrap resamples WHOLE SLATES, same reason as everywhere else in this
 * directory: games on one slate share weather, starters and calibration state.
 * A rung concentrated on few slates gets a wide interval, which is the point.
 */
const fs = require("fs");
const path = require("path");

const ART = process.argv[2] || "nrfi-backtest.json";
const BURN = Number(process.argv[3] || 30);
const B = 4000;
const art = JSON.parse(fs.readFileSync(path.join(__dirname, ART), "utf8"));
const kal = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-kalshi-prices.json"), "utf8")).rows;

/* Thresholds and seed READ FROM THE WORKING TREE, never retyped — this has to be
 * grading the rungs that are shipping. Same readers as nrfi-walk-rungs.js,
 * including the "match the binding not the declaration" fix: all three
 * thresholds share one comma-separated const. */
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
const pick = (name) => {
  const m = src.match(new RegExp("\\bNRFI_" + name + " = (\\d+)"));
  if (!m) throw new Error("NRFI_" + name + " not found in app.jsx — the shape changed, fix this reader");
  return Number(m[1]);
};
const seedM = src.match(/const NRFI_CALIB_SEED = (\{[^}]*\})/);
if (!seedM) throw new Error("NRFI_CALIB_SEED not found in app.jsx — the shape changed, fix this reader");
const SEED = eval("(" + seedM[1] + ")");
const STRONG = pick("STRONG_MIN"), BET = pick("BET_MIN"), LEAN = pick("LEAN_MIN");

const lg = (p) => Math.log(p / (1 - p));
const ul = (x) => 1 / (1 + Math.exp(-x));
const clamp = (p) => Math.min(0.98, Math.max(0.02, p));
const pc = (x) => (x * 100).toFixed(1) + "%";

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

// ---- Kalshi price index. Ticker KXMLBRFI-26AUG151915MILLAD = yy MON dd time(4)
// away+home. Team codes are 2-3 chars so splitting the suffix from the left is
// ambiguous; build the suffix we EXPECT from our own label and compare. Same
// approach as nrfi-vs-kalshi.js, and the ambiguity disappears.
const MON = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
const kalKey = new Map();
for (const r of kal) {
  const m = /^KXMLBRFI-(\d\d)([A-Z]{3})(\d\d)\d{4}([A-Z]+)$/.exec(r.ticker);
  if (!m) continue;
  kalKey.set(`20${m[1]}-${MON[m[2]]}-${m[3]}|${m[4]}`, r);
}

// Doubleheaders dropped: two games share a date and a team pair, Kalshi lists one
// market per game, and our label cannot tell game 1 from game 2. Joining both to
// whichever market the map kept would pair a real price with the wrong result.
const dupe = new Map();
for (const r of art.rows) dupe.set(r.k, (dupe.get(r.k) || 0) + 1);

const byDay = new Map();
for (const r of art.rows) {
  const d = r.k.slice(0, 10);
  if (!byDay.has(d)) byDay.set(d, []);
  byDay.get(d).push(r);
}
const days = [...byDay.keys()].sort();

/* Walk forward. The live calibration is fit on EVERY prior game, matched or not,
 * because that is what the app would have had; only the pricing join is
 * restricted to games with a market. Filtering the calibration history down to
 * matched games would be a leak of the join into the model. */
const graded = [];
let hist = [];
let dh = 0, nomkt = 0;
for (let i = 0; i < days.length; i++) {
  const games = byDay.get(days[i]);
  if (i >= BURN) {
    const liveC = solveShift(hist.map((r) => r.p), hist.reduce((s, r) => s + r.a, 0) / hist.length);
    const w = hist.length / (hist.length + SEED.n);
    const c = w * liveC + (1 - w) * SEED.c;
    for (const g of games) {
      const date = g.k.slice(0, 10), label = g.k.slice(11);
      const q = clamp(ul(lg(clamp(g.p)) + c));
      const nrfi = q >= 0.5;
      const row = { day: i, date, label, pMax: 100 * (nrfi ? q : 1 - q), nrfi, win: (nrfi ? 1 : 0) === g.a ? 1 : 0 };
      const m = /^([A-Z]+)@([A-Z]+)$/.exec(label);
      if (!m) continue;
      if (dupe.get(g.k) > 1) { dh++; continue; }
      const k = kalKey.get(date + "|" + m[1] + m[2]);
      if (!k) { nomkt++; continue; }
      /* k.yes is P(a run scores in the 1st), so the NRFI contract costs 1-yes.
       * Pay for the side our CALL takes — not the side we disagree with the
       * market about. That distinction is the whole difference between this
       * script and the disagreement table in nrfi-vs-kalshi.js. */
      row.mktNrfi = clamp(1 - k.yes);
      row.cost = row.nrfi ? row.mktNrfi : 1 - row.mktNrfi;
      row.kNrfiHit = k.nrfi;
      graded.push(row);
    }
  }
  hist = hist.concat(games);
}

/* Orientation check. `a` in the artifact is 0/1 with no documented polarity and
 * getting it backwards inverts every number below, so verify against the
 * exchange instead of assuming. win was computed from `a`; on matched games the
 * called side winning must agree with Kalshi's own settlement. */
const agree = graded.filter((r) => (r.win === 1) === (r.nrfi === r.kNrfiHit)).length;
const rate = agree / graded.length;

const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
let s = 0x9e3779b9;
const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };

const slate = new Map();
graded.forEach((g, i) => { if (!slate.has(g.day)) slate.set(g.day, []); slate.get(g.day).push(i); });
const slates = [...slate.values()];

const roiOf = (idx) => {
  const cost = idx.reduce((t, i) => t + graded[i].cost, 0);
  const ret = idx.reduce((t, i) => t + graded[i].win, 0);
  return cost > 0 ? 100 * (ret - cost) / cost : 0;
};
const hitOf = (idx) => 100 * mean(idx.map((i) => graded[i].win));
/* The implied probability we bought at IS the cost: a contract costing $0.55 and
 * settling at $1.00 is the market charging 55%. Do NOT write 1 - cost here — an
 * earlier version did, which printed 45.0% for a 55.0% price and made the
 * "edge = hit - paid" instruction in the footer produce 24.5pp instead of the
 * real 14.5pp. The ROI column was unaffected because it uses cost directly, so
 * the mistake was invisible in the number everyone reads first. */
const priceOf = (idx) => 100 * mean(idx.map((i) => graded[i].cost));

function boot(f, stat) {
  const idx = graded.map((g, i) => i).filter((i) => f(graded[i]));
  if (!idx.length) return null;
  const obs = stat(idx);
  const draws = [];
  for (let b = 0; b < B; b++) {
    const pool = [];
    for (let j = 0; j < slates.length; j++) {
      for (const i of slates[Math.floor(rnd() * slates.length)]) if (f(graded[i])) pool.push(i);
    }
    if (pool.length) draws.push(stat(pool));
  }
  draws.sort((x, y) => x - y);
  const se = Math.sqrt(mean(draws.map((d) => (d - mean(draws)) ** 2)));
  return { n: idx.length, slates: new Set(idx.map((i) => graded[i].day)).size, obs, se, draws,
    lo: draws[Math.floor(draws.length * 0.025)], hi: draws[Math.floor(draws.length * 0.975)] };
}

const RUNGS = [
  { name: `★BET  >=${STRONG}`, f: (g) => g.pMax >= STRONG },
  { name: `BET   ${BET}-${STRONG}`, f: (g) => g.pMax >= BET && g.pMax < STRONG },
  { name: `LEAN  ${LEAN}-${BET}`, f: (g) => g.pMax >= LEAN && g.pMax < BET },
  { name: `PASS  <${LEAN}`, f: (g) => g.pMax < LEAN },
  null,
  { name: `BET-or-better >=${BET}`, f: (g) => g.pMax >= BET },
  { name: `LEAN-or-better >=${LEAN}`, f: (g) => g.pMax >= LEAN },
  { name: "every game", f: () => true },
];

console.log(`artifact ${ART}   sig ${art.modelSig}   ablations ${art.ablations || "none"}`);
console.log(`${days.length} days, ${art.rows.length} games; burn-in ${BURN} days`);
console.log(`priced ${graded.length} games over ${slates.length} slates` +
  `  (${nomkt} had no Kalshi market, ${dh} doubleheader games dropped)`);
console.log(`rungs as read from app.jsx: ★BET ${STRONG} / BET ${BET} / LEAN ${LEAN}`);
console.log(`calibration: app blend on shipped seed c=${SEED.c} n=${SEED.n}`);
console.log(`called side bought at the pre-first-pitch price; bootstrap B=${B} over whole slates`);
console.log(`\n  orientation: called side won == Kalshi settlement on ${pc(rate)} of priced games`);
if (Math.abs(rate - 0.5) < 0.4) {
  console.log("  STOP: this should be near 0% or 100% — both sides describe the same game.");
  console.log("  Something is mismatched; nothing below is trustworthy.");
  process.exitCode = 1;
}

console.log("\nrung                    n  slates    hit%   mkt paid     ROI  95% interval        t    P(<=0)");
for (const g of RUNGS) {
  if (!g) { console.log(""); continue; }
  const r = boot(g.f, roiOf);
  if (!r) { console.log("  " + g.name.padEnd(18) + "     no games in this rung"); continue; }
  const h = boot(g.f, hitOf), p = boot(g.f, priceOf);
  const t = r.se > 0 ? r.obs / r.se : 0;
  const pneg = r.draws.filter((d) => d <= 0).length / r.draws.length;
  console.log("  " + g.name.padEnd(18) + String(r.n).padStart(5) + String(r.slates).padStart(7) +
    (h.obs.toFixed(1) + "%").padStart(8) + (p.obs.toFixed(1) + "%").padStart(11) +
    ((r.obs >= 0 ? "+" : "") + r.obs.toFixed(1) + "%").padStart(8) +
    `  [${r.lo.toFixed(1)}, ${r.hi.toFixed(1)}]`.padEnd(18) +
    ((t >= 0 ? "+" : "") + t.toFixed(2)).padStart(6) + pc(pneg).padStart(9));
}

console.log(`
  hit%     = how often the called side won
  mkt paid = the implied probability we bought it at, 100*(1 - mean cost)
  ROI      = per contract staked, settling winners at 1.00
  P(<=0)   = share of slate-bootstrap draws that failed to break even

EDGE IS hit% MINUS mkt paid, NOT hit% MINUS 50. A rung that wins 70% of the
time and is charged 70% for the privilege earns nothing. Read the two columns
together or not at all.

The BET rung's threshold was chosen on this window (see the header comment), so
its interval describes the sample rather than testing the rule. Forward slates
are the only clean confirmation.`);
