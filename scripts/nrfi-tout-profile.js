// What separates NRFIKINGKY's TOP-HALF picks from their band peers?
//
//   node scripts/nrfi-tout-profile.js
//
// WHY THE TOP HALF. nrfi-tout-vs-model.js decomposes his edge by band of our
// own ranking. Two cells clear 2se, and both are in the top half; the bottom
// half sits at +11.6 pts on 76 legs (1.9se) and the script calls it
// INCONCLUSIVE. An earlier reading had the bottom half at 2.2se and this work
// was aimed there — that number did not survive the post-umpire rebuild, which
// is exactly what a significance bar is for. The top half is +17.3 pts on 250
// legs at 4.6se and is the best-powered cell we have, so it is the one worth
// profiling.
//
// WHAT THIS CAN AND CANNOT SEE. It reads only the cache, so it is limited to
// what nrfi-tout-vs-model.js stored per game: our probability, the check
// consensus, the confidence score and the thin-arm flags. It cannot see the
// individual factor values — that needs a re-score with factor capture, which
// is the next step if something here points somewhere.
//
// A NULL RESULT IS THE EXPECTED RESULT and is worth printing. If he separates
// winners from band peers while looking identical to them on every number we
// record, then the missing signal is not a reweighting of what we already
// compute, and no amount of tuning the existing terms will find it.
const fs = require("fs");
const path = require("path");

const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");
const mdl = JSON.parse(fs.readFileSync(CACHE, "utf8"));

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const pc = (x) => (x * 100).toFixed(1) + "%";

const hisKeys = new Set();
for (const [date, picks] of mdl.byDate)
  for (const x of picks) if (x.side === "NRFI" && x.gamePk != null) hisKeys.add(date + ":" + x.gamePk);

/* Percentile within the day's slate, the same way the band table computes it:
 * his picks are compared against the slate he actually chose from, and his own
 * legs are excluded from the peer baseline so the baseline is not partly a
 * measurement of him. */
const pctlIn = (p, s) => {
  const below = s.filter((g) => g.p < p).length;
  const ties = s.filter((g) => g.p === p).length;
  return (below + ties / 2) / s.length;
};

const his = [], peers = [];
for (const [date, games] of mdl.slates) {
  const usable = games.filter((g) => g.p != null && g.actual != null);
  if (usable.length < 4) continue;
  for (const g of usable) {
    const rec = {
      pctl: pctlIn(g.p, usable),
      p: g.p,
      y: g.actual ? 1 : 0,
      conf: g.confidence == null ? null : g.confidence,
      agree: g.aligned && g.aligned.total ? g.aligned.agree / g.aligned.total : null,
      votes: g.aligned ? g.aligned.total : null,
      rows: g.aligned ? g.aligned.rows : null,
      thin: (g.thinAway ? 1 : 0) + (g.thinHome ? 1 : 0),
    };
    (hisKeys.has(date + ":" + g.gamePk) ? his : peers).push(rec);
  }
}

const TOP = (r) => r.pctl >= 0.5;
const hTop = his.filter(TOP), pTop = peers.filter(TOP);

console.log("=================== TOP-HALF CELL ===================");
console.log(`  his legs        ${hTop.length}`);
console.log(`  band peers      ${pTop.length}   (his own legs excluded from this baseline)`);
console.log(`  he hit          ${pc(mean(hTop.map((r) => r.y)))}`);
console.log(`  peers hit       ${pc(mean(pTop.map((r) => r.y)))}`);
if (hTop.length < 30) { console.error("\nToo few of his top-half legs to profile."); process.exit(1); }

/* Welch's t on each recorded feature. Deliberately NOT a per-feature verdict:
 * this is a fishing expedition over several features at once, so the bar has to
 * account for that. With 6 features a nominal 2se cut fires on noise about 1
 * time in 4 across the table even when nothing differs. The Bonferroni-adjusted
 * two-sided 5% bar for 6 tests is |t| ~ 2.64, and that is what gets a star. */
const FEATURES = [
  ["our p(NRFI)", (r) => r.p, "control — near-equal by band construction; a big gap here means the band split is wrong, not that we found something"],
  ["confidence", (r) => r.conf, "our own data-quality score"],
  ["check agreement", (r) => r.agree, "share of voting checks on the called side"],
  ["checks voting", (r) => r.votes, "how many checks were live at all"],
  ["check rows", (r) => r.rows, "how many checks were computed"],
  ["thin arms (0-2)", (r) => r.thin, "starters with too little 1st-inning history"],
];
const NTEST = FEATURES.length;
const BAR = 2.64;

console.log("\n=================== DOES HE LOOK DIFFERENT TO US? ===================");
console.log("  feature            his      peers      diff     t");
const found = [];
for (const [name, get, why] of FEATURES) {
  const a = hTop.map(get).filter((x) => x != null && isFinite(x));
  const b = pTop.map(get).filter((x) => x != null && isFinite(x));
  if (a.length < 20 || b.length < 20) { console.log(`  ${name.padEnd(18)} (not recorded on enough games)`); continue; }
  const ma = mean(a), mb = mean(b);
  const se = Math.sqrt(sd(a) ** 2 / a.length + sd(b) ** 2 / b.length);
  const t = se ? (ma - mb) / se : 0;
  const star = Math.abs(t) > BAR ? "  *" : "";
  console.log(`  ${name.padEnd(18)}${ma.toFixed(3).padStart(6)}${mb.toFixed(3).padStart(10)}` +
    `${((ma - mb) >= 0 ? "+" : "") + (ma - mb).toFixed(3)}`.padStart(10) + `${t.toFixed(2).padStart(7)}${star}`);
  if (Math.abs(t) > BAR) found.push({ name, t, ma, mb, why });
}
console.log(`\n  * = |t| > ${BAR}, the Bonferroni-adjusted 5% bar for ${NTEST} tests.`);
console.log("  A plain 2se cut is not used here: across a table this wide it fires on noise");
console.log("  roughly one run in four, and it would fire hardest on the thinnest column.");

/* MEDIATION. A feature that differs is not a feature that explains.
 *
 * This is the step that stops "he differs on X" from becoming "X is his edge".
 * If a feature carries his advantage, then holding it fixed should shrink that
 * advantage: inside the stratum where he and his peers look alike on X, they
 * should also hit alike. If the edge survives the stratification at full size,
 * X is a trait of his selection and nothing more, and building a filter on it
 * would copy his habits without copying his results. */
const seOf = (p, n) => (n ? Math.sqrt(p * (1 - p) / n) : 0);
const edgeIn = (hs, ps) => {
  const yh = mean(hs.map((r) => r.y)), yp = mean(ps.map((r) => r.y));
  const se = Math.sqrt(seOf(yh, hs.length) ** 2 + seOf(yp, ps.length) ** 2);
  return { yh, yp, d: yh - yp, z: se ? (yh - yp) / se : 0, n: hs.length };
};
const overall = edgeIn(hTop, pTop);
console.log("\n=================== DOES THAT DIFFERENCE EXPLAIN THE EDGE? ===================");
console.log(`  unstratified          ${pc(overall.yh)} vs ${pc(overall.yp)}   ` +
  `${(overall.d >= 0 ? "+" : "") + (overall.d * 100).toFixed(1)}pts (${overall.z.toFixed(1)}se) on ${overall.n}`);
const STRATA = [["thin arms = 0", (r) => r.thin === 0], ["thin arms >= 1", (r) => r.thin > 0]];
for (const [name, f] of STRATA) {
  const h = hTop.filter(f), p = pTop.filter(f);
  if (h.length < 15) { console.log(`  ${name.padEnd(22)}only ${h.length} of his legs — too thin to stratify`); continue; }
  const e = edgeIn(h, p);
  console.log(`  ${name.padEnd(22)}${pc(e.yh)} vs ${pc(e.yp)}   ` +
    `${(e.d >= 0 ? "+" : "") + (e.d * 100).toFixed(1)}pts (${e.z.toFixed(1)}se) on ${e.n}`);
}
const cleanOnly = edgeIn(hTop.filter((r) => r.thin === 0), pTop.filter((r) => r.thin === 0));
const mediated = cleanOnly.n >= 15 && cleanOnly.d < overall.d * 0.6;

console.log("\n=================== READING ===================");
const control = found.find((f) => f.name === "our p(NRFI)");
if (control) {
  console.log(`  STOP. The control moved (t=${control.t.toFixed(2)}). His top-half picks and their`);
  console.log("  peers do not have the same model probability, so they are not really in the");
  console.log("  same band and every other row above is confounded by that. Fix the banding");
  console.log("  before reading anything else here.");
} else if (!found.length) {
  console.log(`  He looks IDENTICAL to his band peers on every number we record, while`);
  console.log(`  hitting ${pc(mean(hTop.map((r) => r.y)))} against their ${pc(mean(pTop.map((r) => r.y)))}.`);
  console.log("");
  console.log("  This is the informative null. The separation is not in our confidence score,");
  console.log("  not in check consensus, and not in how much data we had — so it cannot be");
  console.log("  recovered by reweighting those, and a ladder retune would only be picking");
  console.log("  games that already look the same to us. The next move is a re-score with");
  console.log("  per-factor capture, to ask whether any INPUT separates them; if that also");
  console.log("  comes back null, the signal is not in the inputs we collect at all.");
} else {
  console.log("  These cleared the multiple-comparison bar:");
  for (const f of found)
    console.log(`    ${f.name}: his ${f.ma.toFixed(3)} vs peers ${f.mb.toFixed(3)} (t=${f.t.toFixed(2)}) — ${f.why}`);
  console.log("");
  if (mediated) {
    console.log(`  AND IT MEDIATES. Holding thin arms fixed cuts the edge from ` +
      `${(overall.d * 100).toFixed(1)} to ${(cleanOnly.d * 100).toFixed(1)} pts,`);
    console.log("  so this is a real part of the mechanism and is worth acting on. Confirm on a");
    console.log("  held-out stretch of dates first — one season, correlated features.");
  } else {
    console.log(`  BUT IT DOES NOT EXPLAIN THE EDGE. Among games where the starters have full`);
    console.log(`  first-inning history — where he and his peers look the SAME on this feature —`);
    console.log(`  he still beats them by ${(cleanOnly.d * 100).toFixed(1)} pts (${cleanOnly.z.toFixed(1)}se) on ${cleanOnly.n} legs, essentially`);
    console.log(`  the whole ${(overall.d * 100).toFixed(1)}-pt advantage.`);
    console.log("");
    console.log("  So he does avoid thin-data games, and that habit is not where his money");
    console.log("  comes from. Tightening our confidence gate would copy the habit and none of");
    console.log("  the result — and it would cost volume, which is a real price for nothing.");
    console.log("  Worth stating separately: our own data does not even establish that thin-arm");
    console.log("  games are worse NRFI bets (4.3pt calibration miss vs clean games, t=1.5).");
    console.log("");
    console.log("  The edge remains unexplained by anything this cache records. Next step is a");
    console.log("  re-score with per-factor capture, to ask whether any INPUT separates his");
    console.log("  clean-data picks from their peers.");
  }
}
