// Multi-sport end-to-end check: run the app's real matching + pricing
// functions over EVERY in-season sport's live Kalshi markets at once —
// MLB's 15-game slates and 2/3-letter code collisions are the stress test
// the single-sport sim can't provide.
// Run: node scripts/desk-e2e-multi.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");

function slice(s, e) {
  const a = src.indexOf(s);
  if (a === -1) throw new Error("start marker not found: " + s);
  const b = src.indexOf(e, a);
  if (b === -1) throw new Error("end marker not found after: " + s);
  return src.slice(a, b + e.length);
}
const code = [
  "const clamp = (n,a,b) => Math.max(a, Math.min(b, n));",
  slice("const etDate =", "});"),
  slice("const STOP = new Set(", "\n}"),
  slice("const takerFee =", ": 0;"),
  slice("function mlImplied(", "\n}"),
  slice("function shinDevig(", "\n}"),
  slice("function teamCodes(", "\n}"),
  slice("const CODE_ALIAS = {", "};"),
  slice("const codeEq = (a, c)", ";"),
  slice("const codeHit = (codes, abbrs) => {", "\n};"),
  slice("function tickerDate(", "\n}"),
  slice("function pickDecision(", "\n}"),
  slice("const ODDS_FRESH_MS =", ";"),
  slice("function oddsSideMarket(", "\n}"),
  slice("function oddsEventConsensus(", "\n}"),
  slice("function matchOddsEvent(", "\n}"),
].join("\n");
const api = eval('"use strict";\n' + code +
  "\n;({ teamCodes, codeHit, tickerDate, pickDecision, oddsEventConsensus, matchOddsEvent, takerFee, etDate })");

const COOKIE = process.env.COOKIE ||
  path.join(process.env.TEMP || "C:/Users/Billy/AppData/Local/Temp", "ft-cookies.txt");
const BASE = "https://www.fueltechaipro.com";
const curlJson = (url) => JSON.parse(String(execSync(`curl -s -b "${COOKIE}" "${url}"`, { maxBuffer: 32 * 1024 * 1024 })));

// Mirrors GAME_SERIES + ODDS_SPORT for the in-season leagues.
const SPORTS = [
  ["KXMLBGAME", "baseball/mlb", "basketball? no", "MLB", "baseball_mlb"],
  ["KXWNBAGAME", "basketball/wnba", "", "WNBA", "basketball_wnba"],
  ["KXMLSGAME", "soccer/usa.1", "", "MLS", "soccer_usa_mls"],
  ["KXEPLGAME", "soccer/eng.1", "", "EPL", "soccer_epl"],
  ["KXCFBGAME", "football/college-football", "", "NCAAF", "americanfootball_ncaaf"],
  ["KXNFLGAME", "football/nfl", "", "NFL", "americanfootball_nfl"],
];

let fail = 0, warns = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + " - " + msg); if (!cond) fail++; };
const warn = (msg) => { console.log("WARN - " + msg); warns++; };

(async () => {
  let totalMarkets = 0, totalMatched = 0, totalWrongDate = 0, totalOddsPriced = 0, badSums = 0;
  for (const [series, espnPath, , label, oddsKey] of SPORTS) {
    const km = await (await fetch("https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=" + series + "&status=open&limit=200")).json();
    const markets = km.markets || [];
    if (!markets.length) { console.log(label + ": no open markets (off-slate) — skipped"); continue; }

    const parsed = markets.map((m) => ({ t: m.ticker, codes: api.teamCodes(m.ticker), date: api.tickerDate(m.ticker) }));
    const noCodes = parsed.filter((p) => !p.codes.length || !p.date);
    if (noCodes.length) warn(label + ": " + noCodes.length + " tickers yield no codes/date: " + noCodes.slice(0, 3).map((x) => x.t).join(", "));

    const dates = [...new Set(parsed.map((p) => p.date).filter(Boolean))].sort().slice(0, 4);
    const games = [];
    for (const d of dates) {
      try {
        const sb = await (await fetch("https://site.api.espn.com/apis/site/v2/sports/" + espnPath + "/scoreboard?dates=" + d)).json();
        (sb.events || []).forEach((ev) => {
          const comp = (ev.competitions && ev.competitions[0]) || {};
          const comps = comp.competitors || [];
          const ab = (c) => String((c.team && c.team.abbreviation) || "").toUpperCase();
          const t = Date.parse(ev.date || "");
          const evDate = Number.isFinite(t) ? api.etDate(t).replace(/-/g, "") : d;
          games.push({ eventId: ev.id, date: evDate, abbrs: comps.map(ab), name: ev.name || "" });
        });
      } catch { /* slate fetch fail tolerated */ }
    }
    const uniq = []; const seen = new Set();
    games.forEach((g) => { if (!seen.has(g.eventId)) { seen.add(g.eventId); uniq.push(g); } });

    let matched = 0, wrongDate = 0;
    const unmatched = [];
    parsed.forEach((p) => {
      let best = null, bestS = 0;
      uniq.forEach((g) => {
        const s = api.codeHit(p.codes, g.abbrs) + (p.date && g.date === p.date ? 0.5 : 0);
        if (s > bestS) { bestS = s; best = g; }
      });
      // Only judge date correctness when the market's own slate was among
      // the fetched dates — the sim caps at 4 slates, the app fetches 14.
      if (best && bestS >= 1) { matched++; if (dates.includes(p.date) && best.date !== p.date) wrongDate++; }
      else unmatched.push(p.t + " codes=" + p.codes.join(","));
    });
    totalMarkets += parsed.length; totalMatched += matched; totalWrongDate += wrongDate;
    console.log(label + ": " + parsed.length + " markets, " + uniq.length + " games, matched " + matched + "/" + parsed.length +
      (wrongDate ? " (WRONG DATE: " + wrongDate + ")" : ""));
    if (unmatched.length) console.log("  unmatched: " + unmatched.slice(0, 4).join(" | "));

    // Odds feed coverage + sanity for this sport
    let events = [];
    try { const ow = curlJson(BASE + "/api/desk/odds?sport=" + oddsKey); events = ow.events || []; } catch { /* off */ }
    if (events.length) {
      for (const g of uniq) {
        const ev = api.matchOddsEvent(events, g.name, g.date);
        if (!ev) continue;
        const cons = api.oddsEventConsensus(ev);
        if (!cons) continue;
        totalOddsPriced++;
        const total = cons.home + cons.away + (cons.draw || 0);
        if (Math.abs(total - 100) > 0.6) { badSums++; console.log("  BAD SUM " + g.name + ": " + total.toFixed(2)); }
      }
    }
  }
  ok(totalMarkets > 0, "found open markets across sports (" + totalMarkets + ")");
  ok(totalMatched / Math.max(1, totalMarkets) >= 0.9, "≥90% of markets match a game (" + totalMatched + "/" + totalMarkets + ")");
  ok(totalWrongDate === 0, "zero wrong-slate-date matches");
  ok(badSums === 0, "every odds consensus sums to ~100 (" + totalOddsPriced + " games priced)");
  console.log((fail ? fail + " FAILURES" : "MULTI-SPORT E2E PASSED") + (warns ? " (" + warns + " warnings)" : ""));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SIM ERROR:", e.message); process.exit(1); });
