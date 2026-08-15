// What should the Lineups check be centred on?
//
//   node scripts/nrfi-lineup-center.js [days] [season]
//
// The check computes a leadoff-weighted OBP of the posted 1-2-3 hitters and
// divides it by NRFI_LG_OBP = 0.318. That denominator is the league OBP over
// ALL hitters, but the numerator is the top of the order — a population picked
// precisely because it gets on base. Dividing one by the other does not produce
// "this lineup vs average", it produces "the top of a lineup vs everybody",
// which is above 1.0 almost by construction.
//
// So measure the denominator the check actually needs: the mean, across posted
// lineups, of the very same statistic the model computes. Same 0.5/0.3/0.2
// weights, same vs-LHP/vs-RHP split selection, same fallback when a split is
// missing. Anything else would re-centre onto a number the model never sees.
//
// Reported per season as well as pooled, because a constant that moves year to
// year is a constant that should not be hardcoded.
const DAYS = Number(process.argv[2] || 120);
const SEASONS = (process.argv[3] || "").split(",").filter(Boolean).map(Number);

const J = async (u) => {
  const r = await fetch(u, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(u + " " + r.status);
  return r.json();
};
const cache = new Map();
const memo = (k, fn) => (cache.has(k) ? cache.get(k) : cache.set(k, fn()).get(k));

// The model's own weights. Imported as a literal rather than sliced out of
// app.jsx because if these ever diverge the measurement must fail loudly in
// review, not silently track a weight change it was never re-run against.
const W = [0.5, 0.3, 0.2];

// Mirror of topOrder's OBP arithmetic. Only the OBP half — the batter rate
// blending and the H2H merge do not feed the factor.
const obpOf = async (ids, season, oppHand) => {
  const sit = oppHand === "L" ? "vl" : oppHand === "R" ? "vr" : null;
  return memo("o" + ids.join(",") + (sit || "") + season, async () => {
    try {
      const type = sit ? `type=[statSplits],sitCodes=[${sit}]` : "type=[season]";
      const d = await J(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(",")}` +
        `&hydrate=stats(group=[hitting],${type},season=${season})`);
      const by = {};
      (d.people || []).forEach((p) => {
        const s = p.stats?.[0]?.splits?.[0]?.stat;
        if (s && s.obp != null) by[p.id] = +s.obp;
      });
      let num = 0, den = 0;
      ids.slice(0, 3).forEach((id, i) => {
        const o = by[id];
        if (o != null) { num += o * W[i]; den += W[i]; }
      });
      // den < 1 means at least one of the three had no split on file and the
      // model reweights across the survivors. Kept, because the model keeps it.
      return den > 0 ? { obp: num / den, full: den > 0.999 } : null;
    } catch { return null; }
  });
};

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } }
  });
  await Promise.all(workers);
  return out;
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

(async () => {
  const now = new Date();
  const seasons = SEASONS.length ? SEASONS : [now.getUTCFullYear()];
  const all = [];

  for (const season of seasons) {
    // Walk back from today within the season, or the season's own tail for a
    // past year. gameType=R keeps spring training out: March exhibition lineups
    // are not the lineups this check ever sees.
    const endRef = season === now.getUTCFullYear() ? now : new Date(Date.UTC(season, 9, 1));
    const dates = [];
    for (let d = 1; d <= DAYS; d++) {
      const dt = new Date(endRef.getTime() - d * 864e5);
      if (dt.getUTCFullYear() !== season) continue;
      dates.push(dt.toISOString().slice(0, 10));
    }
    const seasonRows = [];
    for (const date of dates) {
      let sch;
      try {
        sch = await J("https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=R&date=" + date +
          "&hydrate=probablePitcher,lineups,team");
      } catch { continue; }
      const games = sch.dates?.[0]?.games || [];
      const rows = await mapLimit(games, 5, async (g) => {
        const lu = g.lineups || {};
        const ap = g.teams?.away?.probablePitcher, hp = g.teams?.home?.probablePitcher;
        if (!lu.awayPlayers || !lu.homePlayers) return null;
        // The opposing starter's throwing hand picks the split, so a game with
        // no probable on file cannot reproduce what the model would have done.
        const [ah, hh] = await Promise.all([hand(ap?.id, season), hand(hp?.id, season)]);
        const out = [];
        for (const [players, oppHand] of [[lu.awayPlayers, hh], [lu.homePlayers, ah]]) {
          const ids = players.slice(0, 5).map((p) => p?.id).filter(Boolean);
          if (ids.length < 3) continue;
          const v = await obpOf(ids, season, oppHand);
          if (v) out.push({ ...v, season, split: oppHand ? "split" : "season" });
        }
        return out;
      });
      for (const r of rows) if (r) seasonRows.push(...r);
      process.stderr.write("  " + date + ": " + seasonRows.length + " lineups\r");
    }
    process.stderr.write("\n");
    all.push(...seasonRows);
  }

  if (!all.length) { console.log("No posted lineups found."); return; }

  const report = (label, rows) => {
    if (rows.length < 30) { console.log("  " + label.padEnd(20) + String(rows.length).padStart(6) + "   too thin"); return; }
    const v = rows.map((r) => r.obp);
    console.log("  " + label.padEnd(20) + String(rows.length).padStart(6) + "   mean " + mean(v).toFixed(4) +
      "   sd " + sd(v).toFixed(4) + "   p10 " + quant(v, 0.10).toFixed(3) + "   p90 " + quant(v, 0.90).toFixed(3));
  };

  console.log("\n" + "=".repeat(74));
  console.log("LEADOFF-WEIGHTED TOP-3 OBP — what the Lineups check actually computes");
  console.log("=".repeat(74));
  report("pooled", all);
  for (const s of seasons) report(String(s), all.filter((r) => r.season === s));
  report("vs-hand split", all.filter((r) => r.split === "split"));
  report("season fallback", all.filter((r) => r.split === "season"));
  report("all three on file", all.filter((r) => r.full));

  const m = mean(all.map((r) => r.obp));
  console.log("\n  current denominator   NRFI_LG_OBP = 0.318  (league OBP, ALL hitters)");
  console.log("  measured denominator  " + m.toFixed(4) + "  (this statistic, on posted lineups)");
  console.log("  the gap is worth      x" + (m / 0.318).toFixed(4) + " of standing bias in the factor");

  const above = all.filter((r) => r.obp / 0.318 > 1).length;
  console.log("\n  under 0.318:  " + (above / all.length * 100).toFixed(1) + "% of lineups score above 1.0" +
    "   (mean factor " + mean(all.map((r) => Math.max(0.82, Math.min(1.24, r.obp / 0.318)))).toFixed(4) + ")");
  const above2 = all.filter((r) => r.obp / m > 1).length;
  console.log("  under " + m.toFixed(3) + ":  " + (above2 / all.length * 100).toFixed(1) + "% score above 1.0" +
    "   (mean factor " + mean(all.map((r) => Math.max(0.82, Math.min(1.24, r.obp / m)))).toFixed(4) + ")");

  // A re-centred factor has a narrower spread, so the old 0.82/1.24 clamp may no
  // longer be the binding it was chosen to be. Report how often it bites.
  const cl = all.filter((r) => r.obp / m <= 0.82 || r.obp / m >= 1.24).length;
  console.log("  clamp 0.82/1.24 binds on " + (cl / all.length * 100).toFixed(2) + "% of re-centred lineups");
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });

// Declared after use because it is a detail of the pull, not of the measurement.
function hand(id, season) {
  if (id == null) return Promise.resolve(null);
  return memo("h" + id + season, async () => {
    try {
      const d = await J("https://statsapi.mlb.com/api/v1/people/" + id);
      return d.people?.[0]?.pitchHand?.code || null;
    } catch { return null; }
  });
}
