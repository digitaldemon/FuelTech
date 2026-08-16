// Which factors are standing tilts, and which never move at all?
//
//   node scripts/nrfi-factor-center.js
//
// Every multiplier in nrfiEvaluate is supposed to mean "this game versus an
// average game". That claim has a testable consequence — over a few hundred
// games the factor should average about 1.000 — and it had never been checked
// for any of them at once. Three separate bugs in this repo were the same bug
// wearing different clothes:
//
//   - platoonFactor divided by the MIDPOINT of the vs-L and vs-R splits, but
//     clubs face RHP three days in four, so the denominator was not the club's
//     own average and the factor never centred.
//   - seasonLoadFactor bottoms out at 1.00 and climbs to 1.04. It cannot express
//     a rested arm, only a worn one, so its mean sits above 1 by construction.
//   - travelRest shipped 0.98 for "played yesterday", the ordinary mid-season
//     state, which quietly pushed most of the board toward NRFI every day.
//
// A factor that averages 1.02 is not a signal that leans; it is a constant added
// to every game plus a signal. The constant part is absorbed by the calibrator
// and pays nothing, while the reader of the card believes the term is doing
// work. Worse is the other failure this catches: a factor whose SD is zero.
// That is a dead input — the buildCtx starvation that hid five factors from
// every backtest ever run showed up as exactly that and went unseen for months.
//
// WHAT IS NOT A DEFECT HERE, and the report says so rather than flagging it:
//   - the *Base terms are RATES, not multipliers. They have no reason to sit
//     near 1 and are reported for spread only.
//   - homeOffAdv is deliberately asymmetric — it IS the home-field split, so the
//     two sides must differ. Pooled over both sides it should still centre, and
//     that pooled figure is the one carrying a verdict.
//
// THE HEADLINE IS THE COMPOSED MULTIPLIER. offMult and pitMult are what reach
// lambda; an individual factor's tilt only matters through them, and several
// terms leaning opposite ways can compose to something centred. Individual rows
// are diagnostic, the four *Mult rows are the verdict.
//
// CENTRING IS MEASURED IN LOG SPACE, and the first draft of this file got that
// wrong. These are multipliers: the value that undoes 1.10 is 1/1.10 = 0.909,
// not 0.90, so a perfectly balanced pair averages 1.0 geometrically and ABOVE
// 1.0 arithmetically. homeOffAdv is the proof — its two sides are 0.8962 and
// 1.1158, whose arithmetic mean is 1.0060 and whose geometric mean is 1.0000 to
// four places. The arithmetic version of this report flagged the one factor in
// the model that is exactly centred by construction as a +0.60% standing tilt.
// Every mean and SE below is therefore exp(mean(log f)).

const fs = require("fs");
const path = require("path");

const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");
const B = 3000;
const SEED = 815;

if (!fs.existsSync(CACHE)) {
  console.error("no nrfi-tout-vs-model.json — run scripts/nrfi-tout-vs-model.js first");
  process.exit(2);
}
const J = JSON.parse(fs.readFileSync(CACHE, "utf8"));

/* The cache stores the factors some earlier run computed. If the model has moved
 * since, this audit describes a model that is not shipping — which is the exact
 * drift the modelSig field exists to catch, and the exact way a "verified"
 * result goes stale without anyone noticing. Warn loudly; do not stop, because
 * a stale read is still worth having as long as nobody quotes it as current. */
let liveSig = null;
try { liveSig = require("./nrfi-model-lib").modelSig; } catch { /* lib not loadable */ }
const stale = liveSig && J.modelSig && liveSig !== J.modelSig;

const rows = [];
for (const [d, gs] of J.slates) {
  for (const g of gs) {
    if (!g.factors || Object.keys(g.factors).length < 20) continue;
    rows.push({ d, f: g.factors });
  }
}
if (rows.length < 100) { console.error("only " + rows.length + " games carry factors — cache too thin"); process.exit(2); }

const dates = [...new Set(rows.map((r) => r.d))];
const byDate = new Map(dates.map((d) => [d, []]));
for (const r of rows) byDate.get(r.d).push(r);

let seed = SEED;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
// Geometric mean, the correct centre for a multiplier. Non-positive values
// would make the log undefined; none of these factors can be <= 0, so treat one
// as corruption rather than silently dropping it.
const gmean = (a) => {
  for (const x of a) if (!(x > 0)) throw new Error("a multiplier came through as " + x + " — log-space centring is undefined there");
  return Math.exp(mean(a.map(Math.log)));
};

// Pair away/home into one family. A factor computed the same way for both sides
// is one term measured twice, and testing the two halves separately halves the
// sample for no gain.
const keys = Object.keys(rows[0].f);
const fams = new Map();
for (const k of keys) {
  const m = k.match(/^(away|home)(.+)$/);
  const fam = m ? m[2][0].toLowerCase() + m[2].slice(1) : k;
  if (!fams.has(fam)) fams.set(fam, []);
  fams.get(fam).push(k);
}

const isBase = (fam) => /Base$/.test(fam);
const isMult = (fam) => /Mult$/.test(fam);

// Pull every value for a family across both sides, dropping non-finite ones —
// a factor that is sometimes undefined is its own finding and is counted.
function values(cols, sample) {
  const out = [];
  let missing = 0;
  for (const r of sample) for (const c of cols) {
    const v = r.f[c];
    if (Number.isFinite(v)) out.push(v); else missing++;
  }
  return { out, missing };
}

// Date-clustered bootstrap on the mean. A slate shares weather, parks and one
// fetch of our feeds, so games on one date are not independent draws.
function clusteredSe(cols) {
  const bs = [];
  for (let b = 0; b < B; b++) {
    const s = [];
    for (let i = 0; i < dates.length; i++) s.push(...byDate.get(dates[(rnd() * dates.length) | 0]));
    bs.push(gmean(values(cols, s).out));
  }
  return sd(bs);
}

const report = [];
for (const [fam, cols] of fams) {
  const { out: v, missing } = values(cols, rows);
  if (!v.length) { report.push({ fam, dead: true, n: 0, missing }); continue; }
  const isRate = isBase(fam);
  const m = isRate ? mean(v) : gmean(v), s = sd(v);
  const neutral = v.filter((x) => Math.abs(x - 1) < 1e-9).length / v.length;
  const se = s === 0 || isRate ? 0 : clusteredSe(cols);
  const perSide = cols.map((c) => {
    const vals = rows.map((r) => r.f[c]).filter(Number.isFinite);
    return { c, m: isRate ? mean(vals) : gmean(vals) };
  });
  // How much of the factor's range is spent against its own clamp. A term
  // pinned to a bound has stopped reading its input: every arm past the limit
  // gets the identical number, so the games most worth separating are the ones
  // it separates least.
  const lo = Math.min(...v), hi = Math.max(...v);
  const atLo = v.filter((x) => Math.abs(x - lo) < 1e-9).length / v.length;
  const atHi = v.filter((x) => Math.abs(x - hi) < 1e-9).length / v.length;
  // A factor that only ever returns two or three numbers is not clamped when it
  // sits on its extremes — those ARE its values. offAdv is a fixed pair and
  // reads as "50% at the floor, 50% at the ceiling"; seasonLoad is neutral or
  // not. Saturation only means something for a term with a continuous range, so
  // count the distinct values and let the verdict use it.
  const distinct = new Set(v.map((x) => Math.round(x * 1e6))).size;
  report.push({ fam, cols, n: v.length, m, s, min: lo, max: hi,
    neutral, se, missing, perSide, atLo, atHi, distinct });
}

const pad = (x, n) => String(x).padEnd(n);
const f4 = (x) => (x >= 0 ? " " : "") + x.toFixed(4);

/* Two floors, both there because a pure "is it past 2 SE" rule misfires.
 *
 * MATERIAL: a deterministic factor has no sampling error at all, so its
 * clustered SE is floating-point dust and ANY difference from 1 clears 2 SE.
 * offAdv is exactly centred by construction and the first version of this
 * report called it "TILTED -0.00%". A tilt under a tenth of a percent is not
 * worth a reader's attention whatever its t-value.
 *
 * MIN_DISTINCT: saturation is only meaningful for a term with a range to
 * saturate. Below this many distinct values the extremes are the factor's
 * vocabulary, not a bound it is failing to clear. */
const MATERIAL = 0.001;
const MIN_DISTINCT = 8;
const isTilted = (r) => r.s > 0 && r.neutral < 0.9 &&
  Math.abs(r.m - 1) > MATERIAL && Math.abs(r.m - 1) > 2 * r.se;

console.log("=".repeat(92));
console.log(`FACTOR CENTRING · ${rows.length} games over ${dates.length} slates ` +
  `(${dates.slice().sort()[0]} -> ${dates.slice().sort().at(-1)})`);
console.log("=".repeat(92));
if (stale) {
  console.log(`\n  !! STALE: cache modelSig ${J.modelSig} but the live model is ${liveSig}.`);
  console.log(`     These factors are what the model produced BEFORE the current source.`);
  console.log(`     Re-run scripts/nrfi-tout-vs-model.js before quoting anything below.`);
}

console.log("\n  MULTIPLIERS — geometric mean should be 1.0000. 'tilt' is that mean minus 1");
console.log("  with a date-clustered SE, and counts only when it clears 2 SE. 'clamp' is");
console.log("  the share of values sitting exactly on the factor's own min or max.\n");
console.log("  " + pad("factor", 16) + pad("n", 6) + pad("geomean", 9) + pad("sd", 9) +
  pad("min", 9) + pad("max", 9) + pad("=1.0", 7) + pad("clamp", 13) + "verdict");

const mult = report.filter((r) => !isBase(r.fam) && !isMult(r.fam)).sort((a, b) =>
  Math.abs(b.m - 1) - Math.abs(a.m - 1));
const composed = report.filter((r) => isMult(r.fam));
const bases = report.filter((r) => isBase(r.fam));

function line(r) {
  if (r.dead && !r.n) return "  " + pad(r.fam, 16) + "  NO FINITE VALUES — the factor never reached the cache";
  const tilt = r.m - 1;
  let verdict;
  if (r.s === 0) verdict = "DEAD — never varies (" + r.m.toFixed(4) + " on every game)";
  else if (r.neutral >= 0.9) verdict = "PINNED — neutral on " + (100 * r.neutral).toFixed(0) + "% of games";
  else if (isTilted(r)) verdict = "TILTED " + (tilt >= 0 ? "+" : "") + (100 * tilt).toFixed(2) +
    "%  (2SE " + (200 * r.se).toFixed(2) + "%)";
  else if (Math.abs(tilt) <= MATERIAL) verdict = "centred (" + (100 * tilt).toFixed(3) + "%, immaterial)";
  else verdict = "centred (tilt " + (tilt >= 0 ? "+" : "") + (100 * tilt).toFixed(2) +
    "%, under its 2SE of " + (200 * r.se).toFixed(2) + "%)";
  const clamp = (r.distinct < MIN_DISTINCT ? r.distinct + "-valued"
    : (100 * r.atLo).toFixed(0) + "%lo " + (100 * r.atHi).toFixed(0) + "%hi").padEnd(13);
  return "  " + pad(r.fam, 16) + pad(r.n, 6) + f4(r.m).padEnd(9) + r.s.toFixed(4).padEnd(9) +
    r.min.toFixed(4).padEnd(9) + r.max.toFixed(4).padEnd(9) +
    ((100 * r.neutral).toFixed(0) + "%").padEnd(7) + clamp + verdict;
}

for (const r of mult) console.log(line(r));

console.log("\n  COMPOSED — these are what multiply the base rates into lambda.\n");
console.log("  " + pad("factor", 16) + pad("n", 6) + pad("geomean", 9) + pad("sd", 9) +
  pad("min", 9) + pad("max", 9) + pad("=1.0", 7) + pad("clamp", 13) + "verdict");
for (const r of composed) console.log(line(r));

console.log("\n  BASE RATES — no reason to sit near 1; shown for spread only.\n");
for (const r of bases) {
  console.log("  " + pad(r.fam, 16) + pad(r.n, 6) + "mean " + r.m.toFixed(4) +
    "   sd " + r.s.toFixed(4) + "   range " + r.min.toFixed(3) + "-" + r.max.toFixed(3) +
    (r.s === 0 ? "   DEAD — never varies" : ""));
}

// homeOffAdv must differ by side; anything else that does is worth a look, since
// a term computed identically for both teams has no reason to.
console.log("\n  BY SIDE (a gap here is by design only for offAdv):\n");
for (const r of mult.concat(composed)) {
  if (!r.perSide || r.perSide.length < 2) continue;
  const g = Math.abs(r.perSide[0].m - r.perSide[1].m);
  if (g < 0.002) continue;
  console.log("  " + pad(r.fam, 16) + r.perSide.map((p) => p.c + " " + p.m.toFixed(4)).join("   ") +
    "   gap " + (100 * g).toFixed(2) + "%");
}

const tilted = mult.filter(isTilted);
const dead = report.filter((r) => r.n && r.s === 0);
const pinned = mult.filter((r) => r.s > 0 && r.neutral >= 0.9);

console.log("\n" + "=".repeat(92));
console.log("FINDINGS");
if (dead.length) for (const r of dead)
  console.log(`  DEAD: ${r.fam} is ${r.m.toFixed(4)} on all ${r.n} values. Either the input never`);
if (!dead.length) console.log("  no factor is frozen — every one of them varies across games.");
for (const r of pinned)
  console.log(`  PINNED: ${r.fam} is exactly neutral on ${(100 * r.neutral).toFixed(0)}% of games, so it speaks on ` +
    `${(100 * (1 - r.neutral)).toFixed(0)}% and is silent on the rest.`);
for (const r of tilted)
  console.log(`  TILTED: ${r.fam} averages ${r.m.toFixed(4)} (${((r.m - 1) * 100 >= 0 ? "+" : "") + ((r.m - 1) * 100).toFixed(2)}%, 2SE ` +
    `${(200 * r.se).toFixed(2)}%). The constant part of that is not signal.`);
if (!tilted.length) console.log("  no individual multiplier is off centre past 2 SE.");

/* Saturation is the finding a centring report is most likely to bury, because a
 * clamped factor still has a mean and still varies, so it passes both other
 * tests. It is nonetheless the most expensive failure of the three: inside the
 * clamp the term reads its input, outside it returns a constant, and the arms
 * outside are the extreme ones the model most needs separated. */
const CLAMP_BAR = 0.05;
const sat = mult.concat(composed).filter((r) => r.s > 0 && r.neutral < 0.9 &&
  r.distinct >= MIN_DISTINCT && (r.atLo >= CLAMP_BAR || r.atHi >= CLAMP_BAR));
for (const r of sat) {
  const parts = [];
  if (r.atLo >= CLAMP_BAR) parts.push(`${(100 * r.atLo).toFixed(1)}% pinned at its floor ${r.min.toFixed(2)}`);
  if (r.atHi >= CLAMP_BAR) parts.push(`${(100 * r.atHi).toFixed(1)}% at its ceiling ${r.max.toFixed(2)}`);
  console.log(`  SATURATED: ${r.fam} has ${parts.join(" and ")}. Those values are not`);
  console.log(`             measurements — every input past the bound returns the bound.`);
}
if (!sat.length) console.log(`  no factor spends more than ${100 * CLAMP_BAR}% of its games against a clamp.`);
console.log("");
console.log("  A tilt is not automatically a bug: a term can be genuinely asymmetric, as");
console.log("  travel is (a team either changed parks or it did not, and the absence is");
console.log("  the baseline). What a tilt does mean is that the term is not centred on");
console.log("  the population it claims to compare against, so read its denominator");
console.log("  before deciding. And note the composed rows above — if offMult and pitMult");
console.log("  centre, the individual tilts are cancelling and cost less than they look.");
