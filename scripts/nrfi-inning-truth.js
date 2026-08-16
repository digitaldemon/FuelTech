/* Does the desk agree with MLB about which games have started?
 *
 * MLB seeds a linescore SHELL before first pitch. A game sitting in
 * abstractGameState "Preview" / detailedState "Pre-Game" already serves
 * currentInning 1, inningState "Top" and innings.length 1. Taking that at face
 * value makes an unstarted game look live, and on 2026-08-16 it did:
 * SEA @ HOU (gamePk 824156) was 90 minutes from first pitch and the board had
 * already PASSed it with "game under way — no pregame edge left", because the
 * value gate nulls the edge on a started game.
 *
 * The same false positive also killed the countdown, stopped the T-45
 * auto-refresh, and made the game eligible for live audio callouts — four
 * symptoms, one cause. abstractGameState is the authority on whether a game has
 * begun; the linescore is only the authority on where it is once it has.
 *
 * The fix normalises currentInning to 0 while the state is Preview, at the one
 * place the row is built (public/desk/app.jsx, buildRows). This script checks
 * that normalisation against a live slate: it must correct the Preview games
 * WITHOUT zeroing anything genuinely under way.
 *
 *   node scripts/nrfi-inning-truth.js [YYYY-MM-DD]
 *
 * Exits 1 if any game is still misjudged.
 */
const https = require("https");

const get = (u) => new Promise((res, rej) => https.get(u, (r) => {
  let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => {
    try { res(JSON.parse(d)); } catch (e) { rej(e); }
  });
}).on("error", rej));

const date = process.argv[2] || new Date().toISOString().slice(0, 10);

// The two lines under test, copied from buildRows / the verdict's value gate.
const normalise = (state, rawInning) => (state === "Preview" ? 0 : rawInning);
const started = (state, inning, final) => !!(inning >= 1 || final || (state && state !== "Preview"));

(async () => {
  const j = await get("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" +
    date + "&hydrate=linescore,team");
  const games = ((j.dates || [])[0] || {}).games || [];
  if (!games.length) {
    console.log("no games scheduled on " + date + " — nothing to check");
    return;
  }

  let wrongBefore = 0, wrongAfter = 0;
  console.log("slate " + date + "\n");
  console.log("matchup    abstract  detailed         raw  fixed  before  after");
  console.log("-".repeat(66));

  for (const g of games) {
    const state = g.status.abstractGameState;
    const raw = (g.linescore && g.linescore.currentInning) || 0;
    const fixed = normalise(state, raw);
    const final = state === "Final";
    // Ground truth: a game has begun exactly when MLB says it is no longer in
    // Preview. This is the one fact the linescore is not allowed to overrule.
    const truth = state !== "Preview";
    const before = started(state, raw, final);
    const after = started(state, fixed, final);
    if (before !== truth) wrongBefore++;
    if (after !== truth) wrongAfter++;

    const m = (g.teams.away.team.abbreviation || "?") + "@" + (g.teams.home.team.abbreviation || "?");
    console.log(
      m.padEnd(11) + state.padEnd(10) + String(g.status.detailedState).padEnd(17) +
      String(raw).padEnd(5) + String(fixed).padEnd(7) +
      String(before).padEnd(8) + String(after) +
      (before !== truth ? "   <== the shell lied" : "") +
      (after !== truth ? "   <== STILL WRONG" : ""));
  }

  console.log("\nmisjudged before the fix: " + wrongBefore + " of " + games.length);
  console.log("misjudged after  the fix: " + wrongAfter + " of " + games.length);

  if (wrongAfter) {
    console.error("\nnrfi-inning-truth: the normalisation does not cover this slate.");
    process.exit(1);
  }
  console.log(wrongBefore
    ? "\nOK — the shell lied on " + wrongBefore + " game(s) and the fix caught all of them."
    : "\nOK — no Preview game on this slate was carrying a linescore shell.");
})();
