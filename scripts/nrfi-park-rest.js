// Do park, pitcher rest and team travel carry any first-inning signal at all?
//
//   node scripts/nrfi-park-rest.js
//
// This measures BEFORE anything gets added to the model, because the last two
// candidate terms went opposite ways: pitcher rates survived (nrfi-pitreg-fit)
// and team offence did not (nrfi-offreg-fit measured its true spread as narrower
// than the sampling noise floor). A term that fails here would add noise with a
// story attached, and first-inning outcomes are mostly noise to begin with — a
// half-inning is ~4 batters, so raw group rates scatter widely on nothing.
//
// So every candidate is put through the same variance decomposition:
//
//   observed spread of group rates = true spread + binomial sampling noise
//
// If subtracting the noise term leaves nothing, the visible differences between
// parks (or rest days, or travel) are what random 4-batter samples look like,
// and there is no effect to model. Anything that survives is then checked
// walk-forward, since a split that only works in hindsight is not a signal.
//
// Everything reads scripts/nrfi-leakfree-games.json, which is 99.9% complete for
// 2025 and covers 2026 to date, so a pitcher's previous start and a team's
// previous game are both genuinely their previous ones rather than artefacts of
// a gappy cache.
const fs = require("fs");
const path = require("path");

const K = 75;                                  // NRFI_PIT_REG, as in nrfi-leakfree.js
const pc = (x) => (x * 100).toFixed(1) + "%";
const games = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-leakfree-games.json"), "utf8")).games;
games.sort((a, b) => a.date.localeCompare(b.date) || a.pk - b.pk);
const dayNum = (d) => Math.round(Date.parse(d + "T00:00:00Z") / 86400000);

// ---------------------------------------------------------------------------
// Baseline: the same walk-forward arm rates nrfi-leakfree.js uses. Park and rest
// have to be measured against what the pitchers already explain, or a park that
// happens to host good pitching gets credited for it.
// ---------------------------------------------------------------------------
const lgClean = games.reduce((s, g) => s + g.hpClean + g.apClean, 0) / (2 * games.length);
const arm = new Map();
const get = (id) => arm.get(id) || { n: 0, c: 0 };
// One row per half-inning: an arm, the venue it threw in, what it did, and what
// the pitcher-only model expected of it.
const halves = [];
for (const g of games) {
  const a = get(g.ap), h = get(g.hp);
  const pa = (a.c + lgClean * K) / (a.n + K);
  const ph = (h.c + lgClean * K) / (h.n + K);
  halves.push({ ...g, pit: g.hp, side: "home", pred: ph, obs: g.hpClean, prior: h.n });
  halves.push({ ...g, pit: g.ap, side: "away", pred: pa, obs: g.apClean, prior: a.n });
  arm.set(g.ap, { n: a.n + 1, c: a.c + g.apClean });
  arm.set(g.hp, { n: h.n + 1, c: h.c + g.hpClean });
}

/* The test that decides whether a split is real.
 *
 * Each group's observed rate is its true rate plus sampling error, and those add
 * in variance. The sampling part is computable: for a group of n Bernoulli draws
 * with success probability p, the variance of the observed mean is p(1-p)/n. So
 * average that across groups, subtract it from the observed variance of the
 * group means, and what remains estimates the spread that is actually there.
 *
 * Weighted by n, because a 40-game venue and a 400-game venue should not vote
 * equally. Groups below `min` are dropped rather than shrunk: they contribute
 * almost pure noise and their p(1-p)/n term is large enough to dominate the
 * correction it is supposed to make. */
function decompose(rows, key, min = 60) {
  const gs = new Map();
  for (const r of rows) {
    const k = key(r);
    if (k == null) continue;
    if (!gs.has(k)) gs.set(k, { n: 0, obs: 0, pred: 0 });
    const g = gs.get(k);
    g.n++; g.obs += r.obs; g.pred += r.pred;
  }
  const keep = [...gs.entries()].filter(([, g]) => g.n >= min);
  if (keep.length < 2) return null;
  const N = keep.reduce((s, [, g]) => s + g.n, 0);
  // Residual against the pitcher model, so a group is only credited with what
  // the arms in it did NOT already explain.
  const res = keep.map(([k, g]) => ({ k, n: g.n, d: (g.obs - g.pred) / g.n, p: g.pred / g.n }));
  const mean = res.reduce((s, r) => s + r.n * r.d, 0) / N;
  const obsVar = res.reduce((s, r) => s + r.n * (r.d - mean) ** 2, 0) / N;
  const noise = res.reduce((s, r) => s + r.n * (r.p * (1 - r.p) / r.n), 0) / N;
  const trueVar = obsVar - noise;
  return {
    groups: keep.length, N, res, mean,
    obsSd: Math.sqrt(obsVar),
    noiseSd: Math.sqrt(noise),
    trueSd: trueVar > 0 ? Math.sqrt(trueVar) : 0,
    signal: trueVar > 0,
  };
}

function report(label, d, show) {
  if (!d) { console.log(`  ${label}: too few groups to test\n`); return; }
  console.log(`  ${label}`);
  console.log(`    ${d.groups} groups, ${d.N} half-innings`);
  console.log(`    observed spread  ${(d.obsSd * 100).toFixed(2)}pp`);
  console.log(`    sampling noise   ${(d.noiseSd * 100).toFixed(2)}pp`);
  console.log(`    implied TRUE     ${(d.trueSd * 100).toFixed(2)}pp   ` +
    (d.signal ? "<- something is there" : "<- nothing above noise"));
  if (show) {
    const s = [...d.res].sort((a, b) => a.d - b.d);
    const line = (r) => `      ${String(r.k).padEnd(22)} n=${String(r.n).padStart(5)}  ${(r.d * 100 >= 0 ? "+" : "") + (r.d * 100).toFixed(1)}pp`;
    console.log("    most run-friendly:"); for (const r of s.slice(0, 3)) console.log(line(r));
    console.log("    most clean:");        for (const r of s.slice(-3).reverse()) console.log(line(r));
  }
  console.log("");
}

console.log("=================== CANDIDATE TERMS, MEASURED ===================");
console.log(`  ${games.length} games, ${halves.length} half-innings, league clean ${pc(lgClean)}`);
console.log("  Residuals are against the walk-forward pitcher model, so nothing here is");
console.log("  credited with pitching quality it did not cause.\n");

// --- Park ------------------------------------------------------------------
report("PARK (venue)", decompose(halves, (r) => r.venue), true);

// --- Pitcher rest ----------------------------------------------------------
// Days since this pitcher's previous start in the cache. A first start has no
// previous one and is excluded rather than guessed at.
{
  const last = new Map();
  for (const g of games) {
    for (const [pid, side] of [[g.hp, "home"], [g.ap, "away"]]) {
      const prev = last.get(pid);
      const d = dayNum(g.date);
      const h = halves.find((x) => x.pk === g.pk && x.side === side);
      if (prev != null) h.rest = d - prev;
      last.set(pid, d);
    }
  }
  const bucket = (r) => {
    if (r.rest == null) return null;
    if (r.rest <= 3) return "<=3 short";
    if (r.rest === 4) return "4 normal";
    if (r.rest === 5) return "5 normal";
    if (r.rest <= 7) return "6-7 extra";
    return "8+ long";
  };
  report("PITCHER REST (days since last start)", decompose(halves, bucket), true);
}

// --- Team rest and travel --------------------------------------------------
// The team BATTING in this half is the one whose legs matter: away bats vs the
// home starter, home bats vs the away starter.
{
  const lastGame = new Map();   // team -> { day, venue }
  for (const g of games) {
    const d = dayNum(g.date);
    for (const [team, side] of [[g.away, "home"], [g.home, "away"]]) {
      // side is the ARM's side; the batting team is the other one.
      const h = halves.find((x) => x.pk === g.pk && x.side === side);
      const prev = lastGame.get(team);
      if (prev) {
        h.tRest = d - prev.day;
        h.travel = prev.venue !== g.venue ? 1 : 0;
      }
    }
    lastGame.set(g.away, { day: d, venue: g.venue });
    lastGame.set(g.home, { day: d, venue: g.venue });
  }
  report("BATTING TEAM REST (days since their last game)", decompose(halves, (r) =>
    r.tRest == null ? null : r.tRest === 1 ? "1 back-to-back" : r.tRest === 2 ? "2 one off" : "3+ rested"), true);
  report("BATTING TEAM TRAVEL (venue changed since last game)", decompose(halves, (r) =>
    r.travel == null ? null : r.travel ? "traveled" : "same park"), true);
  // Travel is only interesting if it costs something when it is HARD, so the
  // sharpest version of it: a team playing the day after a game in another park.
  report("TRAVEL ON NO REST (new park, played yesterday)", decompose(halves, (r) =>
    r.tRest == null ? null : r.travel && r.tRest === 1 ? "traveled overnight" : "everything else"), true);
}

// ---------------------------------------------------------------------------
// Park survived the noise floor, so now the question that actually decides
// whether it belongs in the model: how much is left after it is shrunk by the
// right amount, and does it help out of sample?
//
// The shrinkage constant is not a tuning knob here, it is implied by the
// decomposition already computed. For a group mean, the weight on its own record
// is n / (n + k) with k = (per-observation noise variance) / (true variance).
// A term whose true spread is small relative to how noisy a half-inning is gets
// a large k, and a large k means the term barely moves anything no matter how
// dramatic its raw leaderboard looks.
// ---------------------------------------------------------------------------
{
  const park = decompose(halves, (r) => r.venue);
  const KPARK = Math.round(lgClean * (1 - lgClean) / (park.trueSd ** 2));
  console.log("=================== PARK, PROPERLY SHRUNK ===================");
  console.log(`  k = p(1-p)/trueVar = ${(lgClean * (1 - lgClean)).toFixed(3)}/${(park.trueSd ** 2).toFixed(6)} = ${KPARK} half-innings`);
  const perPark = Math.round(park.N / park.groups);
  console.log(`  a venue accumulates ~${perPark} half-innings across this whole sample, so it is`);
  console.log(`  worth ${pc(perPark / (perPark + KPARK))} of its own observed residual and ${pc(KPARK / (perPark + KPARK))} league average.\n`);

  // Walk forward: a game's park adjustment uses only earlier games at that park.
  const acc = new Map();
  const clamp = (p) => Math.min(0.98, Math.max(0.02, p));
  const scored = [];
  for (let i = 0; i < halves.length; i += 2) {
    const H = halves[i], A = halves[i + 1];        // pushed home-arm then away-arm
    const v = acc.get(H.venue) || { n: 0, d: 0 };
    const adj = v.d / (v.n + KPARK);
    scored.push({
      nrfi: H.obs && A.obs ? 1 : 0,
      base: clamp(H.pred) * clamp(A.pred),
      park: clamp(H.pred + adj) * clamp(A.pred + adj),
    });
    acc.set(H.venue, { n: v.n + 2, d: v.d + (H.obs - H.pred) + (A.obs - A.pred) });
  }
  const br = (f) => scored.reduce((s, r) => { const d = f(r) - r.nrfi; return s + d * d; }, 0) / scored.length;
  console.log(`  over all ${scored.length} games, walk-forward:`);
  console.log(`    pitcher arms only     ${br((r) => r.base).toFixed(5)}`);
  console.log(`    arms + park           ${br((r) => r.park).toFixed(5)}`);
  const delta = br((r) => r.base) - br((r) => r.park);
  console.log(`    difference            ${(delta >= 0 ? "+" : "") + delta.toFixed(5)}   ` +
    (delta > 0 ? "park helps" : "park hurts"));
  const moved = scored.reduce((s, r) => s + Math.abs(r.park - r.base), 0) / scored.length;
  console.log(`    mean |change| to P(NRFI)  ${(moved * 100).toFixed(2)}pp\n`);
}

console.log("=================== WHAT THIS MEANS ===================");
console.log("  A term only earns a place in the model if its implied TRUE spread is");
console.log("  clearly above zero. Anything reading 0.00pp is a split that looks real on");
console.log("  a leaderboard and is entirely sampling scatter — the same verdict team");
console.log("  offence got, and the reason it is not in nrfi-leakfree.js.");
