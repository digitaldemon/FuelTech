// Sanity tests for the pure math in public/desk/app.jsx.
// Extracts the functions by source markers and runs them with known inputs.
// Run: node scripts/desk-math-test.js
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");

// Slice from a start marker to an end marker (inclusive of end line).
function slice(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  if (a === -1) throw new Error("start marker not found: " + startMarker);
  const b = src.indexOf(endMarker, a);
  if (b === -1) throw new Error("end marker not found after: " + startMarker);
  return src.slice(a, b + endMarker.length);
}

const code = [
  "const clamp = (n,a,b) => Math.max(a, Math.min(b, n));",
  slice("const etDate =", "});"),
  slice("const STOP = new Set(", "\n}"), // STOP + toks + overlap
  slice("const takerFee =", ": 0;"),
  slice("function oddsSideMarket(", "\n}"),
  slice("function matchOddsEvent(", "\n}"),
  slice("function likelyWinner(", "\n}"),
  slice("function legsCombined(", "\n}"),
  slice("function positionAdvice(", "\n}"),
  slice("function mlImplied(", "\n}"),
  slice("function shinDevig(", "\n}"),
  slice("function consensusDevig(", "\n}"),
  slice("function teamCodes(", "\n}"),
  slice("const CODE_ALIAS = {", "};"),
  slice("const codeEq = (a, c)", ";"),
  slice("const codeHit = (codes, abbrs) => {", "\n};"),
  slice("function tickerDate(", "\n}"),
  slice("function gameWinnerAbbr(", "\n}"),
  slice("const pickWon = (pickCode, winner)", ";"),
  slice("function parlayMath(", "\n}"),
  slice("function pickDecision(", "\n}"),
  slice("const LEAGUES = [", "\n];"),
  slice("function detectLeague(", "\n}"),
].join("\n");
// eval'd consts stay in the eval scope — return everything we test as an object.
const { takerFee, mlImplied, shinDevig, consensusDevig, teamCodes, codeHit,
  tickerDate, parlayMath, pickDecision, detectLeague, positionAdvice, matchOddsEvent, legsCombined, oddsSideMarket, gameWinnerAbbr, pickWon } =
  eval('"use strict";\n' + code + "\n;({ takerFee, mlImplied, shinDevig, consensusDevig, teamCodes, codeHit, tickerDate, parlayMath, pickDecision, detectLeague, positionAdvice, matchOddsEvent, legsCombined, oddsSideMarket, gameWinnerAbbr, pickWon })");

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + " - " + msg); if (!cond) fail++; };

// Parlay / cross-sport confusion (the bug Billy hit)
ok(detectLeague({ id: "KXMVESPORTSMULTIGAMEEXTENDED-R-ABC123", question: "Yankees, Chiefs and Lakers all win", name: "combo" }) === null,
  "multivariate parlay ticker -> no league match");
ok(detectLeague({ id: "", question: "Will the Yankees win the World Series and the Chiefs win the Super Bowl?", name: "" }) === null,
  "cross-sport question -> no league match");
const nba = detectLeague({ id: "KXNBAGAME-26AUG09LALBOS-LAL", question: "", name: "" });
ok(nba && nba.label === "NBA", "NBA game ticker -> NBA");
const wnba = detectLeague({ id: "KXWNBAGAME-26AUG09INDLVA-IND", question: "", name: "" });
ok(wnba && wnba.label === "WNBA", "WNBA ticker does not collide with NBA");
const mlb = detectLeague({ id: "", question: "Will the Dodgers win the World Series?", name: "Dodgers" });
ok(mlb && mlb.label === "MLB", "single-sport text still maps (MLB)");

// Team-code extraction and matching
const codes = teamCodes("KXMLBGAME-26AUG09SEATEX-SEA");
ok(codes[0] === "SEA" && codes.includes("TEX"), "teamCodes: own side first + both teams (" + codes.join(",") + ")");
const oddCodes = teamCodes("KXWNBAGAME-26AUG11PHXLA-LA");
ok(oddCodes[0] === "LA" && oddCodes.includes("PHX"), "teamCodes: uneven pair PHX+LA extracted (" + oddCodes.join(",") + ")");
ok(codeHit(["SEA", "TEX"], ["SEA", "TEX"]) === 2, "codeHit exact pair scores 2");
ok(codeHit(["NY"], ["NYY", "NYM"]) === 0, "short code matching BOTH teams of a game scores nothing (NY vs NYY+NYM)");
ok(codeHit(["LA"], ["LAS", "PHX"]) === 0.6, "short code matching exactly one team still pairs (LA vs LAS)");
ok(codeHit(["KC"], ["KC"]) === 1, "2-char exact still pairs (KC)");
ok(codeHit(["CWS"], ["CIN", "CHW"]) === 1, "cross-feed alias pairs White Sox (CWS vs CHW)");

// De-vig math
const dv = shinDevig([0.55, 0.55]);
ok(Math.abs(dv[0] + dv[1] - 1) < 1e-9 && Math.abs(dv[0] - 0.5) < 1e-9, "Shin symmetric 55/55 -> 50/50");
const dv3 = shinDevig([0.60, 0.30, 0.20]);
ok(Math.abs(dv3.reduce((s, x) => s + x, 0) - 1) < 1e-6, "Shin 3-way sums to 1");
const cons = consensusDevig([{ homeTeamOdds: { moneyLine: -120 }, awayTeamOdds: { moneyLine: 260 }, drawOdds: { moneyLine: 250 } }], "ARS", "CHE");
ok(cons && cons.probByAbbr.TIE != null && Math.abs(cons.home + cons.away + cons.draw - 100) < 0.01,
  "soccer 3-way sums to 100 with TIE exposed (" + cons.home.toFixed(1) + "/" + cons.draw.toFixed(1) + "/" + cons.away.toFixed(1) + ")");

// Scanner decisions
ok(pickDecision({ src: "pregame-line", books: 3, edge: 12, fee: 1.7 }).bet === false, "stale pregame line -> never a bet");
ok(pickDecision({ src: "book", books: 3, edge: 6, fee: 1.7 }).tag === "LEAN", "6c gross / 4.3c net with 3 books -> LEAN not STRONG");
ok(pickDecision({ src: "live", books: 1, edge: 7, fee: 1.7 }).tag === "STRONG BET", "live read, 5.3c net -> STRONG");
ok(pickDecision({ src: "model", books: 1, edge: 9, fee: 1.7 }).tag === "LEAN", "model-only projection never STRONG");

// Parlay economics
const pm = parlayMath([
  { entry: 50, modelProb: 55, market: { venue: "Kalshi" } },
  { entry: 60, modelProb: 65, market: { venue: "Kalshi" } },
]);
const grossMult = (100 / 50) * (100 / 60);
ok(pm.mult < grossMult, "parlay multiplier is net of taker fees (" + pm.mult.toFixed(3) + " < " + grossMult.toFixed(3) + ")");
ok(Math.abs(pm.modelProb - 55 * 0.65) < 1e-9, "parlay model win % = product of legs");
ok(Math.abs(takerFee("Kalshi", 50) - 1.75) < 1e-9 && takerFee("Polymarket", 50) === 0, "taker fee: 1.75c at 50c on Kalshi, 0 on Polymarket");

// Ticker date
ok(tickerDate("KXNFLGAME-26SEP07DALPHI-DAL") === "20260907", "tickerDate parses game date");

// Odds event matching: both teams must be present in the game name
const oddsEvents = [
  { home_team: 'New York Liberty', away_team: 'Las Vegas Aces', commence_time: '2026-08-10T23:00:00Z' },
  { home_team: 'Los Angeles Sparks', away_team: 'Phoenix Mercury', commence_time: '2026-08-12T02:00:00Z' },
];
ok(matchOddsEvent(oddsEvents, 'Las Vegas Aces at New York Liberty') === oddsEvents[0], 'matches the right event');
ok(matchOddsEvent(oddsEvents, 'New York Liberty at Indiana Fever') === null,
  'game missing from the odds list does NOT borrow a sibling event sharing one team');
ok(matchOddsEvent(oddsEvents, 'Phoenix Mercury at Los Angeles Sparks', '20260811') === oddsEvents[1], 'date bonus still finds the right ET-dated event');

// Totals/spreads consensus: median line, de-vigged, Over/home share as `a`
const totEv = {
  home_team: "Milwaukee Brewers", away_team: "Minnesota Twins",
  bookmakers: [
    { markets: [{ key: "totals", outcomes: [
      { name: "Over", price: -120, point: 8.5 }, { name: "Under", price: 100, point: 8.5 }] }] },
    { markets: [{ key: "totals", outcomes: [
      { name: "Over", price: -115, point: 8.5 }, { name: "Under", price: -105, point: 8.5 }] }] },
    { markets: [{ key: "totals", outcomes: [
      { name: "Over", price: -110, point: 9 }, { name: "Under", price: -110, point: 9 }] }] },
  ],
};
const tot = oddsSideMarket(totEv, "totals");
ok(tot && tot.point === 8.5 && tot.books === 2 && Math.abs(tot.a + tot.b - 100) < 1e-9 && tot.a > 51,
  "totals: median line 8.5, 2 books at it, de-vigged Over lean " + (tot ? tot.a.toFixed(1) : "?") + "%");
const sprEv = {
  home_team: "H", away_team: "A",
  bookmakers: [{ markets: [{ key: "spreads", outcomes: [
    { name: "H", price: -110, point: -1.5 }, { name: "A", price: -110, point: 1.5 }] }] }],
};
const spr = oddsSideMarket(sprEv, "spreads");
ok(spr && spr.point === -1.5 && Math.abs(spr.a - 50) < 0.01, "spreads: home handicap point, even odds -> 50/50");

// Winner-pick grading from a final score
ok(gameWinnerAbbr([{ abbr: "MIL", score: 5 }, { abbr: "MIN", score: 3 }]) === "MIL", "final score -> winner abbr");
ok(gameWinnerAbbr([{ abbr: "ARS", score: 2 }, { abbr: "CHE", score: 2 }]) === "TIE", "level final -> TIE");
ok(gameWinnerAbbr([{ abbr: "MIL", score: null }, { abbr: "MIN", score: 3 }]) === null, "missing score -> no grade");
ok(pickWon("MIL", "MIL") === true && pickWon("MIN", "MIL") === false, "pick graded against the winner");
ok(pickWon("CWS", "CHW") === true, "grading respects cross-feed aliases");
ok(pickWon("TIE", "TIE") === true && pickWon("MIL", "TIE") === false, "draw pick only wins on a draw");

// Position advice: hold / buy more / sell off a live independent read
const pos = (over) => Object.assign({
  venue: "Kalshi", fair: 55, ts: Date.now(), call: "BUY YES", pillars: [{}],
  taken: { side: "YES", entryPrice: 50, contracts: 100 },
}, over);
const liveIn = (implied) => ({ sides: [{}, {}], state: "in", impliedCents: implied, disagree: false });
ok(positionAdvice(pos(), 80, liveIn(60), { price: 80, bid: 80, ask: 81 }).act === "TAKE PROFIT",
  "worth 60c by live model, bid 80c -> TAKE PROFIT");
ok(positionAdvice(pos(), 60, liveIn(70), { price: 60, bid: 59, ask: 60 }).act === "BUY MORE",
  "worth 70c by live model, all-in add ~61.7c -> BUY MORE");
ok(positionAdvice(pos(), 60, liveIn(61), { price: 60, bid: 59, ask: 60 }).act === "HOLD",
  "worth ~ price -> HOLD");
ok(positionAdvice(pos({ ts: Date.now() - 5 * 3600 * 1000 }), 60, null, { price: 60, bid: 59, ask: 60 }).act === "HOLD",
  "stale analysis, no live read -> HOLD (market is the estimate)");
ok(positionAdvice(pos(), 60, { sides: [{}, {}], state: "post" }, { price: 60, bid: 59, ask: 60 }).act === "SETTLING",
  "game final -> SETTLING");

// Parlay legs math
const legs2 = [
  { side: "YES", name: "Milwaukee", price: 60, result: null },
  { side: "YES", name: "New York", price: 70, result: null },
];
const ll2 = [{ sides: [{}], state: "in", impliedCents: 80, disagree: false }, null];
const c2 = legsCombined(legs2, ll2);
ok(Math.abs(c2.prob - 56) < 0.01 && c2.live, "parlay combine: live 80% x leg price 70c = 56c");
const c3 = legsCombined([{ side: "YES", name: "A", price: 60, result: "no" }, legs2[1]], null);
ok(c3.dead && c3.prob === 0, "settled-lost leg kills the parlay");
ok(positionAdvice(pos(), 66, null, { price: 66, bid: 0, ask: 100 }, { prob: 30, live: true, dead: false }).act === "HOLD",
  "parlay slipping but empty bid -> HOLD (selling collects nothing)");
ok(positionAdvice(pos(), 66, null, { price: 66, bid: 0, ask: 100 }, { prob: 0, live: false, dead: true }).act === "SETTLING",
  "dead parlay with no bid -> SETTLING at zero");

console.log(fail ? fail + " FAILURES" : "ALL TESTS PASSED");
process.exit(fail ? 1 : 0);
