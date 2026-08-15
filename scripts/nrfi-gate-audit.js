// Regression check on the NRFI gate chain, run against public/desk/app.js via
// the VM sandbox so it tests the code that actually ships.
//
// These are invariants, not tuning opinions. Each one corresponds to a defect
// that reached the live board:
//   1. a calibration that silences the model, which blanks the whole card
//   2. blend tiers that only fire for one side of the market
//   3. a gate that jumps STRONG -> PASS instead of stepping down
//   4. one check outvoting a whole family
//   5. threshold constants drifting apart across call sites
//
//   node scripts/nrfi-gate-audit.js     → exits 1 if any invariant is violated
const { loadDeskModel } = require("./nrfi-model-load");
const c = loadDeskModel();
const { applyCalibration, nrfiBlend, nrfiVerdict, checkFamily, nrfiTier } = c;

const SEED = c.read("NRFI_CALIB_SEED");
const STRONG = c.read("NRFI_STRONG_MIN"), BET = c.read("NRFI_BET_MIN"), LEAN = c.read("NRFI_LEAN_MIN");
const calib = Object.assign({}, SEED, { active: true });

let fails = 0;
const check = (ok, name, detail) => {
  console.log((ok ? "  PASS  " : "  FAIL  ") + name + (ok || !detail ? "" : "\n          " + detail.replace(/\n/g, "\n          ")));
  if (!ok) fails++;
};
console.log("=".repeat(72) + "\nNRFI GATE INVARIANTS — shipped bundle\n" +
  "seed " + JSON.stringify(SEED) + "\nladder STRONG>=" + STRONG + " BET>=" + BET + " LEAN>=" + LEAN + "\n" + "=".repeat(72));

// ── 1. The model must keep a voice across its working range ───────────────
console.log("\ncalibration");
let dead = 0;
for (let raw = 52; raw <= 80; raw += 0.5) {
  if (Math.abs(applyCalibration(raw / 100, calib) - 0.5) < 0.0005) dead = raw;
}
check(dead === 0, "no dead zone — calibration never pins output to exactly 50%",
  "raw confidence up to " + dead + "% collapses to 50.0. A silenced model makes pFinal\n" +
  "equal the market, so edgeRaw <= 0 and the value gate hard-PASSes every game —\n" +
  "LEANs included, because that gate outranks the ladder.");
console.log("          raw 55->" + (applyCalibration(0.55, calib) * 100).toFixed(1) +
  "  60->" + (applyCalibration(0.60, calib) * 100).toFixed(1) +
  "  65->" + (applyCalibration(0.65, calib) * 100).toFixed(1) +
  "  70->" + (applyCalibration(0.70, calib) * 100).toFixed(1));

// ── 2. Equal conviction must be treated equally on both sides ─────────────
console.log("\nblend");
let worstAsym = 0;
for (const conv of [0.55, 0.60, 0.65, 0.70, 0.75]) {
  worstAsym = Math.max(worstAsym, Math.abs(nrfiBlend(conv, 50) - (1 - nrfiBlend(1 - conv, 50))));
}
check(worstAsym < 0.001, "blend is direction-symmetric",
  "a YRFI read is shrunk " + (worstAsym * 100).toFixed(1) + "pp more than an identical NRFI read;\n" +
  "the tier ladder is testing P(NRFI) instead of directional conviction.");

// ── 3. Gates step down; they do not cliff ─────────────────────────────────
console.log("\nvalue gate");
const ORDER = ["PASS", "LEAN", "BET", "STRONG"];
const row = (mktProb, edgeRaw) => nrfiVerdict({
  pMax: 72, call: "NRFI", aligned: { agree: 3, total: 3, rows: 18 }, confidence: 0.85,
  pitProfiles: { away: { sample: 20 }, home: { sample: 20 } }, awayPP: "A", homePP: "B",
  market: { edgeRaw, edge: edgeRaw * 0.65, marketSide: mktProb },
});
let worstDrop = 0, dropAt = "";
for (const e of [3, 4, 4.9]) {
  const lo = ORDER.indexOf(row(64, e).strength), hi = ORDER.indexOf(row(65, e).strength);
  if (lo - hi > worstDrop) { worstDrop = lo - hi; dropAt = e + "pp edge: 64%=" + ORDER[lo] + " -> 65%=" + ORDER[hi]; }
}
check(worstDrop <= 1, "1pp market move costs at most one rung",
  dropAt + " — a " + worstDrop + "-rung fall on a single point of price.");
for (const m of [55, 65, 75]) console.log("          mktSide " + m + "%: " +
  [2, 3, 4.9, 6].map((e) => e + "pp=" + row(m, e).strength).join("  "));

// ── 4. No single check may outvote a family ───────────────────────────────
console.log("\nconsensus");
const labels = ["Starting pitching (1st inning)", "Pitcher skill (K/BB/barrel/GB)", "Opener / bullpen game",
  "Starter recent form", "Pitcher K9 trend (L3 vs SZN)", "Clean opener vs slow starter", "Pitcher season load",
  "Pitcher rest days", "Last start momentum", "Pitcher trend (L10 vs SZN)", "Pitcher venue split",
  "Backtest profile", "1st-inning offense", "Offense trend (1st inn L10)", "Offense venue split",
  "Team K% (1st inn)", "Platoon / handedness", "Lineups (leadoff-weighted)", "Day game", "Weather & park",
  "Umpire", "Travel & rest", "Some Future Unlisted Check"];
const fams = {};
for (const l of labels) { const f = checkFamily(l); (fams[f] = fams[f] || []).push(l); }
const solo = Object.entries(fams).filter(([, ls]) => ls.length === 1);
check(solo.length === 0, "every check rolls into a multi-check family",
  solo.map(([f]) => "\"" + f + "\"").join(", ") + " votes alone, carrying 1/" +
  Object.keys(fams).length + " of consensus — the same weight as all " +
  (fams.pitching || []).length + " pitching checks.");
for (const [f, ls] of Object.entries(fams)) console.log("          " + f + ": " + ls.length);

// ── 5. Threshold constants agree across call sites ────────────────────────
console.log("\nthresholds");
const at = (p) => nrfiVerdict({ pMax: p, call: "NRFI", aligned: { agree: 3, total: 3, rows: 18 },
  confidence: 0.9, pitProfiles: { away: { sample: 20 }, home: { sample: 20 } }, awayPP: "A", homePP: "B" }).strength;
check(at(STRONG) === "STRONG" && at(STRONG - 0.1) === "BET", "ladder honours NRFI_STRONG_MIN=" + STRONG, at(STRONG) + "/" + at(STRONG - 0.1));
check(at(BET) === "BET" && at(BET - 0.1) === "LEAN", "ladder honours NRFI_BET_MIN=" + BET, at(BET) + "/" + at(BET - 0.1));
check(at(LEAN) === "LEAN" && at(LEAN - 0.1) === "PASS", "ladder honours NRFI_LEAN_MIN=" + LEAN, at(LEAN) + "/" + at(LEAN - 0.1));
check(nrfiTier(BET).t !== "TOSS-UP" && nrfiTier(LEAN).t !== "TOSS-UP",
  "tier badge does not read TOSS-UP on a bettable number",
  "tier(" + BET + ")=" + nrfiTier(BET).t + " tier(" + LEAN + ")=" + nrfiTier(LEAN).t);

console.log("\n" + "=".repeat(72));
if (fails) { console.log(fails + " invariant(s) VIOLATED"); process.exit(1); }
console.log("all invariants hold");
