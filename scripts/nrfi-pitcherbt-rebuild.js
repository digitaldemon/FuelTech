// Rebuild PITCHER_BT's tier bands from the real distribution.
//
//   node scripts/nrfi-pitcherbt-rebuild.js
//
// Why the bands and not just the numbers: nrfi-pitcherbt-audit.js found the
// table wrong by a mean 19.7pp, but the shape of the error is the finding. Drift
// by tier is monotone — elite +8.8pp, sharp +13.7, leaky +29.4, danger +34.7 —
// and for the bottom three tiers the signed error EQUALS the absolute error, so
// all 32 of those rows are wrong in the same direction. Aging drifts both ways.
//
// The arithmetic explains it. League clean-first-inning rate is roughly 70%, so
// the table's "danger, under 30% clean" band describes a pitcher about four
// standard deviations below average, and the table lists fourteen of them. Those
// rows do not describe real pitchers, so correcting the literals while keeping
// the bands would just refill an impossible bucket. The bands have to come from
// the distribution.
//
// One feed/live call per game yields both starters and the first inning, so the
// whole season is one pass. The away starter defends the BOTTOM half, so his
// first inning is the home team's runs, and vice versa.
const fs = require("fs");
const path = require("path");
const { mapLimit } = require("./nrfi-model-lib");

const FIELDS = "gameData,players,id,fullName,liveData,linescore,innings,num,away,home,runs,boxscore,teams,pitchers";
const OUT = path.join(__dirname, "nrfi-pitcherbt-dist.json");
// Per-start outcomes, written separately to keep OUT readable. This scan costs
// 4,274 API calls, so it persists the raw starts rather than only the summary —
// the next question about first innings should not require re-fetching them.
const STARTS = path.join(__dirname, "nrfi-pitcherbt-starts.json");
const MIN_STARTS = 10;
// Two seasons, not one. Reliability is the binding constraint on this table:
// a beta-binomial fit to 2026 alone puts a 14-start sample at 0.19, meaning four
// fifths of what it measures is noise. Reliability rises as n/(n+k), so doubling
// the starts is worth far more than any cleverness applied to one season.
const SEASONS = [2025, 2026];

const J = async (u) => { const r = await fetch(u, { headers: { accept: "application/json" } }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };

function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

// Final regular-season games only. gameType=R excludes spring and postseason,
// where rotations and lineups do not describe the season being modelled.
async function seasonPks(season) {
  const s = await J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${season}&gameType=R&fields=dates,games,gamePk,status,codedGameState`);
  return (s.dates || []).flatMap((d) => d.games || [])
    .filter((g) => g.status?.codedGameState === "F").map((g) => g.gamePk);
}

(async () => {
  const perSeason = await Promise.all(SEASONS.map(seasonPks));
  SEASONS.forEach((s, i) => console.log(`  ${s}: ${perSeason[i].length} final games`));
  const pks = [...new Set(perSeason.flat())];
  console.log(`scanning ${pks.length} games across ${SEASONS.join("+")} for starter first innings...`);

  const arms = new Map(); // id -> { name, starts, clean }
  let done = 0, skipped = 0;
  await mapLimit(pks, 8, async (pk) => {
    let j = null;
    try { j = await J(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live?fields=${FIELDS}`); } catch { skipped++; return; }
    const t = j.liveData?.boxscore?.teams, first = j.liveData?.linescore?.innings?.[0];
    if (!t || !first) { skipped++; return; }
    const players = j.gameData?.players || {};
    // away starter defends the bottom half (home runs); home starter the top.
    for (const [side, oppRuns] of [["away", first.home?.runs], ["home", first.away?.runs]]) {
      const id = t[side]?.pitchers?.[0];
      if (id == null || oppRuns == null) continue;
      const rec = arms.get(id) || { name: players["ID" + id]?.fullName || String(id), starts: 0, clean: 0, log: [] };
      rec.starts++;
      if (+oppRuns === 0) rec.clean++;
      // Keep the per-start sequence, not just the total. The totals cannot
      // distinguish a real skill spread from binomial noise; a split-half
      // correlation on these outcomes can, and that is the question that decides
      // whether this table is worth rebuilding at all.
      //
      // `runs` is kept alongside `clean` because NRFI_PIT_REG regresses the run
      // RATE rather than the clean share, and testing that constant out of
      // sample needs the runs — collapsing to a bit here would mean re-fetching
      // 4,274 games to ask the next question.
      rec.log.push({ pk, clean: +oppRuns === 0 ? 1 : 0, runs: +oppRuns });
      arms.set(id, rec);
    }
    if (++done % 200 === 0) process.stderr.write(`  ${done}/${pks.length}\n`);
  });

  const all = [...arms.values()];
  const qualified = all.filter((a) => a.starts >= MIN_STARTS).map((a) => ({ ...a, rate: (a.clean * 100) / a.starts }));
  qualified.sort((a, b) => a.rate - b.rate);
  const rates = qualified.map((a) => a.rate);
  const leagueClean = (all.reduce((s, a) => s + a.clean, 0) * 100) / Math.max(1, all.reduce((s, a) => s + a.starts, 0));

  console.log(`\n${all.length} starters seen, ${qualified.length} with >=${MIN_STARTS} starts, ${skipped} games skipped.`);
  console.log(`league clean-1st rate: ${leagueClean.toFixed(1)}%  (so a first inning scores ${(100 - leagueClean).toFixed(1)}% of the time)`);
  console.log("\n=== DISTRIBUTION OF CLEAN-1st RATE AMONG QUALIFIED STARTERS ===");
  for (const p of [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]) {
    console.log(`  p${String(p * 100).padStart(2)}  ${pct(rates, p).toFixed(1)}%`);
  }
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const sd = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length);
  console.log(`  mean ${mean.toFixed(1)}%, sd ${sd.toFixed(1)}pp`);
  console.log(`\n  For reference the shipped table's bands are elite >=70, sharp 65-69, leaky 30-35, danger <30.`);
  console.log(`  A 30% clean starter sits ${((mean - 30) / sd).toFixed(1)} sd below the mean — which is why that bucket cannot be filled honestly.`);

  // ── IS THERE ANYTHING HERE TO RANK? ──────────────────────────────────────
  //
  // The obvious move is to cut bands at percentiles of the observed rates. That
  // is wrong if the observed spread is mostly sampling noise, because then the
  // top decile is the luckiest tenth rather than the best tenth, and a band
  // built on it will not repeat. A starter has ~14 first innings on file. At the
  // league rate that is a binomial with a standard deviation near 12pp all by
  // itself — comparable to the 14pp spread actually observed. So the spread has
  // to be decomposed before any band is drawn on it.
  const p = leagueClean / 100;
  const obsVar = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
  const sampVar = qualified.reduce((a, x) => a + (p * (1 - p) * 1e4) / x.starts, 0) / qualified.length;
  const talentVar = Math.max(0, obsVar - sampVar);
  const crudeRel = obsVar > 0 ? talentVar / obsVar : 0;

  console.log("\n=== HOW MUCH OF THIS SPREAD IS REAL? ===");
  console.log(`  observed variance   ${obsVar.toFixed(1).padStart(6)} pp^2  (sd ${Math.sqrt(obsVar).toFixed(1)}pp)`);
  console.log(`  binomial sampling   ${sampVar.toFixed(1).padStart(6)} pp^2  (sd ${Math.sqrt(sampVar).toFixed(1)}pp)  <- noise floor at these start counts`);
  console.log(`  true talent         ${talentVar.toFixed(1).padStart(6)} pp^2  (sd ${Math.sqrt(talentVar).toFixed(1)}pp)`);
  console.log(`  crude reliability   ${crudeRel.toFixed(3)}  => ${((1 - crudeRel) * 100).toFixed(0)}% of the observed spread is noise`);
  console.log("  (crude because it charges every arm the same p(1-p) noise floor; a 90% arm is");
  console.log("   quieter than a 50% one, so this overstates noise. The ML fit below fixes that.)");

  // The principled version: fit Beta(mu*k, (1-mu)*k) as the distribution of TRUE
  // rates by maximum likelihood over the beta-binomial, which prices each arm's
  // noise at his own p and his own start count. k is the concentration, and it
  // has a direct reading: an arm's estimate is his record weighted n/(n+k)
  // against league average weighted k/(n+k). So k is literally "how many starts
  // of evidence it takes before a pitcher has told you half of his own story".
  const lgamma = (z) => {
    const g = 7, C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1; let x = C[0];
    for (let i = 1; i < g + 2; i++) x += C[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  };
  const logLik = (mu, k) => {
    const a = mu * k, b = (1 - mu) * k, base = lgamma(a) + lgamma(b) - lgamma(a + b);
    let s = 0;
    for (const x of qualified) s += lgamma(x.clean + a) + lgamma(x.starts - x.clean + b) - lgamma(x.starts + a + b) - base;
    return s;
  };
  let fit = { ll: -Infinity, mu: p, k: 50 };
  for (let mu = 0.55; mu <= 0.88; mu += 0.002) {
    for (let lk = Math.log(2); lk <= Math.log(2000); lk += 0.02) {
      const k = Math.exp(lk), v = logLik(mu, k);
      if (v > fit.ll) fit = { ll: v, mu, k };
    }
  }
  const { mu: fMu, k: fK } = fit;
  const priorSd = Math.sqrt((fMu * (1 - fMu)) / (fK + 1)) * 100;
  console.log("\n=== BETA-BINOMIAL ML FIT (the estimate the table will actually use) ===");
  console.log(`  prior mean ${(fMu * 100).toFixed(1)}%, concentration k = ${fK.toFixed(1)} starts`);
  console.log(`  => true first-inning talent has sd ${priorSd.toFixed(1)}pp across MLB starters`);
  console.log("  reliability of a sample, n/(n+k):");
  for (const n of [10, 15, 20, 30, 40, 60]) {
    console.log(`     ${String(n).padStart(2)} starts -> ${(n / (n + fK)).toFixed(3)}`);
  }

  // The decomposition above assumes every start is an independent trial at one
  // shared rate. A split-half correlation assumes none of that: split each arm's
  // own starts into two halves and ask whether the halves agree. If they do not,
  // there is no stable pitcher effect to rank, whatever the totals look like.
  const splitPool = qualified.filter((a) => a.starts >= 10);
  const halves = splitPool.map((a) => {
    const log = [...a.log].sort((x, y) => x.pk - y.pk); // concurrency scrambles arrival order
    const A = log.filter((_, i) => i % 2 === 0), B = log.filter((_, i) => i % 2 === 1);
    return [A.reduce((s, x) => s + x.clean, 0) / A.length, B.reduce((s, x) => s + x.clean, 0) / B.length];
  });
  const corr = (xs, ys) => {
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxy / Math.sqrt(sxx * syy);
  };
  const r = corr(halves.map((h) => h[0]), halves.map((h) => h[1]));
  const sb = (2 * r) / (1 + r); // Spearman-Brown: reliability of the FULL sample
  const rSE = 1 / Math.sqrt(Math.max(1, splitPool.length - 3));
  const rLo = Math.tanh(Math.atanh(r) - 1.96 * rSE), rHi = Math.tanh(Math.atanh(r) + 1.96 * rSE);
  const sbOf = (x) => (2 * x) / (1 + x);
  console.log("\n=== SPLIT-HALF (odd starts vs even starts, same pitcher) ===");
  console.log(`  ${splitPool.length} arms with >=10 starts`);
  console.log(`  r = ${r.toFixed(3)}   95% CI [${rLo.toFixed(3)}, ${rHi.toFixed(3)}]`);
  console.log(`  Spearman-Brown full-sample reliability = ${sb.toFixed(3)}   CI [${sbOf(rLo).toFixed(3)}, ${sbOf(rHi).toFixed(3)}]`);
  console.log(`  ${r <= 1.96 * rSE
    ? "=> A pitcher's first-inning record does not predict his own next first innings."
    : "=> A real, repeatable pitcher effect: the halves agree more than chance allows."}`);
  // Two estimates of the same quantity, so say plainly whether they conflict.
  // They are measuring subtly different things — split-half also absorbs the
  // defense behind the arm and the division he keeps facing, which is why it
  // runs higher — but the CI is what decides whether that difference matters.
  const mlRel = qualified.reduce((s, a) => s + a.starts / (a.starts + fK), 0) / qualified.length;
  console.log(`\n  ML fit says the average arm's sample is ${mlRel.toFixed(3)} reliable; split-half says ${sb.toFixed(3)}.`);
  console.log(`  ${mlRel >= sbOf(rLo) && mlRel <= sbOf(rHi)
    ? "The ML value sits inside the split-half CI, so these agree and the point\n  estimates differ only by noise. Using the ML fit, which has the tighter error."
    : "These do NOT overlap — something is wrong with one of them; do not ship a\n  table off either until that is resolved."}`);

  // Regression to the mean, per arm rather than by one shared factor: the
  // posterior mean of Beta(clean + mu*k, starts - clean + (1-mu)*k). An arm with
  // 40 starts keeps more of his record than one with 10, which a single
  // shrinkage constant cannot express. THIS is the number the table carries — a
  // raw rate is a claim the sample is not entitled to make.
  const post = (a) => ((a.clean + fMu * fK) / (a.starts + fK)) * 100;
  const sRates = qualified.map(post).sort((a, b) => a - b);
  console.log("\n=== THE SAME ARMS AFTER REGRESSING TO THE MEAN ===");
  console.log(`  raw        range ${rates[0].toFixed(0)}% .. ${rates[rates.length - 1].toFixed(0)}%`);
  console.log(`  posterior  range ${sRates[0].toFixed(1)}% .. ${sRates[sRates.length - 1].toFixed(1)}%`);
  console.log(`  The whole league of starters fits in ${(sRates[sRates.length - 1] - sRates[0]).toFixed(0)} points of true first-inning skill.`);
  console.log("  For scale, the shipped table spans 9% to 83% and presents that as a ranking.");
  // What the spread is worth in the only currency that matters here.
  const lo = sRates[0] / 100, hi = sRates[sRates.length - 1] / 100;
  console.log(`\n  Two best-case arms vs two worst-case arms, as P(no run in the 1st):`);
  console.log(`    ${(hi * hi * 100).toFixed(1)}%  vs  ${(lo * lo * 100).toFixed(1)}%   = ${((hi * hi - lo * lo) * 100).toFixed(1)}pp`);
  console.log("  Small next to what the table claims, but not nothing: that is a real edge");
  console.log("  at these prices, which is the case for fixing this check rather than cutting it.");

  const bands = { elite: pct(sRates, 0.9), sharp: pct(sRates, 0.75), leaky: pct(sRates, 0.25), danger: pct(sRates, 0.1) };
  console.log("\n=== BANDS ON THE REGRESSED SCALE (deciles/quartiles of the posterior) ===");
  console.log(`  elite  >= ${bands.elite.toFixed(1)}%   sharp >= ${bands.sharp.toFixed(1)}%   ` +
    `leaky <= ${bands.leaky.toFixed(1)}%   danger <= ${bands.danger.toFixed(1)}%`);

  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), seasons: SEASONS,
    games: pks.length, minStarts: MIN_STARTS, leagueClean, mean, sd, bands,
    obsVar, sampVar, talentVar, crudeRel, priorMu: fMu, priorK: fK, priorSd, mlRel,
    splitHalfR: r, spearmanBrown: sb, splitN: splitPool.length,
    arms: qualified.map((a) => ({ name: a.name, starts: a.starts, clean: a.clean, rate: a.rate, post: post(a) })) }, null, 2));
  console.log(`\nwrote ${OUT} (${qualified.length} qualified arms)`);
  fs.writeFileSync(STARTS, JSON.stringify({ at: new Date().toISOString(), seasons: SEASONS,
    arms: [...arms.values()].map((a) => ({ name: a.name, log: a.log })) }));
  console.log(`wrote ${STARTS} (per-start runs for every starter seen, not just the qualified)`);
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
