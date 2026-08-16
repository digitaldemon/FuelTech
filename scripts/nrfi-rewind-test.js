// Does the point-in-time index actually rewind the thing it claims to?
//
//   node scripts/nrfi-rewind-test.js
//
// This exists because of two failures on the same night, both of which printed
// confident numbers while testing nothing:
//
//   1. The pitcher index was keyed by ARRAY POSITION in a file with no pitcher
//      id in it, and looked up by MLB person id. It matched zero arms. Every
//      starter silently fell back to the league mean, and the run produced a
//      BETTER Brier than the leaky control — because a model with no pitcher
//      information also has no leak. Nothing about the output looked wrong.
//   2. The "unit test" written to catch that selected an arm by iterating the
//      array and fed the array index back in, so it matched the index it had
//      just built from the same positions. It printed PASS.
//
// So the rules here are: assert against a source the index did NOT build itself,
// and prove the assertion can fail. Every check below does both.
const lib = require("./nrfi-model-lib");
const fs = require("fs");
const path = require("path");

const SE = Number(process.argv[2]) || 2025;
const AFTER = "2099-01-01";   // asOf past the season end, so the prefix scan is the whole season
let failed = 0;
const ok = (pass, msg) => { console.log(`  ${pass ? "PASS" : "FAIL"} - ${msg}`); if (!pass) failed++; };

// The external oracle. statsapi's own season split is computed by someone else
// from someone else's data, so agreeing with it is evidence rather than an echo.
// Rewinding to a date past the season should reproduce it exactly: same games,
// same estimator, just reached by a different route.
async function seasonAgreement() {
  console.log(`\nrewound-to-end-of-season should reproduce the season aggregate (${SE})`);
  const ids = [147, 111, 119, 120, 158, 116, 145, 141];
  let worst = 0, checked = 0;
  for (const id of ids) {
    const [pit, api] = await Promise.all([lib.teamOff(id, SE, AFTER), lib.teamOff(id, SE)]);
    if (!pit || !api) { ok(false, `team ${id}: no data (index ${!!pit}, api ${!!api})`); continue; }
    worst = Math.max(worst, Math.abs(pit.rate - api.rate));
    checked++;
  }
  // Not zero-tolerance: the cache is built from finished games with a first
  // inning on the linescore, so a suspended or forfeited game can put the counts
  // one apart. One game in 162 moves the rate by about 0.004.
  ok(checked === ids.length, `all ${ids.length} teams resolved (${checked})`);
  ok(worst < 0.02, `worst team rate error ${worst.toFixed(4)} < 0.02`);
}

// The above only means something if the WRONG answer would have failed it. The
// away side bats against the home starter, so hpRuns is the away team's first
// inning. Crossing that produces a perfectly plausible per-team rate, which is
// exactly why it needs an explicit counter-check rather than a code comment.
function inversionDiscriminates() {
  console.log("\nan inverted away/home mapping must fail the check above");
  const gf = path.join(__dirname, "nrfi-leakfree-games.json");
  const games = JSON.parse(fs.readFileSync(gf, "utf8")).games.filter((g) => g.season === SE);
  const tally = (pick) => {
    const o = {};
    for (const g of games) {
      for (const [id, runs] of pick(g)) { if (id == null) continue; (o[id] = o[id] || { r: 0, n: 0 }); o[id].r += runs; o[id].n++; }
    }
    return o;
  };
  const shipped = tally((g) => [[g.away, g.hpRuns], [g.home, g.apRuns]]);
  const inverted = tally((g) => [[g.away, g.apRuns], [g.home, g.hpRuns]]);
  return lib.teamOff(147, SE).then(async () => {
    const ids = [147, 111, 119, 120, 158, 116, 145, 141];
    let s = 0, si = 0, n = 0;
    for (const id of ids) {
      const api = await lib.teamOff(id, SE);
      if (!api || !shipped[id] || !inverted[id]) continue;
      s += Math.abs(shipped[id].r / shipped[id].n - api.rate);
      si += Math.abs(inverted[id].r / inverted[id].n - api.rate);
      n++;
    }
    const mShip = s / n, mInv = si / n;
    console.log(`    shipped mapping  mean abs err ${mShip.toFixed(4)}`);
    console.log(`    inverted mapping mean abs err ${mInv.toFixed(4)}`);
    ok(mInv > mShip * 5, `inversion is ${(mInv / mShip).toFixed(0)}x worse — the check discriminates`);
  });
}

// A rewind that never rewinds anything is the failure mode from (1). Mid-season,
// the point-in-time sample must be a strict subset of the season sample for a
// clear majority of teams, and the rate must actually differ somewhere. If both
// halves agree everywhere, the index is returning season numbers.
async function midSeasonIsShorter() {
  console.log("\nmid-season, the rewound window must be strictly shorter than the season");
  const ids = [147, 111, 119, 120, 158, 116, 145, 141];
  let shorter = 0, moved = 0, resolved = 0;
  for (const id of ids) {
    const [mid, api] = await Promise.all([lib.teamOff(id, SE, `${SE}-06-01`), lib.teamOff(id, SE)]);
    if (!mid || !api) continue;
    resolved++;
    if (mid.sample < api.sample) shorter++;
    if (Math.abs(mid.rate - api.rate) > 1e-9) moved++;
  }
  ok(resolved === ids.length, `all ${ids.length} teams resolved mid-season (${resolved})`);
  ok(shorter === resolved, `every team's June-1 sample is shorter than its season (${shorter}/${resolved})`);
  ok(moved >= resolved - 1, `the rate actually moves for ${moved}/${resolved} teams`);
}

// Same for the pitcher index, keyed by real MLB person id. The ids come out of
// the cache rather than being typed in, but they are used as IDS — the bug in
// (2) was using them as positions, which this cannot do.
async function pitcherRewind() {
  console.log("\npitcher splits rewind, keyed by MLB person id");
  const gf = path.join(__dirname, "nrfi-leakfree-games.json");
  const games = JSON.parse(fs.readFileSync(gf, "utf8")).games.filter((g) => g.season === SE);
  const counts = new Map();
  for (const g of games) for (const id of [g.hp, g.ap]) if (id != null) counts.set(id, (counts.get(id) || 0) + 1);
  const busy = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
  let resolved = 0, shorter = 0, worst = 0;
  for (const id of busy) {
    const [mid, full, api] = await Promise.all([
      lib.pitI01(id, SE, `${SE}-06-01`), lib.pitI01(id, SE, AFTER), lib.pitI01(id, SE, null)]);
    if (!mid || !full || !api) { ok(false, `pitcher ${id}: no data`); continue; }
    resolved++;
    if (mid.sample < full.sample) shorter++;
    worst = Math.max(worst, Math.abs(full.rate - api.rate));
  }
  ok(resolved === busy.length, `all ${busy.length} busiest arms resolved (${resolved})`);
  ok(shorter === resolved, `every arm's June-1 sample is shorter than its season (${shorter}/${resolved})`);
  ok(worst < 0.35, `full-season rewind matches the api rate within ${worst.toFixed(3)} r/start`);
  return busy;
}

/* pitMeta's season line, summed out of the game log instead of pulled whole.
 *
 * This is the assertion that makes the rewind a rewind rather than a different
 * statistic wearing the same field names. Summing the log to the end of the
 * season has to land back on MLB's own season aggregate: same ERA, same innings,
 * same appearance counts. If it does not, the per-game rows are being read
 * wrong — wrong gameType filter, wrong innings encoding, double-counted
 * doubleheaders — and every rewound number in the backtest is a number nobody
 * has checked.
 *
 * ERA gets a 0.02 tolerance because the API hands it back as a rounded STRING
 * ("2.93"), so the sum is the more precise of the two and exact equality would
 * fail on the rounding. Innings and game counts are integers-over-three and
 * integers, so those are compared tight.
 */
async function pitMetaRewind(busy) {
  console.log("\npitcher season line rewind (pitMeta, summed from the game log)");
  let resolved = 0, shorter = 0, moved = 0, worstEra = 0, worstIp = 0, gMismatch = 0;
  for (const id of busy) {
    const [api, full, mid] = await Promise.all([
      lib.pitMeta(id, SE), lib.pitMeta(id, SE, AFTER), lib.pitMeta(id, SE, `${SE}-06-01`)]);
    if (api.seasonEra == null || full.seasonEra == null || mid.seasonEra == null) {
      ok(false, `pitcher ${id}: no season line (api ${api.seasonEra}, full ${full.seasonEra}, mid ${mid.seasonEra})`);
      continue;
    }
    resolved++;
    worstEra = Math.max(worstEra, Math.abs(full.seasonEra - api.seasonEra));
    worstIp = Math.max(worstIp, Math.abs(full.ip - api.ip));
    if (full.g !== api.g || full.gs !== api.gs) gMismatch++;
    if (mid.ip < full.ip) shorter++;
    if (Math.abs(mid.seasonEra - full.seasonEra) > 1e-9) moved++;
  }
  ok(resolved === busy.length, `all ${busy.length} arms have a season line (${resolved})`);
  ok(worstEra < 0.02, `full-season sum matches the api ERA within ${worstEra.toFixed(4)}`);
  ok(worstIp < 0.02, `full-season sum matches the api innings within ${worstIp.toFixed(4)}`);
  ok(gMismatch === 0, `appearance and start counts match the api for all ${resolved} arms`);
  ok(shorter === resolved, `every arm's June-1 innings are fewer than its season (${shorter}/${resolved})`);
  ok(moved === resolved, `the ERA actually moves for ${moved}/${resolved} arms`);

  // And the check has to be able to fail. Feeding the summer a log with one
  // start duplicated must break the innings agreement — otherwise the three
  // assertions above would pass on a function that ignored its input.
  const probe = [{ gameType: "R", date: `${SE}-04-01`,
    stat: { earnedRuns: 2, hits: 4, doubles: 1, triples: 0, homeRuns: 1, baseOnBalls: 1,
      hitByPitch: 0, battersFaced: 24, inningsPitched: "6.0", gamesStarted: 1, gamesPlayed: 1 } }];
  const one = lib.sumPitLog(probe), two = lib.sumPitLog([...probe, probe[0]]);
  ok(Math.abs(one.ip - 6) < 1e-9 && one.g === 1 && Math.abs(one.seasonEra - 3) < 1e-9,
    `sumPitLog reads one 6.0 IP / 2 ER start as 6 IP, 1 G, 3.00 ERA (got ${one.ip}, ${one.g}, ${one.seasonEra.toFixed(2)})`);
  ok(Math.abs(two.ip - 12) < 1e-9 && two.g === 2 && Math.abs(two.seasonEra - 3) < 1e-9,
    `duplicating that start doubles innings and appearances but holds the rate (got ${two.ip}, ${two.g}, ${two.seasonEra.toFixed(2)})`);
  // Thirds of an inning are encoded ".1" and ".2", not decimal tenths. Summing
  // three of them must give a whole inning, which decimal parsing would not.
  const third = (ip) => [{ gameType: "R", date: `${SE}-04-01`,
    stat: { inningsPitched: ip, earnedRuns: 0, battersFaced: 3, gamesStarted: 1, gamesPlayed: 1 } }];
  const thirds = lib.sumPitLog([...third("0.1"), ...third("0.1"), ...third("0.1")]);
  ok(Math.abs(thirds.ip - 1) < 1e-9, `three "0.1" outings sum to a full inning, not 0.3 (got ${thirds.ip})`);
  // Non-regular-season rows must not reach the sum: the API season aggregate
  // excludes them, so counting them would break the agreement above for a
  // reason that has nothing to do with rewinding.
  ok(lib.GLOG_REG([{ gameType: "R" }, { gameType: "S" }, { gameType: "P" }, {}]).length === 2,
    "GLOG_REG keeps regular-season rows and the untyped default, drops spring and postseason");

  /* The K/9 trend fields have to be PRESENT, not merely correct.
   *
   * nrfiEvaluate's "Pitcher K9 trend" check bails on `m.recentK9 == null`, and
   * that check votes into the consensus that decides a game's rung. The lib's
   * pitMeta did not return the field at all, so the check was absent from every
   * backtest row while firing live — the backtest was scoring a model with one
   * fewer check than ships, and nothing anywhere said so, because a missing
   * check looks identical to a check that abstained.
   *
   * So: assert they arrive, and assert the L3 window is a WINDOW — its innings
   * must not exceed the season's, and for a full-season arm it must be strictly
   * less, or `.slice(-3)` is not slicing.
   */
  let haveK9 = 0, windowed = 0;
  for (const id of busy) {
    const m = await lib.pitMeta(id, SE, AFTER);
    if (m.recentK9 != null && m.seasonK9 != null && m.recentIp != null) haveK9++;
    if (m.recentIp != null && m.ip != null && m.recentIp < m.ip) windowed++;
  }
  ok(haveK9 === busy.length, `recentK9/seasonK9/recentIp arrive for all ${busy.length} arms (${haveK9})`);
  ok(windowed === busy.length, `the L3 window is shorter than the season for all ${busy.length} arms (${windowed})`);
}

(async () => {
  if (lib.PIT_MODE !== "point-in-time") {
    console.error(`NRFI_LEAKY is set, so there is nothing to test — PIT_MODE is "${lib.PIT_MODE}".`);
    process.exit(1);
  }
  await seasonAgreement();
  await inversionDiscriminates();
  await midSeasonIsShorter();
  const busy = await pitcherRewind();
  await pitMetaRewind(busy);
  const st = lib.pitStats();
  console.log(`\nindex use: pitcher rewound ${st.pit} / missed ${st.miss} / api ${st.api}` +
    ` · offence rewound ${st.off.pit} / missed ${st.off.miss} / api ${st.off.api}` +
    ` · meta rewound ${st.meta.pit} / missed ${st.meta.miss} / api ${st.meta.api}`);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL REWIND CHECKS PASSED");
  process.exit(failed ? 1 : 0);
})();
