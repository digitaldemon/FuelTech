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
// restFactor, formFactor and platoonFactor used to be listed here. All three
// were withdrawn from the model on measurement — see the REMOVED notes in
// app.jsx — and this list was never updated, so the audit reported three
// violations on every run for functions that were correctly gone. That is worse
// than not checking at all: an audit that always fails teaches you to ignore its
// exit code, and ignoring it is exactly the state it was in when it was next
// asked whether anything real had broken.
//
// So the list is now reconciled against the bundle in BOTH directions. A name
// here that no longer exists is a stale assertion. A *Factor in the bundle that
// is NOT here is an unfuzzed one — and that is the direction that bites: nine
// helpers were once added to nrfiEvaluate without matching slices, every
// backtest row threw a ReferenceError, mapLimit swallowed each one, and the
// harness printed "No samples." A silence that looks like an empty schedule.
//
// The four at the end were found by that reverse check on its first run: they
// had been in the bundle, unfuzzed, the whole time. Each gets the pool matching
// what it is really called with — openerFactor and seasonLoadFactor take ERA and
// IP numbers, openerGameFactor takes a pitMeta object, and calibrationFactor
// takes a LEDGER ARRAY, so handing it a bare object would only prove that
// `{}.filter` is not a function.
const NASTY_LEDGER = [undefined, null, [], [null], [{}],
  [{ status: "resolved", outcome: null }],
  [{ status: "resolved", outcome: 1, call: "SYNCED", fair: 0.6, price: 0.6 }],
  [{ status: "resolved", outcome: 1, fair: NaN, price: 0.5 }],
  [{ status: "resolved", outcome: 1, fair: 0.6, price: 0 }],
  [{ status: "open", outcome: null, fair: 0.6, price: 0.5 }]];
const FACTORS = [["pitchSkillFactor", NASTY_OBJ], ["pitcherTrendFactor", NASTY_OBJ],
  ["pitcherVenueFactor", NASTY_OBJ], ["offKrateFactor", NASTY_OBJ],
  ["offenseVenueFactor", NASTY_OBJ], ["teamOffenseTrendFactor", NASTY_OBJ],
  ["openerGameFactor", NASTY_OBJ], ["openerFactor", NASTY], ["seasonLoadFactor", NASTY],
  ["calibrationFactor", NASTY_LEDGER]];
{
  const listed = new Set(FACTORS.map(([n]) => n));
  const stale = [...listed].filter((n) => typeof c[n] !== "function");
  const inBundle = Object.keys(c).filter((k) => /Factor$/.test(k) && typeof c[k] === "function");
  const uncovered = inBundle.filter((k) => !listed.has(k));
  ok(stale.length === 0, "every listed factor still exists in the bundle", stale.join(", "));
  ok(uncovered.length === 0, "every *Factor in the bundle is fuzzed here", uncovered.join(", "));
}
for (const [name, pool] of FACTORS) {
  const fn = c[name];
  if (typeof fn !== "function") continue;   // already reported as stale, above
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

/* paRates / matchupPA, the base/out state machine and simHalfNoRun were
 * audited here — three blocks, ~70 lines: distributions summing to 1, the 24-cell
 * grid never escaping its bounds, a grand slam scoring four, monotonicity in
 * offense quality. All of it tested the base-out sim, which no longer exists.
 *
 * It was deleted rather than kept passing against nothing. Over 1555 paired
 * games the sim was worth -0.00018 Brier (t -1.12) and -0.0003 AUC (t -0.16);
 * it moved p on 95.8% of games by a mean 0.59pp, twelve times the run-to-run
 * drift, in directions uncorrelated with outcomes. These checks were sound and
 * the code passed them — being correct is not the same as being worth having.
 * If the sim comes back, so should they; git has both. */

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
