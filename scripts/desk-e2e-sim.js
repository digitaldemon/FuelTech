// End-to-end simulation of the Parlays scanner pipeline using the REAL
// functions from app.jsx against LIVE Kalshi/ESPN/Odds API data.
// Run: node scripts/desk-e2e-sim.js  (needs network; odds via prod proxy
// with a session cookie file path in COOKIE env or default /tmp/ft-cookies.txt)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");

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
  slice("function mlImplied(", "\n}"),
  slice("function shinDevig(", "\n}"),
  slice("function consensusDevig(", "\n}"),
  slice("function teamCodes(", "\n}"),
  slice("const CODE_ALIAS = {", "};"),
  slice("const codeEq = (a, c)", ";"),
  slice("const codeHit = (codes, abbrs) => {", "\n};"),
  slice("function tickerDate(", "\n}"),
  slice("function pickDecision(", "\n}"),
  slice("const ODDS_FRESH_MS =", ";"),
  slice("function oddsSideMarket(", "\n}"),
  slice("const BOOK_WEIGHT = {", "};"),
  slice("function oddsEventConsensus(", "\n}"),
  slice("function matchOddsEvent(", "\n}"),
  slice("function homeProbObj(", "\n}"),
  slice("function oddsProbObj(", "\n}"),
  slice("const LEAGUES = [", "\n];"),
  slice("function detectLeague(", "\n}"),
].join("\n");
const api = eval('"use strict";\n' + code +
  "\n;({ takerFee, mlImplied, shinDevig, consensusDevig, teamCodes, codeHit, tickerDate, pickDecision, oddsEventConsensus, matchOddsEvent, homeProbObj, oddsProbObj, detectLeague, overlap })");

// execSync spawns cmd.exe on Windows, where git-bash's /tmp doesn't exist —
// resolve the cookie jar to a real Windows path.
const COOKIE = process.env.COOKIE ||
  path.join(process.env.TEMP || "C:/Users/Billy/AppData/Local/Temp", "ft-cookies.txt");
const BASE = "https://www.fueltechaipro.com";
function curlJson(url) {
  const out = execSync(`curl -s -b "${COOKIE}" "${url}"`, { maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(String(out));
}

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + " - " + msg); if (!cond) fail++; };

(async () => {
  // 1. Kalshi WNBA markets (public API, browser-direct path in the app)
  const km = await (await fetch("https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=KXWNBAGAME&status=open&limit=200")).json();
  const markets = (km.markets || []);
  console.log("live Kalshi WNBA markets:", markets.length);
  ok(markets.length > 0, "Kalshi WNBA series has open markets");

  // 2. Ticker parsing on every real market
  const parsed = markets.map((m) => ({ t: m.ticker, codes: api.teamCodes(m.ticker), date: api.tickerDate(m.ticker) }));
  ok(parsed.every((p) => p.codes.length >= 1 && p.date), "every real ticker yields codes + date");
  console.log("  sample:", parsed[0].t, "->", parsed[0].codes.join(","), parsed[0].date);

  // 3. ESPN scoreboard for those dates (browser-direct path)
  const dates = [...new Set(parsed.map((p) => p.date))].sort().slice(0, 4);
  let games = [];
  for (const d of dates) {
    const sb = await (await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=" + d)).json();
    (sb.events || []).forEach((ev) => {
      const comp = (ev.competitions && ev.competitions[0]) || {};
      const comps = comp.competitors || [];
      const home = comps.find((c) => c.homeAway === "home"), away = comps.find((c) => c.homeAway === "away");
      const ab = (c) => String((c.team && c.team.abbreviation) || "").toUpperCase();
      games.push({ eventId: ev.id, date: d, abbrs: comps.map(ab), homeAbbr: home ? ab(home) : null, awayAbbr: away ? ab(away) : null,
        state: (ev.status && ev.status.type && ev.status.type.state) || "pre", name: ev.name || "" });
    });
  }
  console.log("ESPN games found across", dates.length, "slates:", games.length);
  ok(games.length > 0, "ESPN scoreboard reachable browser-direct with ET dates");

  // 4. Market -> game matching with the new codeHit. ESPN returns the same
  // game on adjacent date queries, so dedupe by eventId before judging
  // ambiguity — two hits on the SAME game are fine.
  const uniqGames = [];
  const seenIds = new Set();
  games.forEach((g) => { if (!seenIds.has(g.eventId)) { seenIds.add(g.eventId); uniqGames.push(g); } });
  let matched = 0, wrongDate = 0;
  parsed.forEach((p) => {
    let best = null, bestS = 0;
    uniqGames.forEach((g) => {
      const s = api.codeHit(p.codes, g.abbrs) + (p.date && g.date === p.date ? 0.5 : 0);
      if (s > bestS) { bestS = s; best = g; }
    });
    if (best && bestS >= 1) { matched++; if (p.date && best.date && best.date !== p.date) wrongDate++; }
  });
  console.log("markets matched to a game:", matched + "/" + parsed.length, "| matched to wrong slate date:", wrongDate);
  ok(matched === parsed.length, "every market pairs to a game");
  ok(wrongDate === 0, "every market pairs to the game on ITS OWN slate date");

  // 5. Odds API consensus through the prod proxy + event matching
  const ow = curlJson(BASE + "/api/desk/odds?sport=basketball_wnba");
  const events = ow.events || [];
  ok(events.length > 0, "odds proxy returns WNBA events (credits left: " + ow.remaining + ")");
  // Both-teams rule: a game must never borrow a sibling event's odds.
  const stolen = uniqGames.filter((g) => {
    const ev = api.matchOddsEvent(events, g.name, g.date);
    if (!ev) return false;
    const evNames = ((ev.home_team || "") + " " + (ev.away_team || "")).toLowerCase();
    return !g.name.split(" at ").every((part) =>
      part.trim().split(/\s+/).some((w) => w.length > 2 && evNames.includes(w.toLowerCase())));
  });
  ok(stolen.length === 0, "no game borrows a sibling event's odds" +
    (stolen.length ? " — STOLEN: " + stolen.map((g) => g.name).join("; ") : ""));

  let consChecked = 0;
  for (const g of uniqGames) {
    const ev = api.matchOddsEvent(events, g.name, g.date);
    if (!ev) continue;
    const cons = api.oddsEventConsensus(ev);
    if (!cons) continue;
    consChecked++;
    ok(Math.abs(cons.home + cons.away - 100) < 0.5, "consensus sums to 100 for " + g.name + " (" + cons.books + " books, " +
      cons.home.toFixed(1) + "/" + cons.away.toFixed(1) + ", disp " + cons.disp.toFixed(1) + ")");
    ok(cons.books >= 5, "wide book pool for " + g.name + " (" + cons.books + " books)");
  }
  ok(consChecked > 0, "at least one game priced by the odds feed");

  // 6. Full pick construction for one market, decision math sane
  const withGame = parsed.map((p) => {
    let best = null, bestS = 0;
    games.forEach((g) => { const s = api.codeHit(p.codes, g.abbrs); if (s > bestS) { bestS = s; best = g; } });
    return { p, g: best, s: bestS };
  }).filter((x) => x.g && x.s >= 1);
  if (withGame.length) {
    const { p, g } = withGame[0];
    const m = markets.find((mm) => mm.ticker === p.t);
    const ev = api.matchOddsEvent(events, g.name, g.date);
    const cons = ev && api.oddsEventConsensus(ev);
    if (cons) {
      const obj = api.oddsProbObj(cons, g, "book");
      const myCode = p.codes[0];
      let modelProb = null;
      for (const [ab, pr] of Object.entries(obj.probByAbbr)) {
        if (ab === myCode || ab.startsWith(myCode) || myCode.startsWith(ab)) { modelProb = pr; break; }
      }
      ok(modelProb != null && modelProb > 0 && modelProb < 100, "side probability resolved for " + p.t + " -> " + (modelProb && modelProb.toFixed(1)) + "%");
      const ask = m && m.yes_ask != null ? Number(m.yes_ask) : null;
      if (ask != null && modelProb != null) {
        const entry = ask;
        const pick = { src: obj.src, books: obj.books, edge: modelProb - entry, fee: api.takerFee("Kalshi", entry) };
        const dec = api.pickDecision(pick);
        console.log("  full pick:", p.t, "model", modelProb.toFixed(1) + "%", "ask", entry + "c",
          "edge", pick.edge.toFixed(1) + "c", "fee", pick.fee.toFixed(2) + "c", "->", dec.tag);
        ok(typeof dec.tag === "string", "pickDecision produced a decision");
      }
    }
  }

  // 7. detectLeague on Billy's real parlay position ticker
  ok(api.detectLeague({ id: "KXMVECROSSCATEGORY-S2026CBB94B61D30-93F46EE3FC6", question: "yes Milwaukee,yes New York", name: "yes Milwaukee,yes New York" }) === null,
    "Billy's real KXMVE parlay ticker maps to NO single game (was the confusion bug)");

  console.log(fail ? fail + " FAILURES" : "E2E SIMULATION PASSED");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SIM ERROR:", e.message); process.exit(1); });
