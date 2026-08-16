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

// --- Batting team offence --------------------------------------------------
/* Explicitly re-tested, not assumed dead.
 *
 * nrfi-offreg-fit.js rejected team offence, but that ran on a season and a half,
 * and park shows what that can hide: park's implied true spread rose from 1.10pp
 * to 1.30pp when the sample went from 1.5 seasons to 6, because the noise term
 * shrinks with n while the true term does not. A rejection at low power is not a
 * finding, so the same term gets asked again with four times the data.
 *
 * Two versions, because they answer different questions. Team identity pooled
 * across six years asks whether some franchises are persistently better at
 * scoring in the first; team-season asks whether a given year's roster is,
 * which is what would actually be usable in-season. The pooled version has more
 * data per group but blurs across roster turnover. */
{
  const bat = (r) => (r.side === "home" ? r.away : r.home);
  report("BATTING TEAM (offence, pooled over seasons)", decompose(halves, bat), true);
  report("BATTING TEAM-SEASON (offence, that year's roster)",
    decompose(halves, (r) => bat(r) + ":" + r.season), false);
}

// --- Home field ------------------------------------------------------------
// Only two groups, but it is free to ask and it is the one split where a real
// effect would be structural rather than a story: the home team bats second, so
// its half of the first can be shaped by what already happened in the top.
report("PITCHING SIDE (home arm vs away arm)", decompose(halves, (r) => r.side + " arm"), true);

// --- Time of season --------------------------------------------------------
// Cold April air does not carry, and pitchers are less stretched out. Those pull
// in opposite directions, which is exactly why it is worth measuring rather than
// reasoning about.
report("MONTH", decompose(halves, (r) => r.date.slice(5, 7)), true);

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
  const kOf = (d) => Math.round(lgClean * (1 - lgClean) / (d.trueSd ** 2));
  const park = decompose(halves, (r) => r.venue);
  const bat = (r) => (r.side === "home" ? r.away : r.home);
  const team = decompose(halves, bat);
  const KPARK = kOf(park), KTEAM = kOf(team);
  const weight = (d, k) => { const per = Math.round(d.N / d.groups); return `~${per} half-innings -> ${pc(per / (per + k))} own record`; };

  console.log("=================== SHRINKAGE, DERIVED NOT TUNED ===================");
  console.log("  k = per-observation noise variance / true variance, both already measured");
  console.log("  above. It is not a free parameter, so it is not tuned here.\n");
  console.log(`  park          k=${String(KPARK).padStart(4)}   ${weight(park, KPARK)}`);
  console.log(`  batting team  k=${String(KTEAM).padStart(4)}   ${weight(team, KTEAM)}\n`);

  /* Walk forward, adding one term at a time so each is charged only for what it
   * contributes on top of the ones before it. Everything uses strictly earlier
   * games, including the home/away split, which is accumulated rather than taken
   * as a constant so it cannot borrow from the future either. */
  const clamp = (p) => Math.min(0.98, Math.max(0.02, p));
  const acc = new Map(), tacc = new Map();
  let hN = 0, hC = 0, aN = 0, aC = 0;
  const scored = [];
  for (let i = 0; i < halves.length; i += 2) {
    const H = halves[i], A = halves[i + 1];        // pushed home-arm then away-arm
    const v = acc.get(H.venue) || { n: 0, d: 0 };
    const adj = v.d / (v.n + KPARK);
    // Side offset: how much cleaner a home arm runs than the league, and an away
    // arm, from games already played. Needs a real sample before it says anything.
    const sH = hN > 200 ? hC / hN - lgClean : 0;
    const sA = aN > 200 ? aC / aN - lgClean : 0;
    // Offence attaches to the arm FACING that team: the away team bats against
    // the home arm, the home team against the away arm.
    const tA = tacc.get(H.away) || { n: 0, d: 0 };   // away bats vs home arm
    const tH = tacc.get(A.home) || { n: 0, d: 0 };   // home bats vs away arm
    const oH = tA.d / (tA.n + KTEAM), oA = tH.d / (tH.n + KTEAM);
    const mk = (h, a) => clamp(h) * clamp(a);
    scored.push({
      nrfi: H.obs && A.obs ? 1 : 0,
      base: mk(H.pred, A.pred),
      park: mk(H.pred + adj, A.pred + adj),
      side: mk(H.pred + sH, A.pred + sA),
      all: mk(H.pred + adj + sH + oH, A.pred + adj + sA + oA),
      mat: H.prior >= 20 && A.prior >= 20,
    });
    acc.set(H.venue, { n: v.n + 2, d: v.d + (H.obs - H.pred) + (A.obs - A.pred) });
    tacc.set(H.away, { n: tA.n + 1, d: tA.d + (H.obs - H.pred) });
    tacc.set(A.home, { n: tH.n + 1, d: tH.d + (A.obs - A.pred) });
    hN++; hC += H.obs; aN++; aC += A.obs;
  }
  const br = (f) => scored.reduce((s, r) => { const d = f(r) - r.nrfi; return s + d * d; }, 0) / scored.length;
  const b0 = br((r) => r.base);
  const row = (name, f) => {
    const b = br(f), d = b0 - b;
    const moved = scored.reduce((s, r) => s + Math.abs(f(r) - r.base), 0) / scored.length;
    console.log(`    ${name.padEnd(24)} ${b.toFixed(5)}   ${((d >= 0 ? "+" : "") + d.toFixed(5)).padStart(9)}   ${(moved * 100).toFixed(2)}pp`);
  };
  console.log("=================== WALK-FORWARD, ONE TERM AT A TIME ===================");
  console.log(`  over all ${scored.length} games`);
  console.log("    model                       Brier   vs base   mean |move|");
  row("pitcher arms only", (r) => r.base);
  row("+ park", (r) => r.park);
  row("+ home/away side", (r) => r.side);
  row("+ park, side, offence", (r) => r.all);
  /* Read that table carefully, because the obvious conclusion is wrong.
   *
   * The side term makes the model WORSE despite being the largest and cleanest
   * effect measured anywhere in this file (2.20pp true spread against 0.38pp of
   * noise). That is not a contradiction, it is the independence assumption
   * failing, and the arithmetic shows it exactly:
   *
   *   correct marginals   0.729 * 0.684 = 49.9%
   *   pooled mean squared 0.711^2       = 50.6%
   *   actual NRFI                         50.7%
   *
   * Multiplying two CORRECT numbers gives the wrong answer, and multiplying two
   * wrong ones gives the right answer. So P(both halves clean) is not the product
   * of the halves — they are positively correlated, because game-level conditions
   * (weather, the umpire's zone, the ball) push both the same way at once. The
   * pooled mean was silently absorbing that correlation, and splitting it by side
   * removed the compensation while adding nothing that discriminates between
   * games: the side offset is the same every game.
   *
   * The fix is not to drop the term, it is to stop pretending the product is
   * calibrated. A walk-forward logistic recalibration on logit(p) can absorb both
   * the correlation and any residual bias, and unlike the raw product it is
   * allowed to learn that the model's spread is too narrow or too wide. */
  const lgt = (x) => Math.log(x / (1 - x));
  function platt(rows) {
    let a = 0, b = 1;
    for (let it = 0; it < 60; it++) {
      let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
      for (const r of rows) {
        const x = lgt(r.p), mu = 1 / (1 + Math.exp(-(a + b * x))), w = mu * (1 - mu), d = r.y - mu;
        g0 += d; g1 += d * x; h00 += w; h01 += w * x; h11 += w * x * x;
      }
      const det = h00 * h11 - h01 * h01;
      if (!(Math.abs(det) > 1e-12)) break;
      a += (h11 * g0 - h01 * g1) / det;
      b += (h00 * g1 - h01 * g0) / det;
    }
    return { a, b };
  }
  /* Refit every 250 games on everything before the current block, so a game is
   * always scored by a calibration that has not seen it. The first block has no
   * history and is left uncalibrated rather than guessed at. */
  const STEP = 250, WARM = 1000;
  const calibrated = (pick) => {
    const out = [];
    let cal = null;
    for (let i = 0; i < scored.length; i++) {
      if (i >= WARM && i % STEP === 0) {
        cal = platt(scored.slice(0, i).map((r) => ({ p: pick(r), y: r.nrfi })));
      }
      const p = pick(r_at(i));
      out.push(cal ? 1 / (1 + Math.exp(-(cal.a + cal.b * lgt(p)))) : p);
    }
    return out;
  };
  const r_at = (i) => scored[i];
  const brV = (v) => v.reduce((s, x, i) => { const d = x - scored[i].nrfi; return s + d * d; }, 0) / v.length;
  console.log("=================== WITH WALK-FORWARD CALIBRATION ===================");
  console.log("    model                       Brier   vs raw");
  for (const [name, pick] of [["pitcher arms only", (r) => r.base], ["+ park", (r) => r.park],
    ["+ home/away side", (r) => r.side], ["+ park, side, offence", (r) => r.all]]) {
    const raw = br(pick), c = brV(calibrated(pick));
    console.log(`    ${name.padEnd(24)} ${c.toFixed(5)}   ${((raw - c >= 0 ? "+" : "") + (raw - c).toFixed(5)).padStart(9)}`);
  }
  /* Split by whether the model actually knew anything yet.
   *
   * A walk-forward model spends its first season saying the league mean, because
   * every arm starts at zero prior starts and k=75 pins it there. Those games are
   * not evidence about the model, they are evidence about the base rate, and
   * pooling them drags every number toward "no better than 50.7%". The Kalshi
   * window is entirely mature games, which is why it reads so much better. */
  const mature = scored.filter((r) => r.mat);
  const brM = (pick) => mature.reduce((s, r) => { const d = pick(r) - r.nrfi; return s + d * d; }, 0) / mature.length;
  const mBase = mature.reduce((s, r) => s + r.nrfi, 0) / mature.length;
  console.log("=================== MATURE GAMES ONLY (both arms 20+ prior starts) ===================");
  console.log(`  ${mature.length} of ${scored.length} games, base rate ${pc(mBase)}`);
  console.log(`    base rate                ${(mBase * (1 - mBase)).toFixed(5)}`);
  for (const [name, pick] of [["pitcher arms only", (r) => r.base], ["+ park", (r) => r.park],
    ["+ home/away side", (r) => r.side], ["+ park, side, offence", (r) => r.all]]) {
    console.log(`    ${name.padEnd(24)} ${brM(pick).toFixed(5)}`);
  }
  const matCal = platt(mature.map((r) => ({ p: r.all, y: r.nrfi })));
  console.log(`\n  calibration on mature games: logit(p') = ${matCal.a.toFixed(3)} + ${matCal.b.toFixed(3)}*logit(p)`);
  console.log(`    calibrated               ${mature.reduce((s, r) => { const q = 1 / (1 + Math.exp(-(matCal.a + matCal.b * lgt(r.all)))); const d = q - r.nrfi; return s + d * d; }, 0) / mature.length}\n`);

  const fin = platt(scored.map((r) => ({ p: r.all, y: r.nrfi })));
  console.log(`\n  full-sample calibration of the complete model: logit(p') = ${fin.a.toFixed(3)} + ${fin.b.toFixed(3)}*logit(p)`);
  console.log("  A slope above 1 would mean the model is too timid and its spread should be");
  console.log("  stretched; below 1, too confident. The intercept is the correlation bias");
  console.log("  the product cannot represent.\n");
}

console.log("=================== WHAT THIS MEANS ===================");
console.log("  A term only earns a place in the model if its implied TRUE spread is");
console.log("  clearly above zero. Anything reading 0.00pp is a split that looks real on");
console.log("  a leaderboard and is entirely sampling scatter — the same verdict team");
console.log("  offence got, and the reason it is not in nrfi-leakfree.js.");
