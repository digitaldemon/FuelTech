/* What ARE his tier cutoffs? Bracketed from his own posted boards.
 *
 * The DS decode work (scripts/nrfi-ds-decode.js) tried to recover his FORMULA
 * from three screenshots and honestly failed — three games cannot pin a fusion
 * of eight window inputs. This script answers the much smaller, much more
 * answerable question sitting next to it: given a DS, which BADGE does he print?
 *
 * That one does not need the formula at all. He posts his board as plain text in
 * the JuiceReel main chat:
 *
 *     SD@CLE: DS 71.1 → ELITE
 *     STL@CHC: DS 67.7 → GREEN
 *     MIL@LAD: DS 64.7 → GREEN
 *
 * Every such line is a labelled (DS, tier) pair. A threshold rule is monotone by
 * construction, so the cut between two tiers must lie strictly above the highest
 * DS of the lower tier and at or below the lowest DS of the upper one. Collect
 * enough pairs and the interval closes on its own. No fitting, no free
 * parameters, nothing to overfit — this is interval arithmetic on observations.
 *
 * SOURCE AND ITS LIMITS. Harvested 2026-08-16 from the nrfikingky main channel,
 * scrolled up until the client rendered "No earlier messages" — so this is the
 * COMPLETE channel, 2026-08-03 to 2026-08-16, not a sample of it. The limit is
 * that he only posts boards he intends to PLAY: every pair below is GREEN or
 * better. That is why the yellow/red cut is unobserved and stays a placeholder,
 * and it is a censoring we cannot fix by scrolling more.
 *
 *   node scripts/nrfi-ds-tier-brackets.js
 */

/* Verbatim from chat. Game labels are kept only so a pair can be traced back and
 * re-checked; nothing here depends on them. Two games appear twice at different
 * scores (MIL@LAD 64.7 and 68.3, BOS@PIT 64.1 and 72.6) — different dates and
 * different starters, so they are independent observations, not a contradiction. */
const POSTED = [
  { g: "PHI@STL", ds: 69.1, tier: "ELITE" },
  { g: "MIL@SD", ds: 68.9, tier: "ELITE" },
  { g: "BOS@TOR", ds: 67.8, tier: "GREEN" },
  { g: "MIL@LAD", ds: 68.3, tier: "ELITE" },
  { g: "BOS@PIT", ds: 72.6, tier: "ELITE" },
  { g: "ARI@ATL", ds: 70.5, tier: "ELITE" },
  { g: "MIA@CIN", ds: 69.7, tier: "ELITE" },
  { g: "NYY@TOR", ds: 69.8, tier: "ELITE" },
  { g: "BAL@TB", ds: 66.4, tier: "GREEN" },
  { g: "BOS@PIT", ds: 64.1, tier: "GREEN" },
  { g: "SD@CLE", ds: 71.1, tier: "ELITE" },
  { g: "STL@CHC", ds: 67.7, tier: "GREEN" },
  { g: "MIL@LAD", ds: 64.7, tier: "GREEN" },
];

/* The two YELLOW cards come from screenshots of his app, not from chat text, and
 * they are read off an image rather than copied from a string. Kept separate for
 * that reason: if the green bracket ever looks wrong, this is the weaker input. */
const SCREENSHOT = [
  { g: "card A", ds: 60.0, tier: "YELLOW" },
  { g: "card C", ds: 59.1, tier: "YELLOW" },
  /* MIA@ATL, 7:15 PM Truist, ranked #2, N -102 / Y -125 / BE 50.5%. This one is
   * worth more than the other two put together: at 62.8 it is the highest YELLOW
   * ever seen and it cuts the green bracket from 4.1 points wide to 1.3. It also
   * retires 62 as a candidate for his green cut — 62 would paint this card GREEN
   * and he prints YELLOW. Note the edge is +12.3 over break-even and still not
   * green, which is the badge-is-level-not-edge finding at its most extreme. */
  { g: "MIA@ATL", ds: 62.8, tier: "YELLOW" },
];

/* His own site, nrfi-edge.replit.app/free, read 2026-08-16. This is the first
 * observation that did not come through chat, and it is the only one whose
 * provenance is his product rather than his posting habit.
 *
 * It re-observes MIL@LAD at DS 64.7 GREEN — already in POSTED above, and NOT
 * added twice — but it independently confirms the pair from a second surface,
 * and it confirms card B of nrfi-ds-decode.js down to the cell: Henderson 91%
 * SZN / 100% L30 on 5GS / 11 starts, Skubal 67% / 83% on 6GS / 18 starts. Those
 * were read off a screenshot; these were read out of his own DOM. They agree.
 *
 * THE STRUCTURAL FINDING, which is worth more than the confirmation.
 *
 * The page is headed "THE #3-RANKED PLAY OFF TODAY'S BOARD · MEMBERS GET ALL
 * THREE". So the app emits exactly THREE ranked picks per day — his "I have a
 * number system that ranks it and spits out top 3" is a literal description of
 * the product, not a figure of speech.
 *
 * That resolves the "absolute bar + variable count" question the SELECTION note
 * below raises, and it resolves it differently than assumed. The COUNT IS FIXED
 * AT THREE. What varies is how many of the three he actually bets — 13 legs over
 * 14 days against 3 published per day is well under half of them, and "Tough
 * board today. Only playing MIL@LAD" is him taking one of three, not his app
 * emitting one. So the ranker and the bar are separate stages:
 *
 *   rank the slate -> take the top 3 -> bet the ones that clear the bar
 *
 * Our ladder collapses those two into one verdict per game, which is why it can
 * never say "today, fewer". The fix is not a threshold change, it is the missing
 * stage: rank first, truncate to a fixed shortlist, then apply the level bar to
 * the shortlist. A game that would be a BET on a thin slate should not be one
 * when three better games are on the board, and right now nothing in the desk
 * expresses that.
 *
 * The free card also shows FEWER windows than his in-app card: SZN and L30 with
 * the start count, plus total starts. The four-window view (SZN/L50/L30/L10) in
 * nrfi-ds-decode.js is the members' card. Nothing here says which set the DS is
 * computed from, and this page is not evidence that it uses only two. */
const FREE_PAGE = {
  date: "2026-08-16", game: "MIL@LAD", ds: 64.7, tier: "GREEN", rank: 3,
  nrfiPrice: -147, picksPerDay: 3,
  away: { name: "Logan Henderson", szn: 91, l30: 100, l30gs: 5, starts: 11 },
  home: { name: "Tarik Skubal", szn: 67, l30: 83, l30gs: 6, starts: 18 },
};

// Ordered best to worst. The whole method is that this order is the truth.
const ORDER = ["ELITE", "GREEN", "YELLOW", "RED"];

const all = [...POSTED, ...SCREENSHOT];
const band = (t) => {
  const v = all.filter((x) => x.tier === t).map((x) => x.ds).sort((a, b) => a - b);
  return v.length ? { n: v.length, min: v[0], max: v[v.length - 1], v } : null;
};

console.log("OBSERVED DS BY TIER (his own labels)\n");
for (const t of ORDER) {
  const b = band(t);
  console.log("  " + t.padEnd(7) + (b
    ? "n=" + String(b.n).padStart(2) + "   " + b.v.map((x) => x.toFixed(1)).join(" ")
    : "n= 0   never published — nothing to bracket with"));
}

/* CONSISTENCY FIRST. If any single DS carries two different labels, or a lower DS
 * outranks a higher one, then the badge is NOT a pure threshold on DS and every
 * bracket below is meaningless. Check before deriving, not after. */
let bad = 0;
for (const a of all) for (const b of all) {
  if (a.ds > b.ds && ORDER.indexOf(a.tier) > ORDER.indexOf(b.tier)) {
    console.log("  !! " + a.g + " " + a.ds + " " + a.tier + " outranked by " +
      b.g + " " + b.ds + " " + b.tier);
    bad++;
  }
}
console.log("\n  monotone check: " + (bad === 0
  ? "PASS — no higher DS ever carries a worse badge across " + all.length + " observations"
  : bad + " violations; the badge is not a pure DS threshold and the brackets below are void"));

console.log("\nDERIVED CUTOFFS\n");
console.log("  cut            interval        width   admissible    confidence");
for (let i = 0; i < ORDER.length - 1; i++) {
  const hi = band(ORDER[i]), lo = band(ORDER[i + 1]);
  if (!hi || !lo) {
    console.log("  " + (ORDER[i] + "/" + ORDER[i + 1]).padEnd(13) +
      " unbracketed — " + (hi ? ORDER[i + 1] : ORDER[i]) + " never observed");
    continue;
  }
  const w = hi.min - lo.max;
  /* EVERY integer in the interval is equally consistent with the data — the
   * observations pick the interval, they do not pick a point inside it. So print
   * the admissible set rather than a single number, and show which one we ship.
   * Printing one "derived" value here would invent a precision nothing supports:
   * for the green cut, 63 and 64 are indistinguishable on this evidence. */
  const ok = [];
  for (let c = Math.floor(lo.max) + 1; c <= hi.min; c++) if (c > lo.max) ok.push(c);
  console.log("  " + (ORDER[i] + "/" + ORDER[i + 1]).padEnd(13) +
    ("(" + lo.max.toFixed(1) + ", " + hi.min.toFixed(1) + "]").padEnd(16) +
    w.toFixed(1).padStart(5) + "   " + (ok.length ? ok.join(" ") : "none").padEnd(14) +
    (w <= 1 ? "tight — treat as known"
      : w <= 5 ? "loose — any of these fits; the shipped one is a pick, not a result"
      : "very loose — barely constrains anything"));
}

/* THESE CUTOFFS DESCRIBE HIS SCALE AND MUST NOT BE SHIPPED AS OURS.
 *
 * The obvious next move is to drop 68/63 into DS_TIER_DEFAULTS. It was tried and
 * it is wrong, because the board's DS is our calibrated probability (pCal * 100),
 * not his rating. Over the 1283 games in nrfi-tout-vs-model.json our p runs
 * 37.9 .. 67.2 with a median of 54.2, while his plays FLOOR at 64.1. Applying his
 * numbers to ours gives GREEN on 4.5% of the slate against his real 19% play
 * rate, and ELITE on ZERO games in 95 days — a badge that can never appear.
 *
 * That is not conservatism, it is a dead control, and it reads to the user as
 * "no elite games today" rather than "this threshold cannot be met".
 *
 * The cause is not a defect in either model: a calibrated probability is pulled
 * toward the base rate and cannot reach 68 on a near-coin-flip market. His DS is
 * a 0-100 rating and he says so ("it's dual score out of 100 for both arms").
 * Comparing them by value is a category error. What transfers is SELECTIVITY,
 * and app.jsx sets its cuts where OUR distribution is as selective as he is. */
const SHIPPED_HIS_SCALE = { elite: 68, green: 63, yellow: 55 };
console.log("\nSELF-CONSISTENCY OF THE DERIVED CUTOFFS (on HIS scale)\n");
const tierOf = (ds) => ds >= SHIPPED_HIS_SCALE.elite ? "ELITE"
  : ds >= SHIPPED_HIS_SCALE.green ? "GREEN"
  : ds >= SHIPPED_HIS_SCALE.yellow ? "YELLOW" : "RED";
let miss = 0;
for (const o of all) {
  const got = tierOf(o.ds);
  if (got !== o.tier) { console.log("  MISMATCH " + o.g + " DS " + o.ds + ": he says " + o.tier + ", these cuts say " + got); miss++; }
}
console.log("  " + (all.length - miss) + "/" + all.length + " of his published badges reproduced" +
  (miss === 0 ? " by 68 / 63 / 55 — internally consistent" : ""));
console.log("\n  app.jsx does NOT ship these. It ships 62 / 58.5 / 54, set on our own");
console.log("  calibrated-p scale to match his 19% play rate. See DS_TIER_DEFAULTS.");

/* THE SELECTION RULE, which is the part worth more than the cutoffs themselves.
 *
 * "Tough board today. Only playing MIL@LAD: DS 68.3 → ELITE" — on a thin slate he
 * drops to ELITE-only rather than filling out a card. Combined with "Not that
 * meets my nrfi pitching thresholds. I care less about the odds more about
 * chances of successful bet", his filter is an absolute bar on DS, not a hunt for
 * price. He passes on positive-edge games (DS 60.0 at +8.5 over break-even is
 * YELLOW and unplayed) and he passes on cheap ones ("Nyy is elite but price is
 * baddddd" — elite DS, still no play).
 *
 * That matters because scripts/nrfi-tout-bottom-half.js found his edge lives
 * ENTIRELY in games we already rank highly: a FILTER problem, not a DIRECTION
 * problem. An absolute level bar plus a variable count is exactly the shape of
 * filter we do not currently implement — our ladder emits a verdict per game and
 * never says "today, fewer". */
const posted = POSTED.length, elite = POSTED.filter((p) => p.tier === "ELITE").length;
console.log("\nSELECTION\n");
console.log("  boards posted as text        " + posted + " legs over 14 days (2026-08-03 .. 2026-08-16)");
console.log("  of them ELITE                " + elite + " (" + (100 * elite / posted).toFixed(0) + "%)");
console.log("  lowest DS he ever posted     " + Math.min(...POSTED.map((p) => p.ds)).toFixed(1) +
  "  -> nothing below the GREEN cut is ever played, so the yellow/red");
console.log("                                  cut is CENSORED by his posting habit, not merely unmeasured");

/* The denominator the play rate should be read against, now that the free page
 * has supplied it. Without picksPerDay the 13 legs looked like the whole output;
 * they are not, they are the part of a fixed shortlist that cleared the bar. */
const days = 14, shortlist = FREE_PAGE.picksPerDay * days;
console.log("\nSHORTLIST vs PLAYS  (from " + FREE_PAGE.date + " " + "nrfi-edge.replit.app/free" + ")\n");
console.log("  picks his app emits per day  " + FREE_PAGE.picksPerDay + "  (\"members get all three\") -> " +
  shortlist + " over " + days + " days");
console.log("  legs he actually posted      " + posted + "  (" + (100 * posted / shortlist).toFixed(0) +
  "% of the shortlist)");
console.log("  -> the COUNT is fixed and the BAR is what varies. Two stages, and the desk has only one:");
console.log("     rank the slate -> truncate to a fixed shortlist -> bet what clears the level bar.");
console.log("     Our ladder emits a verdict per game, so it cannot express \"good, but third best today\".");
// Cross-check the free card against the screenshot decode, so a future edit to
// either source has to keep them consistent rather than quietly diverging.
console.log("\n  free-card cells vs the card-B screenshot in nrfi-ds-decode.js:");
console.log("    " + FREE_PAGE.away.name.padEnd(16) + "SZN " + FREE_PAGE.away.szn + "%  L30 " +
  FREE_PAGE.away.l30 + "% (" + FREE_PAGE.away.l30gs + "GS)  " + FREE_PAGE.away.starts + " starts");
console.log("    " + FREE_PAGE.home.name.padEnd(16) + "SZN " + FREE_PAGE.home.szn + "%  L30 " +
  FREE_PAGE.home.l30 + "% (" + FREE_PAGE.home.l30gs + "GS)  " + FREE_PAGE.home.starts + " starts");
console.log("    decode card B has 91/100 on 11/5 and 67/83 on 18/6 — agrees on every cell.");
