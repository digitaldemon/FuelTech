// One-shot server-side grader: grades every pending picks-record entry
// whose game has gone final. Safe to run repeatedly.
// Run: node scripts/desk-grade-now.js   (needs session cookie file)
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
function slice(s, e) { const a = src.indexOf(s); const b = src.indexOf(e, a); return src.slice(a, b + e.length); }
const code = [
  "const clamp = (n,a,b) => Math.max(a, Math.min(b, n));",
  slice("const CODE_ALIAS = {", "};"),
  slice("const codeEq = (a, c)", ";"),
  slice("const codeHit = (codes, abbrs) => {", "\n};"),
  slice("function gameWinnerAbbr(", "\n}"),
  slice("const pickWon = (pickCode, winner)", ";"),
].join("\n");
const api = eval('"use strict";\n' + code + "\n;({ gameWinnerAbbr, pickWon })");
const COOKIE = process.env.COOKIE || path.join(process.env.TEMP || "/tmp", "ft-cookies.txt");
const BASE = "https://www.fueltechaipro.com";
(async () => {
  const rec = JSON.parse(String(execSync(`curl -s -b "${COOKIE}" ${BASE}/api/desk/picks`))).record || [];
  const changed = [];
  for (const r of rec) {
    if (r.result != null || !r.date || !r.eventId) continue;
    try {
      const sb = await (await fetch("https://site.api.espn.com/apis/site/v2/sports/" + r.path + "/scoreboard?dates=" + r.date)).json();
      const ev = (sb.events || []).find((e) => e.id === String(r.eventId));
      if (!ev || (ev.status && ev.status.type && ev.status.type.state) !== "post") continue;
      const comp = (ev.competitions && ev.competitions[0]) || {};
      const sides = (comp.competitors || []).map((c) => ({
        abbr: String((c.team && c.team.abbreviation) || "").toUpperCase(),
        score: c.score != null && c.score !== "" ? Number(c.score) : null }));
      const w = api.gameWinnerAbbr(sides);
      if (!w) continue;
      r.result = api.pickWon(r.pickCode, w) ? "won" : "lost";
      r.final = sides.map((s) => s.abbr + " " + (s.score != null ? s.score : "-")).join(" ");
      changed.push(r);
      console.log("GRADED: " + r.pick + " @ " + r.prob + "% -> " + r.result.toUpperCase() + " (final " + r.final + ")");
    } catch { /* next cycle */ }
  }
  if (changed.length) {
    const tmp = path.join(__dirname, "graded.tmp.json");
    fs.writeFileSync(tmp, JSON.stringify(changed));
    execSync(`curl -s -b "${COOKIE}" -X POST ${BASE}/api/desk/picks -H "Content-Type: application/json" -d @${tmp}`);
    fs.unlinkSync(tmp);
  }
  console.log(changed.length + " graded this pass");
})();
