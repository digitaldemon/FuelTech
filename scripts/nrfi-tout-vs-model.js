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
const fs = require("fs");
const path = require("path");
const { J, savant, mapLimit, buildCtx, scoreBothPaths, makeVerdict } = require("./nrfi-model-lib");
const { gradeSeller } = require("./nrfi-tout-grade");
const { nrfiThinArm: thinArm } = makeVerdict();

const pc = (x) => (x * 100).toFixed(1) + "%";
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");

(async () => {
  const id = process.argv[2] || "318949";
  const args = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const maxDates = Number(process.argv[3] || 0) || Infinity;
  const se = new Date().getUTCFullYear();
  // A full-season pass is ~1300 games and ~20 minutes of MLB API calls. The
  // scoring is deterministic given the same stats, so cache it and let the
  // analysis below be re-cut cheaply. Re-run without --cached whenever the
  // model changes; the cached scores are from whatever app.jsx said that day.
  const useCache = args.includes("--cached") && fs.existsSync(CACHE);

  let dates, slates, byDate;
  if (useCache) {
    const c = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    process.stderr.write(`loaded cached scores from ${c.at} (model ${c.simW == null ? "?" : "NRFI_SIM_W=" + c.simW})\n`);
    dates = c.dates; slates = new Map(c.slates); byDate = new Map(c.byDate);
  } else {
    ({ dates, slates, byDate } = await collect(id, maxDates, se));
  }

  // Join his picks to our score for the same gamePk.
  const joined = [];
  for (const date of dates) {
    const slate = slates.get(date) || [];
    const idx = new Map(slate.map((s) => [s.gamePk, s]));
    for (const x of byDate.get(date) || []) {
      const mine = x.gamePk != null ? idx.get(x.gamePk) : null;
      if (!mine) continue;
      joined.push({ date, side: x.side, actual: mine.actual, p: mine.p, label: mine.label, slate });
    }
  }
  report(dates, slates, joined);
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });

async function collect(id, maxDates, se) {
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
    byDate.get(d).push({ side: x.p.side, gamePk: x.a.gamePk });
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
      // Cache the verdict gates alongside the probability. nrfiVerdict downgrades
      // on check consensus, confidence and thin arms, so a threshold sweep that
      // sees only `p` would promise volume the real board never shows. Thin-arm
      // state is stored as booleans rather than the whole pitProfiles object,
      // which is the only part of it nrfiVerdict reads.
      return { gamePk: g.gamePk, p: ev.pNRFI, actual: runs === 0 ? 1 : 0,
        label: `${g.teams.away.team.abbreviation}@${g.teams.home.team.abbreviation}`,
        aligned: ev.aligned || null, confidence: ev.confidence == null ? 1 : ev.confidence,
        thinAway: thinArm(ev.pitProfiles && ev.pitProfiles.away),
        thinHome: thinArm(ev.pitProfiles && ev.pitProfiles.home) };
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
    if (rate > 0.2) { console.error("!! >20% — refusing to report off a partial model.\n"); process.exitCode = 1; throw new Error("partial model"); }
  }
  const simW = (require("fs").readFileSync(require("path").join(__dirname, "..", "public", "desk", "app.jsx"), "utf8")
    .match(/const NRFI_SIM_W = ([\d.]+);/) || [])[1] || null;
  fs.writeFileSync(CACHE, JSON.stringify({ at: new Date().toISOString(), season: se, simW,
    dates, slates: [...slates], byDate: [...byDate] }));
  process.stderr.write(`  cached to ${CACHE}\n`);
  return { dates, slates, byDate };
}

function report(dates, slates, joined) {
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

  // ---- 3b. Is our top-N number real, or is it hindsight? ----
  // Our scores use CURRENT-SEASON splits, so scoring an April game uses stats
  // that did not exist in April. His picks had no such luxury — they were made
  // live. That makes any head-to-head above unfair in our favour, and the size
  // of the unfairness is not knowable directly.
  //
  // But it IS testable by month. Full-season stats applied to an April game are
  // almost entirely hindsight; applied to an August game they are mostly
  // information that genuinely existed by then. So if our top-1 edge is large
  // in April and collapses by August, the edge is leakage. If it holds roughly
  // flat, leakage is not what is producing it.
  console.log("\n=========== LEAKAGE CHECK: our top-1 by month ===========");
  console.log("Scores use current-season splits, so early games are scored with the most");
  console.log("hindsight. An edge that decays toward the end of the season is an artifact.");
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))].sort();
  const monthRows = [];
  for (const m of months) {
    const ds = dates.filter((d) => d.startsWith(m));
    let w = 0, l = 0, base = [], hw = 0, hn = 0;
    for (const date of ds) {
      const slate = (slates.get(date) || []).slice().sort((a, b) => b.p - a.p);
      if (slate.length) { if (slate[0].actual) w++; else l++; }
      base.push(...slate.map((g) => g.actual));
      for (const j of joined.filter((x) => x.date === date && x.side === "NRFI")) { hn++; if (j.actual) hw++; }
    }
    const n = w + l;
    if (!n) continue;
    const row = { m, n, top1: w / n, base: mean(base), his: hn ? hw / hn : null, hn };
    monthRows.push(row);
    console.log(`  ${m}   top-1 ${String(w).padStart(2)}-${String(l).padStart(2)} = ${pc(row.top1).padStart(6)}` +
      `   slate ${pc(row.base).padStart(6)}   edge ${((row.top1 - row.base) * 100).toFixed(1).padStart(5)} pts` +
      `   | his ${row.his == null ? "  —  " : pc(row.his).padStart(6)} on ${String(row.hn).padStart(3)}`);
  }
  if (monthRows.length >= 4) {
    const half = Math.floor(monthRows.length / 2);
    const early = monthRows.slice(0, half), late = monthRows.slice(-half);
    const eE = mean(early.map((r) => r.top1 - r.base)), lE = mean(late.map((r) => r.top1 - r.base));
    console.log(`\n  early-season edge ${(eE * 100).toFixed(1)} pts   late-season edge ${(lE * 100).toFixed(1)} pts`);
    if (eE - lE > 0.10) console.log("  -> decays sharply. Treat the top-N hit rate as inflated by hindsight.");
    else if (eE - lE > 0.04) console.log("  -> some decay. The top-N hit rate is optimistic but not entirely artifact.");
    else console.log("  -> roughly flat. Leakage is not what is producing the top-N edge.");
    console.log("  Either way this is NOT a walk-forward test, and his record IS. Live CLV");
    console.log("  on our own picks is the only clean comparison; this only sizes the gap.");
  }

  // ---- 4. Verdict ----
  console.log("\n=========== READING ===========");
  const mp = mean(pctls), edge = mean(nrfiPicks.map((j) => j.actual)) - mean(allGames.map((g) => g.actual));
  console.log(`  his games beat the slate base rate by ${(edge * 100).toFixed(1)} pts`);
  console.log(`  our ranking puts them at the ${(mp * 100).toFixed(0)}th percentile on average`);
  // Two independent facts, reported independently. An if/else chain here hid
  // one behind the other — a small edge printed "it's all price" and never
  // mentioned that we were ranking his games in the top quartile, which is the
  // finding that decides what to change.
  if (edge <= 0.02) {
    console.log("\n  -> SELECTION EDGE IS SMALL on these joined legs: his games barely beat");
    console.log("     the slate base rate, so most of his return is price rather than which");
    console.log("     games he picks. Line shopping is the lever, not the model.");
  }
  if (mp >= 0.62) {
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
}
