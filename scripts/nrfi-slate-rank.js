/* Does SLATE RANK carry information that the probability does not?
 *
 * The tout emits a fixed top 3 every day. Our ladder emits a verdict per game
 * and can never say "good, but third best today" — it applies an absolute bar
 * (NRFI_BET_MIN and friends) to each game in isolation. The standing read of
 * his edge is that it is a FILTER problem rather than a DIRECTION problem: his
 * picks live in games we already rank high, so what he is doing better is
 * choosing WHICH of the high ones to fire on.
 *
 * If that read is right, then "is this game in today's top N" should predict
 * winning AFTER the probability is already accounted for. If it is wrong, rank
 * is just a noisy restatement of p and its coefficient will sit on zero.
 *
 * That is the whole test, and it is a test the hypothesis can lose. Ranking is
 * a deterministic function of p within a slate, so rank can only add something
 * through the SLATE: how good today's board is compared to other days. A bar of
 * 57% means something different on a day when nine games clear it than on a day
 * when none do.
 *
 * Data: scripts/nrfi-tout-vs-model.json, 95 slates of 2026 with model p and the
 * graded first-inning outcome per game. No prices, so this measures ACCURACY,
 * not ROI. A rank effect on accuracy is necessary but not sufficient for a rank
 * effect on money; the market may already price it.
 *
 * Run: node scripts/nrfi-slate-rank.js
 *
 * VERDICT, 2026-08-16, 1282 games over 95 slates: NULL. Rank adds nothing once
 * conviction is controlled. Every coefficient on "in today's top N" sits inside
 * one standard error of zero and the sign FLIPS between N=1,2,3,4,5 — which is
 * the signature of noise, not of an effect too small to see. In money it is the
 * same story on 726 priced games: the top-1 gap looks like +12.95% ROI and
 * carries +/-12.08, and top-3 is NEGATIVE.
 *
 * The raw hit-rate gap that motivated all this (top 3 at 56.4% against 53.5%)
 * survives control for exactly as long as you do not control for anything: the
 * top 3 have higher p BY CONSTRUCTION, and p is doing all the work.
 *
 * So the planned shortlist stage — rank the slate, truncate to a fixed N, then
 * apply the level bar — DOES NOT GET BUILT. It would suppress bets our own
 * record says are as good as the ones it keeps. The FILTER-not-DIRECTION read
 * of his edge may still be right, but "fixed top N" is not the filter, and this
 * data cannot find one. Whatever he has is still unexplained by anything we
 * record, which is where nrfi-market-bias left it.
 */
const data = require("./nrfi-tout-vs-model.json");

const logit = (p) => Math.log(p / (1 - p));

/* Logistic regression by Newton-Raphson, with standard errors off the inverse
 * of the observed information. The SE is the entire point of running this — a
 * coefficient without one cannot distinguish "no effect" from "not enough
 * games", and at n~1400 those look identical on a point estimate. */
function logistic(X, y) {
  const n = X.length, k = X[0].length;
  let b = new Array(k).fill(0);
  for (let iter = 0; iter < 60; iter++) {
    const g = new Array(k).fill(0);
    const H = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let i = 0; i < n; i++) {
      let z = 0;
      for (let j = 0; j < k; j++) z += b[j] * X[i][j];
      const p = 1 / (1 + Math.exp(-z)), w = p * (1 - p);
      for (let j = 0; j < k; j++) {
        g[j] += (y[i] - p) * X[i][j];
        for (let l = 0; l < k; l++) H[j][l] += w * X[i][j] * X[i][l];
      }
    }
    const inv = invert(H);
    if (!inv) return null;
    let maxStep = 0;
    for (let j = 0; j < k; j++) {
      let d = 0;
      for (let l = 0; l < k; l++) d += inv[j][l] * g[l];
      b[j] += d;
      maxStep = Math.max(maxStep, Math.abs(d));
    }
    if (maxStep < 1e-9) break;
  }
  // Recompute the information at the solution for the SEs.
  const H = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++) {
    let z = 0;
    for (let j = 0; j < k; j++) z += b[j] * X[i][j];
    const p = 1 / (1 + Math.exp(-z)), w = p * (1 - p);
    for (let j = 0; j < k; j++) for (let l = 0; l < k; l++) H[j][l] += w * X[i][j] * X[i][l];
  }
  const cov = invert(H);
  return { b, se: b.map((_, j) => Math.sqrt(cov[j][j])) };
}

function invert(M) {
  const k = M.length;
  const A = M.map((r, i) => r.concat(Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))));
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c];
    for (let j = 0; j < 2 * k; j++) A[c][j] /= d;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c];
      for (let j = 0; j < 2 * k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((r) => r.slice(k));
}

// ---- build the game table, ranked within each slate --------------------------
const games = [];
for (const [date, rows] of data.slates) {
  const usable = rows.filter((r) => r && r.p != null && (r.actual === 0 || r.actual === 1));
  if (usable.length < 4) continue;   // a 3-game slate has no top-3 to speak of
  // Rank by conviction on the CALLED side, which is what the ladder reads.
  const withMax = usable.map((r) => {
    const call = r.p >= 0.5 ? "NRFI" : "YRFI";
    const pMax = Math.max(r.p, 1 - r.p);
    const won = (call === "NRFI") === (r.actual === 1);
    return { date, label: r.label, call, p: r.p, pMax, won: won ? 1 : 0 };
  });
  withMax.sort((a, b) => b.pMax - a.pMax);
  withMax.forEach((g, i) => { g.rank = i + 1; g.slateN = withMax.length; });
  // Rank among NRFI calls only — his board is one-sided, so this is the
  // apples-to-apples version of the same question.
  const nrfiOnly = withMax.filter((g) => g.call === "NRFI").sort((a, b) => b.p - a.p);
  nrfiOnly.forEach((g, i) => { g.nrfiRank = i + 1; });
  games.push(...withMax);
}

console.log("slates " + data.slates.length + "  games " + games.length +
  "  overall hit " + (games.reduce((s, g) => s + g.won, 0) / games.length * 100).toFixed(1) + "%\n");

// ---- 1) baseline: is pMax itself predictive at all? --------------------------
const fit1 = logistic(games.map((g) => [1, logit(g.pMax)]), games.map((g) => g.won));
console.log("win ~ logit(pMax)");
console.log("  slope on logit(pMax)  " + fit1.b[1].toFixed(3) + "  +/- " + fit1.se[1].toFixed(3) +
  "   t = " + (fit1.b[1] / fit1.se[1]).toFixed(2));
console.log("  (1.0 would be perfectly calibrated conviction; 0 would be no signal)\n");

// ---- 2) does rank add anything on top? ---------------------------------------
for (const N of [1, 2, 3, 4, 5]) {
  const X = games.map((g) => [1, logit(g.pMax), g.rank <= N ? 1 : 0]);
  const f = logistic(X, games.map((g) => g.won));
  const inTop = games.filter((g) => g.rank <= N);
  const rest = games.filter((g) => g.rank > N);
  const hit = (a) => a.length ? a.reduce((s, g) => s + g.won, 0) / a.length * 100 : NaN;
  const t = f.b[2] / f.se[2];
  console.log("top " + N + ":  raw hit " + hit(inTop).toFixed(1) + "% (n=" + inTop.length + ")" +
    "  vs rest " + hit(rest).toFixed(1) + "% (n=" + rest.length + ")" +
    "   |  controlled for pMax: " + (f.b[2] >= 0 ? "+" : "") + f.b[2].toFixed(3) +
    " +/- " + f.se[2].toFixed(3) + "  t = " + t.toFixed(2) +
    (Math.abs(t) >= 2 ? "  SIGNIFICANT" : ""));
}

// ---- 3) the same question one-sided, on NRFI calls only ----------------------
const nrfiGames = games.filter((g) => g.call === "NRFI" && g.nrfiRank != null);
console.log("\nNRFI calls only (n=" + nrfiGames.length + "), rank among that slate's NRFI calls:");
for (const N of [1, 2, 3, 5]) {
  const X = nrfiGames.map((g) => [1, logit(g.pMax), g.nrfiRank <= N ? 1 : 0]);
  const f = logistic(X, nrfiGames.map((g) => g.won));
  const inTop = nrfiGames.filter((g) => g.nrfiRank <= N);
  const rest = nrfiGames.filter((g) => g.nrfiRank > N);
  const hit = (a) => a.length ? a.reduce((s, g) => s + g.won, 0) / a.length * 100 : NaN;
  const t = f.b[2] / f.se[2];
  console.log("  top " + N + ":  raw " + hit(inTop).toFixed(1) + "% (n=" + inTop.length + ")" +
    " vs " + hit(rest).toFixed(1) + "% (n=" + rest.length + ")" +
    "   controlled: " + (f.b[2] >= 0 ? "+" : "") + f.b[2].toFixed(3) +
    " +/- " + f.se[2].toFixed(3) + "  t = " + t.toFixed(2) +
    (Math.abs(t) >= 2 ? "  SIGNIFICANT" : ""));
}

/* ---- 4) the mechanism, if there is one -------------------------------------
 * Rank can only beat p through the slate. So look directly at the slate: does
 * how GOOD today's board is change what a given p is worth? If a 57% pick is
 * worth less on a stacked day than on a bare one, that is the same finding as
 * a rank effect and it names the cause. */
const bySlate = new Map();
for (const g of games) {
  if (!bySlate.has(g.date)) bySlate.set(g.date, []);
  bySlate.get(g.date).push(g);
}
const slateTop = new Map();
for (const [d, gs] of bySlate) slateTop.set(d, Math.max(...gs.map((g) => g.pMax)));
const X4 = games.map((g) => [1, logit(g.pMax), logit(slateTop.get(g.date))]);
const f4 = logistic(X4, games.map((g) => g.won));
console.log("\nwin ~ logit(pMax) + logit(best pMax on that slate)");
console.log("  own conviction   " + (f4.b[1] >= 0 ? "+" : "") + f4.b[1].toFixed(3) + " +/- " + f4.se[1].toFixed(3) +
  "   t = " + (f4.b[1] / f4.se[1]).toFixed(2));
console.log("  slate strength   " + (f4.b[2] >= 0 ? "+" : "") + f4.b[2].toFixed(3) + " +/- " + f4.se[2].toFixed(3) +
  "   t = " + (f4.b[2] / f4.se[2]).toFixed(2));
console.log("  a NEGATIVE slate-strength term is what 'fire only the best few' would look like:");
console.log("  the same number is worth less on a day that is thick with them.");

/* ---- 5) the same question in MONEY -----------------------------------------
 * Accuracy is not the decision. A rank effect could be absent from the hit rate
 * and present in the price, because the market is not equally sharp on every
 * game, and "which of my good numbers to fire" is a question about the PRICE as
 * much as the number. Kalshi trade prices cover 65 of the 95 dates.
 *
 * Same ticker parse and same doubleheader exclusion as nrfi-tout-market-gap.js:
 * the team split is ambiguous from the left (MIL+LAD or MI+LLAD), so build the
 * suffix expected from our own label and compare for equality. Doubleheaders
 * are dropped because two games share a date and team pair and nothing in the
 * label says which market is which. */
const kal = require("./nrfi-kalshi-prices.json").rows;
const MON = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
const priceOf = new Map();
for (const r of kal) {
  const m = /^KXMLBRFI-(\d\d)([A-Z]{3})(\d\d)\d{4}([A-Z]+)$/.exec(r.ticker);
  if (m) priceOf.set(`20${m[1]}-${MON[m[2]]}-${m[3]}|${m[4]}`, r);
}
const dupe = new Map();
for (const g of games) dupe.set(g.date + "|" + g.label, (dupe.get(g.date + "|" + g.label) || 0) + 1);

const priced = [];
for (const g of games) {
  if (dupe.get(g.date + "|" + g.label) > 1) continue;          // doubleheader
  const k = priceOf.get(g.date + "|" + g.label.replace("@", ""));
  if (!k || k.yes == null) continue;
  const px = g.call === "NRFI" ? 1 - k.yes : k.yes;             // cost of our side
  if (!(px > 0.02 && px < 0.98)) continue;
  priced.push(Object.assign({ px, roi: g.won ? (1 / px) - 1 : -1 }, g));
}
const roiOf = (a) => a.length ? a.reduce((s, g) => s + g.roi, 0) / a.length * 100 : NaN;
// SE of a mean ROI, which is what says whether a gap is worth acting on.
const roiSe = (a) => {
  if (a.length < 2) return NaN;
  const m = a.reduce((s, g) => s + g.roi, 0) / a.length;
  const v = a.reduce((s, g) => s + (g.roi - m) * (g.roi - m), 0) / (a.length - 1);
  return Math.sqrt(v / a.length) * 100;
};
console.log("\nROI at Kalshi trade prices, flat stake on the called side (n=" + priced.length +
  " of " + games.length + " games priced):");
/* The all-games line is a BASELINE for the rows under it, not a result. Do not
 * quote it as the desk's edge: these p values come from a model whose PITCHER_BT
 * table is generated from backtest starts that overlap this very season, so the
 * level is contaminated even though the top-N comparison below is not — both
 * sides of that comparison carry the same contamination and it cancels. */
console.log("  all priced games    " + roiOf(priced).toFixed(2) + "% +/- " + roiSe(priced).toFixed(2) +
  "   (BASELINE ONLY — in-sample, not an edge estimate)");
for (const N of [1, 2, 3, 4, 5]) {
  const inTop = priced.filter((g) => g.rank <= N);
  const rest = priced.filter((g) => g.rank > N);
  const diff = roiOf(inTop) - roiOf(rest);
  const se = Math.sqrt(roiSe(inTop) ** 2 + roiSe(rest) ** 2);
  console.log("  top " + N + "  " + roiOf(inTop).toFixed(2) + "% +/- " + roiSe(inTop).toFixed(2) +
    " (n=" + inTop.length + ")   rest " + roiOf(rest).toFixed(2) + "% (n=" + rest.length + ")" +
    "   gap " + (diff >= 0 ? "+" : "") + diff.toFixed(2) + " +/- " + se.toFixed(2) +
    "  t = " + (diff / se).toFixed(2) + (Math.abs(diff / se) >= 2 ? "  SIGNIFICANT" : ""));
}
