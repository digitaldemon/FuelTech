/* Is a simple rolling clean-rate scorer better than our 33-factor model?
 *
 * NRFIKINGKY's board shows, per starter, first-inning clean% over four windows
 * (SZN / L50 / L30 / L10) and fuses them into one "Dual Score". This asks the
 * only question that matters: on the same games, does a scorer built from those
 * windows rank better than our model's p?
 *
 * THIS DOES NOT REPLICATE HIS DS. It can't — a plain product of the four windows
 * orders his own two published cards backwards (MIL@DET 51.3 vs SEA@HOU 69.4,
 * where his card says 64.7 and 59.1). His number carries inputs he doesn't show.
 * What this measures is whether the *displayed approach* — raw recent clean rate
 * — carries ranking information our model lacks.
 *
 * Three scorers on an identical game set:
 *   ours    cached p from nrfi-tout-vs-model.json
 *   raw     his-style, windows used at face value
 *   reg     same windows, regressed to league mean at the MEASURED k=87.6
 *
 * raw vs reg is the noise test. If the windows carry real signal, using them at
 * face value should not be much worse than regressing them. If they are mostly
 * sampling error, regression should win by a lot.
 *
 * Walk-forward throughout: a start is scored only from starts with a STRICTLY
 * smaller gamePk, so a game never sees itself or its own future. gamePk is
 * chronological within and across seasons (2025 ~777k, 2026 ~82xk).
 *
 * His windows are in DAYS, not starts — his card reads "L30 · 5g", i.e. five
 * starts inside thirty days. starts.json carries no dates, so days are
 * approximated by starts at the ~5-day turn his own cards imply:
 * L10d~2, L30d~6, L50d~10. Approximation noted rather than hidden; it cannot
 * flip a conclusion this size.
 */
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const K_REL = 87.6;   // beta-binomial k, scripts/nrfi-pitcherbt-rebuild.js
const LG_CLEAN = 0.705; // league mean clean first inning, same source
const WINDOWS = { l10: 2, l30: 6, l50: 10 };

const starts = JSON.parse(fs.readFileSync(path.join(HERE, "nrfi-pitcherbt-starts.json"), "utf8"));
const cache = JSON.parse(fs.readFileSync(path.join(HERE, "nrfi-tout-vs-model.json"), "utf8"));

// pk -> the arms that started it. Each arm's `clean` is HIS half-inning.
const byPk = new Map();
starts.arms.forEach((arm, idx) => {
  const log = arm.log.slice().sort((a, b) => a.pk - b.pk);
  arm._log = log;
  arm._idx = new Map(log.map((s, i) => [s.pk, i]));
  for (const s of log) {
    if (!byPk.has(s.pk)) byPk.set(s.pk, []);
    byPk.get(s.pk).push(idx);
  }
});

// Season boundary, derived rather than assumed: the smallest gamePk the cache uses.
let minCachePk = Infinity;
for (const [, games] of cache.slates) for (const g of games) minCachePk = Math.min(minCachePk, g.gamePk);
const SEASON_LO = minCachePk - 20000; // comfortably inside 2026, clear of 2025

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

// Clean-rate windows for one arm, using ONLY starts before `pk`.
function windows(arm, pk) {
  const i = arm._idx.get(pk);
  if (i == null) return null;
  const prior = arm._log.slice(0, i);
  if (!prior.length) return null;
  const szn = prior.filter((s) => s.pk >= SEASON_LO);
  const rate = (arr) => (arr.length ? { pct: mean(arr.map((s) => s.clean)), n: arr.length } : null);
  return {
    szn: rate(szn),
    l50: rate(prior.slice(-WINDOWS.l50)),
    l30: rate(prior.slice(-WINDOWS.l30)),
    l10: rate(prior.slice(-WINDOWS.l10)),
  };
}

// Fuse four windows into one clean probability for this arm.
// raw: face value, equally weighted, exactly what the card displays.
// reg: each window shrunk toward the league mean by its own reliability n/(n+k),
//      which is the only defensible way to average samples of 2 and 23.
function fuse(w, mode) {
  const cells = ["szn", "l50", "l30", "l10"].map((k) => w[k]).filter(Boolean);
  if (!cells.length) return null;
  if (mode === "raw") return mean(cells.map((c) => c.pct));
  if (mode === "reg") {
    // NOTE THE FLAW, kept deliberately: the four windows are NESTED
    // (szn contains l50 contains l30 contains l10), so shrinking each by its own
    // n and averaging treats the same start as up to four independent
    // observations. That understates shrinkage on the short windows and lets
    // them reorder arms. It is reported because it is what a naive "just regress
    // the card" implementation does, and because it is NOT the fair steelman.
    const num = cells.reduce((s, c) => s + (c.n / (c.n + K_REL)) * c.pct + (K_REL / (c.n + K_REL)) * LG_CLEAN, 0);
    return num / cells.length;
  }
  // sznR: the statistically correct use of the same data. One sample, one
  // shrinkage, no double counting — every start the arm has thrown this season,
  // regressed to the league mean at the measured k.
  if (!w.szn) return null;
  const n = w.szn.n;
  return (n / (n + K_REL)) * w.szn.pct + (K_REL / (n + K_REL)) * LG_CLEAN;
}

// Metrics
const brier = (rows, f) => mean(rows.map((r) => (f(r) - r.actual) ** 2));
function auc(rows, f) {
  const pos = rows.filter((r) => r.actual === 1).map(f);
  const neg = rows.filter((r) => r.actual === 0).map(f);
  if (!pos.length || !neg.length) return null;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}
// AUC standard error, Hanley-McNeil — needed to say whether a gap is real.
function aucSe(a, np, nn) {
  const q1 = a / (2 - a), q2 = (2 * a * a) / (1 + a);
  return Math.sqrt((a * (1 - a) + (np - 1) * (q1 - a * a) + (nn - 1) * (q2 - a * a)) / (np * nn));
}

const rows = [];
let noArms = 0, noPrior = 0;
for (const [date, games] of cache.slates) {
  for (const g of games) {
    const armIdx = byPk.get(g.gamePk);
    if (!armIdx || armIdx.length < 2) { noArms++; continue; }
    const ws = armIdx.slice(0, 2).map((i) => windows(starts.arms[i], g.gamePk));
    if (ws.some((w) => !w)) { noPrior++; continue; }
    const raw = ws.map((w) => fuse(w, "raw"));
    const reg = ws.map((w) => fuse(w, "reg"));
    const szr = ws.map((w) => fuse(w, "sznR"));
    if ([raw, reg, szr].some((a) => a.some((x) => x == null))) { noPrior++; continue; }
    rows.push({
      date, gamePk: g.gamePk, actual: g.actual, ours: g.p,
      raw: raw[0] * raw[1], reg: reg[0] * reg[1], sznR: szr[0] * szr[1],
      // sample depth actually available, for the reliability report
      nMin: Math.min(...ws.map((w) => (w.szn ? w.szn.n : 0))),
    });
  }
}

const np = rows.filter((r) => r.actual === 1).length, nn = rows.length - np;
console.log("joined " + rows.length + " games  (" + noArms + " no arm pair, " + noPrior + " no prior starts)");
console.log("base rate " + (np / rows.length * 100).toFixed(1) + "% NRFI\n");

const scorers = [["ours", (r) => r.ours], ["raw ", (r) => r.raw], ["reg ", (r) => r.reg], ["sznR", (r) => r.sznR]];
console.log("scorer   Brier     AUC      se       vs chance");
for (const [name, f] of scorers) {
  const b = brier(rows, f), a = auc(rows, f), se = aucSe(a, np, nn);
  console.log("  " + name + "  " + b.toFixed(5) + "   " + a.toFixed(4) + "   " + se.toFixed(4) +
    "   " + ((a - 0.5) / se).toFixed(2) + " se");
}

// The decisive comparison is PAIRED — same games, so the difference has a much
// smaller error than either AUC alone. Bootstrap by DATE: a slate shares
// weather, parks and one fetch of our feeds, so games within a date are not
// independent (this is the clustering that moved travel under its MDE).
const dates = [...new Set(rows.map((r) => r.date))];
const byDate = new Map(dates.map((d) => [d, rows.filter((r) => r.date === d)]));
function bootDiff(fA, fB, B = 2000) {
  const out = [];
  for (let b = 0; b < B; b++) {
    const samp = [];
    for (let i = 0; i < dates.length; i++) samp.push(...byDate.get(dates[(Math.random() * dates.length) | 0]));
    const p = samp.filter((r) => r.actual === 1), n = samp.filter((r) => r.actual === 0);
    if (!p.length || !n.length) continue;
    out.push(auc(samp, fA) - auc(samp, fB));
  }
  out.sort((a, b) => a - b);
  return { lo: out[(out.length * 0.025) | 0], hi: out[(out.length * 0.975) | 0], mid: out[(out.length * 0.5) | 0] };
}

console.log("\npaired AUC differences, 2000x bootstrap clustered by date (" + dates.length + " dates):");
for (const [a, b] of [["ours", "raw"], ["ours", "sznR"], ["sznR", "raw"], ["reg", "raw"]]) {
  const fA = scorers.find((s) => s[0].trim() === a)[1], fB = scorers.find((s) => s[0].trim() === b)[1];
  const d = bootDiff(fA, fB);
  const verdict = d.lo > 0 ? a.toUpperCase() + " better" : d.hi < 0 ? b.toUpperCase() + " better" : "cannot separate";
  console.log("  " + a + " - " + b + ":  " + (d.mid >= 0 ? "+" : "") + d.mid.toFixed(4) +
    "  95% [" + d.lo.toFixed(4) + ", " + d.hi.toFixed(4) + "]   " + verdict);
}

// How much of the raw score is sampling error? Compare the spread of the raw
// score against the spread of the regressed one. Regression removes variance
// that is noise, so the ratio is an estimate of how much of raw's spread is real.
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const sdRaw = sd(rows.map((r) => r.raw)), sdReg = sd(rows.map((r) => r.reg));
console.log("\nspread of the score itself:");
console.log("  raw sd " + sdRaw.toFixed(4) + "   reg sd " + sdReg.toFixed(4) +
  "   -> regression removes " + ((1 - sdReg / sdRaw) * 100).toFixed(0) + "% of the spread");
console.log("  median season starts available on the thinner arm: " +
  rows.map((r) => r.nMin).sort((a, b) => a - b)[rows.length >> 1]);
