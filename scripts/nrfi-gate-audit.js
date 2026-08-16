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
  "Last start momentum", "Pitcher trend (L10 vs SZN)", "Pitcher venue split",
  "Backtest profile", "1st-inning offense", "Offense trend (1st inn L10)", "Offense venue split",
  "Team K% (1st inn)", "Platoon / handedness", "Lineups (leadoff-weighted)", "Day game", "Weather & park",
  "Travel & rest", "Some Future Unlisted Check"];
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

// A recent-form window compared against a baseline that CONTAINS it measures a
// fraction of the move it is trying to detect. teamOffenseRolling caps its window
// at 25 games, so L10 was 40% of "szn" and every delta arrived at exactly 60% of
// true size — confirmed on all 30 clubs to machine precision, mean ratio 0.6000
// with zero deviation. The synthetic case below is the regression test.
console.log("\ntrend baselines exclude their own window");
{
  // A club that scored in the 1st in 8 of its last 10 and 3 of the 15 before
  // that: true delta is 80% - 20% = +60pp. Against the overlapping 25-game rate
  // (11/25 = 44%) it reads +36pp — three fifths, and a different verdict.
  const l10 = { rate: 0.80, n: 10, avgRuns: 1.0 };
  const szn = { rate: 11 / 25, n: 25, avgRuns: 0.6 };
  const base = c.trendBaseline(szn, l10);
  check(!!base && Math.abs(base.rate - 3 / 15) < 1e-9 && base.n === 15,
    "trendBaseline subtracts the recent window back out",
    "expected the prior 15 games at 20%, got " + (base ? base.n + "g @ " + (base.rate * 100).toFixed(1) + "%" : "null"));
  const dTrue = l10.rate - (base ? base.rate : 0), dOverlap = l10.rate - szn.rate;
  check(Math.abs(dOverlap / dTrue - 0.6) < 1e-9,
    "the overlap attenuation is the predicted 0.6, not an approximation",
    "measured " + (dOverlap / dTrue).toFixed(6) + " — the window arithmetic has changed.");
  // Too little left over to be a baseline: fall back rather than invent one.
  check(c.trendBaseline({ rate: 0.4, n: 12 }, { rate: 0.5, n: 10 }) === null,
    "a prior window under 5 games is refused, not extrapolated",
    "a 2-game baseline was accepted as a season rate.");
  // The gates must stay on the de-overlapped scale. At the old 0.12/0.20 the
  // corrected delta (1.67x larger) would fire roughly half again as often.
  const gates = /const HOT = ([\d.]+), WARM = ([\d.]+);/.exec(src);
  check(!!gates && Number(gates[1]) >= 0.30 && Number(gates[2]) >= 0.18,
    "offense trend gates are stated on the de-overlapped scale",
    "HOT/WARM = " + (gates ? gates[1] + "/" + gates[2] : "?") + ". Values near 0.20/0.12 belong to\n" +
    "the attenuated delta and will over-fire now that the baseline is clean.");
  // The note has to quote the number that decided the call. "off L10 hot (+4pp)"
  // shipped because the verdict came from L5 at +44 and the note printed d10
  // regardless — a label contradicting its own number reads as a broken model.
  check(/const pp = Math\.round\(\(delta \?\? 0\) \* 100\)/.test(src),
    "the trend note prints the delta that drove the verdict",
    "the note is back to printing d10 while the call is made on the L5/L10 blend.");

  // The pitcher side carries the same defect under a different field name, and
  // there the overlap is (n-10)/n — it moves with workload instead of sitting at
  // a constant, so it cannot be corrected by dividing.
  const pitSzn = { pct: 60, n: 22, runsPerStart: 0.55 };
  const pitL10 = { pct: 90, n: 10, runsPerStart: 0.20 };
  const pb = c.trendBaseline(pitSzn, pitL10, "pct");
  check(!!pb && Math.abs(pb.pct - (60 * 22 - 90 * 10) / 12) < 1e-9,
    "pitcher trend de-overlaps on pct, not just rate",
    "trendBaseline did not handle the pitcher window's field name.");

  // De-overlapping made a near-zero denominator reachable for the first time. The
  // runs-per-start supplement divides by the prior window, and a prior of 0.04
  // R/start turned routine cold streaks into -124pp on the 2026-08-15 slate
  // (Schlittler, Webb, Ginn), pinning the factor at its clamp. The old `> 0`
  // guard was only ever survivable because a full season never got that small.
  // Bounding `combined` outright is the wrong assertion — a large clean-start
  // delta is a legitimate reading, and an earlier cut of this check failed on
  // synthetic data whose OWN pct delta was -65pp. What has to be bounded is the
  // SUPPLEMENT. So run the same windows twice, once with runsPerStart stripped
  // (boost forced to 0) and once with a fractional prior, and measure only the
  // difference the supplement made.
  const rpsWindows = (rps) => ({
    szn: { pct: 60, n: 25, runsPerStart: rps ? 0.576 : undefined },  // prior 15 st = 0.16 R/st
    l10: { pct: 55, n: 10, runsPerStart: rps ? 1.20 : undefined },
    l5:  { pct: 55, n: 5,  runsPerStart: rps ? 1.20 : undefined },
  });
  const rpsOff = c.pitcherTrendFactor(rpsWindows(false));
  const rpsOn  = c.pitcherTrendFactor(rpsWindows(true));
  check(rpsOff && rpsOn && rpsOff.d != null && rpsOn.d != null &&
        Math.abs(rpsOn.d - rpsOff.d) <= 10.0001,
    "a near-zero trend baseline cannot blow up the runs-per-start supplement",
    "the supplement moved combined by " +
      (rpsOn && rpsOff ? (rpsOn.d - rpsOff.d).toFixed(2) : "?") + "pp off a 0.16 R/start prior; " +
      "it is weighted to be worth +-10pp.");
  // Same isolation on the offense side. avgRuns 0.456 over 25 with 0.90 in the
  // L10 leaves a prior of 0.16 R/g — above the floor, so this exercises the CLAMP
  // rather than the floor (a smaller prior would just zero the boost and pass
  // trivially).
  const rgWindows = (rg) => ({
    szn: { rate: 0.30, n: 25, avgRuns: rg ? 0.456 : undefined },
    l10: { rate: 0.35, n: 10, avgRuns: rg ? 0.90 : undefined },
    l5:  { rate: 0.35, n: 5,  avgRuns: rg ? 0.90 : undefined },
  });
  const rgOff = c.teamOffenseTrendFactor(rgWindows(false));
  const rgOn  = c.teamOffenseTrendFactor(rgWindows(true));
  check(rgOff && rgOn && rgOff.d != null && rgOn.d != null &&
        Math.abs(rgOn.d - rgOff.d) <= 0.12001,
    "the offense runs/game boost is capped at its own weight",
    "the boost moved combined by " +
      (rgOn && rgOff ? (rgOn.d - rgOff.d).toFixed(4) : "?") + " off a 0.16 R/g prior; weight is 0.12.");
}

// opener measured r=+0.658 against pitBase, the strongest overlap in the model,
// because it is a transform of the same first-inning line pitBase is built from.
// Correlation is scale-invariant so no input fix can remove it — what the fixes
// remove is MAGNITUDE. Two causes, both pinned here.
console.log("\nopener is not a restatement of the base rate");
{
  // seasonEra includes the 1st innings under test (~18% of a starter's innings),
  // so the old ratio divided a number by a baseline partly made of itself.
  const withRest = c.openerFactor(6.00, 3.60, 130, 22);
  const seasonOnly = c.openerFactor(6.00, 3.60, null, null);
  check(withRest.f !== seasonOnly.f && /inn 2\+/.test(withRest.note),
    "opener compares the 1st inning against innings 2+, not against a season containing it",
    "note=" + withRest.note + " — the baseline is still the contaminated season line.");
  // A 20-inning ERA moves a full run on two bad frames, and that noise is exactly
  // what pitBase already carries. Regressing shrinks the ratio toward its
  // baseline, so a wild first-inning line must not reach the clamp on its own.
  // The test has to sit where regression is the only thing keeping the factor off
  // the rail: at 6.00 the unregressed ratio clears the clamp, the regressed one
  // lands at ~1.08. Asserting on a 12.00 instead would prove nothing, because a
  // first-inning ERA that extreme is genuinely a pinned reading either way.
  const hot  = c.openerFactor(6.00, 3.60, 130, 20);
  const mid  = c.openerFactor(4.00, 3.60, 130, 20);
  const calm = c.openerFactor(3.00, 3.60, 130, 20);
  check(hot.f < 1.12 && hot.f > mid.f && mid.f > calm.f,
    "a noisy first-inning ERA is regressed before it becomes a multiplier",
    "6.00=" + hot.f.toFixed(4) + " 4.00=" + mid.f.toFixed(4) + " 3.00=" + calm.f.toFixed(4) +
    "; unregressed, a 6.00 over 20 IP already pins the clamp and the ordering flattens.");
  // A starter whose earned runs are nearly all in the 1st leaves a rest-ERA near
  // zero; dividing by it manufactures a huge ratio from a tiny denominator.
  const allInFirst = c.openerFactor(9.00, 1.50, 40, 18);
  check(isFinite(allInFirst.f) && allInFirst.f <= 1.12 && allInFirst.f >= 0.90,
    "a near-zero rest-of-game ERA falls back instead of dividing",
    "f=" + (allInFirst ? allInFirst.f : "?"));
}

// The card prints "this team scores in the 1st X% of the time" from a run rate.
// It used 1 - exp(-lambda), the Poisson answer, which overstates every club by
// about ten points: runs in an inning cluster (score in the 1st and it is often
// two or three), so a given lambda comes from FEWER scoring innings than Poisson
// assumes. Measured against actual season frequencies for all 30 clubs, mean
// absolute error was 11.87 points; the anchored form gives 1.75.
console.log("\nthe displayed scoring rate is anchored, not Poisson");
{
  const P0 = c.read("NRFI_LG_P0"), LG = c.read("NRFI_LG_LAMBDA");
  check(c.yrfiPctFromLambda(LG) === Math.round((1 - P0) * 100),
    "at the league lambda the displayed rate IS the league rate, by construction",
    "lambda=" + LG + " printed " + c.yrfiPctFromLambda(LG) + "%, but NRFI_LG_P0=" + P0 +
    " means the league scores " + Math.round((1 - P0) * 100) + "% of the time.");
  // The Poisson form is what was shipped; it must not come back.
  check(c.yrfiPctFromLambda(0.52) < Math.round((1 - Math.exp(-0.52)) * 100) - 8,
    "the displayed rate is well below the Poisson value it replaced",
    "the display is back within 8 points of 1-exp(-lambda) — the overstatement has returned.");
  // Monotone and bounded: a higher run rate can never print a lower scoring rate.
  let mono = true;
  for (let lam = 0.05; lam < 1.5; lam += 0.05)
    if (c.yrfiPctFromLambda(lam) > c.yrfiPctFromLambda(lam + 0.05)) mono = false;
  check(mono, "a higher first-inning run rate never prints a lower scoring rate",
    "the display transform is not monotone in lambda.");
  check(c.yrfiPctFromLambda(null) === null && c.yrfiPctFromLambda(undefined) === null,
    "a missing rate prints nothing rather than 0%",
    "a null lambda produced a number, which reads as a team that never scores.");
}

// The card's L10 arrow used to be drawn off a baseline containing the L10, so it
// showed three fifths of the move the verdict acted on — the Yankees read -12pp
// on the card and -20pp in the model on 2026-08-15.
console.log("\nthe card's recent-form baseline matches the model's");
{
  const roll = { szn: { rate: 0.20, n: 25, avgRuns: 0.4 }, l10: { rate: 0.0, n: 10, avgRuns: 0 }, l5: { rate: 0, n: 5, avgRuns: 0 } };
  const p = c.offL10Payload(roll);
  const prior = c.trendBaseline(roll.szn, roll.l10);
  check(p && p.priorRate != null && Math.abs(p.priorRate - prior.rate) < 1e-9,
    "the card is handed the de-overlapped prior, not just the whole window",
    "offL10Payload did not carry priorRate.");
  check(p && Math.abs((p.rate - p.priorRate)) > Math.abs((p.rate - p.sznRate)),
    "the de-overlapped delta is the larger, true one",
    "prior delta " + (p ? (p.rate - p.priorRate).toFixed(3) : "?") +
    " vs overlapping " + (p ? (p.rate - p.sznRate).toFixed(3) : "?"));
  check(c.offL10Payload({ szn: { rate: 0.2, n: 25 }, l10: { rate: 0.1, n: 3 } }) === null,
    "a window under 5 games is not put on the card at all",
    "a 3-game window was surfaced as an L10.");
}

console.log("\n" + "=".repeat(72));
if (fails) { console.log(fails + " invariant(s) VIOLATED"); process.exit(1); }
console.log("all invariants hold");
