// NRFI backtest — runs the REAL model (sliced from app.jsx) over historical
// games against actual first-inning outcomes, then reports calibration/Brier/
// reliability and prints a calibration seed to bake into the app.
//
//   node scripts/desk-nrfi-backtest.js [days]     (default 14)
//
// CAVEAT: split stats are current-season (not point-in-time), so there is mild
// look-ahead leakage. This measures the model's discriminative power + overall
// calibration, not a clean walk-forward. Good enough to set the calibration
// prior and sanity-check the weights; CLV on live picks is the cleaner test.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
function slice(a, b) {
  const i = src.indexOf(a); if (i < 0) throw new Error("start marker not found: " + a);
  const j = src.indexOf(b, i); if (j < 0) throw new Error("end marker not found after: " + a);
  return src.slice(i, j + b.length);
}
// Pull the real model math out of app.jsx.
const model = [
  slice("const NRFI_LG_LAMBDA = 0.52;", "const nClamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));"),
  slice("function nrfiRegress(", "\n}"),
  slice("function halfNoRun(", "\n}"),
  slice("function platoonFactor(", "\n}"),
  slice("function formFactor(", "\n}"),
  slice("function pitchSkillFactor(", "\n}"),
  slice("function openerGameFactor(", "\n}"),
  slice("function openerFactor(", "\n}"),
  slice("function weatherPark(", "\n}"),
  slice("const rate2 = (o)", ";"),
  slice("const awayPit0 = (o)", ";"),
  slice("function nrfiEvaluate(", "\n}"),
].join("\n");
const { nrfiEvaluate, weatherPark } = eval('"use strict";\n' + model +
  "\n;({ nrfiEvaluate, weatherPark })");

// ---- data (Node fetchers; faithful to the app's getJson logic) ----
const J = async (u) => { const r = await fetch(u, { headers: { accept: "application/json" } }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };
const parseIp = (ip) => { const m = String(ip == null ? "0" : ip).split("."); return Number(m[0] || 0) + (m[1] === "1" ? 1 / 3 : m[1] === "2" ? 2 / 3 : 0); };
const cache = new Map();
const memo = (k, fn) => cache.has(k) ? cache.get(k) : cache.set(k, fn()).get(k);

const pitI01 = (id, se) => id == null ? Promise.resolve(null) : memo("p" + id + se, async () => {
  try { const d = await J(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=statSplits&group=pitching&sitCodes=i01&season=${se}`);
    const s = d.stats?.[0]?.splits?.[0]?.stat; if (!s || !s.gamesPlayed) return null;
    return { rate: (+s.runs || 0) / s.gamesPlayed, sample: s.gamesPlayed, era: s.era != null ? +s.era : null }; } catch { return null; }
});
const teamOff = (id, se) => id == null ? Promise.resolve(null) : memo("t" + id + se, async () => {
  try { const d = await J(`https://statsapi.mlb.com/api/v1/teams/${id}/stats?stats=statSplits&group=hitting&sitCodes=i01,vr,vl&season=${se}`);
    const sp = d.stats?.[0]?.splits || []; const f = (re) => sp.find((x) => re.test(x.split?.description || ""))?.stat;
    const i01 = f(/first inning/i), vr = f(/right/i), vl = f(/left/i); if (!i01 || !i01.gamesPlayed) return null;
    return { rate: (+i01.runs || 0) / i01.gamesPlayed, sample: i01.gamesPlayed, opsVsR: vr?.ops != null ? +vr.ops : null, opsVsL: vl?.ops != null ? +vl.ops : null }; } catch { return null; }
});
const pitMeta = (id, se) => id == null ? Promise.resolve({ hand: null, form: null, seasonEra: null, gs: null, g: null, ip: null }) : memo("m" + id + se, async () => {
  let hand = null, form = null, seasonEra = null, gs = null, g = null, ip = null;
  try { const [p, gl] = await Promise.all([
      J(`https://statsapi.mlb.com/api/v1/people/${id}?hydrate=stats(group=[pitching],type=[season],season=${se})`),
      J(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=gameLog&group=pitching&season=${se}`)]);
    const pp = p.people?.[0]; hand = pp?.pitchHand?.code || null;
    const s = pp?.stats?.[0]?.splits?.[0]?.stat; if (s) { seasonEra = s.era != null ? +s.era : null; gs = s.gamesStarted != null ? +s.gamesStarted : null; g = s.gamesPlayed != null ? +s.gamesPlayed : null; ip = s.inningsPitched != null ? parseIp(s.inningsPitched) : null; }
    const last = (gl.stats?.[0]?.splits || []).slice(-3); if (last.length) { let er = 0, lip = 0; last.forEach((x) => { er += +(x.stat?.earnedRuns || 0); lip += parseIp(x.stat?.inningsPitched); }); if (lip > 0) form = er * 9 / lip; }
  } catch { /* nulls */ }
  return { hand, form, seasonEra, gs, g, ip };
});
const LG_OBP = 0.318, C = (x, a, b) => Math.max(a, Math.min(b, x));
const topOrder = async (players, se, oppHand) => {
  const ids = (players || []).slice(0, 3).map((p) => p?.id).filter(Boolean);
  if (ids.length < 3) return { factor: 1, obp: null, note: "lineup n/a" };
  const sit = oppHand === "L" ? "vl" : oppHand === "R" ? "vr" : null;
  return memo("o" + ids.join(",") + (sit || "") + se, async () => {
    try { const type = sit ? `type=[statSplits],sitCodes=[${sit}]` : "type=[season]";
      const d = await J(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(",")}&hydrate=stats(group=[hitting],${type},season=${se})`);
      const by = {}; (d.people || []).forEach((p) => { const s = p.stats?.[0]?.splits?.[0]?.stat; if (s?.obp != null) by[p.id] = +s.obp; });
      const w = [0.5, 0.3, 0.2]; let num = 0, den = 0; ids.forEach((id, i) => { if (by[id] != null) { num += by[id] * w[i]; den += w[i]; } });
      if (den > 0) { const obp = num / den; return { factor: C(obp / LG_OBP, 0.82, 1.24), obp, note: "1-3 OBP " + obp.toFixed(3) }; }
    } catch { /* neutral */ } return { factor: 1, obp: null, note: "lineup n/a" };
  });
};
const travelRest = async (teamId, todayStr, venueId) => {
  if (teamId == null) return { factor: 1, note: "" };
  return memo("v" + teamId + todayStr, async () => {
    try { const d0 = new Date(todayStr + "T12:00:00Z"); const start = new Date(d0.getTime() - 3 * 864e5).toISOString().slice(0, 10);
      const d = await J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${start}&endDate=${todayStr}&hydrate=venue`);
      const gs = []; (d.dates || []).forEach((dt) => (dt.games || []).forEach((g) => gs.push({ date: dt.date, g })));
      const prev = gs.filter((x) => x.date < todayStr).sort((a, b) => a.date.localeCompare(b.date)).pop();
      if (prev) { const rest = Math.round((d0 - new Date(prev.date + "T12:00:00Z")) / 864e5); const traveled = prev.g.venue?.id && venueId && prev.g.venue.id !== venueId;
        if (rest <= 1 && traveled) return { factor: 0.93, note: "b2b+travel" }; if (rest <= 1) return { factor: 0.98, note: "b2b" }; if (rest >= 3) return { factor: 1.03, note: rest + "d rest" }; }
    } catch { /* neutral */ } return { factor: 1, note: "" };
  });
};
async function savant(se) {
  return memo("sav" + se, async () => {
    try { const sel = "k_percent,bb_percent,barrel_batted_rate,groundballs_percent,whiff_percent,f_strike_percent";
      const r = await fetch(`https://baseballsavant.mlb.com/leaderboard/custom?year=${se}&type=pitcher&min=1&selections=${sel}&csv=true`, { headers: { "user-agent": "cd/2" } });
      const csv = await r.text(); const by = {}; const acc = { k: 0, bb: 0, barrel: 0, gb: 0, whiff: 0, fstrike: 0 }; let n = 0;
      for (const line of csv.split(/\r?\n/).slice(1)) { const m = line.match(/^".*?",(\d+),\d{4},([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+)/); if (!m) continue;
        const row = { k: +m[2], bb: +m[3], barrel: +m[4], gb: +m[5], whiff: +m[6], fstrike: +m[7] }; if (!Number.isFinite(row.k)) continue; by[m[1]] = row; for (const key of Object.keys(acc)) acc[key] += row[key]; n++; }
      const lg = n ? { k: acc.k / n, bb: acc.bb / n, barrel: acc.barrel / n, gb: acc.gb / n, whiff: acc.whiff / n, fstrike: acc.fstrike / n } : { k: 22, bb: 8, barrel: 7.5, gb: 44, whiff: 24.5, fstrike: 60 };
      return { by, lg };
    } catch { return { by: {}, lg: { k: 22, bb: 8, barrel: 7.5, gb: 44, whiff: 24.5, fstrike: 60 } }; }
  });
}
async function mapLimit(items, limit, fn) {
  const out = []; let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const idx = i++; try { out[idx] = await fn(items[idx]); } catch { out[idx] = null; } } });
  await workers.reduce((p) => p, Promise.resolve()); await Promise.all(workers); return out;
}

const logit = (p) => Math.log(p / (1 - p)), unlogit = (x) => 1 / (1 + Math.exp(-x));

(async () => {
  const days = Number(process.argv[2] || 14);
  const se = new Date().getUTCFullYear();
  const dates = []; for (let d = 1; d <= days; d++) { const dt = new Date(Date.now() - d * 864e5); dates.push(dt.toISOString().slice(0, 10)); }
  const { by: periBy, lg } = await savant(se);
  const samples = [];
  for (const date of dates) {
    let sch; try { sch = await J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,linescore,team,lineups,weather,venue,officials`); } catch { continue; }
    const games = (sch.dates?.[0]?.games || []).filter((g) => g.status?.abstractGameState === "Final" && g.linescore?.innings?.[0]);
    const rows = await mapLimit(games, 5, async (g) => {
      const a = g.teams?.away, h = g.teams?.home, ap = a?.probablePitcher, hp = h?.probablePitcher;
      if (!ap?.id || !hp?.id) return null;
      const lu = g.lineups || {};
      const [awayPit, homePit, awayMeta, homeMeta, awayOff, homeOff, awayTravel, homeTravel] = await Promise.all([
        pitI01(ap.id, se), pitI01(hp.id, se), pitMeta(ap.id, se), pitMeta(hp.id, se),
        teamOff(a.team.id, se), teamOff(h.team.id, se), travelRest(a.team.id, date, g.venue?.id), travelRest(h.team.id, date, g.venue?.id)]);
      const [awayLineup, homeLineup] = await Promise.all([topOrder(lu.awayPlayers, se, homeMeta.hand), topOrder(lu.homePlayers, se, awayMeta.hand)]);
      const hpUmp = (g.officials || []).find((o) => o.officialType === "Home Plate");
      const ctx = { awayName: a.team.name, homeName: h.team.name, awayPP: ap.fullName, homePP: hp.fullName,
        awayOff, homeOff, awayPit, homePit, awayMeta, homeMeta, awayLineup, homeLineup, awayTravel, homeTravel,
        wx: weatherPark(g, h.team.abbreviation), awayPeri: periBy[ap.id] || null, homePeri: periBy[hp.id] || null, lg,
        umpName: hpUmp?.official?.fullName || null, umpFactor: 1 };
      const ev = nrfiEvaluate(ctx);
      const inn1 = g.linescore.innings[0];
      const runs = (+(inn1.away?.runs || 0)) + (+(inn1.home?.runs || 0));
      return { pModel: ev.pNRFI, actual: runs === 0 ? 1 : 0 };
    });
    for (const r of rows) if (r) samples.push(r);
    process.stderr.write(`  ${date}: ${rows.filter(Boolean).length} games (total ${samples.length})\n`);
  }

  const n = samples.length;
  if (!n) { console.log("No samples."); return; }
  const actualRate = samples.filter((s) => s.actual).length / n;
  const meanPred = samples.reduce((a, s) => a + s.pModel, 0) / n;
  const brier = samples.reduce((a, s) => a + (s.pModel - s.actual) ** 2, 0) / n;
  const cl = (x) => C(x, 1e-6, 1 - 1e-6);
  const logloss = -samples.reduce((a, s) => a + (s.actual ? Math.log(cl(s.pModel)) : Math.log(cl(1 - s.pModel))), 0) / n;
  const brierBase = actualRate * (1 - actualRate); // Brier of always predicting base rate
  // reliability buckets
  const buckets = {};
  for (const s of samples) { const b = Math.floor(s.pModel * 20) / 20; (buckets[b] = buckets[b] || []).push(s.actual); }
  // pick-side accuracy (model off the fence)
  const picks = samples.filter((s) => Math.abs(s.pModel - 0.5) >= 0.03);
  const pickAcc = picks.length ? picks.filter((s) => (s.pModel >= 0.5) === (s.actual === 1)).length / picks.length : 0;
  // calibration seed
  const shrink = Math.min(1, n / 100);
  const c = C((logit(cl(actualRate)) - logit(cl(meanPred))) * shrink, -0.6, 0.6);

  console.log("\n================ NRFI BACKTEST ================");
  console.log(`games:            ${n}  (last ${days} days, ${se})`);
  console.log(`actual NRFI rate: ${(actualRate * 100).toFixed(1)}%`);
  console.log(`model mean pred:  ${(meanPred * 100).toFixed(1)}%   (bias ${((meanPred - actualRate) * 100).toFixed(1)} pts)`);
  console.log(`Brier score:      ${brier.toFixed(4)}   (base-rate ${brierBase.toFixed(4)}; lower is better)`);
  console.log(`log-loss:         ${logloss.toFixed(4)}`);
  console.log(`pick-side acc:    ${(pickAcc * 100).toFixed(1)}%  on ${picks.length} off-the-fence games`);
  console.log("\nreliability (predicted bucket -> actual NRFI rate):");
  Object.keys(buckets).map(Number).sort((a, b) => a - b).forEach((b) => { const arr = buckets[b]; const rate = arr.reduce((x, y) => x + y, 0) / arr.length; console.log(`  ${(b * 100).toFixed(0)}-${(b * 100 + 5).toFixed(0)}%  n=${String(arr.length).padStart(3)}  actual ${(rate * 100).toFixed(0)}%`); });
  const seed = { c: Math.round(c * 1000) / 1000, n, active: n >= 25 };
  console.log("\ncalibration seed (bake into app as NRFI_CALIB_SEED):");
  console.log("  " + JSON.stringify(seed));
  fs.writeFileSync(path.join(__dirname, "nrfi-backtest.json"), JSON.stringify({ ...seed, actualRate, meanPred, brier, logloss, pickAcc, at: date_stamp() }, null, 2));
  console.log("  (written to scripts/nrfi-backtest.json)");
  function date_stamp() { return new Date().toISOString(); }
})();
