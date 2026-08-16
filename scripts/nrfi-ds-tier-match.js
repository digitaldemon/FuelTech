/* Why does a game he badges YELLOW come out RED on our board?
 *
 * Reported 2026-08-16 on SEA @ HOU: his card reads DS 59.1 YELLOW, ours reads
 * DS 51.5 RED. The instinct is that our ladder is too harsh. This script asks
 * whether that is true, and it has to start by refusing the obvious comparison.
 *
 * THE TWO NUMBERS ARE NOT ON THE SAME SCALE. Ours is dsOf(r) = pCal * 100, a
 * calibrated probability: over 1283 graded games it runs 37.9 to 67.2 with a
 * median of 54.2. His is a 0-100 rating whose 16 observed values run 59.1 to
 * 72.6. Neither the centre nor the width matches, so no threshold can be
 * carried across by value and a cell-for-cell match is not a thing to aim at.
 * The only property that survives the change of scale is SELECTIVITY: what
 * FRACTION of a slate earns each badge. That is what this script matches on.
 *
 * WHAT IS ACTUALLY OBSERVABLE ABOUT HIS LADDER, and what is not:
 *
 *   ELITE/GREEN  (67.8, 68.3]  8 elite and 5 green observations bracket it
 *   GREEN/YELLOW (62.8, 64.1]  3 yellow observations bracket it from below
 *   YELLOW/RED   NOTHING. He has never once published a RED card.
 *
 * That last line is the whole story of this complaint. He posts his shortlist,
 * not his slate, so the bottom of his ladder is CENSORED by his posting habit
 * rather than merely unmeasured — and the 55 that nrfi-ds-decode.js records for
 * his yellow/red cut is explicitly a guess, not a reading. Our own 54 is the
 * same kind of guess on a different scale.
 *
 * So "his YELLOW vs our RED" is a disagreement between two UNMEASURED
 * thresholds about a game that NEITHER system is betting — his 59.1 is far
 * below his 64.1 play floor, and ours is a PASS. The badge is the only thing
 * that differs; the action does not.
 *
 * Run: node scripts/nrfi-ds-tier-match.js
 */
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "nrfi-tout-vs-model.json");
const SHIPPED = { elite: 62, green: 58.5, yellow: 54 };

// His published cards, tier as HE labelled them. From nrfi-ds-tier-brackets.js.
const HIS = {
  ELITE: [68.3, 68.9, 69.1, 69.7, 69.8, 70.5, 71.1, 72.6],
  GREEN: [64.1, 64.7, 66.4, 67.7, 67.8],
  YELLOW: [59.1, 60.0, 62.8],
  RED: [],
};

const d = JSON.parse(fs.readFileSync(DATA, "utf8"));
const ds = [];
const graded = [];   // {v, won} where won = the 1st inning actually went clean
for (const [, rows] of d.slates) for (const r of rows) {
  if (!Number.isFinite(r.p)) continue;
  ds.push(r.p * 100);
  if (r.actual === 0 || r.actual === 1) graded.push({ v: r.p * 100, won: r.actual === 1 });
}
ds.sort((a, b) => a - b);

const q = (frac) => ds[Math.min(ds.length - 1, Math.max(0, Math.round(frac * (ds.length - 1))))];
const pctBelow = (v) => {
  let lo = 0, hi = ds.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ds[m] < v) lo = m + 1; else hi = m; }
  return lo / ds.length;
};
const tierOf = (v, th) => v >= th.elite ? "ELITE" : v >= th.green ? "GREEN"
  : v >= th.yellow ? "YELLOW" : "RED";

console.log("OUR DS DISTRIBUTION  (pCal * 100, " + ds.length + " graded games)\n");
for (const f of [0, .05, .1, .25, .5, .75, .9, .95, 1]) {
  console.log("  p" + String(Math.round(f * 100)).padStart(3) + "   " + q(f).toFixed(1));
}

console.log("\nHIS OBSERVED DS BY HIS OWN BADGE\n");
for (const [t, v] of Object.entries(HIS)) {
  console.log("  " + t.padEnd(7) + "n=" + String(v.length).padStart(2) + "   " +
    (v.length ? v[0].toFixed(1) + " .. " + v[v.length - 1].toFixed(1) : "never published"));
}

console.log("\nWHAT OUR SHIPPED LADDER EMITS  (" +
  SHIPPED.elite + " / " + SHIPPED.green + " / " + SHIPPED.yellow + ")\n");
const share = {};
for (const v of ds) share[tierOf(v, SHIPPED)] = (share[tierOf(v, SHIPPED)] || 0) + 1;
for (const t of ["ELITE", "GREEN", "YELLOW", "RED"]) {
  const n = share[t] || 0;
  console.log("  " + t.padEnd(7) + String(n).padStart(5) + "   " +
    (100 * n / ds.length).toFixed(1) + "% of games");
}

/* His selectivity at the TOP of the ladder is already settled and is NOT what
 * this complaint is about. DS_TIER_DEFAULTS was set by quantile-matching his
 * 19.0% play rate — 2.59 of 13.6 games a day, taken from what his APP EMITS.
 *
 * Note the 13-legs-in-14-days figure in nrfi-ds-tier-brackets.js is a different
 * quantity: it counts what he POSTS in chat, which is a subset of what his app
 * emits (31% of the shortlist). Matching our GREEN floor to the posted rate
 * instead would move it from 58.5 to about 61 and cut our GREEN band by more
 * than half. The emitted rate is the right one — GREEN is a LEVEL bar, and the
 * posted set has his own extra selection on top of it. Both are printed below
 * so the two are never confused again. */
const EMIT_PER_DAY = 2.59, GAMES_PER_DAY = 13.6;   // basis for the shipped cuts
const LEGS = 13, DAYS = 14;                        // what he posts in chat
const playRate = EMIT_PER_DAY / GAMES_PER_DAY;
const postRate = LEGS / (DAYS * GAMES_PER_DAY);
const eliteShare = 8 / 13;

console.log("\nHIS SELECTIVITY\n");
console.log("  app emits           " + EMIT_PER_DAY + " of " + GAMES_PER_DAY +
  " games/day = " + (100 * playRate).toFixed(1) + "%   <- basis for the shipped GREEN cut");
console.log("  posts in chat       " + LEGS + " legs / " + DAYS + " days = " +
  (100 * postRate).toFixed(1) + "%   (a further selection ON TOP of the level bar)");
console.log("  of posted, ELITE    " + (100 * eliteShare).toFixed(0) + "%");
console.log("  YELLOW / RED split  UNOBSERVABLE — he has never published a RED");

console.log("\nQUANTILE-MATCHED CUTS ON OUR SCALE\n");
const matched = { green: q(1 - playRate), post: q(1 - postRate) };
console.log("  GREEN cut matching his EMIT rate   " + matched.green.toFixed(1) +
  "   vs shipped " + SHIPPED.green + "  -> agrees to " +
  Math.abs(matched.green - SHIPPED.green).toFixed(1) + " pt");
console.log("  (GREEN cut matching his POST rate  " + matched.post.toFixed(1) +
  "   — the wrong basis, shown only to keep the two apart)");
console.log("\n  The top of the ladder is already matched where evidence exists.");
console.log("  Nothing below GREEN has any observation of his to match to.");

/* The reported game. */
const SEA_HOU = 51.5, HIS_SEA_HOU = 59.1;
console.log("\nTHE REPORTED GAME — SEA @ HOU, 2026-08-16\n");
console.log("  his DS   " + HIS_SEA_HOU.toFixed(1) + "  YELLOW   (his lowest published YELLOW; " +
  "his play floor is 64.1, so he is NOT betting it)");
console.log("  our DS   " + SEA_HOU.toFixed(1) + "  " + tierOf(SEA_HOU, SHIPPED) +
  "      (our GREEN floor is " + SHIPPED.green + ", so we are NOT betting it either)");
console.log("  our DS sits at our p" + Math.round(100 * pctBelow(SEA_HOU)) +
  "; his sits below every play he has ever posted.");
console.log("\n  Both systems decline the game. Only the badge differs, and the badge");
console.log("  differs because of the one cut in each ladder that was never measured.");

console.log("\nWHAT WOULD IT TAKE TO PAINT THIS GAME YELLOW\n");
for (const cut of [54, 52, 51.5, 50, 48]) {
  const th = { ...SHIPPED, yellow: cut };
  let red = 0; for (const v of ds) if (tierOf(v, th) === "RED") red++;
  console.log("  yellow cut " + String(cut).padStart(4) + "  -> SEA@HOU " +
    tierOf(SEA_HOU, th).padEnd(6) + "   RED becomes " +
    (100 * red / ds.length).toFixed(1) + "% of all games");
}
console.log("\n  He shows a YELLOW at 59.1 while never showing a RED at all, so on his");
console.log("  board RED is rare. Ours is currently " +
  (100 * (share.RED || 0) / ds.length).toFixed(0) + "% of the slate, which is not a");
console.log("  badge so much as a second name for 'below average'. That is the real");
console.log("  defect this complaint found — not the verdict, which is a correct PASS.");

/* THE CHECK THAT CAN VETO THE CHANGE.
 *
 * The DS_TIER_DEFAULTS comment in app.jsx justifies the ladder by a monotone
 * hit rate — ELITE 69.0, GREEN 56.0, YELLOW 51.8, RED 45.3 against a 50.0 base.
 * Moving the yellow/red cut cannot be argued from selectivity alone, because
 * selectivity is exactly what it changes: a lower cut sweeps games into YELLOW,
 * and if those games win at YELLOW's current rate the badge still means what it
 * says, while if they win at the base rate the badge has been diluted into
 * noise. RED also has to stay BELOW the base rate to keep meaning "the model is
 * against this", so the moved cut has to survive from both sides.
 *
 * In-sample and therefore optimistic on the LEVELS. The ORDER is the claim. */
const bandHit = (th) => {
  const acc = {};
  for (const g of graded) {
    const t = tierOf(g.v, th);
    (acc[t] || (acc[t] = { n: 0, w: 0 })).n++;
    if (g.won) acc[t].w++;
  }
  return acc;
};
const baseRate = 100 * graded.filter((g) => g.won).length / graded.length;

console.log("\nHIT RATE BY BAND — the monotonicity the ladder is justified by");
console.log("(P(clean 1st) among graded games in each band; base rate " +
  baseRate.toFixed(1) + "% over " + graded.length + " games)\n");
for (const cut of [54, 52, 50, 48]) {
  const th = { ...SHIPPED, yellow: cut };
  const acc = bandHit(th);
  const line = ["ELITE", "GREEN", "YELLOW", "RED"].map((t) => {
    const a = acc[t] || { n: 0, w: 0 };
    return t.charAt(0) + " " + (a.n ? (100 * a.w / a.n).toFixed(1) : "--").padStart(4) +
      "%(" + String(a.n).padStart(4) + ")";
  }).join("  ");
  const rates = ["ELITE", "GREEN", "YELLOW", "RED"]
    .map((t) => (acc[t] && acc[t].n ? acc[t].w / acc[t].n : null)).filter((x) => x != null);
  const mono = rates.every((v, i) => i === 0 || v <= rates[i - 1]);
  const redRate = acc.RED && acc.RED.n ? 100 * acc.RED.w / acc.RED.n : NaN;
  console.log("  yellow " + String(cut).padStart(4) + "   " + line +
    "   " + (mono ? "monotone" : "ORDER BREAKS") +
    (redRate >= baseRate ? "  RED >= base — badge is a lie" : ""));
}
console.log("\n  A cut only ships if the row is monotone AND its RED stays under the");
console.log("  base rate. Both are structural claims about what the badge means;");
console.log("  the levels themselves are in-sample and are not the point.");
