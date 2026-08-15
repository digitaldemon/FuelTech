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

// ── 6. Known-good picks stay on the bet board ─────────────────────────────
// Ground truth from the Telegram cards sent 2026-08-14, captured before the
// ladder was disturbed. A refactor that quietly moves a cut-point shows up here
// as picks falling off the board, which is how the ten-point BET drift was
// caught. If a deliberate retune makes these fail, update the fixture in the
// same commit and say why — do not delete the check.
console.log("\nnotified picks (2026-08-14)");
const NOTIFIED = [
  { g: "BOS@PIT", prob: 63.7, mkt: 55 },
  { g: "BAL@TB", prob: 67.4, mkt: 56 },
  { g: "NYY@TOR", prob: 60.3, mkt: 51 },
];
// The notifier ships anything the board calls BET or better; LEAN and PASS are
// board-only. Rung-for-rung equality is not asserted because the live rows carry
// gate context (consensus, sample depth, pitcher tier) this harness cannot
// reconstruct — a one-rung step-down is expected, falling off the board is not.
for (const n of NOTIFIED) {
  const s = nrfiVerdict({ pMax: n.prob, call: "NRFI",
    aligned: { agree: 3, total: 3, rows: 18 }, confidence: 0.85,
    pitProfiles: { away: { sample: 20 }, home: { sample: 20 } }, awayPP: "A", homePP: "B",
    market: { marketSide: n.mkt, edgeRaw: n.prob - n.mkt, edge: (n.prob - n.mkt) * 0.65 },
  }).strength;
  check(s === "BET" || s === "STRONG", n.g + " (" + n.prob + "% vs " + n.mkt + "¢) is still bettable",
    "graded " + s + " — this pick was sent as a BET and would now be withheld.");
}

// The notifier has its own floor in lib/nrfi-notify.ts (`e.prob >= 57`). It only
// matters for rows without isBet, but if it ever rises above the BET cut it
// silently swallows real picks in a file nobody edits when tuning the ladder.
console.log("          notifier floor 57 vs NRFI_BET_MIN " + BET +
  (57 > BET ? " — floor sits ABOVE the BET cut; only isBet keeps 55-56% picks sending"
            : " — floor at or below the BET cut, no picks withheld"));

// ── 7. Thin-arm gate tells a reliever apart from an unknown ───────────────
console.log("\nthin-arm gate");
const thinArm = c.read("nrfiThinArm");
const ARMS = [
  ["reliever/opener, full season of work", { sample: 2, apps: 29, seasonIp: 61.2 }, false],
  ["established starter", { sample: 11, apps: 25, seasonIp: 104.2 }, false],
  ["swingman at the threshold", { sample: 3, apps: 15, seasonIp: 25 }, false],
  ["September callup", { sample: 0, apps: 4, seasonIp: 4 }, true],
  ["one-out specialist — apps but no innings", { sample: 2, apps: 40, seasonIp: 22 }, true],
  ["no profile", null, true],
  // Records written before apps/seasonIp existed must fail closed, not open.
  ["legacy record with no workload fields", { sample: 2 }, true],
];
for (const [name, p, want] of ARMS) {
  check(thinArm(p) === want, name + " -> " + (want ? "thin" : "not thin"),
    "got " + (thinArm(p) ? "thin" : "not thin") + "; a wrong answer here moves the verdict a full rung.");
}
// The reconcile block used to keep its own copy of the `sample >= 5` rule, which
// let the record refuse a pick the board was showing. One definition, both sites.
check(/nrfiThinArm\(r\.pitProfiles/.test(require("fs").readFileSync(
  require("path").join(__dirname, "..", "public", "desk", "app.jsx"), "utf8")),
  "record reconcile shares the verdict's thin definition",
  "the reconcile site has re-inlined its own sample threshold.");

// ── 8. Consensus and one-directional checks ───────────────────────────────
console.log("\nconsensus semantics");
const withAgree = (agree, total, pMax) => nrfiVerdict({ pMax: pMax || 72, call: "NRFI",
  aligned: { agree, total, rows: 18 }, confidence: 0.9,
  pitProfiles: { away: { sample: 20 }, home: { sample: 20 } }, awayPP: "A", homePP: "B" }).strength;
// `total ? agree/total : 1` scored a game with no signal as unanimous, which
// cleared the STRONG gate's frac >= 0.6. Absence of evidence is not agreement.
check(ORDER.indexOf(withAgree(0, 0)) < ORDER.indexOf(withAgree(3, 3)),
  "zero family votes ranks below unanimous agreement",
  "no-signal grades " + withAgree(0, 0) + ", unanimous grades " + withAgree(3, 3) + " — they are being treated alike.");
// Only three families exist, so a `total >= 3` split gate needed full turnout
// before it could ever register a disagreement.
check(ORDER.indexOf(withAgree(0, 2)) < ORDER.indexOf(withAgree(2, 2)),
  "a split across two families still costs a rung",
  "0/2 grades " + withAgree(0, 2) + " and 2/2 grades " + withAgree(2, 2) + "; the split gate is unreachable below full turnout.");

// A check that can only ever vote one way is a constant, not a signal. Both of
// these were caught voting NRFI on 14 of 15 live games.
console.log("\ncheck directionality");
const src = require("fs").readFileSync(
  require("path").join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
const travelLean = /Travel & rest"[\s\S]{0,600}?lean: ([\s\S]*?)\},/.exec(src);
check(!!travelLean && /"nrfi"/.test(travelLean[1]) && /"yrfi"/.test(travelLean[1]),
  "Travel & rest can vote either direction",
  "the lean expression cannot reach one of the two sides.");
// Offense trend required BOTH offences to be 12pp off their own season rate in
// the same direction — ~3.8% of games, and it voted on none of a live slate.
// A conjunction across the two teams is the shape to watch for here.
const offTrend = /Offense trend \(1st inn L10\)"[\s\S]{0,400}?lean: ([\s\S]*?)\};/.exec(src);
check(!!offTrend && /"nrfi"/.test(offTrend[1]) && /"yrfi"/.test(offTrend[1]) && !/every\(/.test(offTrend[1]),
  "Offense trend votes on the combined read, not a both-teams conjunction",
  "the lean expression is back to requiring every team to clear the same gate.");
const lgk = /const LG_K = ([\d.]+);/.exec(src);
check(!!lgk && Number(lgk[1]) >= 0.235 && Number(lgk[1]) <= 0.255,
  "LG_K matches a plausible league first-inning K rate (measured 24.6% on 2026-08-15)",
  "LG_K=" + (lgk ? lgk[1] : "?") + ". At 0.21, 22 of 30 clubs graded above-average-K and the\n" +
  "check could never vote YRFI; offMult carried that bias into the probability at weight 0.35.");

console.log("\n" + "=".repeat(72));
if (fails) { console.log(fails + " invariant(s) VIOLATED"); process.exit(1); }
console.log("all invariants hold");
