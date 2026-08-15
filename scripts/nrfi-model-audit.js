// Property sweep over the pure NRFI model surface, run against the shipped
// bundle. Complements nrfi-gate-audit.js (which covers the verdict ladder).
//
// Checks the classes of defect that actually reach the board: a factor that
// returns NaN or undefined on missing data and silently poisons the product, a
// probability that escapes [0,1], a distribution that stops summing to 1, and
// monotonicity breaks (a worse pitcher producing a higher NRFI number).
//
//   node scripts/nrfi-model-audit.js    → exits 1 on any violation
const { loadDeskModel } = require("./nrfi-model-load");
const c = loadDeskModel();

let fails = 0;
const ok = (cond, name, detail) => {
  if (!cond) fails++;
  console.log((cond ? "  PASS  " : "  FAIL  ") + name + (cond || !detail ? "" : "\n          " + String(detail).replace(/\n/g, "\n          ")));
};
const finite = (v) => typeof v === "number" && Number.isFinite(v);

// Inputs the board really does hand over when a pitcher is called up, a game is
// postponed, or MLB returns one of its sentinels ("-.--", "INF") for a stat.
// Deliberately type-appropriate: passing an object where a number belongs would
// only prove that JavaScript is untyped, not that the model is fragile.
const NASTY = [undefined, null, 0, -1, NaN, Infinity, -Infinity, Number("-.--"), Number("INF"), 1e9];
const NASTY_OBJ = [undefined, null, {}, { rate: null }, { sample: 0 }, { rate: NaN, sample: 10 },
  { f: NaN }, { l10: null }, { szn: { rate: NaN } }];

console.log("=".repeat(72) + "\nNRFI MODEL PROPERTIES — shipped bundle\n" + "=".repeat(72));

// ── factors: must be finite positive multipliers, and survive junk ────────
console.log("\nfactor functions (missing/garbage input must not produce NaN)");
// Numeric-argument factors vs object-argument factors — fuzz each with the
// shapes it is actually called with.
const FACTORS = [["restFactor", NASTY], ["formFactor", NASTY],
  ["pitchSkillFactor", NASTY_OBJ], ["pitcherTrendFactor", NASTY_OBJ], ["pitcherVenueFactor", NASTY_OBJ],
  ["platoonFactor", NASTY_OBJ], ["offKrateFactor", NASTY_OBJ], ["offenseVenueFactor", NASTY_OBJ],
  ["teamOffenseTrendFactor", NASTY_OBJ]];
for (const [name, pool] of FACTORS) {
  const fn = c[name];
  if (typeof fn !== "function") { ok(false, name + " exists"); continue; }
  const bad = [];
  for (const a of pool) for (const b of pool) {
    let r;
    try { r = fn(a, b); } catch (e) { bad.push("threw on (" + String(a) + "," + String(b) + "): " + e.message); continue; }
    const v = r && typeof r === "object" ? (r.factor !== undefined ? r.factor : r.f) : r;
    if (v === undefined || v === null) continue;         // "no opinion" is legitimate
    if (!finite(v)) bad.push("(" + String(a) + "," + String(b) + ") -> " + v);
    else if (v <= 0 || v > 5) bad.push("(" + String(a) + "," + String(b) + ") -> " + v + " (out of sane multiplier range)");
  }
  ok(bad.length === 0, name, bad.slice(0, 3).join("\n") + (bad.length > 3 ? "\n...and " + (bad.length - 3) + " more" : ""));
}

// ── nrfiRegress ──────────────────────────────────────────────────────────
console.log("\nnrfiRegress");
{
  const bad = [];
  for (const rate of [null, 0, 0.3, 0.52, 1, 2, -0.5]) for (const s of [0, 1, 50, 1e6]) for (const reg of [0, 5, 100]) {
    const v = c.nrfiRegress(rate, s, reg);
    if (!finite(v)) bad.push("rate=" + rate + " s=" + s + " reg=" + reg + " -> " + v);
  }
  ok(bad.length === 0, "finite for every (rate, sample, reg)", bad.slice(0, 3).join("\n"));
  ok(c.nrfiRegress(null, 0, 0) != null && finite(c.nrfiRegress(null, 0, 0)), "null rate falls back to league lambda",
    "got " + c.nrfiRegress(null, 0, 0));
  // sample=0, reg=0 is 0/0. It is reachable if a team has no games and the
  // regression constant is ever set to 0.
  const z = c.nrfiRegress(0.5, 0, 0);
  ok(finite(z), "sample=0 and reg=0 does not divide by zero", "-> " + z);
}

// ── halfNoRun: probability, and monotone in pitcher quality ──────────────
console.log("\nhalfNoRun");
{
  const bad = [];
  for (const off of [0.05, 0.3, 0.52, 1.0, 2.0]) for (const pit of [0.05, 0.3, 0.52, 1.0, 2.0]) for (const env of [null, 0.8, 1, 1.3]) {
    const v = c.halfNoRun(off, pit, env);
    if (!finite(v) || v < 0 || v > 1) bad.push("off=" + off + " pit=" + pit + " env=" + env + " -> " + v);
  }
  ok(bad.length === 0, "always a probability in [0,1]", bad.slice(0, 3).join("\n"));
  let mono = true, ex = "";
  for (const off of [0.3, 0.52, 1.0]) {
    let prev = Infinity;
    for (let pit = 0.1; pit <= 1.8; pit += 0.1) {
      const v = c.halfNoRun(off, pit, 1);
      if (v > prev + 1e-12) { mono = false; ex = "off=" + off + " pit=" + pit.toFixed(1) + ": " + v.toFixed(4) + " > " + prev.toFixed(4); }
      prev = v;
    }
  }
  ok(mono, "monotone: a worse pitcher never raises P(no run)", ex);
}

// ── paRates / matchupPA: must stay valid distributions ───────────────────
console.log("\nPA distributions");
{
  const LG = c.read("NRFI_LG_PA");
  const lgSum = Object.values(LG).reduce((a, b) => a + b, 0);
  ok(Math.abs(lgSum - 1) < 1e-9, "NRFI_LG_PA sums to 1",
    "sums to " + lgSum.toFixed(4) + " (short by " + ((1 - lgSum) * 100).toFixed(2) + "pp). Every rate blended " +
    "toward\nthis prior inherits the gap; matchupPA renormalises so it cannot escape as a\n" +
    "bad probability, but the regression target is not the league average it claims.");

  ok(c.paRates({ hits: 1 }, 0, 0) === null, "zero denominator returns null, not a divide-by-zero");
  // A tiny sample where the events outnumber the plate appearances.
  const wild = c.paRates({ hits: 5, doubles: 2, homeRuns: 2, baseOnBalls: 3 }, 3, 0);
  const wildSum = wild ? Object.values(wild).reduce((a, b) => a + b, 0) : null;
  ok(wild == null || Math.abs(wildSum - 1) < 1e-9, "raw rates sum to 1 even when events exceed PA",
    "sum=" + (wildSum == null ? "n/a" : wildSum.toFixed(4)) + " — `out` floors at 0 while the hit rates keep\n" +
    "their full value, so the row stops being a distribution. matchupPA renormalises,\n" +
    "so the effect is a silent reweighting rather than a crash.");

  const b = c.paRates({ hits: 150, doubles: 30, triples: 3, homeRuns: 20, baseOnBalls: 50 }, 600, 0);
  const p = c.paRates({ hits: 140, doubles: 28, triples: 2, homeRuns: 18, baseOnBalls: 45 }, 600, 0);
  const m = c.matchupPA(b, p, LG);
  const mSum = Object.values(m).reduce((a, x) => a + x, 0);
  ok(Math.abs(mSum - 1) < 1e-9, "matchupPA output sums to 1", "sum=" + mSum);
  ok(Object.values(m).every((v) => finite(v) && v >= 0), "matchupPA output has no negative or NaN mass");
  const degenerate = c.matchupPA({ out: 0, bb: 0, s1: 0, s2: 0, s3: 0, hr: 0 }, p, LG);
  ok(Object.values(degenerate).every(finite), "all-zero batter profile does not produce NaN", JSON.stringify(degenerate));
}

// ── advanceBaseOut: state machine stays in bounds ────────────────────────
console.log("\nbase/out state machine");
{
  const bad = [];
  for (let base = 0; base < 8; base++) for (let outs = 0; outs < 3; outs++) {
    for (const o of ["out", "bb", "s1", "s2", "s3", "hr", "bogus"]) {
      const [nb, no, runs] = c.advanceBaseOut(base, outs, o);
      if (!(nb >= 0 && nb <= 7)) bad.push("base " + base + "/" + outs + "/" + o + " -> base " + nb);
      if (!(no >= 0 && no <= 3)) bad.push("base " + base + "/" + outs + "/" + o + " -> outs " + no);
      if (!(runs >= 0 && runs <= 4)) bad.push("base " + base + "/" + outs + "/" + o + " -> runs " + runs);
    }
  }
  ok(bad.length === 0, "state index never escapes the 24-cell grid", bad.slice(0, 4).join("\n"));
  // A run may only score when someone was actually on or it left the yard.
  const [, , r] = c.advanceBaseOut(0, 0, "s1");
  ok(r === 0, "single with empty bases scores nobody", "scored " + r);
  const [, , rh] = c.advanceBaseOut(7, 0, "hr");
  ok(rh === 4, "grand slam scores four", "scored " + rh);
}

// ── simHalfNoRun ─────────────────────────────────────────────────────────
console.log("\nsimHalfNoRun");
{
  const LG = c.read("NRFI_LG_PA");
  const lineup = (mult) => new Array(9).fill(0).map(() => {
    const o = {}; for (const k of Object.keys(LG)) o[k] = LG[k] * (k === "out" ? 1 / mult : mult);
    return o;
  });
  const bad = [];
  for (const m of [0.5, 0.8, 1, 1.3, 2]) {
    const v = c.simHalfNoRun(lineup(m), LG, LG, 12);
    if (!finite(v) || v < 0 || v > 1) bad.push("mult=" + m + " -> " + v);
  }
  ok(bad.length === 0, "always a probability", bad.join("\n"));
  let prev = Infinity, mono = true, ex = "";
  for (const m of [0.5, 0.7, 0.9, 1.1, 1.3, 1.6, 2]) {
    const v = c.simHalfNoRun(lineup(m), LG, LG, 12);
    if (v > prev + 1e-9) { mono = false; ex = "mult " + m + ": " + v.toFixed(4) + " > " + prev.toFixed(4); }
    prev = v;
  }
  ok(mono, "monotone: a better offense never raises P(no run)", ex);
  ok(finite(c.simHalfNoRun([], LG, LG, 12)), "empty lineup falls back to league batters");
}

// ── kellyNRFI ────────────────────────────────────────────────────────────
console.log("\nkellyNRFI");
{
  const bad = [];
  for (const p of [0.02, 0.3, 0.5, 0.7, 0.98]) for (const price of [0, 1, 25, 50, 99, 100]) for (const call of ["NRFI", "YRFI"]) {
    const f = c.kellyNRFI(p, price, call);
    if (f == null) continue;
    if (!finite(f)) bad.push("p=" + p + " price=" + price + " " + call + " -> " + f);
    else if (f < 0 || f > 0.25) bad.push("p=" + p + " price=" + price + " " + call + " -> " + f + " (outside 0..0.25 cap)");
  }
  ok(bad.length === 0, "stake fraction finite and inside the 25% cap", bad.slice(0, 4).join("\n"));
  ok(c.kellyNRFI(0.6, 0, "NRFI") == null || finite(c.kellyNRFI(0.6, 0, "NRFI")), "price 0 does not divide by zero",
    "-> " + c.kellyNRFI(0.6, 0, "NRFI"));
  ok(c.kellyNRFI(0.6, 100, "NRFI") == null || finite(c.kellyNRFI(0.6, 100, "NRFI")), "price 100 does not divide by zero",
    "-> " + c.kellyNRFI(0.6, 100, "NRFI"));
}

// ── calibration round trip ───────────────────────────────────────────────
console.log("\ncalibration");
{
  const seed = Object.assign({}, c.read("NRFI_CALIB_SEED"), { active: true });
  const bad = [];
  for (let p = 0.01; p <= 0.99; p += 0.01) {
    const v = c.applyCalibration(p, seed);
    if (!finite(v) || v <= 0 || v >= 1) bad.push("p=" + p.toFixed(2) + " -> " + v);
  }
  ok(bad.length === 0, "output stays a strict probability across the full range", bad.slice(0, 3).join("\n"));
  ok(c.applyCalibration(0.6, null) === 0.6 && c.applyCalibration(0.6, { active: false }) === 0.6,
    "inactive calibration is a pass-through");
  let mono = true, prev = -1, ex = "";
  for (let p = 0.02; p <= 0.98; p += 0.01) {
    const v = c.applyCalibration(p, seed);
    if (v < prev - 1e-12) { mono = false; ex = "p=" + p.toFixed(2); }
    prev = v;
  }
  ok(mono, "calibration is order-preserving (never reranks two games)", ex);
  const lc = c.nrfiCalibration([]);
  ok(finite(lc.liveC) && lc.n === 0, "empty record yields a finite live correction", JSON.stringify(lc));
}

console.log("\n" + "=".repeat(72));
if (fails) { console.log(fails + " property violation(s)"); process.exit(1); }
console.log("all properties hold");
