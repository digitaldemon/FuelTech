/* What fusion rule could produce NRFIKINGKY's Dual Score?
 *
 * Three of his cards have now been read at full resolution off screenshots he
 * posted in the JuiceReel chat on 2026-08-16. Each card shows, per starter,
 * first-inning clean% over four windows with the start count under each cell,
 * and one fused "Dual Score" for the game. That is enough to RULE FORMULAS OUT,
 * which is the only thing three points can honestly do.
 *
 * The decisive test is ORDERING, not fit. With three games there are six
 * possible orderings and a two-parameter map can hit any two points exactly, so
 * "it fits" means nothing. But no monotone rescaling can reorder games, so a
 * fusion that ranks his own published cards wrongly is dead on the spot — and
 * ranking is precisely what his DS is for ("a number system that ranks it and
 * spits out top 3", his words in chat at 11:02 AM).
 *
 * His actual order is  B (64.7) > A (60.0) > C (59.1).
 *
 * Run: node scripts/nrfi-ds-decode.js
 */

// pct over [SZN, L50, L30, L10] and the start count under each cell.
// Windows are in DAYS on his card, so n falls as the window shortens.
const CARDS = [
  {
    id: "A", ds: 60.0, tier: "YELLOW", be: 51.5, // N -106 / Y -120
    game: "(card above MIL@LAD, teams cropped by the status bar)",
    away: { p: [82, 78, 100, 100], n: [22, 9, 5, 2] },
    home: { p: [64, 70, 67, 50], n: [11, 10, 6, 2] },
  },
  {
    id: "B", ds: 64.7, tier: "GREEN", be: 59.5, // N -147 / Y +119
    game: "MIL @ LAD, Logan Henderson vs Tarik Skubal",
    away: { p: [91, 100, 100, 100], n: [11, 4, 5, 1] },
    home: { p: [67, 60, 83, 0], n: [18, 10, 6, 1] },
  },
  {
    id: "C", ds: 59.1, tier: "YELLOW", be: 57.6, // N -136 / Y +106
    game: "SEA @ HOU, Bryan Woo vs Hunter Brown",
    away: { p: [83, 78, 60, 100], n: [23, 9, 5, 2] },
    home: { p: [83, 80, 83, 100], n: [12, 10, 6, 2] },
  },
];

const LG = 0.705;   // league mean clean first inning
const W = ["SZN", "L50", "L30", "L10"];

// Candidate per-arm fusions. Each returns a probability for that arm's half.
const ARM_RULES = {
  "equal mean of 4": (a) => mean(a.p) / 100,
  "n-weighted mean": (a) => wmean(a.p, a.n) / 100,
  "SZN only": (a) => a.p[0] / 100,
  "L30 only": (a) => a.p[2] / 100,
  "L10 only": (a) => a.p[3] / 100,
  "SZN+L30 half each": (a) => (a.p[0] + a.p[2]) / 200,
  "recency 1/2/3/4": (a) => wmean(a.p, [1, 2, 3, 4]) / 100,
  "recency 4/3/2/1": (a) => wmean(a.p, [4, 3, 2, 1]) / 100,
  // Each cell shrunk to the league mean by its own n, then averaged. Nested
  // windows make this double-count starts; included because it is what a naive
  // "just regress the card" implementation does.
  "shrunk k=10, mean": (a) => mean(a.p.map((p, i) => shrink(p / 100, a.n[i], 10))),
  "shrunk k=30, mean": (a) => mean(a.p.map((p, i) => shrink(p / 100, a.n[i], 30))),
  "shrunk k=87.6, mean": (a) => mean(a.p.map((p, i) => shrink(p / 100, a.n[i], 87.6))),
  "SZN shrunk k=87.6": (a) => shrink(a.p[0] / 100, a.n[0], 87.6),
  "L30 shrunk k=10": (a) => shrink(a.p[2] / 100, a.n[2], 10),
};

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const wmean = (v, w) => v.reduce((s, x, i) => s + x * w[i], 0) / w.reduce((s, x) => s + x, 0);
const shrink = (p, n, k) => (n / (n + k)) * p + (k / (n + k)) * LG;
const logit = (p) => Math.log(p / (1 - p));

// Rank a list of numbers, 1 = largest. Returns "B>A>C" style.
function order(vals) {
  return CARDS.map((c, i) => ({ id: c.id, v: vals[i] }))
    .sort((x, y) => y.v - x.v).map((x) => x.id).join(">");
}

const TRUTH = order(CARDS.map((c) => c.ds));

console.log("his published order: " + TRUTH + "   (DS " +
  CARDS.map((c) => c.id + " " + c.ds.toFixed(1)).join(", ") + ")\n");
console.log("fusion rule              raw product per game        order      verdict");
console.log("-".repeat(78));

const survivors = [];
for (const [name, f] of Object.entries(ARM_RULES)) {
  const prod = CARDS.map((c) => f(c.away) * f(c.home));
  const ord = order(prod);
  const ok = ord === TRUTH;
  if (ok) survivors.push([name, prod]);
  console.log(
    name.padEnd(24) +
    prod.map((p, i) => CARDS[i].id + " " + (p * 100).toFixed(1)).join("  ").padEnd(26) +
    "  " + ord.padEnd(9) + "  " + (ok ? "SURVIVES" : "ruled out")
  );
}

if (!survivors.length) {
  console.log("\nNo displayed-window fusion reproduces his ranking. His DS uses inputs");
  console.log("the card does not show, and cannot be recovered from these three games.");
  process.exit(0);
}

/* A surviving rule still has to be checked for CONSISTENCY, because DS is not
 * the raw product — his numbers sit in a 59-65 band while raw products range
 * far wider, so a calibration sits in between. Fit that map (logit-linear, two
 * parameters) on two cards and PREDICT the third. Three points, two parameters,
 * one degree of freedom: the held-out error is the whole test. */
console.log("\nsurviving rules, leave-one-out through a logit-linear calibration:");
for (const [name, prod] of survivors) {
  const errs = [];
  for (let held = 0; held < 3; held++) {
    const fit = [0, 1, 2].filter((i) => i !== held);
    const [i, j] = fit;
    const dx = logit(prod[j]) - logit(prod[i]);
    if (Math.abs(dx) < 1e-9) continue;
    const b = (logit(CARDS[j].ds / 100) - logit(CARDS[i].ds / 100)) / dx;
    const a = logit(CARDS[i].ds / 100) - b * logit(prod[i]);
    const pred = 100 / (1 + Math.exp(-(a + b * logit(prod[held]))));
    errs.push({ id: CARDS[held].id, pred, act: CARDS[held].ds, b });
  }
  console.log("\n  " + name);
  for (const e of errs) {
    console.log("    hold out " + e.id + ": predicted " + e.pred.toFixed(1) +
      "  actual " + e.act.toFixed(1) + "   miss " + (e.pred - e.act >= 0 ? "+" : "") +
      (e.pred - e.act).toFixed(1) + "pts   (slope " + e.b.toFixed(3) + ")");
  }
  const worst = Math.max(...errs.map((e) => Math.abs(e.pred - e.act)));
  console.log("    worst held-out miss " + worst.toFixed(1) + "pts -> " +
    (worst < 1.5 ? "consistent with this rule" : "NOT a plain rescaling of this rule"));
}

/* Whatever survives, the tier badge is a threshold on the DS LEVEL, not on the
 * edge over the price. That was established by card A: DS 60.0 against BE 51.5%
 * is an +8.5pt edge and it is still YELLOW, while card B at +5.2 is GREEN. */
console.log("\ntier bracket from these three cards:");
const greens = CARDS.filter((c) => c.tier === "GREEN").map((c) => c.ds);
const yellows = CARDS.filter((c) => c.tier === "YELLOW").map((c) => c.ds);
console.log("  GREEN observed at  " + greens.join(", "));
console.log("  YELLOW observed at " + yellows.join(", "));
console.log("  -> green cutoff is in (" + Math.max(...yellows).toFixed(1) + ", " +
  Math.min(...greens).toFixed(1) + "] ON THESE THREE CARDS ONLY");
console.log("  -> RED is unobserved. The 55 in DS_TIER_DEFAULTS is a guess, not a reading.");
/* SUPERSEDED — do not quote the interval above as the current bracket.
 *
 * These three screenshots were the whole evidence base when this script was
 * written. They are not any more: he posts his board as plain text in chat, and
 * the full channel yields 13 more labelled pairs. That data tightens green to
 * (60.0, 64.1] and reveals a fourth tier, ELITE, above GREEN — which no card
 * here shows, so the "GREEN is the top band" reading implicit above is wrong.
 *
 * The three cards remain the only source for YELLOW and are still load-bearing
 * for the badge-is-level-not-edge finding, which is why this script stays. */
console.log("  -> SUPERSEDED by scripts/nrfi-ds-tier-brackets.js: 15 observations,");
console.log("     green tightens to (60.0, 64.1], and a fourth tier ELITE exists above GREEN.");

console.log("\nedge (DS - BE) per card, for the record:");
for (const c of CARDS) {
  console.log("  " + c.id + "  DS " + c.ds.toFixed(1) + "  BE " + c.be.toFixed(1) +
    "%  edge " + (c.ds - c.be >= 0 ? "+" : "") + (c.ds - c.be).toFixed(1) +
    "pt  " + c.tier);
}
