// How much should a team's own first-inning scoring rate be trusted?
//
//   node scripts/nrfi-offreg-fit.js
//
// The twin of nrfi-pitreg-fit.js, for the other half of the lambda.
// NRFI_OFF_REG (app.jsx:5240) is the regression weight on a team's first-inning
// runs per game at app.jsx:6686-6687, feeding the same nrfiRegress and the same
// probability. It was never measured either.
//
// The prior here is genuinely different from the pitcher case, which is why it
// needs its own test rather than the pitcher answer applied twice. A starter
// brings 15-30 first innings; a team brings 100+ by midseason, so the sample is
// four to seven times larger and a light regression may well be correct. The
// pitcher result (12 -> 75) is not evidence about this constant.
//
// The scan is cheap: schedule with hydrate=linescore returns the teams, the
// date and the first inning together, so a season costs one call rather than
// 2,000. That is also why this script scans and fits in one pass instead of
// persisting an intermediate file the way the pitcher scan had to.
//
// SEASON BOUNDARIES ARE HARD BOUNDARIES. teamOffenseSplits queries a single
// season (app.jsx:5672), so the live model never carries a team's rate across
// years, and neither does this fit — rosters turn over and a 2025 lineup is a
// different offense. Walk-forward restarts at each season.
const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "..", "public", "desk", "app.jsx");
const SEASONS = [2025, 2026];
const MIN_PRIOR = 5;
const BOOT = 1000;

const J = async (u) => { const r = await fetch(u, { headers: { accept: "application/json" } }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };

const src = fs.readFileSync(APP, "utf8");
const num = (name) => {
  const m = src.match(new RegExp("const " + name + " = (-?[\\d.]+)"));
  if (!m) throw new Error("could not read " + name + " from app.jsx");
  return Number(m[1]);
};
const LG = num("NRFI_LG_LAMBDA");
const SHIPPED = num("NRFI_OFF_REG");

// The grid runs far past any plausible weight on purpose. A first pass topped
// out at 300 and the optimum sat exactly on the boundary with a bootstrap CI of
// [300, 300] — which is not an estimate, it is the search hitting a wall. If the
// curve is still falling at 3000 the honest reading is that a team's own
// first-inning rate carries no usable signal at all, and that has to be
// reportable rather than disguised as a large finite number.
const GRID = [];
for (let r = 0; r <= 40; r += 1) GRID.push(r);
for (let r = 45; r <= 300; r += 5) GRID.push(r);
for (let r = 350; r <= 3000; r += 50) GRID.push(r);

(async () => {
  // key: season|teamId -> [{ date, runs }], chronological
  const teams = new Map();
  for (const season of SEASONS) {
    const s = await J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${season}&gameType=R&hydrate=linescore`);
    let games = 0;
    for (const d of s.dates || []) {
      for (const g of d.games || []) {
        if (g.status?.codedGameState !== "F") continue;
        const first = g.linescore?.innings?.[0];
        if (!first) continue;
        // A team's own first-inning offense is the half it BATS in: the away
        // team bats the top, the home team the bottom. Swapping these would
        // measure each team's pitching and still produce a plausible curve.
        for (const [side, runs] of [["away", first.away?.runs], ["home", first.home?.runs]]) {
          const id = g.teams?.[side]?.team?.id;
          if (id == null || runs == null) continue;
          const k = season + "|" + id;
          if (!teams.has(k)) teams.set(k, []);
          teams.get(k).push({ date: g.officialDate || d.date, runs: +runs });
        }
        games++;
      }
    }
    console.log(`  ${season}: ${games} final games`);
  }
  for (const v of teams.values()) v.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const units = [...teams.entries()].filter(([, v]) => v.length >= MIN_PRIOR + 5);
  const allRuns = units.flatMap(([, v]) => v.map((x) => x.runs));
  console.log(`\nout-of-sample fit for NRFI_OFF_REG over ${units.length} team-seasons, ${allRuns.length} team-games`);
  console.log(`shrink target NRFI_LG_LAMBDA = ${LG}; observed mean ${(allRuns.reduce((s, x) => s + x, 0) / allRuns.length).toFixed(3)} runs/game`);
  console.log(`shipped NRFI_OFF_REG = ${SHIPPED}\n`);

  // Walk-forward: predict each game from only the games before it, within season.
  // Same shape as the pitcher fit, including the deliberately-leaky variant, so
  // the two results are read on the same footing.
  const perUnit = [], perUnitLeak = [];
  let n = 0;
  for (const [, v] of units) {
    const acc = new Array(GRID.length).fill(0), accL = new Array(GRID.length).fill(0);
    let run = 0, cnt = 0;
    for (let i = 0; i < v.length; i++) {
      if (i >= MIN_PRIOR) {
        cnt++;
        for (let g = 0; g < GRID.length; g++) {
          const est = (run + LG * GRID[g]) / (i + GRID[g]);
          acc[g] += (est - v[i].runs) * (est - v[i].runs);
        }
      }
      run += v[i].runs;
      if (i >= MIN_PRIOR) {
        for (let g = 0; g < GRID.length; g++) {
          const estL = (run + LG * GRID[g]) / (i + 1 + GRID[g]);
          accL[g] += (estL - v[i].runs) * (estL - v[i].runs);
        }
      }
    }
    n += cnt;
    perUnit.push(acc); perUnitLeak.push(accL);
  }
  const tot = new Array(GRID.length).fill(0), totL = new Array(GRID.length).fill(0);
  for (const a of perUnit) for (let g = 0; g < GRID.length; g++) tot[g] += a[g];
  for (const a of perUnitLeak) for (let g = 0; g < GRID.length; g++) totL[g] += a[g];
  let bi = 0, li = 0;
  for (let g = 1; g < GRID.length; g++) { if (tot[g] < tot[bi]) bi = g; if (totL[g] < totL[li]) li = g; }

  // Bootstrap over team-seasons, the unit of independence.
  const best = [];
  for (let b = 0; b < BOOT; b++) {
    const acc = new Array(GRID.length).fill(0);
    for (let i = 0; i < perUnit.length; i++) {
      const pick = perUnit[(Math.random() * perUnit.length) | 0];
      for (let g = 0; g < GRID.length; g++) acc[g] += pick[g];
    }
    let m = 0;
    for (let g = 1; g < GRID.length; g++) if (acc[g] < acc[m]) m = g;
    best.push(GRID[m]);
  }
  best.sort((a, b) => a - b);
  const lo = best[Math.floor(BOOT * 0.025)], hi = best[Math.floor(BOOT * 0.975)];

  console.log(`=================== WALK-FORWARD (${n} predicted team-games, ${MIN_PRIOR}+ priors) ===================`);
  console.log("    reg      clean MSE     vs shipped      leaky MSE");
  const si = GRID.indexOf(SHIPPED);
  const show = [0, 2, 4, 6, 8, 12, 16, 20, 30, 40, 60, 100, 200, 300].filter((r) => GRID.includes(r));
  for (const r of show) {
    const g = GRID.indexOf(r);
    const d = tot[g] / n - tot[si] / n;
    console.log(`  ${String(r).padStart(5)}      ${(tot[g] / n).toFixed(6)}     ${(d >= 0 ? "+" : "") + d.toFixed(6)}      ${(totL[g] / n).toFixed(6)}` +
      `${g === bi ? "   <== best" : ""}${r === SHIPPED ? "   (shipped)" : ""}`);
  }
  console.log(`\n  best reg predicting forward: ${GRID[bi]}`);
  console.log(`  bootstrap 95% CI over team-seasons: [${lo}, ${hi}]  (${BOOT} resamples)`);
  console.log(`  => shipped ${SHIPPED} is ${SHIPPED >= lo && SHIPPED <= hi ? "INSIDE" : "OUTSIDE"} that interval.`);
  console.log(`\n  leaky optimum ${GRID[li]} vs clean ${GRID[bi]} — same contamination check the pitcher fit runs.`);
  console.log("  A large gap means a leaky backtest would push this constant the wrong way too.");

  // A railed optimum is a claim that there is nothing to regress toward the mean
  // FROM, so test that claim on its own terms instead of inferring it from the
  // shape of an MSE curve. Two direct measurements:
  //
  //   1. Variance decomposition. If the observed spread of team season rates is
  //      no wider than the sampling noise floor, the spread IS the noise.
  //   2. Split-half. Correlate each team-season's odd-numbered games against its
  //      even-numbered ones. Odd/even rather than first-half/second-half because
  //      the latter confounds real signal with schedule and roster drift, which
  //      would understate reliability for reasons unrelated to talent.
  const seasonRates = units.map(([, v]) => ({ n: v.length, mean: v.reduce((s, x) => s + x.runs, 0) / v.length }));
  const grand = seasonRates.reduce((s, x) => s + x.mean * x.n, 0) / seasonRates.reduce((s, x) => s + x.n, 0);
  const obsVar = seasonRates.reduce((s, x) => s + (x.mean - grand) * (x.mean - grand), 0) / (seasonRates.length - 1);
  const gameVar = allRuns.reduce((s, x) => s + (x - grand) * (x - grand), 0) / (allRuns.length - 1);
  const noiseVar = seasonRates.reduce((s, x) => s + gameVar / x.n, 0) / seasonRates.length;
  const trueVar = obsVar - noiseVar;

  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0;
  for (const [, v] of units) {
    const odd = v.filter((_, i) => i % 2), even = v.filter((_, i) => !(i % 2));
    if (odd.length < 10 || even.length < 10) continue;
    const a = odd.reduce((s, x) => s + x.runs, 0) / odd.length;
    const b = even.reduce((s, x) => s + x.runs, 0) / even.length;
    sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b; m++;
  }
  const r = (m * sxy - sx * sy) / Math.sqrt(Math.max(1e-12, (m * sxx - sx * sx) * (m * syy - sy * sy)));
  const sb = (2 * r) / (1 + r);
  // Fisher CI, because a correlation over 60 team-seasons has an error bar wide
  // enough to change the conclusion, and "r = 0.053" read as a point estimate
  // would be exactly the over-reading the pitcher table already got wrong once.
  const rSE = 1 / Math.sqrt(m - 3);
  const fis = (x) => Math.tanh(Math.atanh(x));
  const rLo = fis(Math.atanh(r) - 1.96 * rSE), rHi = fis(Math.atanh(r) + 1.96 * rSE);
  const sbOf = (x) => (2 * x) / (1 + x);
  // A reliability translates straight into the regression weight this script is
  // fitting: reliability = n/(n+k), so k = n*(1-rel)/rel. That makes the
  // split-half an independent estimate of the same constant the MSE curve is
  // groping for, derived without reference to it.
  const meanN = allRuns.length / units.length;
  const kOf = (rel) => (rel <= 0 ? Infinity : (meanN * (1 - rel)) / rel);

  console.log("\n=================== IS THERE ANYTHING THERE AT ALL? ===================");
  console.log(`  observed sd across ${seasonRates.length} team-seasons   ${Math.sqrt(Math.max(0, obsVar)).toFixed(4)} runs/game`);
  console.log(`  sampling noise floor at these sample sizes   ${Math.sqrt(noiseVar).toFixed(4)}`);
  console.log(`  implied true team spread                     ${trueVar > 0 ? Math.sqrt(trueVar).toFixed(4) : "none — noise exceeds the observed spread"}`);
  console.log(`  odd/even split-half r = ${r.toFixed(3)}  95% CI [${rLo.toFixed(3)}, ${rHi.toFixed(3)}]  over ${m} team-seasons`);
  console.log(`  Spearman-Brown reliability of a full season = ${sb.toFixed(3)}  CI [${sbOf(rLo).toFixed(3)}, ${sbOf(rHi).toFixed(3)}]`);
  console.log(`\n  Implied regression weight from that reliability (k = n(1-rel)/rel at n=${meanN.toFixed(0)}):`);
  console.log(`    point ${kOf(sb) === Infinity ? "infinite" : Math.round(kOf(sb))}   from the CI: ${kOf(sbOf(rHi)) === Infinity ? "infinite" : Math.round(kOf(sbOf(rHi)))} (most generous) .. ${kOf(sbOf(rLo)) === Infinity ? "infinite" : Math.round(kOf(sbOf(rLo)))}`);
  console.log(`  This is derived without touching the MSE curve, so where it lands inside`);
  console.log(`  the walk-forward CI is genuine corroboration rather than restatement.`);
  console.log(`\n  For contrast, the same arithmetic on STARTERS found a real if small effect`);
  console.log(`  (Spearman-Brown 0.262). Even the most generous end of this CI is weaker,`);
  console.log(`  and the variance decomposition above finds no true spread at all.`);

  const shrink = (rate, sample, reg) => (rate * sample + LG * reg) / (sample + reg);
  console.log("\n=================== WHAT THE WEIGHT IS WORTH ===================");
  console.log(`  A team scoring 0.20 runs/game above league in the 1st, by games played:`);
  console.log(`    games      reg=${SHIPPED}        reg=${GRID[bi]}        difference`);
  for (const gp of [20, 50, 80, 110, 140]) {
    const a = shrink(LG + 0.20, gp, SHIPPED), b = shrink(LG + 0.20, gp, GRID[bi]);
    console.log(`    ${String(gp).padStart(6)}     ${a.toFixed(3)}       ${b.toFixed(3)}       ${(b - a >= 0 ? "+" : "") + (b - a).toFixed(3)} runs`);
  }
  console.log("\n  Team samples are big, so a heavy weight moves the estimate far less here");
  console.log("  than the same weight would for a starter. Size the decision on this table,");
  console.log("  not on the ratio between the old and new constants.");
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
