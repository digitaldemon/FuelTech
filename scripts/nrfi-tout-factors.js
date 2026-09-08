// What does he see that our p does not?
//
//   node scripts/nrfi-tout-factors.js [cache]
//
// He beats our own p-matched games by 17.3 pts (z=5.01), and that survives
// stratifying by date (z=4.47) and by date x p-band (z=3.28). So conditional on
// everything our probability knows, his selection still carries information.
// This asks which of the 33 factors we record carries any of it.
//
// THE MATCHING, and why band buckets were not enough. An earlier version of this
// comparison used "top half of our board", a 50-percentile-wide bucket, and its
// control row — our own p, which must come out flat if the two groups really sit
// at the same rank — failed at t=10.00. A 50-point bucket does not hold p fixed.
// Each of his legs is matched here against games on the SAME DATE whose p is
// within MATCH_P, which drove that control to t=1.15. The control row is printed
// first and every other number is void if it is not flat.
//
// THE TRAP THIS SCRIPT EXISTS TO AVOID. A feature that differs is not a feature
// that explains. Thin-sample starters cleared a Bonferroni bar on this data and
// then evaporated: inside the stratum where he and his peers looked identical on
// it, he still beat them by the entire advantage. So anything that clears here
// is immediately re-tested by MEDIATION — hold the factor fixed and ask whether
// his edge shrinks. Only a factor whose edge shrinks when held fixed is carrying
// the signal. That test runs automatically and its verdict is printed with the
// finding, not in a separate pass someone can skip.
//
// AND A NULL IS NOT A FINDING UNTIL IT STATES ITS MDE. "Nothing cleared" from an
// underpowered test means UNMEASURED, not disproved, and that distinction has
// already been got wrong once on this data. Every non-significant row prints the
// effect it could have detected.

const fs = require("fs");
const path = require("path");

const CACHE = process.argv[2] || "nrfi-tout-vs-model.json";
const MATCH_P = 0.02;      // same-date peers within this much of the leg's p
const B = 3000;            // date-clustered bootstrap replicates

const p0 = path.isAbsolute(CACHE) ? CACHE : path.join(__dirname, CACHE);
const J = JSON.parse(fs.readFileSync(p0, "utf8"));

let _s = 0x9e3779b9 >>> 0;
const rnd = () => { _s ^= _s << 13; _s >>>= 0; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0; return _s / 4294967296; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };

// ---- load ------------------------------------------------------------------
const his = new Set();
for (const [d, ps] of J.byDate) for (const x of ps) if (x.side === "NRFI" && x.gamePk != null) his.add(d + ":" + x.gamePk);
const raw = [];
for (const [d, gs] of J.slates) for (const g of gs) {
  if (!Number.isFinite(g.p) || !g.factors) continue;
  raw.push({ d, pk: g.gamePk, p: g.p, y: g.actual, his: his.has(d + ":" + g.gamePk), f: g.factors });
}
const games = [...new Map(raw.map((r) => [r.pk, r])).values()];
const byDate = new Map();
for (const r of games) { if (!byDate.has(r.d)) byDate.set(r.d, []); byDate.get(r.d).push(r); }

// The factor list comes from the data, not a hand-written list that can drift
// out of date with the evaluator.
const FACTORS = [...new Set(games.flatMap((r) => Object.keys(r.f)))].sort();

console.log(`${games.length} games, ${games.filter((r) => r.his).length} his NRFI legs, ` +
  `${byDate.size} dates, ${FACTORS.length} factors captured`);

// ---- match -----------------------------------------------------------------
/* One record per leg: the leg, and the same-date games at the same p that he
 * passed on. A leg with no peers contributes nothing and is counted, because a
 * matching rate that quietly collapses is how a comparison ends up describing a
 * different population than it claims to. */
const matched = [];
let unmatched = 0;
for (const leg of games.filter((r) => r.his)) {
  const peers = (byDate.get(leg.d) || []).filter((r) => !r.his && Math.abs(r.p - leg.p) <= MATCH_P);
  if (!peers.length) { unmatched++; continue; }
  matched.push({ leg, peers });
}
console.log(`matched ${matched.length}/${matched.length + unmatched} legs to same-date peers within ${MATCH_P} of p ` +
  `(median ${[...matched.map((m) => m.peers.length)].sort((a, b) => a - b)[matched.length >> 1]} peers each)\n`);

/* Date-clustered bootstrap. A slate shares weather, parks, umpires and one fetch
 * of our own feeds, so games on a date are not independent draws; an i.i.d.
 * bootstrap reports a band narrower than the data supports, which is the
 * dangerous direction on a threshold call. Resample DATES. */
const dates = [...new Set(matched.map((m) => m.leg.d))];
const idxByDate = new Map(dates.map((d) => [d, matched.filter((m) => m.leg.d === d)]));
function clusterCI(valueOf) {
  const point = mean(matched.map(valueOf));
  const boot = [];
  for (let b = 0; b < B; b++) {
    const s = [];
    for (let i = 0; i < dates.length; i++) s.push(...idxByDate.get(dates[(rnd() * dates.length) | 0]));
    boot.push(mean(s.map(valueOf)));
  }
  const se = sd(boot);
  return { point, se, t: se > 0 ? point / se : 0 };
}

// ---- the control row -------------------------------------------------------
/* Printed first and on its own, because every number below is void if it fails.
 * If our p is not flat between his legs and their matched peers then the match
 * did not work, and any factor difference found afterwards may just be the p
 * difference wearing a disguise. */
const ctl = clusterCI((m) => m.leg.p - mean(m.peers.map((r) => r.p)));
console.log("CONTROL — our own p, which the matching is supposed to hold fixed");
console.log(`  his legs minus matched peers: ${(100 * ctl.point).toFixed(3)} pts   t=${ctl.t.toFixed(2)}`);
if (Math.abs(ctl.t) > 2) {
  console.log("  STOP: the match did not hold p fixed. Everything below is confounded by p.");
  process.exit(1);
}
console.log("  flat — the comparison is at equal p.\n");

// ---- per-factor differences ------------------------------------------------
/* Standardised by the factor's own spread across the board, so factors on wildly
 * different scales (a lambda multiplier near 1.0 vs a base rate near 0.5) are
 * comparable and the MDE below means the same thing on every row. */
const rows = [];
for (const k of FACTORS) {
  const all = games.map((r) => r.f[k]).filter(Number.isFinite);
  const spread = sd(all);
  if (!(spread > 0)) { rows.push({ k, dead: true }); continue; }
  const r = clusterCI((m) => {
    const a = m.leg.f[k], b = mean(m.peers.map((x) => x.f[k]).filter(Number.isFinite));
    return Number.isFinite(a) && Number.isFinite(b) ? (a - b) / spread : 0;
  });
  rows.push({ k, ...r, spread });
}
const live = rows.filter((r) => !r.dead);
const BAR = 2.807;   // two-sided 0.005, ~Bonferroni for this many tests
console.log(`per-factor difference, his legs minus matched peers, in SDs of the factor`);
console.log(`${live.length} live factors tested, bar |t| > ${BAR} (Bonferroni)`);
const dead = rows.filter((r) => r.dead);
if (dead.length) console.log(`  (${dead.length} factor(s) constant across the board and untestable: ${dead.map((r) => r.k).join(", ")})`);
console.log("");
live.sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
for (const r of live.slice(0, 12)) {
  const flag = Math.abs(r.t) > BAR ? " **" : "";
  console.log(`  ${r.k.padEnd(16)} ${(r.point >= 0 ? "+" : "") + r.point.toFixed(3)} sd   t=${r.t.toFixed(2).padStart(6)}${flag}`);
}
const clear = live.filter((r) => Math.abs(r.t) > BAR);
if (!clear.length) {
  // The null needs its power stated or it is not a result.
  const mde = BAR * mean(live.map((r) => r.se));
  console.log(`\n  NOTHING CLEARS. Minimum detectable effect at this bar: ${mde.toFixed(3)} sd.`);
  console.log("  Read that as UNMEASURED below that size, not as 'he uses nothing we record'.");
}

// ---- mediation -------------------------------------------------------------
/* The test that killed the last finding on this data.
 *
 * A factor can differ between his legs and their peers and explain none of his
 * edge. The way to tell is to hold it fixed: split into games above and below
 * the factor's median and recompute his edge inside each half. If the factor is
 * carrying the signal his edge collapses there. If it survives at full size, he
 * merely has a habit, and copying the habit buys the habit and not the result. */
function edgeWithin(filter, label) {
  const sub = matched.filter(filter);
  if (sub.length < 20) return `${label}: only ${sub.length} legs, not enough to say`;
  const d = sub.map((m) => m.leg.y - mean(m.peers.map((r) => r.y)));
  const point = mean(d);
  const boot = [];
  const ds = [...new Set(sub.map((m) => m.leg.d))];
  const bd = new Map(ds.map((x) => [x, sub.filter((m) => m.leg.d === x)]));
  for (let b = 0; b < B; b++) {
    const s = [];
    for (let i = 0; i < ds.length; i++) s.push(...bd.get(ds[(rnd() * ds.length) | 0]));
    boot.push(mean(s.map((m) => m.leg.y - mean(m.peers.map((r) => r.y)))));
  }
  const se = sd(boot);
  return `${label}: +${(100 * point).toFixed(1)} pts on ${sub.length} legs (${(point / se).toFixed(1)}se)`;
}

console.log("\n" + "=".repeat(72));
console.log("HIS EDGE, matched — the thing any factor would have to explain");
console.log("  " + edgeWithin(() => true, "all matched legs"));

if (clear.length) {
  console.log("\nMEDIATION — hold each clearing factor fixed and re-ask");
  console.log("  A factor that carries the signal makes his edge SHRINK when held fixed.");
  console.log("  A factor that survives at full size is a habit of his, not his reason.\n");
  for (const r of clear) {
    const vals = games.map((g) => g.f[r.k]).filter(Number.isFinite).sort((a, b) => a - b);
    const med = vals[vals.length >> 1];
    console.log(`  ${r.k} (median ${med.toFixed(4)}, his legs ${r.point >= 0 ? "above" : "below"} peers by ${Math.abs(r.point).toFixed(3)} sd)`);
    console.log("    " + edgeWithin((m) => m.leg.f[r.k] <= med, "      legs at/below median"));
    console.log("    " + edgeWithin((m) => m.leg.f[r.k] > med, "      legs above median"));
  }
  console.log("\n  Compare each pair against the all-matched edge above. Both halves holding");
  console.log("  near the full edge means the factor explains none of it.");
}
