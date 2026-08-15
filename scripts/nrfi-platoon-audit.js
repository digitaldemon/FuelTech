// Is platoonFactor centred?
//
// It compares the offense's OPS vs today's starter hand against
// (opsVsR + opsVsL) / 2 -- the unweighted midpoint of the two splits. But a
// lineup does not face the two hands equally: roughly 70-75% of starts are made
// by right-handers. So the midpoint is NOT the club's own average performance,
// and the factor does not average to 1 over a season of games. Whatever direction
// the typical club's platoon split runs, the factor leans that way on every RHP
// day -- which is three days in four -- and offMult carries it at weight 0.20.
//
// This measures the actual bias two ways: the naive slate average the model
// produces, and what it would produce against a PA-weighted baseline.
const { loadDeskModel } = require("./nrfi-model-load");
const path = require("path");

(async () => {
  const c = loadDeskModel(path.join(__dirname, "..", "public", "desk", "app.js"));
  const season = new Date().getFullYear();

  // Team splits vs LHP / RHP, and the PA behind each, straight from statsapi.
  const url = "https://statsapi.mlb.com/api/v1/teams/stats?season=" + season +
    "&sportIds=1&stats=statSplits&group=hitting&sitCodes=vl,vr";
  const j = await fetch(url).then((r) => r.json());
  const byTeam = new Map();
  for (const blk of j.stats || []) {
    const code = blk.splits && blk.splits[0] && blk.splits[0].split && blk.splits[0].split.code;
    for (const s of blk.splits || []) {
      const id = s.team && s.team.id; if (!id) continue;
      const e = byTeam.get(id) || { name: s.team.name };
      const k = (s.split && s.split.code) || code;
      e[k] = { ops: Number(s.stat.ops), pa: Number(s.stat.plateAppearances) };
      byTeam.set(id, e);
    }
  }

  let nPA = 0, sumPA = 0;
  const rows = [];
  for (const [, t] of byTeam) {
    if (!t.vl || !t.vr || !isFinite(t.vl.ops) || !isFinite(t.vr.ops)) continue;
    const off = { opsVsL: t.vl.ops, opsVsR: t.vr.ops };
    const mid = (off.opsVsR + off.opsVsL) / 2;
    const wtd = (t.vl.ops * t.vl.pa + t.vr.ops * t.vr.pa) / (t.vl.pa + t.vr.pa);
    const shareR = t.vr.pa / (t.vl.pa + t.vr.pa);
    // The factor the model actually returns, averaged over the hands the club
    // really sees rather than over the two hands equally.
    const fL = c.platoonFactor(off, "L").f, fR = c.platoonFactor(off, "R").f;
    const expF = fL * (1 - shareR) + fR * shareR;
    // Same thing with the baseline it should have used.
    const fL2 = off.opsVsL / wtd, fR2 = off.opsVsR / wtd;
    const expF2 = fL2 * (1 - shareR) + fR2 * shareR;
    rows.push({ name: t.name, shareR, mid, wtd, expF, expF2 });
    sumPA += expF; nPA += 1;
    rows.at(-1).sum2 = expF2;
  }
  const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  const shareR = mean("shareR");

  console.log("\nPLATOON BASELINE  (" + rows.length + " clubs, " + season + ")");
  console.log("  share of PA vs RHP:                 " + (shareR * 100).toFixed(1) + "%");
  console.log("  mean shipped factor, PA-weighted:   " + mean("expF").toFixed(4));
  console.log("  same with a PA-weighted baseline:   " + mean("expF2").toFixed(4));
  const off = (mean("expF") - 1) * 100;
  console.log("  net lean the midpoint baseline adds: " + (off >= 0 ? "+" : "") + off.toFixed(2) +
    "%  on lambda, at weight 0.20 -> " + (off * 0.2 >= 0 ? "+" : "") + (off * 0.2).toFixed(3) + "% of lambda");
  console.log("  (a centred factor averages 1.0000; anything else is a standing tilt)");

  rows.sort((a, b) => a.expF - b.expF);
  console.log("\n  most-tilted clubs (shipped factor, PA-weighted over the season)");
  for (const r of rows.slice(0, 4).concat(rows.slice(-4)))
    console.log("    " + r.name.padEnd(24) + r.expF.toFixed(4) + "   midpoint " + r.mid.toFixed(3) +
      "  vs real avg " + r.wtd.toFixed(3));
})().catch((e) => { console.error(e); process.exit(1); });
