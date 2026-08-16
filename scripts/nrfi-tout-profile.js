// What separates NRFIKINGKY's picks from the games our model scores the same?
//
//   node scripts/nrfi-tout-profile.js
//
// WHY THE COMPARISON IS MATCHED AND NOT BANDED. The earlier version of this
// script compared his top-half legs against every other top-half game on the
// slate, and carried `our p(NRFI)` as a control row: if his picks and their
// peers really sit in the same band, that row should be flat, and everything
// else in the table is then a difference AMONG games we score alike.
//
// After the rolling-factor fix (see nrfi-ctx-parity.js — four factors and the
// confidence penalty were dead on every cached game) the control stopped being
// flat. His top-half legs came back +0.008 in p at t=3.20. That is small, but
// "top half of the slate" is a 50-percentile-wide bucket, and a bucket that wide
// does not hold p fixed just because both sides are inside it. The control row
// did its job: it said the band split was too coarse to support the rest of the
// table, so the split is what changed.
//
// The fix is to match on the control instead of bucketing it. Each of his legs
// is compared against the games on THE SAME DATE whose model probability is
// within CALIPER of it. The comparison is then a within-day, within-probability
// difference, and p is held fixed by construction rather than by hope. The
// control row is still printed and still gates the read — a caliper is only a
// claim about balance until it is measured.
//
// This also answers the question the band split could not: the raw edge and the
// matched edge differ by exactly the amount the probability gap was buying.
//
// A NULL RESULT IS THE EXPECTED RESULT and is worth printing. If he separates
// winners from matched peers while looking identical to them on every number we
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
 * measurement of him. Retained only to report WHERE in our ranking a matched
 * pair sits; it no longer defines the comparison. */
const pctlIn = (p, s) => {
  const below = s.filter((g) => g.p < p).length;
  const ties = s.filter((g) => g.p === p).length;
  return (below + ties / 2) / s.length;
};

const his = [], peers = [];
const byDate = new Map();
for (const [date, games] of mdl.slates) {
  const usable = games.filter((g) => g.p != null && g.actual != null);
  if (usable.length < 4) continue;
  const cell = { his: [], peers: [] };
  byDate.set(date, cell);
  for (const g of usable) {
    const rec = {
      date,
      pctl: pctlIn(g.p, usable),
      p: g.p,
      y: g.actual ? 1 : 0,
      conf: g.confidence == null ? null : g.confidence,
      agree: g.aligned && g.aligned.total ? g.aligned.agree / g.aligned.total : null,
      votes: g.aligned ? g.aligned.total : null,
      rows: g.aligned ? g.aligned.rows : null,
      thin: (g.thinAway ? 1 : 0) + (g.thinHome ? 1 : 0),
      f: g.factors || null,
    };
    const mine = hisKeys.has(date + ":" + g.gamePk);
    (mine ? his : peers).push(rec);
    (mine ? cell.his : cell.peers).push(rec);
  }
}

/* THE MATCH.
 *
 * CALIPER is in units of model probability, not percentile, because probability
 * is the thing that has to be equal for "among games we score alike" to mean
 * anything. A percentile caliper would be wider on a flat slate and narrower on
 * a spread one, which is the same coarseness problem in a different coordinate.
 *
 * MIN_PEERS is 2 rather than 1 because a single matched peer contributes its own
 * coin flip at full weight, and on a 15-game slate there is usually more than one
 * game within two points of any given one. Legs that cannot find two are dropped
 * and COUNTED — a match that silently discards the hardest-to-match third of his
 * book is selecting on the thing being measured, so the retention rate is printed
 * and asserted rather than assumed.
 */
const CALIPER = 0.02, MIN_PEERS = 2;
const matched = [], dropped = [];
for (const cell of byDate.values())
  for (const r of cell.his) {
    const ps = cell.peers.filter((q) => Math.abs(q.p - r.p) <= CALIPER);
    // `all` is every peer on the same date, kept so the same legs can be scored
    // against both peer sets. Without it, "raw vs matched" would compare 243
    // legs to 151 and attribute the difference to the caliper when part of it is
    // simply a different book.
    if (ps.length >= MIN_PEERS) matched.push({ r, peers: ps, all: cell.peers });
    else dropped.push(r);
  }

/* Matched difference on any per-game quantity.
 *
 * Each of his legs contributes ONE number: his value minus the mean of his
 * matched peers'. The spread of those differences across legs is what the
 * standard error is built from, so it already contains the noise in the peer
 * means — no separate term for it, and no assumption that the peer mean is
 * exact. `keep` is applied to BOTH sides, so a stratified call compares his legs
 * in a stratum against peers in the same stratum, which is what "holding the
 * factor fixed" has to mean.
 *
 * Understated by a little: legs on the same date can share peers, so the
 * differences are mildly correlated and the true se is somewhat wider than this.
 * The direction matters — it makes findings look slightly stronger than they
 * are — which is one more reason the bar below is Bonferroni-adjusted rather
 * than a bare 2se.
 */
const mdiff = (get, keep, peerField) => {
  const ds = [], hv = [], pv = [];
  for (const m of matched) {
    if (keep && !keep(m.r)) continue;
    const a = get(m.r);
    if (a == null || !isFinite(a)) continue;
    const pool = m[peerField || "peers"];
    const bs = (keep ? pool.filter(keep) : pool).map(get).filter((x) => x != null && isFinite(x));
    if (!bs.length) continue;
    const mb = mean(bs);
    ds.push(a - mb); hv.push(a); pv.push(mb);
  }
  if (ds.length < 20) return null;
  const d = mean(ds);
  const spread = sd(ds);
  const se = ds.length > 1 ? spread / Math.sqrt(ds.length - 1) : 0;
  /* FLAT is a tolerance, not an equality, and the tolerance is load-bearing.
   * A term that is identical on every game still produces differences of about
   * 1e-16, because mean([x,x,x]) is (x+x+x)/3 and that is not bit-identical to x.
   * With `sd === 0` the home-field split came back t=-1.74 off pure rounding
   * noise and printed as an ordinary row. Cached factors are rounded to 1e-4, so
   * the smallest difference that can be real is ~3e-5; 1e-9 sits far below that
   * and far above ulp noise. */
  return { his: mean(hv), peers: mean(pv), d, se, t: se ? d / se : 0, n: ds.length, flat: spread < 1e-9 };
};

console.log("=================== SAMPLE ===================");
console.log(`  his NRFI legs with a result      ${his.length}`);
console.log(`  matched within +/-${CALIPER} on the same date   ${matched.length}`);
console.log(`  unmatched (fewer than ${MIN_PEERS} peers)        ${dropped.length}`);
console.log(`  peers per leg (mean)             ${(mean(matched.map((m) => m.peers.length))).toFixed(1)}`);
console.log(`  mean percentile of a matched leg ${(mean(matched.map((m) => m.r.pctl)) * 100).toFixed(0)}th`);
/* What got dropped is part of the result, not bookkeeping. A leg fails to match
 * when its probability is isolated on that day's slate — which is not a random
 * property of a bet, it is what an extreme pick looks like. If the dropped legs
 * hit at a very different rate from the kept ones, the matched estimate is a
 * statement about a subset of his book and has to be read that way. */
if (dropped.length >= 20) {
  const dh = mean(dropped.map((r) => r.y)), mh = mean(matched.map((m) => m.r.y));
  console.log(`  dropped legs hit ${pc(dh)} vs ${pc(mh)} for kept legs` +
    (Math.abs(dh - mh) > 0.1 ? "   <== the dropped book is a different book; matched result covers the kept one only" : ""));
}
if (matched.length < 60) {
  console.error(`\nOnly ${matched.length} matched legs — too few to profile. Widen CALIPER or rebuild the cache.`);
  process.exit(1);
}
const retention = matched.length / his.length;
if (retention < 0.6) {
  console.error(`\nMatching kept only ${pc(retention)} of his legs. Below 60% the matched book is a`);
  console.error("different book from the one he actually bet, and the comparison stops being about him.");
  process.exit(1);
}

/* The bar is COMPUTED from the number of tests, not typed in.
 *
 * It used to be a literal 2.64 with a comment saying "the Bonferroni-adjusted
 * two-sided 5% bar for 6 tests". That was right for six. The factor section
 * below runs one test per captured factor, and a hand-typed constant would have
 * stayed at 2.64 while the table it governs grew five-fold — which is how a
 * multiple-comparison correction quietly stops correcting. Deriving it means
 * adding a feature cannot silently loosen the bar.
 *
 * erfc via the Numerical Recipes rational approximation (|error| < 1.2e-7,
 * far tighter than anything that matters at these sample sizes), then bisect
 * for the z with two-sided p = 0.05/m. Checked against the old constant: m=6
 * returns 2.64, which is the value this replaces.
 */
const erfc = (x) => {
  const z = Math.abs(x), t = 1 / (1 + z / 2);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
};
const twoSidedP = (z) => erfc(Math.abs(z) / Math.SQRT2);
const barFor = (m) => {
  const target = 0.05 / m;
  let lo = 0, hi = 8;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (twoSidedP(mid) > target) lo = mid; else hi = mid; }
  return Math.round((lo + hi) / 2 * 100) / 100;
};

/* ---- CONTROL ----
 *
 * Tested at the UNADJUSTED 1.96, deliberately, and it is the one place in this
 * script where the strict direction is the loose-looking one. Everywhere else a
 * wide bar guards against calling noise a finding. Here the null is what lets
 * the rest of the script be read, so a wide bar would make imbalance EASIER to
 * wave through. The conservative choice for a control is the bar that trips
 * soonest.
 */
console.log("\n=================== CONTROL: IS THE MATCH BALANCED? ===================");
const rawEdge = (() => {
  const a = mean(his.map((r) => r.y)), b = mean(peers.map((r) => r.y));
  return { his: a, peers: b, d: a - b };
})();
const ctlBand = (() => {
  const a = his.map((r) => r.p), b = peers.map((r) => r.p);
  const se = Math.sqrt(sd(a) ** 2 / a.length + sd(b) ** 2 / b.length);
  return { d: mean(a) - mean(b), t: se ? (mean(a) - mean(b)) / se : 0 };
})();
const ctl = mdiff((r) => r.p);
console.log(`  unmatched (his book vs all peers)   p gap ${(ctlBand.d >= 0 ? "+" : "") + ctlBand.d.toFixed(4)}   t=${ctlBand.t.toFixed(2)}`);
console.log(`  matched (+/-${CALIPER}, same date)          p gap ${(ctl.d >= 0 ? "+" : "") + ctl.d.toFixed(4)}   t=${ctl.t.toFixed(2)}`);
const balanced = Math.abs(ctl.t) <= 1.96;
console.log(`  ${balanced ? "BALANCED" : "STILL IMBALANCED"} at the unadjusted 1.96 bar.`);
if (!balanced) {
  console.log("\n  The caliper is still too wide to hold p fixed. Everything below would be");
  console.log("  confounded by the probability gap, so it is not printed. Tighten CALIPER and");
  console.log("  re-run; if retention falls below 60% the cache does not support this question.");
  process.exit(1);
}

const edge = mdiff((r) => r.y);
/* The SAME legs against the WHOLE slate. This is the only comparison that
 * isolates the caliper: `rawEdge` above is computed on all 243 of his legs, so
 * differencing it against a 151-leg matched estimate would charge the caliper
 * for a change of book as well as a change of peer set. Here the numerator is
 * identical and only the denominator's peers move, so the gap between the two
 * lines below is exactly what holding p fixed was worth. */
const sameLegsAllPeers = mdiff((r) => r.y, null, "all");
console.log("\n=================== HIS EDGE, MATCHED ===================");
console.log(`  he hit                ${pc(edge.his)} on ${edge.n} matched legs`);
console.log(`  matched peers hit     ${pc(edge.peers)}`);
console.log(`  edge                  ${(edge.d >= 0 ? "+" : "") + (edge.d * 100).toFixed(1)} pts   (${edge.t.toFixed(1)}se)`);
console.log(`\n  same legs vs the WHOLE slate  ${(sameLegsAllPeers.d * 100).toFixed(1)} pts (${sameLegsAllPeers.t.toFixed(1)}se)`);
console.log(`  same legs vs matched peers    ${(edge.d * 100).toFixed(1)} pts (${edge.t.toFixed(1)}se)`);
const bought = edge.d - sameLegsAllPeers.d;
console.log(`  holding p fixed ${bought >= 0 ? "ADDS" : "REMOVES"} ${Math.abs(bought * 100).toFixed(1)} pts. ${bought >= 0
  ? "His edge is not him sitting higher in our\n  ranking — against the games we score exactly like his, he does better, not worse."
  : "That much of the raw gap was him\n  sitting higher in our own ranking rather than picking better within a level."}`);
console.log(`  (his whole ${his.length}-leg book vs all peers, for scale: ${(rawEdge.d * 100).toFixed(1)} pts — a different leg set,`);
console.log("   so it is context, not a term in the decomposition above.)");
const half = [["our top half", (r) => r.pctl >= 0.5], ["our bottom half", (r) => r.pctl < 0.5]];
for (const [nm, f] of half) {
  const e = mdiff((r) => r.y, f);
  if (!e) { console.log(`  ${nm.padEnd(20)}too few matched legs to split`); continue; }
  console.log(`  ${nm.padEnd(20)}${(e.d >= 0 ? "+" : "") + (e.d * 100).toFixed(1)} pts (${e.t.toFixed(1)}se) on ${e.n}`);
}

/* Welch on each recorded feature is gone; these are matched differences too, so
 * "his 0.62 vs peers 0.57" below always means "against the games beside him at
 * the same probability on the same day", never "against the slate at large". */
const FEATURES = [
  ["confidence", (r) => r.conf, "our own data-quality score"],
  ["check agreement", (r) => r.agree, "share of voting checks on the called side"],
  ["checks voting", (r) => r.votes, "how many checks were live at all"],
  ["check rows", (r) => r.rows, "how many checks were computed"],
  ["thin arms (0-2)", (r) => r.thin, "starters with too little 1st-inning history"],
];
const BAR = barFor(FEATURES.length);

console.log("\n=================== DOES HE LOOK DIFFERENT TO US? ===================");
console.log("  feature            his      peers      diff       t");
const found = [];
for (const [name, get, why] of FEATURES) {
  const m = mdiff(get);
  if (!m) { console.log(`  ${name.padEnd(18)} (not recorded on enough matched legs)`); continue; }
  const star = Math.abs(m.t) > BAR ? "  *" : "";
  console.log(`  ${name.padEnd(18)}${m.his.toFixed(3).padStart(6)}${m.peers.toFixed(3).padStart(10)}` +
    `${((m.d) >= 0 ? "+" : "") + m.d.toFixed(3)}`.padStart(10) + `${m.t.toFixed(2).padStart(8)}${star}`);
  if (Math.abs(m.t) > BAR) found.push({ name, t: m.t, ma: m.his, mb: m.peers, why });
}
console.log(`\n  * = |t| > ${BAR}, the Bonferroni-adjusted 5% bar for ${FEATURES.length} tests.`);
console.log("  A plain 2se cut is not used here: across a table this wide it fires on noise");
console.log("  roughly one run in four, and it would fire hardest on the thinnest column.");

/* ---- PER-FACTOR: does any INPUT separate his picks from their matched peers? ----
 *
 * This is the section the previous run of this script asked for by name. The
 * summary table above compares numbers the model OUTPUTS; this compares the
 * numbers it takes IN, one test per factor the evaluator applied.
 *
 * Reading it requires holding onto what the match already controls. His legs and
 * their peers carry the same p(NRFI) — verified above, not assumed. A factor
 * that still differs between them therefore is not "he picks games our model
 * likes"; it is "among games our model scores the same, he takes the ones where
 * THIS term is doing the work". That is a specific, actionable claim about a
 * weight, and it is only available because p is fixed.
 *
 * It is also a much wider fishing net than the five summaries, which is exactly
 * why the bar is recomputed for the larger count rather than inherited.
 */
const factorLegs = matched.filter((m) => m.r.f);
console.log("\n=================== DOES ANY FACTOR SEPARATE THEM? ===================");
if (factorLegs.length < matched.length * 0.9) {
  console.log(`  Only ${factorLegs.length} of ${matched.length} matched legs carry a factor block.`);
  console.log("  This cache predates per-factor capture. Rebuild it before reading this section:");
  console.log("    node scripts/nrfi-tout-vs-model.js 318949");
  console.log("  (numeric seller id, not the username — the username 500s and resolves 0 legs)");
} else {
  const FKEYS = Object.keys(factorLegs[0].r.f);
  /* Derived pair products, because the model applies each side's terms to its
   * own half and the game is the product of the two halves. A tout who avoids
   * games where EITHER starter is trending badly shows up in the product and
   * can wash out in the two separate columns, each of which averages his
   * avoided side against his indifferent one. */
  const DERIVED = [
    ["pitMult product", (r) => r.f.awayPitMult * r.f.homePitMult],
    ["offMult product", (r) => r.f.awayOffMult * r.f.homeOffMult],
    ["trend product", (r) => r.f.awayTrend * r.f.homeTrend],
    ["offTrend product", (r) => r.f.awayOffTrend * r.f.homeOffTrend],
  ];
  const TESTS = [...FKEYS.map((k) => [k, (r) => (r.f ? r.f[k] : null)]), ...DERIVED];
  const FBAR = barFor(TESTS.length);
  const hits = [], flat = [];
  console.log("  factor                his      peers      diff        t");
  for (const [name, get] of TESTS) {
    const m = mdiff(get);
    if (!m) continue;
    /* A term that is identical on every game — the home-field split is a pure
     * function of the home/away boolean — produces a difference of exactly zero
     * on every leg, so t is 0/0. The old Welch version printed those as t=±25
     * from a zero-variance denominator, which read as the two strongest rows in
     * the table. They are collected and named instead of scored. */
    if (m.flat) { flat.push(name); continue; }
    const star = Math.abs(m.t) > FBAR ? "  *" : "";
    console.log(`  ${name.padEnd(20)}${m.his.toFixed(4).padStart(8)}${m.peers.toFixed(4).padStart(10)}` +
      `${(m.d >= 0 ? "+" : "") + m.d.toFixed(4)}`.padStart(11) + `${m.t.toFixed(2).padStart(9)}${star}`);
    if (Math.abs(m.t) > FBAR) hits.push({ name, get, t: m.t, ma: m.his, mb: m.peers });
  }
  if (flat.length) console.log(`\n  constant on every leg, so no difference is possible: ${flat.join(", ")}`);
  console.log(`\n  * = |t| > ${FBAR}, the Bonferroni-adjusted 5% bar for ${TESTS.length} tests.`);
  console.log("  His legs and the peer baseline carry the same model probability, so a");
  console.log("  difference here is not 'he likes what we like' — it is a difference in");
  console.log("  which term is carrying games we score the same.");

  if (!hits.length) {
    console.log("\n  NOTHING CLEARS. Not one of the model's own inputs distinguishes his picks");
    console.log("  from the games sitting beside them at the same probability. Combined with the");
    console.log("  null on the summaries above, that closes the question this cache can");
    console.log("  answer: the separation is not a reweighting of anything we currently");
    console.log("  compute, because on everything we compute he looks like his peers.");
    console.log("  What remains is a factor we do not collect at all — bullpen/opener news,");
    console.log("  weather revisions after our fetch, lineup scratches, or his entry timing,");
    console.log("  which the CLV finding already says is real (t=7.85, see the market-bias memo).");
  } else {
    /* Same discipline the thin-arm finding got, and it is the reason that
     * finding did not become a code change: a factor that DIFFERS still has to
     * be shown to EXPLAIN. Hold it fixed; if his edge survives at full size
     * inside the stratum where he and his peers look alike on it, the factor is
     * a trait of his selection and reweighting it copies the habit, not the
     * result. */
    console.log("\n  These cleared. Each is now stratified, because a factor that differs is not");
    console.log("  a factor that explains:");
    for (const h of hits) {
      const pooled = [];
      for (const m of matched) {
        for (const r of [m.r, ...m.peers]) { const v = h.get(r); if (v != null && isFinite(v)) pooled.push(v); }
      }
      pooled.sort((x, y) => x - y);
      const med = pooled[Math.floor(pooled.length / 2)];
      // Gated factors pile up on a single neutral value, so a median split can
      // put that whole pile on one side. Split on "at neutral" vs "moved" when
      // the factor is gated, and on the median when it is continuous.
      const gated = new Set(pooled).size <= 12;
      const label = gated ? `factor moved (!= ${med})` : `above median ${med.toFixed(4)}`;
      const inHi = (r) => { const v = h.get(r); return v != null && isFinite(v) && (gated ? v !== med : v > med); };
      console.log(`\n    ${h.name}: his ${h.ma.toFixed(4)} vs peers ${h.mb.toFixed(4)} (t=${h.t.toFixed(2)})`);
      console.log(`      unstratified        ${pc(edge.his)} vs ${pc(edge.peers)}   ` +
        `${(edge.d >= 0 ? "+" : "") + (edge.d * 100).toFixed(1)}pts (${edge.t.toFixed(1)}se) on ${edge.n}`);
      for (const [nm, f] of [[label, inHi], ["the rest", (r) => !inHi(r)]]) {
        const e = mdiff((r) => r.y, f);
        if (!e) { console.log(`      ${nm.padEnd(24)}too few matched legs to stratify`); continue; }
        console.log(`      ${nm.padEnd(24)}${pc(e.his)} vs ${pc(e.peers)}   ` +
          `${(e.d >= 0 ? "+" : "") + (e.d * 100).toFixed(1)}pts (${e.t.toFixed(1)}se) on ${e.n}`);
      }
    }
    console.log("\n  Act on one of these only if the edge SHRINKS inside the stratum where he and");
    console.log("  his peers match on it. If it survives at full size in both, the factor is a");
    console.log("  habit of his and reweighting it buys nothing but lost volume.");
  }
}

/* MEDIATION. A feature that differs is not a feature that explains.
 *
 * This is the step that stops "he differs on X" from becoming "X is his edge".
 * If a feature carries his advantage, then holding it fixed should shrink that
 * advantage: inside the stratum where he and his peers look alike on X, they
 * should also hit alike. If the edge survives the stratification at full size,
 * X is a trait of his selection and nothing more, and building a filter on it
 * would copy his habits without copying his results. */
console.log("\n=================== DOES THAT DIFFERENCE EXPLAIN THE EDGE? ===================");
console.log(`  unstratified          ${pc(edge.his)} vs ${pc(edge.peers)}   ` +
  `${(edge.d >= 0 ? "+" : "") + (edge.d * 100).toFixed(1)}pts (${edge.t.toFixed(1)}se) on ${edge.n}`);
const STRATA = [["thin arms = 0", (r) => r.thin === 0], ["thin arms >= 1", (r) => r.thin > 0]];
for (const [name, f] of STRATA) {
  const e = mdiff((r) => r.y, f);
  if (!e) { console.log(`  ${name.padEnd(22)}too few matched legs to stratify`); continue; }
  console.log(`  ${name.padEnd(22)}${pc(e.his)} vs ${pc(e.peers)}   ` +
    `${(e.d >= 0 ? "+" : "") + (e.d * 100).toFixed(1)}pts (${e.t.toFixed(1)}se) on ${e.n}`);
}
const cleanOnly = mdiff((r) => r.y, (r) => r.thin === 0);
const mediated = cleanOnly && cleanOnly.d < edge.d * 0.6;

console.log("\n=================== READING ===================");
console.log(`  Matched on p within +/-${CALIPER} on the same date, he beats the games beside him`);
console.log(`  by ${(edge.d * 100).toFixed(1)} pts (${edge.t.toFixed(1)}se) on ${edge.n} legs. The same legs against the whole slate come to`);
console.log(`  ${(sameLegsAllPeers.d * 100).toFixed(1)} pts, so holding p fixed ${bought >= 0 ? "does not reduce his edge at all" : "accounts for " + Math.abs(bought * 100).toFixed(1) + " pts of it"}.`);
console.log("");
if (!found.length) {
  console.log("  He looks IDENTICAL to his matched peers on every summary we record.");
  console.log("");
  console.log("  This is the informative null. The separation is not in our confidence score,");
  console.log("  not in check consensus, and not in how much data we had — so it cannot be");
  console.log("  recovered by reweighting those, and a ladder retune would only be picking");
  console.log("  games that already look the same to us. Read the factor table above for");
  console.log("  whether any INPUT separates them; if that is null too, the signal is not in");
  console.log("  the inputs we collect at all.");
} else {
  console.log("  These cleared the multiple-comparison bar:");
  for (const f of found)
    console.log(`    ${f.name}: his ${f.ma.toFixed(3)} vs peers ${f.mb.toFixed(3)} (t=${f.t.toFixed(2)}) — ${f.why}`);
  console.log("");
  if (mediated) {
    console.log(`  AND IT MEDIATES. Holding thin arms fixed cuts the edge from ` +
      `${(edge.d * 100).toFixed(1)} to ${(cleanOnly.d * 100).toFixed(1)} pts,`);
    console.log("  so this is a real part of the mechanism and is worth acting on. Confirm on a");
    console.log("  held-out stretch of dates first — one season, correlated features.");
  } else if (cleanOnly) {
    console.log(`  BUT IT DOES NOT EXPLAIN THE EDGE. Among games where the starters have full`);
    console.log(`  first-inning history — where he and his peers look the SAME on this feature —`);
    console.log(`  he still beats them by ${(cleanOnly.d * 100).toFixed(1)} pts (${cleanOnly.t.toFixed(1)}se) on ${cleanOnly.n} legs, essentially`);
    console.log(`  the whole ${(edge.d * 100).toFixed(1)}-pt advantage.`);
    console.log("");
    console.log("  So he does avoid thin-data games, and that habit is not where his money");
    console.log("  comes from. Tightening our confidence gate would copy the habit and none of");
    console.log("  the result — and it would cost volume, which is a real price for nothing.");
    console.log("  Worth stating separately: our own data does not even establish that thin-arm");
    console.log("  games are worse NRFI bets (4.3pt calibration miss vs clean games, t=1.5).");
  }
}
console.log("");
console.log("  Standing caveat on all of the above: this is a point-in-time re-score of past");
console.log("  slates, not a walk-forward test, while his record IS one. Live CLV on our own");
console.log("  picks remains the only clean comparison; this sizes the gap, it does not settle it.");
