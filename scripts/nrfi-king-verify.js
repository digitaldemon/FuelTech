/* Verifies the KING MODE block AS SHIPPED.
 *
 *   node scripts/nrfi-king-verify.js
 *
 * Reads the real source out of app.jsx and evaluates it, rather than restating
 * the equation here — a test that restates the thing it tests passes forever
 * after the app drifts away from it. The assertions below are anchored to
 * NRFIKINGKY's own published dialog, including the two worked examples he gives
 * ("a 100% arm over 5 starts shrinks to ~85; over 1 start to ~80"), so this
 * fails if the app stops implementing HIS equation, not merely if it changes.
 *
 * Sliced by function-name markers, not line numbers: an earlier version used
 * line numbers and they were already stale by the next edit. */
const fs = require("fs");
const path = require("path");
const raw = fs.readFileSync(
  path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");

/* From the declaration to the line that closes it at column 0. Every function
 * here is top-level in the bundle, so a lone "}" is an unambiguous terminator. */
function slice(startRe, label) {
  const lines = raw.split(/\r?\n/);
  const i = lines.findIndex((l) => startRe.test(l));
  if (i < 0) throw new Error("could not find " + label + " in app.jsx");
  for (let j = i; j < lines.length; j++) {
    if (/^[}]/.test(lines[j])) return lines.slice(i, j + 1).join("\n");
  }
  throw new Error("unterminated " + label);
}
const dsTierSrc = slice(/^function dsTier\(/, "dsTier");
const kingSrc = [
  raw.split(/\r?\n/).filter((l) => /^const KING_(PARK_ADJ|ADJ_CAP|W|LG|K|TIERS|YRFI_FLIP)\b/.test(l)).join("\n"),
  slice(/^function kingArm\(/, "kingArm"),
  slice(/^function kingEvaluate\(/, "kingEvaluate"),
  slice(/^function kingTier\(/, "kingTier"),
].join("\n");

const mod = {};
new Function("exports", dsTierSrc + "\n" + kingSrc + `
  Object.assign(exports, { kingArm, kingEvaluate, kingTier, dsTier,
    KING_W, KING_LG, KING_K, KING_TIERS, KING_YRFI_FLIP, KING_ADJ_CAP });
`)(mod);

let fails = 0;
const near = (name, got, want, tol = 0.05) => {
  const ok = got != null && Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log((ok ? "  ok   " : "  FAIL ") + name.padEnd(52) +
    "got " + (got == null ? "null" : got.toFixed(3)) + "  want " + want);
};
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? "  ok   " : "  FAIL ") + name.padEnd(52) +
    "got " + JSON.stringify(got) + "  want " + JSON.stringify(want));
};

const arm = (szn, sznN, l30, l30N) => ({
  windows: [{ key: "SZN", pct: szn, n: sznN }, { key: "L30", pct: l30, n: l30N }],
});

console.log("CONSTANTS match his published dialog");
eq("blend", mod.KING_W, { SZN: 0.6, L30: 0.4 });
eq("league shrink target", mod.KING_LG, 78);
eq("phantom starts", mod.KING_K, 10);
eq("tiers", mod.KING_TIERS, { elite: 68, green: 64, yellow: 58 });
eq("yrfi flip", mod.KING_YRFI_FLIP, 52);
eq("adjustment cap", mod.KING_ADJ_CAP, 3);

console.log("\nHIS OWN WORKED EXAMPLES (the dialog states both outcomes)");
// "A 100% arm over 5 starts shrinks to ~85; over 1 start to ~80."
near("100% arm, 5 season starts -> ~85", mod.kingArm(arm(100, 5, 100, 5), 0).pct, 85.333);
near("100% arm, 1 season start  -> ~80", mod.kingArm(arm(100, 1, 100, 1), 0).pct, 80.0);

console.log("\nSHRINK USES SEASON GS, NOT L30 (the thing his dialog leaves open)");
/* Same L30 count, different season count. If the shrink read L30 these would be
 * identical — that is the whole test. */
near("100%/30 szn, 5 in L30", mod.kingArm(arm(100, 30, 100, 5), 0).pct, 94.5);
near("100%/5 szn,  5 in L30", mod.kingArm(arm(100, 5, 100, 5), 0).pct, 85.333);

console.log("\nBLEND IS 60/40, L50 AND L10 DO NOT SCORE");
// 60*80 + 40*40 = 64 raw; shrink on 20 GS: (20*64 + 10*78)/30 = 68.667
near("SZN 80 / L30 40 on 20 GS", mod.kingArm(arm(80, 20, 40, 6), 0).pct, 68.667);
{
  const withNoise = { windows: [{ key: "SZN", pct: 80, n: 20 }, { key: "L30", pct: 40, n: 6 },
    { key: "L50", pct: 0, n: 12 }, { key: "L10", pct: 0, n: 2 }] };
  near("same arm + L50/L10 at 0% -> unchanged", mod.kingArm(withNoise, 0).pct, 68.667);
}

console.log("\nPARK ADJUSTMENT, capped");
// (20*80 + 10*78)/30 = 79.333, then +2.
near("PNC +2 on an 80% arm at 20 GS", mod.kingArm(arm(80, 20, 80, 6), +2).pct, 81.333);
{
  const g = (home, szn) => ({ homeAbbr: home, pitProfiles: {
    away: { name: "A", rolling: arm(szn, 20, szn, 6) },
    home: { name: "H", rolling: arm(szn, 20, szn, 6) } } });
  const base = mod.kingEvaluate(g("SEA", 80)).score;
  const pit = mod.kingEvaluate(g("PIT", 80)).score;
  const cin = mod.kingEvaluate(g("CIN", 80)).score;
  /* Not symmetric, and that is correct: the adjustment is additive on each arm
   * but the score is their product, so the same +-2 moves a high pair further
   * than a low one. Asserted to 3 decimals so an accidental switch to a
   * multiplicative adjustment would fail here. */
  near("PNC lifts the score", pit - base, 3.213, 0.01);
  near("GABP drops it slightly less", base - cin, 3.133, 0.01);
  eq("Coors is refused, not docked", mod.kingEvaluate(g("COL", 80)).gates.map((x) => x.tag), ["COORS"]);
}

console.log("\nGATES (hard) AND FLAGS (soft)");
const G = (home, a, h) => ({ homeAbbr: home,
  pitProfiles: { away: { name: "A", rolling: a }, home: { name: "H", rolling: h } } });
const tags = (k) => k.gates.map((x) => x.tag);
const ftags = (k) => k.flags.map((x) => x.tag);

eq("0 starts -> BLIND", tags(mod.kingEvaluate(G("SEA", arm(null, 0, null, 0), arm(80, 20, 80, 6)))), ["BLIND"]);
eq("1 start  -> THIN (not 2-3)", tags(mod.kingEvaluate(G("SEA", arm(100, 1, 100, 1), arm(80, 20, 80, 6)))), ["THIN"]);
eq("3 starts -> THIN", tags(mod.kingEvaluate(G("SEA", arm(80, 3, 80, 3), arm(80, 20, 80, 6)))), ["THIN"]);
eq("4 starts -> no gate", tags(mod.kingEvaluate(G("SEA", arm(80, 4, 80, 4), arm(80, 20, 80, 6)))), []);
{
  const k = mod.kingEvaluate(G("SEA", arm(70, 20, 40, 6), arm(80, 20, 80, 6)));
  eq("leaky arm is NOT a hard gate", tags(k), []);
  eq("leaky arm IS a soft flag", ftags(k), ["LEAK"]);
}

console.log("\nTIER LADDER, on his cutoffs");
const tierFor = (aSzn, hSzn) => mod.kingTier(
  mod.kingEvaluate(G("SEA", arm(aSzn, 25, aSzn, 6), arm(hSzn, 25, hSzn, 6)))).label;
/* Each pair is chosen to land inside a band rather than near an edge; the score
 * each produces is in the comment so a shifted cutoff shows up as a tier change
 * here instead of silently rescoring the board. */
eq("two 95% arms (score 81.3) -> ELITE", tierFor(95, 95), "ELITE");
eq("two 88% arms (score 72.5) -> ELITE", tierFor(88, 88), "ELITE");
eq("two 82% arms (score 65.4) -> GREEN", tierFor(82, 82), "GREEN");
eq("two 78% arms (score 60.8) -> YELLOW", tierFor(78, 78), "YELLOW");
eq("two 70% arms (score 52.3) -> RED", tierFor(70, 70), "RED");
eq("two 65% arms (score 47.2) -> RED", tierFor(65, 65), "RED");
{
  // Strong pair, one leaky arm -> a flagged game never shows green.
  const k = mod.kingEvaluate(G("SEA", arm(95, 25, 40, 6), arm(95, 25, 95, 6)));
  eq("flagged strong game capped at YELLOW", mod.kingTier(k).label, "YELLOW");
  eq("  and marked as capped", !!mod.kingTier(k).capped, true);
}
{
  // Low score, exactly one leaky arm -> flips.
  const k = mod.kingEvaluate(G("SEA", arm(45, 25, 30, 6), arm(75, 25, 75, 6)));
  eq("under 52 + one leak -> YRFI", mod.kingTier(k).label, "YRFI");
  eq("  side reported", k.side, "YRFI");
}
{
  // Low score, BOTH arms leaky -> not his setup, no flip.
  const k = mod.kingEvaluate(G("SEA", arm(45, 25, 30, 6), arm(45, 25, 30, 6)));
  eq("under 52 + TWO leaks -> no flip", k.side, "NRFI");
}
{
  // One leaky arm but the score is above 52 -> no flip, just the cap.
  const k = mod.kingEvaluate(G("SEA", arm(90, 25, 40, 6), arm(90, 25, 90, 6)));
  eq("one leak but score >= 52 -> no flip", k.side, "NRFI");
}
{
  // A gated game has no tier at all, which must agree with dsOf() returning null.
  const k = mod.kingEvaluate(G("COL", arm(95, 25, 95, 6), arm(95, 25, 95, 6)));
  eq("gated game has no tier", mod.kingTier(k).label, "NO DS");
}

console.log(fails === 0 ? "\nALL PASS" : "\n" + fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
