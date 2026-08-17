/* Does each confidence rung actually beat a coin flip, out of sample?
 *
 * The board sorts every game into PASS / LEAN / BET / ★BET and the whole product
 * rests on that ordering meaning something. "★BET hits 70%" is the claim that
 * sells, and it is also the claim most likely to be an artifact: the top rung is
 * the smallest sample by construction, so it has both the highest observed rate
 * and the widest interval, and a sorted table shows the first and hides the
 * second.
 *
 * So: walk forward by date, classify each game by the CALIBRATED probability the
 * app would have shown, and put a date-clustered bootstrap interval on every
 * rung. Same walk-forward and clustering discipline as nrfi-calib-walk-sig.js,
 * for the same reasons — a seed fit on the past may only be scored on the
 * future, and games on one slate share weather, starters and calibration state,
 * so slates are the resampling unit, not rows.
 *
 * TWO STATISTICS PER RUNG, because they answer different questions:
 *   hit rate  - does the pick side win more than half the time (is there edge)
 *   level bias- is the stated confidence honest (mean pMax minus hit rate)
 * A rung can win 67% of the time while claiming 54%, or claim 63% and deliver
 * 58%. The first is a filter that works and underclaims; the second is a filter
 * that works and lies. Only the bias column separates them. See
 * feedback/test-level-bias-not-brier: Brier has almost no power against a pure
 * level shift, so do not substitute it here.
 *
 *   node scripts/nrfi-walk-rungs.js [artifact.json] [burnInDays]
 */
const fs = require("fs");
const path = require("path");

const ART = process.argv[2] || "nrfi-backtest.lambda-path.json";
const BURN = Number(process.argv[3] || 30);
const B = 4000;
const art = JSON.parse(fs.readFileSync(path.join(__dirname, ART), "utf8"));

/* Thresholds and seed are READ FROM THE WORKING TREE, never retyped. A test that
 * grades the shipped rungs has to be grading the rungs that are shipping. */
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
// All three live in ONE comma-separated const, so only the first carries the
// `const` keyword. Match the binding, not the declaration.
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

// Same objective nrfiCalibration runs for liveC: land the calibrated mean on the
// observed rate. Not an ML Platt intercept, because that is not what ships.
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

/* Take n from the rows, not the header: artifacts written before the
 * officialDate fix in desk-nrfi-backtest.js carry an n one too high, because a
 * suspended game was listed under both its dates and scored twice. */
const REFIT_N = art.rows.length;

// Walk forward. Each scored game keeps its calibrated pMax, its call, whether
// the call won, and which slate it came from.
const graded = [];
let hist = [];
for (let i = 0; i < days.length; i++) {
  const games = byDay.get(days[i]);
  if (i >= BURN) {
    const liveC = solveShift(hist.map((r) => r.p), hist.reduce((s, r) => s + r.a, 0) / hist.length);
    const w = hist.length / (hist.length + SEED.n);
    const c = w * liveC + (1 - w) * SEED.c;
    for (const g of games) {
      const q = clamp(ul(lg(clamp(g.p)) + c));
      const nrfi = q >= 0.5;
      graded.push({
        day: i,
        pMax: 100 * (nrfi ? q : 1 - q),
        call: nrfi ? "NRFI" : "YRFI",
        win: (nrfi ? 1 : 0) === g.a ? 1 : 0,
        z: lg(q), // logit of the calibrated NRFI prob, for the slope test below
        a: g.a,
      });
    }
  }
  hist = hist.concat(games);
}

const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;

// Deterministic RNG so a rerun reproduces the intervals exactly.
let s = 0x9e3779b9;
const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };

const slate = new Map();
graded.forEach((g, i) => { if (!slate.has(g.day)) slate.set(g.day, []); slate.get(g.day).push(i); });
const slates = [...slate.values()];

/* Bootstrap resamples WHOLE SLATES, so a rung's interval reflects the ~88
 * independent days behind it rather than the ~1150 correlated rows. Rungs with
 * few games are also concentrated on few slates, and this is what makes that
 * show up in the width instead of hiding in it. */
function boot(memberOf, stat) {
  const idx = graded.map((g, i) => i).filter((i) => memberOf(graded[i]));
  if (!idx.length) return null;
  const obs = stat(idx);
  const draws = [];
  for (let b = 0; b < B; b++) {
    const pool = [];
    for (let j = 0; j < slates.length; j++) {
      const g = slates[Math.floor(rnd() * slates.length)];
      for (const i of g) if (memberOf(graded[i])) pool.push(i);
    }
    if (pool.length) draws.push(stat(pool));
  }
  draws.sort((x, y) => x - y);
  const se = Math.sqrt(mean(draws.map((d) => (d - mean(draws)) ** 2)));
  return { n: idx.length, slates: new Set(idx.map((i) => graded[i].day)).size, obs, se,
    lo: draws[Math.floor(draws.length * 0.025)], hi: draws[Math.floor(draws.length * 0.975)] };
}

const hitRate = (idx) => 100 * mean(idx.map((i) => graded[i].win));
const claimed = (idx) => mean(idx.map((i) => graded[i].pMax));
const biasOf = (idx) => claimed(idx) - hitRate(idx);

const RUNGS = [
  { name: `★BET  >=${STRONG}`, f: (g) => g.pMax >= STRONG },
  { name: `BET   ${BET}-${STRONG}`, f: (g) => g.pMax >= BET && g.pMax < STRONG },
  { name: `LEAN  ${LEAN}-${BET}`, f: (g) => g.pMax >= LEAN && g.pMax < BET },
  { name: `PASS  <${LEAN}`, f: (g) => g.pMax < LEAN },
];
const GROUPS = [
  { name: `BET-or-better >=${BET}`, f: (g) => g.pMax >= BET },
  { name: `LEAN-or-better >=${LEAN}`, f: (g) => g.pMax >= LEAN },
  { name: "every game", f: () => true },
];

console.log(`artifact ${ART}   sig ${art.modelSig}   ablations ${art.ablations || "none"}`);
console.log(`${days.length} days, ${art.rows.length} games; scored the last ${days.length - BURN} days = ${graded.length} games`);
console.log(`rungs as read from app.jsx: ★BET ${STRONG} / BET ${BET} / LEAN ${LEAN}`);
console.log(`calibration: app blend on shipped seed c=${SEED.c} n=${SEED.n}`);
console.log(`bootstrap B=${B}, resampling ${slates.length} whole slates\n`);

const fmt = (label, r) => {
  if (!r) return "  " + label.padEnd(18) + "     no games in this rung";
  const t = r.se > 0 ? (r.obs - 50) / r.se : 0;
  return "  " + label.padEnd(18) + String(r.n).padStart(5) + String(r.slates).padStart(7) +
    (r.obs.toFixed(1) + "%").padStart(9) + `  [${r.lo.toFixed(1)}, ${r.hi.toFixed(1)}]`.padEnd(17) +
    ((t >= 0 ? "+" : "") + t.toFixed(2)).padStart(7);
};

console.log("rung                    n  slates      hit   95% interval        t vs 50%");
for (const g of [...RUNGS, null, ...GROUPS]) {
  if (!g) { console.log(""); continue; }
  console.log(fmt(g.name, boot(g.f, hitRate)));
}

console.log("\nis the stated confidence honest? (claimed pMax - actual hit rate)");
console.log("rung                    n  slates     bias   95% interval");
for (const g of [...RUNGS, ...GROUPS]) {
  const r = boot(g.f, biasOf);
  if (!r) continue;
  const cl = boot(g.f, claimed);
  console.log("  " + g.name.padEnd(18) + String(r.n).padStart(5) + String(r.slates).padStart(7) +
    ((r.obs >= 0 ? "+" : "") + r.obs.toFixed(1) + "pp").padStart(10) +
    `  [${r.lo.toFixed(1)}, ${r.hi.toFixed(1)}]`.padEnd(18) +
    `claims ${cl.obs.toFixed(1)}%`);
}

/* The bias column above drifts monotonically from overclaiming at PASS to
 * underclaiming at BET, which is the signature of a SLOPE error, not a level
 * error — and the shipped calibration is a pure logit shift, so it cannot fix
 * one. Ask the slope directly rather than inferring it from four nested cuts:
 * fit a ~ sigmoid(A*logit(q) + B) on the walk-forward probabilities. A > 1 means
 * the model is too COMPRESSED and its confident picks deserve more confidence.
 *
 * Reported next to the artifact's own in-sample Platt because they disagree in
 * power, not direction, and the weaker one is the one already on disk. */
function slope(idx) {
  let A = 1, B0 = 0;
  for (let it = 0; it < 200; it++) {
    let g1 = 0, g2 = 0, h11 = 0, h12 = 0, h22 = 0;
    for (const i of idx) {
      const { z, a } = graded[i], q = ul(A * z + B0), w = q * (1 - q);
      g1 += (a - q) * z; g2 += a - q; h11 += w * z * z; h12 += w * z; h22 += w;
    }
    const det = h11 * h22 - h12 * h12;
    if (Math.abs(det) < 1e-12) break;
    const dA = (h22 * g1 - h12 * g2) / det, dB = (-h12 * g1 + h11 * g2) / det;
    A += dA; B0 += dB;
    if (Math.abs(dA) + Math.abs(dB) < 1e-12) break;
  }
  return A;
}
{
  const all = graded.map((_, i) => i);
  const obs = slope(all), draws = [];
  for (let b = 0; b < 2000; b++) {
    const pool = [];
    for (let j = 0; j < slates.length; j++) pool.push(...slates[Math.floor(rnd() * slates.length)]);
    draws.push(slope(pool));
  }
  draws.sort((x, y) => x - y);
  const se = Math.sqrt(mean(draws.map((d) => (d - mean(draws)) ** 2)));
  console.log("\nslope check — is the whole curve compressed? (a>1 = too timid)");
  console.log(`  walk-forward, clustered   a ${obs.toFixed(3)}   se ${se.toFixed(3)}` +
    `   95% [${draws[50].toFixed(3)}, ${draws[1949].toFixed(3)}]   t vs 1  ${((obs - 1) / se).toFixed(2)}`);
  if (art.platt) console.log(`  artifact in-sample Platt  a ${art.platt.a.toFixed(3)}   se ${art.platt.seA.toFixed(3)}` +
    `   t vs 1  ${((art.platt.a - 1) / art.platt.seA).toFixed(2)}`);
}

console.log("\nt vs 50% is the edge test: an interval containing 50 means this window");
console.log("cannot show the rung beats a coin flip. Positive bias = overclaiming.");
console.log("Rungs are nested cuts of one sample, so their intervals are NOT independent;");
console.log("do not read a monotone column as four separate confirmations.");
