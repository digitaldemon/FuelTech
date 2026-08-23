// One-shot server-side grader for the NRFI record store: grades every pending
// nrfi- entry whose game has a completed first inning, voids entries older
// than 5 days with no line to grade from. Safe to run repeatedly — it applies
// the same rule as reconcile()/gradeAllRecords in app.jsx (both halves of
// inning 1 posted, and the game past the 1st or final).
// Run: ADMIN_SECRET=... node scripts/nrfi-grade-now.js
const BASE = process.env.BASE || "https://www.fueltechaipro.com";
const SECRET = process.env.ADMIN_SECRET;
if (!SECRET) { console.error("set ADMIN_SECRET"); process.exit(1); }
const H = { "x-admin-secret": SECRET };

(async () => {
  const rec = (await (await fetch(BASE + "/api/desk/nrfi", { headers: H })).json()).record || [];
  const today = new Date(Date.now() - 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, ""); // ET-ish guard
  const pend = rec.filter((x) => String(x.id).indexOf("nrfi-") === 0 && x.result == null &&
    !x.skipped && x.gamePk && x.call && x.date && x.date <= today);
  console.log(pend.length + " pending gradable entries");
  const byDate = {};
  pend.forEach((x) => { (byDate[x.date] = byDate[x.date] || []).push(x); });
  const changed = [];
  for (const d of Object.keys(byDate).sort()) {
    const iso = d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8);
    const sch = await (await fetch("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + iso + "&hydrate=linescore")).json();
    const games = {};
    (((sch.dates || [])[0] || {}).games || []).forEach((g) => { games[g.gamePk] = g; });
    for (const x of byDate[d]) {
      const g = games[x.gamePk];
      const state = g && g.status && g.status.abstractGameState;
      const inn1 = g && g.linescore && (g.linescore.innings || [])[0];
      const runs = inn1 && inn1.away && inn1.home && inn1.away.runs != null && inn1.home.runs != null
        ? inn1.away.runs + inn1.home.runs : null;
      const curr = state === "Preview" ? 0 : ((g && g.linescore && g.linescore.currentInning) || 0);
      if (runs != null && (curr > 1 || state === "Final")) {
        x.result = (x.call === "NRFI") === (runs === 0) ? "won" : "lost";
        x.firstInningRuns = runs;
        if (x.mktAtClose == null && x.mktAtPick != null) x.mktAtClose = x.mktLatest != null ? x.mktLatest : x.mktAtPick;
        changed.push(x);
        console.log("GRADED " + x.id + " " + x.game + " " + x.call + "@" + x.prob + "% -> " +
          x.result.toUpperCase() + " (inn1 runs " + runs + ")");
      } else if (Date.now() - (x.at || 0) > 5 * 86400000) {
        x.result = "void"; changed.push(x);
        console.log("VOID   " + x.id + " " + x.game + " (" + (g ? "no gradable line" : "off the schedule") + ")");
      } else {
        console.log("skip   " + x.id + " " + x.game + " — " + (g ? "state " + state + ", inn " + curr : "not on schedule"));
      }
    }
  }
  if (changed.length) {
    const r = await fetch(BASE + "/api/desk/nrfi", { method: "POST",
      headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(changed) });
    console.log("POST " + r.status);
  }
  console.log(changed.length + " graded/voided this pass");
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
