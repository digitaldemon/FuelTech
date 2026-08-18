/* The control for nrfi-king-record-grade.js.
 *
 * His published record is 64.7% NRFI at an average price of -107 (break-even
 * 54.9%). That looks like a large edge, but EVERY ONE of his 244 published
 * picks is NRFI -- he has never once published the YRFI side. So the rival
 * explanation is that he is not selecting games well, he is simply always
 * taking a side the market underprices, and the dual score decides only WHICH
 * games get bet rather than whether the bet is good.
 *
 * That is separable. On the same days he posted, compute the unconditional
 * first-inning-scoreless rate over every game on the slate. If it lands near
 * 64%, his selection is worth nothing and the edge is the NRFI side itself. If
 * it lands near 57%, his selection is doing real work. */
const fs = require("fs");
const path = require("path");
const https = require("https");
const get = (u) => new Promise((res, rej) => https.get(u, (r) => {
  let b = ""; r.on("data", (c) => b += c); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
}).on("error", rej));

const picks = require("./nrfi-king-record-graded.json").rows;
const pickedPk = new Set(picks.filter((p) => p.gamePk).map((p) => p.gamePk));
const dates = [...new Set(picks.map((p) => p.date))].sort();

(async () => {
  let all = 0, allClean = 0, off = 0, offClean = 0;
  for (const d of dates) {
    const j = await get("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + d +
      "&gameType=R&hydrate=linescore");
    (j.dates || []).forEach((dd) => (dd.games || []).forEach((g) => {
      const i1 = g.linescore && g.linescore.innings && g.linescore.innings[0];
      if (!i1 || !g.status || g.status.abstractGameState !== "Final") return;
      const r1 = Number((i1.away && i1.away.runs) || 0) + Number((i1.home && i1.home.runs) || 0);
      all++; if (r1 === 0) allClean++;
      if (!pickedPk.has(g.gamePk)) { off++; if (r1 === 0) offClean++; }
    }));
    process.stderr.write(".");
  }
  process.stderr.write("\n");

  const graded = picks.filter((p) => p.actual);
  const hisW = graded.filter((p) => p.actual === "W").length;
  const his = hisW / graded.length, base = allClean / all, offR = offClean / off;
  const pct = (x) => (100 * x).toFixed(1) + "%";
  const se2 = Math.sqrt(his * (1 - his) / graded.length + offR * (1 - offR) / off);

  console.log("\n=== HIS PICKS vs THE SLATE THEY CAME FROM (" + dates.length + " dates) ===");
  console.log("his picks            " + pct(his) + "   (" + hisW + "/" + graded.length + ")");
  console.log("every game those days " + pct(base) + "   (" + allClean + "/" + all + ")");
  console.log("games he did NOT pick " + pct(offR) + "   (" + offClean + "/" + off + ")");
  console.log("");
  console.log("selection edge       " + (100 * (his - offR)).toFixed(1) + "pp over the games he passed");
  console.log("                     t = " + ((his - offR) / se2).toFixed(2) + "  (SE " + (100 * se2).toFixed(1) + "pp)");
  console.log("");
  const avgP = graded.filter(p=>p.price!=null).reduce((s,p)=>s+p.price,0)/graded.filter(p=>p.price!=null).length;
  const bep = avgP > 0 ? 100/(avgP+100) : -avgP/(-avgP+100);
  console.log("break-even at his avg price " + avgP.toFixed(0) + " = " + pct(bep));
  console.log("blind NRFI on every game    " + pct(base) + "  ->  " + (100*(base-bep)).toFixed(1) + "pp vs that price");
  console.log("his selection on top of that " + (100 * (his - base)).toFixed(1) + "pp");
})();
