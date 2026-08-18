/* Grades NRFIKINGKY's published pick record against real MLB first innings.
 *
 *   node scripts/nrfi-king-record-grade.js
 *
 * WHY: his /record page reports 155-86 (64%), +40.87U, +3.9 CLV. That is his
 * own grading of his own picks. Before any of it informs our model we should
 * check it against the actual linescores -- an independent regrade is cheap and
 * it is the only way to know whether the record is a measurement or a claim.
 *
 * One schedule call per date with hydrate=linescore gets every game's first
 * inning at once, so this is ~90 requests, not ~340. */
const fs = require("fs");
const path = require("path");
const https = require("https");

const get = (u) => new Promise((res, rej) => https.get(u, (r) => {
  let b = ""; r.on("data", (c) => b += c); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
}).on("error", rej));

const YEAR = "2026";
const rows = fs.readFileSync(path.join(__dirname, "nrfi-king-record-2026-08-18.csv"), "utf8")
  .trim().split(/\r?\n/).slice(1).map((l) => {
    const [date, rank, game, side, price, ds, clv, result] = l.split(",");
    const [away, home] = game.split("@");
    return { date: YEAR + "-" + date, rank: +rank, game, away, home, side,
      price: price ? +price : null, ds: ds ? +ds : null, clv: clv ? +clv : null, result };
  });

/* statsapi abbreviations differ from his in a few spots; map ours onto theirs. */
const ALIAS = { ATH: ["ATH", "OAK"], CWS: ["CWS", "CHW"], SD: ["SD", "SDP"], SF: ["SF", "SFG"],
  TB: ["TB", "TBR"], KC: ["KC", "KCR"], WSH: ["WSH", "WAS"], ARI: ["ARI", "AZ"], LAD: ["LAD"], LAA: ["LAA"] };
const matches = (mine, theirs) => (ALIAS[mine] || [mine]).includes(theirs);

(async () => {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const byDate = {};
  for (const d of dates) {
    const j = await get("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + d +
      "&gameType=R&hydrate=linescore,team");
    const games = [];
    (j.dates || []).forEach((dd) => (dd.games || []).forEach((g) => {
      const ls = g.linescore, i1 = ls && ls.innings && ls.innings[0];
      games.push({
        gamePk: g.gamePk,
        away: g.teams.away.team.abbreviation, home: g.teams.home.team.abbreviation,
        state: g.status && g.status.abstractGameState,
        r1: i1 ? Number((i1.away && i1.away.runs) || 0) + Number((i1.home && i1.home.runs) || 0) : null,
        hasInn: !!i1,
      });
    }));
    byDate[d] = games;
    process.stderr.write(".");
  }
  process.stderr.write("\n");

  const used = new Set();
  let agree = 0, disagree = 0, ungraded = 0;
  const bad = [];
  for (const r of rows) {
    const cand = (byDate[r.date] || []).filter((g) => matches(r.away, g.away) && matches(r.home, g.home));
    const g = cand.find((x) => !used.has(x.gamePk)); // doubleheader: take games in order
    if (!g) { r.actual = null; ungraded++; continue; }
    used.add(g.gamePk);
    r.gamePk = g.gamePk;
    if (g.state !== "Final" || !g.hasInn) { r.actual = null; ungraded++; continue; }
    r.r1 = g.r1;
    // Every published pick is NRFI: it wins when the whole first inning is scoreless.
    r.actual = g.r1 === 0 ? "W" : "L";
    if (r.result === "W" || r.result === "L") {
      if (r.actual === r.result) agree++; else { disagree++; bad.push(r); }
    }
  }

  const graded = rows.filter((r) => r.actual);
  const w = graded.filter((r) => r.actual === "W").length;
  const roi = (r) => r.price == null ? 0 : (r.actual === "W" ? (r.price > 0 ? r.price / 100 : 100 / -r.price) : -1);
  const priced = graded.filter((r) => r.price != null);
  const units = priced.reduce((s, r) => s + roi(r), 0);
  const be = priced.reduce((s, r) => s + (r.price > 0 ? 100 / (r.price + 100) : -r.price / (-r.price + 100)), 0) / priced.length;

  console.log("\n=== INDEPENDENT REGRADE (MLB linescores) ===");
  console.log("picks on file      " + rows.length);
  console.log("regraded           " + graded.length + "   (unmatched/not final: " + ungraded + ")");
  console.log("his grade agrees   " + agree + " / " + (agree + disagree) + (disagree ? "   *** " + disagree + " DISAGREE ***" : "   (no disagreements)"));
  console.log("");
  console.log("true record        " + w + "-" + (graded.length - w) + "   " + (100 * w / graded.length).toFixed(1) + "%");
  console.log("break-even needed  " + (100 * be).toFixed(1) + "%   (avg price " +
    (priced.reduce((s, r) => s + r.price, 0) / priced.length).toFixed(0) + ")");
  console.log("units @ 1u/pick    " + (units >= 0 ? "+" : "") + units.toFixed(2) + "U over " + priced.length +
    " priced   ROI " + (units >= 0 ? "+" : "") + (100 * units / priced.length).toFixed(1) + "%");
  const se = Math.sqrt(0.25 / graded.length);
  console.log("edge vs break-even " + (100 * (w / graded.length - be)).toFixed(1) + "pp   (1 SE on win% = " +
    (100 * se).toFixed(1) + "pp, so t = " + ((w / graded.length - be) / se).toFixed(2) + ")");

  for (const r of bad) console.log("  DISAGREE " + r.date + " " + r.game + " he says " + r.result + ", 1st inning had " + r.r1 + " run(s)");

  // Does the published DS separate anything, inside the picked range?
  const withDs = graded.filter((r) => r.ds != null).sort((a, b) => b.ds - a.ds);
  console.log("\n=== DS vs OUTCOME (only picks that print a DS) ===");
  console.log("n = " + withDs.length + ", DS range " + withDs[withDs.length - 1].ds + " - " + withDs[0].ds);
  const half = Math.floor(withDs.length / 2);
  const rate = (a) => a.length ? (100 * a.filter((r) => r.actual === "W").length / a.length).toFixed(1) + "% (" +
    a.filter((r) => r.actual === "W").length + "/" + a.length + ")" : "-";
  console.log("top half  DS>=" + withDs[half - 1].ds + "   " + rate(withDs.slice(0, half)));
  console.log("bottom half         " + rate(withDs.slice(half)));
  const mw = withDs.filter(r => r.actual === "W"), ml = withDs.filter(r => r.actual === "L");
  const mean = (a) => a.reduce((s, r) => s + r.ds, 0) / a.length;
  console.log("mean DS | won  " + mean(mw).toFixed(1) + "   mean DS | lost  " + mean(ml).toFixed(1) +
    "   gap " + (mean(mw) - mean(ml)).toFixed(1) + "pts");

  fs.writeFileSync(path.join(__dirname, "nrfi-king-record-graded.json"),
    JSON.stringify({ _source: "nrfi-edge.replit.app/record, regraded against MLB statsapi first innings",
      generated: new Date().toISOString(), rows }, null, 1) + "\n");
  console.log("\nwrote scripts/nrfi-king-record-graded.json");
})();
