// Does our model see what NRFIKINGKY sees?
//
//   node scripts/nrfi-tout-vs-model.js [sellerId] [maxDates]
//
// He grades out 205-120 (63.1%) on first-inning legs with a CLV t-stat of 7.6,
// so the edge is real and worth understanding. But "be more like him" is two
// completely different code changes depending on WHY he wins, and the two are
// easy to confuse:
//
//   DIRECTION problem — we look at his games and estimate the wrong number.
//     Then the fix is signal: some factor he has and we don't.
//   FILTER problem — we estimate the same number he does, but our verdict
//     ladder does not fire on it, or fires on twenty other games too.
//     Then the fix is thresholds and selection, and touching the model
//     would make things worse.
//
// The test that separates them is not "do we agree with his picks" — a model
// that says NRFI on everything agrees with him constantly and knows nothing.
// It is where his picks land in OUR ranking of the SAME slate. If his games sit
// in our top decile, we already see them. If they sit at random, he has signal
// we lack.
//
// Scoring is done through scripts/nrfi-model-lib.js, the same loader the
// backtest uses, so this measures the shipped model rather than a copy of it.
const { J, savant, mapLimit, buildCtx, scoreBothPaths } = require("./nrfi-model-lib");
const { gradeSeller } = require("./nrfi-tout-grade");

const pc = (x) => (x * 100).toFixed(1) + "%";
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

(async () => {
  const id = process.argv[2] || "318949";
  const maxDates = Number(process.argv[3] || 0) || Infinity;
  const se = new Date().getUTCFullYear();

  process.stderr.write("grading the seller's book...\n");
  const { graded } = await gradeSeller(id, true);
  const ok = graded.filter((x) => x.a.ok && x.a.day);
  process.stderr.write(`  ${ok.length} legs resolved to a final game\n`);

  // Group his picks by the game's official date, because the percentile test is
  // "against the slate he chose from", and the slate is a day.
  const byDate = new Map();
  for (const x of ok) {
    const d = x.a.day;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(x);
  }
  const dates = [...byDate.keys()].sort().reverse().slice(0, maxDates);
  process.stderr.write(`scoring full slates for ${dates.length} dates...\n`);

  const { by: periBy, lg } = await savant(se);
  const slates = new Map();   // date -> [{gamePk, p, actual, label}]
  let scored = 0, failed = 0;
  for (const date of dates) {
    let sch;
    try { sch = await J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,linescore,team,lineups,weather,venue,officials`); } catch { continue; }
    const games = (sch.dates?.[0]?.games || []).filter((g) => g.status?.abstractGameState === "Final" && g.linescore?.innings?.[0]);
    const rows = await mapLimit(games, 5, async (g) => {
      const ctx = await buildCtx(g, date, se, periBy);
      if (!ctx) return null;
      const { ev } = scoreBothPaths(ctx, lg);
      if (ev.pNRFI == null) return null;
      const inn1 = g.linescore.innings[0];
      const runs = (+(inn1.away?.runs || 0)) + (+(inn1.home?.runs || 0));
      return { gamePk: g.gamePk, p: ev.pNRFI, actual: runs === 0 ? 1 : 0,
        label: `${g.teams.away.team.abbreviation}@${g.teams.home.team.abbreviation}` };
    });
    const keep = rows.filter(Boolean);
    failed += rows.length - keep.length;
    scored += keep.length;
    slates.set(date, keep);
    process.stderr.write(`  ${date}: ${keep.length}/${games.length} scored (total ${scored})\n`);
  }
  if (mapLimit.errs) {
    const rate = mapLimit.errs / (mapLimit.errs + scored);
    console.error(`\n!! ${mapLimit.errs} games threw while scoring (${pc(rate)})`);
    console.error("!! last: " + ((mapLimit.lastErr && mapLimit.lastErr.message) || mapLimit.lastErr));
    if (rate > 0.2) { console.error("!! >20% — refusing to report off a partial model.\n"); process.exitCode = 1; return; }
  }

  // Join his picks to our score for the same gamePk.
  const joined = [];
  for (const date of dates) {
    const slate = slates.get(date) || [];
    const idx = new Map(slate.map((s) => [s.gamePk, s]));
    for (const x of byDate.get(date) || []) {
      const pk = x.a.gamePk;
      const mine = pk != null ? idx.get(pk) : null;
      if (!mine) continue;
      joined.push({ date, side: x.p.side, actual: mine.actual, p: mine.p, label: mine.label, slate });
    }
  }
  console.log(`\njoined ${joined.length} of his legs to a model score on the same game`);
  if (!joined.length) { console.log("nothing to compare"); return; }

  const nrfiPicks = joined.filter((j) => j.side === "NRFI");

  // ---- 1. Do we agree on direction? ----
  console.log("\n=========== DIRECTION: what does our model say on HIS games? ===========");
  const agree = nrfiPicks.filter((j) => j.p >= 0.5).length;
  console.log(`  his NRFI legs joined      ${nrfiPicks.length}`);
  console.log(`  our model also says NRFI  ${agree} (${pc(agree / nrfiPicks.length)})`);
  console.log(`  our mean p(NRFI)          ${pc(mean(nrfiPicks.map((j) => j.p)))}`);
  console.log(`  actual NRFI rate on them  ${pc(mean(nrfiPicks.map((j) => j.actual)))}`);
  const allGames = dates.flatMap((d) => slates.get(d) || []);
  console.log(`  ...vs the full slate      ${pc(mean(allGames.map((g) => g.actual)))} on ${allGames.length} games`);
  console.log("\n  If the actual rate on his games clearly beats the slate, his selection is");
  console.log("  doing real work. If our mean p does NOT rise to match, we are not seeing it.");

  // ---- 2. Where do his picks land in OUR ranking of the same slate? ----
  // This is the question. Percentile is computed within the day, so it is
  // immune to our overall level being off — only the ordering matters.
  console.log("\n=========== SELECTION: his picks' percentile in OUR ranking ===========");
  const pctls = [];
  for (const j of nrfiPicks) {
    if (j.slate.length < 4) continue;
    const below = j.slate.filter((g) => g.p < j.p).length;
    const ties = j.slate.filter((g) => g.p === j.p).length;
    pctls.push((below + ties / 2) / j.slate.length);
  }
  const top = (t) => pctls.filter((v) => v >= t).length;
  console.log(`  legs with a usable slate  ${pctls.length}`);
  console.log(`  mean percentile           ${pc(mean(pctls))}   (50% = we rank his picks at random)`);
  console.log(`  in our top 25% that day   ${top(0.75)} (${pc(top(0.75) / pctls.length)})   [random would be 25%]`);
  console.log(`  in our top 10% that day   ${top(0.90)} (${pc(top(0.90) / pctls.length)})   [random would be 10%]`);
  console.log(`  in our BOTTOM half        ${pctls.filter((v) => v < 0.5).length} (${pc(pctls.filter((v) => v < 0.5).length / pctls.length)})`);
  // Distribution, because a mean of 0.6 can be "mildly agrees on everything" or
  // "strongly agrees on half and actively disagrees on the rest", and those two
  // want opposite fixes.
  console.log("\n  percentile distribution:");
  for (let b = 0; b < 10; b++) {
    const n = pctls.filter((v) => v >= b / 10 && v < (b + 1) / 10 + (b === 9 ? 1 : 0)).length;
    console.log(`    ${String(b * 10).padStart(3)}-${String(b * 10 + 10).padStart(3)}%  ${"#".repeat(Math.round(n / Math.max(1, pctls.length) * 60)).padEnd(24)} ${n}`);
  }

  // ---- 3. Would our own top pick have done as well? ----
  // The honest head-to-head: on the days he played, take OUR highest-p game and
  // see how it lands. If our top pick matches his hit rate, the model is fine
  // and the gap is that we never told you to bet it.
  console.log("\n=========== HEAD-TO-HEAD on the days he played ===========");
  for (const k of [1, 2, 3]) {
    let w = 0, l = 0;
    for (const date of dates) {
      const slate = (slates.get(date) || []).slice().sort((a, b) => b.p - a.p).slice(0, k);
      for (const g of slate) { if (g.actual) w++; else l++; }
    }
    const n = w + l;
    console.log(`  our top-${k} NRFI per day     ${w}-${l}  (${n ? pc(w / n) : "—"} on ${n})`);
  }
  const hisW = nrfiPicks.filter((j) => j.actual).length;
  console.log(`  his NRFI legs, same days   ${hisW}-${nrfiPicks.length - hisW}  (${pc(hisW / nrfiPicks.length)} on ${nrfiPicks.length})`);
  console.log(`  every game, same days      ${pc(mean(allGames.map((g) => g.actual)))} on ${allGames.length}`);

  // ---- 4. Verdict ----
  console.log("\n=========== READING ===========");
  const mp = mean(pctls), edge = mean(nrfiPicks.map((j) => j.actual)) - mean(allGames.map((g) => g.actual));
  console.log(`  his games beat the slate base rate by ${(edge * 100).toFixed(1)} pts`);
  console.log(`  our ranking puts them at the ${(mp * 100).toFixed(0)}th percentile on average`);
  if (edge <= 0.02) {
    console.log("\n  -> His edge on THESE joined legs is small. Most of his return is price,");
    console.log("     not game selection. Chasing his picks with the model is the wrong lever;");
    console.log("     line shopping is the right one.");
  } else if (mp >= 0.62) {
    console.log("\n  -> FILTER problem. We already rank his games near the top of the slate;");
    console.log("     we simply do not convert that ranking into a played verdict often");
    console.log("     enough. The lever is the ladder thresholds and daily pick count,");
    console.log("     NOT the probability model. Changing weights here would be chasing");
    console.log("     a number that is already right.");
  } else if (mp <= 0.55) {
    console.log("\n  -> DIRECTION problem. His winning games are not distinguishable in our");
    console.log("     ranking, so he is using information the model does not have. The");
    console.log("     lever is signal. Look at what his picks share that we do not price.");
  } else {
    console.log("\n  -> Mixed. We rank his games modestly above average but not decisively.");
    console.log("     Expect a real but partial signal gap; do not expect a threshold");
    console.log("     change alone to close it.");
  }
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
