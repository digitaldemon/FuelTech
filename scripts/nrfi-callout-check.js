// Does the first-inning callout actually read a real feed?
// Runs against completed games, where the truth is knowable: the number of runs
// the callout would have announced must equal the line score's 1st-inning total.
const { loadDeskModel } = require("./nrfi-model-load");
const c = loadDeskModel();
const realFetch = global.fetch;
c.fetch = (u, o) => (String(u).startsWith("/") ? Promise.reject(new Error("local api")) : realFetch(u, o));

const date = process.argv[2] || new Date(Date.now() - 36e5 * 30).toISOString().slice(0, 10);
let fails = 0;
const check = (ok, what, detail) => {
  console.log((ok ? "  PASS  " : "  FAIL  ") + what + (ok ? "" : "\n          " + detail));
  if (!ok) fails++;
};

(async () => {
  const sch = await (await realFetch("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + date)).json();
  const games = (sch.dates || []).flatMap((d) => d.games || [])
    .filter((g) => String(g.status && g.status.abstractGameState).toLowerCase() === "final").slice(0, 8);
  if (!games.length) { console.log("no finals on " + date); process.exit(0); }
  console.log("\nfirst-inning callout, " + games.length + " finals on " + date);
  console.log("-".repeat(78));
  for (const g of games) {
    const live = await c.fetchFirstInning(g.gamePk);
    if (!live) { check(false, "feed reachable for " + g.gamePk, "fetchFirstInning returned null"); continue; }
    // Truth: the line score's own 1st-inning runs.
    const ls = await (await realFetch("https://statsapi.mlb.com/api/v1/game/" + g.gamePk + "/linescore")).json();
    const inn1 = (ls.innings || [])[0] || {};
    const truth = ((inn1.away && inn1.away.runs) || 0) + ((inn1.home && inn1.home.runs) || 0);
    let counted = 0, spoken = 0;
    for (let i = 0; i < live.plays.length; i++) {
      counted += c.playRuns(live.plays[i], live.plays[i - 1]);
      if (c.playCallout(live.plays[i])) spoken++;
    }
    const nm = (g.teams.away.team.abbreviation || "") + "@" + (g.teams.home.team.abbreviation || "");
    check(counted === truth && spoken === live.plays.length && live.past1,
      nm.padEnd(9) + live.plays.length + " plays, " + counted + " run(s) — matches the line score",
      "counted " + counted + " vs line score " + truth + "; " + spoken + "/" + live.plays.length +
      " plays had a callout; past1=" + live.past1);
  }
  // A play with no description must not be spoken as an empty utterance.
  check(c.playCallout({ result: {} }) === null, "a play with no description is skipped, not spoken as silence",
    "playCallout returned a non-null for an empty result.");
  // The very first play has no predecessor; runs must read off its own score.
  check(c.playRuns({ result: { awayScore: 1, homeScore: 0 } }, undefined) === 1,
    "the leadoff play scores against zero, not against undefined",
    "playRuns mishandled the first play of the inning.");
  /* ---- latency ----
   * A callout that lags is just a recap. Three things decided the delay and all
   * three are pinned here, because each was individually enough to put the voice
   * half a minute behind the park. */
  console.log("\nlatency");
  const pks = games.map((g) => g.gamePk);
  let t = Date.now();
  const par = await Promise.all(pks.map((pk) => c.fetchFirstInning(pk)));
  const parMs = Date.now() - t;
  t = Date.now();
  for (const pk of pks.slice(0, 3)) await c.fetchFirstInning(pk);
  const seqMs = (Date.now() - t) / 3 * pks.length;
  check(par.every(Boolean) && parMs < seqMs / 2,
    "the whole board is polled in parallel — " + parMs + "ms for " + pks.length +
      " games, vs ~" + Math.round(seqMs) + "ms one at a time",
    "parallel " + parMs + "ms is not meaningfully faster than sequential " + Math.round(seqMs) + "ms.");
  // The field projection is what makes a 2.5s interval affordable rather than
  // ~48MB/min of feed across a full board.
  const bare = await (await realFetch("https://statsapi.mlb.com/api/v1.1/game/" + pks[0] + "/feed/live")).text();
  const trimmed = await (await realFetch("https://statsapi.mlb.com/api/v1.1/game/" + pks[0] +
    "/feed/live?fields=" + c.read("CALLOUT_FIELDS"))).text();
  check(trimmed.length * 10 < bare.length,
    "the field projection cuts the feed by 10x or more (" + (bare.length / 1024).toFixed(0) +
      "KB -> " + (trimmed.length / 1024).toFixed(0) + "KB)",
    "projection saved little: " + bare.length + " -> " + trimmed.length +
      "; polling this fast across a full board is not affordable at that size.");
  // The stale-play skip is what stops a mid-inning attach from narrating history
  // and then trailing the game for the rest of the inning.
  check(c.playAgeMs({ about: { endTime: new Date(Date.now() - 90000).toISOString() } }) > 45000 &&
        c.playAgeMs({ about: { endTime: new Date().toISOString() } }) < 5000 &&
        c.playAgeMs({}) === Infinity,
    "play age is read from endTime, and a play with no endTime is treated as old",
    "playAgeMs mis-reports how long ago a play finished.");

  console.log("\n" + "=".repeat(78));
  if (fails) { console.log(fails + " check(s) FAILED"); process.exit(1); }
  console.log("callout reads the live feed correctly");
})().catch((e) => { console.error(e); process.exit(1); });
