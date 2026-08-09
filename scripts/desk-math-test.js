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
  slice("const takerFee =", ": 0;"),
  slice("function positionAdvice(", "\n}"),
  slice("function mlImplied(", "\n}"),
  slice("function shinDevig(", "\n}"),
  slice("function consensusDevig(", "\n}"),
  slice("function teamCodes(", "\n}"),
  slice("const codeHit = (codes, abbrs) => {", "\n};"),
  slice("function tickerDate(", "\n}"),
  slice("function parlayMath(", "\n}"),
  slice("function pickDecision(", "\n}"),
  slice("const LEAGUES = [", "\n];"),
  slice("function detectLeague(", "\n}"),
].join("\n");
// eval'd consts stay in the eval scope — return everything we test as an object.
const { takerFee, mlImplied, shinDevig, consensusDevig, teamCodes, codeHit,
  tickerDate, parlayMath, pickDecision, detectLeague, positionAdvice } =
  eval('"use strict";\n' + code + "\n;({ takerFee, mlImplied, shinDevig, consensusDevig, teamCodes, codeHit, tickerDate, parlayMath, pickDecision, detectLeague, positionAdvice })");

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
ok(codeHit(["SEA", "TEX"], ["SEA", "TEX"]) === 2, "codeHit exact pair scores 2");
ok(codeHit(["NY"], ["NYY"]) === 0, "2-char prefix no longer pairs the wrong team (NY vs NYY)");
ok(codeHit(["KC"], ["KC"]) === 1, "2-char exact still pairs (KC)");

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

console.log(fail ? fail + " FAILURES" : "ALL TESTS PASSED");
process.exit(fail ? 1 : 0);
