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
  slice("function pitchSkillFactor(", "\n}"),
  slice("function openerGameFactor(", "\n}"),
  slice("function openerFactor(", "\n}"),
  slice("function seasonLoadFactor(", "\n}"),
  // These nine went into nrfiEvaluate after the last time this file was run, and
  // nothing caught it: mapLimit swallowed the ReferenceError per row, every row
  // came back null, and the script printed "No samples." A backtest that reports
  // nothing looks like a backtest with no data, not a broken one. See the guard
  // below, which now refuses to run rather than under-report.
  slice("function pitcherTrendFactor(", "\n}"),
  slice("function teamOffenseTrendFactor(", "\n}"),
  slice("function offenseVenueFactor(", "\n}"),
  slice("function offKrateFactor(", "\n}"),
  slice("function trendBaseline(", "\n}"),
  slice("const HFA_LAMBDA_RATIO = 1.245;", "HFA_DOWN = 1 / Math.sqrt(HFA_LAMBDA_RATIO);"),
  slice("function homeOffAdvantage(", "\n}"),
  slice("const NRFI_LEAK_MIN = 1.5;", ";"),
  slice("function nrfiLeaks(", "\n}"),
  slice("const PITCHER_BT = (() => {", "\n})();"),
  slice("function pitcherVenueFactor(", "\n}"),
  slice("const OPENER_REG_IP = 12;", ";"),
  slice("const I01_LG = {", "};"),
  slice("const CHECK_FAMILIES = [", "\n];"),
  slice("function checkFamily(", "\n}"),
  slice("function pitcherI01Profile(", "\n}"),
  slice("function pitcherBT(", "\n}"),
  slice("const NRFI_TEMP_REF = 73.7;", "const ENV_W_WIND = 1.00;"),
  slice("function weatherPark(", "\n}"),
  slice("const rate2 = (o)", ";"),
  slice("const awayPit0 = (o)", ";"),
  slice("const NRFI_LG_PA = (() => {", "const NRFI_PA_REG_H2H = 50;"),
  slice("function paRates(", "\n}"),
  slice("function matchupPA(", "\n}"),
  slice("function advanceBaseOut(", "\n}"),
  slice("function simHalfNoRun(", "\n}"),
  slice("function nrfiEvaluate(", "\n}"),
].join("\n");
const { nrfiEvaluate, weatherPark, paRates, NRFI_LG_TOP3_OBP } = eval('"use strict";\n' + model +
  "\n;({ nrfiEvaluate, weatherPark, paRates, NRFI_LG_TOP3_OBP })");

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
const pitMeta = (id, se) => id == null ? Promise.resolve({ hand: null, form: null, seasonEra: null, gs: null, g: null, ip: null, allow: null, id: null }) : memo("m" + id + se, async () => {
  let hand = null, form = null, seasonEra = null, gs = null, g = null, ip = null, allow = null;
  try { const [p, gl] = await Promise.all([
      J(`https://statsapi.mlb.com/api/v1/people/${id}?hydrate=stats(group=[pitching],type=[season],season=${se})`),
      J(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=gameLog&group=pitching&season=${se}`)]);
    const pp = p.people?.[0]; hand = pp?.pitchHand?.code || null;
    const s = pp?.stats?.[0]?.splits?.[0]?.stat; if (s) { seasonEra = s.era != null ? +s.era : null; gs = s.gamesStarted != null ? +s.gamesStarted : null; g = s.gamesPlayed != null ? +s.gamesPlayed : null; ip = s.inningsPitched != null ? parseIp(s.inningsPitched) : null; allow = paRates(s, s.battersFaced); }
    const last = (gl.stats?.[0]?.splits || []).slice(-3); if (last.length) { let er = 0, lip = 0; last.forEach((x) => { er += +(x.stat?.earnedRuns || 0); lip += parseIp(x.stat?.inningsPitched); }); if (lip > 0) form = er * 9 / lip; }
  } catch { /* nulls */ }
  return { hand, form, seasonEra, gs, g, ip, allow, id };
});
// Read from app.jsx, never redeclared here. A backtest that carries its own copy
// of a model constant stops backtesting the model the moment the two drift, and
// the drift is silent — the numbers still look like numbers.
const LG_OBP = NRFI_LG_TOP3_OBP, C = (x, a, b) => Math.max(a, Math.min(b, x));
if (!(LG_OBP > 0.2 && LG_OBP < 0.5)) throw new Error("NRFI_LG_TOP3_OBP did not come through the slice: " + LG_OBP);
const topOrder = async (players, se, oppHand, oppPitcherId) => {
  const ids = (players || []).slice(0, 5).map((p) => p?.id).filter(Boolean);
  if (ids.length < 3) return { factor: 1, obp: null, note: "lineup n/a", batters: null };
  const sit = oppHand === "L" ? "vl" : oppHand === "R" ? "vr" : null;
  return memo("o" + ids.join(",") + (sit || "") + (oppPitcherId || "") + se, async () => {
    try { const type = sit ? `type=[statSplits],sitCodes=[${sit}]` : "type=[season]";
      const d = await J(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(",")}&hydrate=stats(group=[hitting],${type},season=${se})`);
      const by = {}; (d.people || []).forEach((p) => { const s = p.stats?.[0]?.splits?.[0]?.stat; if (s) by[p.id] = { obp: s.obp != null ? +s.obp : null, rates: paRates(s, s.plateAppearances) }; });
      const w = [0.5, 0.3, 0.2]; let num = 0, den = 0; ids.slice(0, 3).forEach((id, i) => { const o = by[id] && by[id].obp; if (o != null) { num += o * w[i]; den += w[i]; } });
      let batters = ids.map((id) => (by[id] && by[id].rates) || null);
      if (oppPitcherId && batters.some(Boolean)) {
        try {
          const h2hD = await J(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(",")}&hydrate=stats(group=[hitting],type=[vsPlayer],opposingPlayerId=${oppPitcherId},season=${se})`);
          const h2h = {}; (h2hD.people || []).forEach((p) => { const s = p.stats?.[0]?.splits?.[0]?.stat; const pa = s ? Number(s.plateAppearances || s.atBats || 0) : 0; if (s && pa >= 5) h2h[p.id] = { pa, rates: paRates(s, pa) }; });
          batters = batters.map((b, i) => { const h = h2h[ids[i]]; if (!b || !h || !h.rates) return b; const wH = Math.min(0.65, h.pa / 20); const keys = ["out","bb","s1","s2","s3","hr"]; const bl = {}; for (const k of keys) bl[k] = b[k]*(1-wH) + h.rates[k]*wH; return bl; });
        } catch { /* H2H unavailable */ }
      }
      const hasB = batters.some(Boolean);
      if (den > 0) { const obp = num / den; return { factor: C(obp / LG_OBP, 0.82, 1.24), obp, batters: hasB ? batters : null, note: "1-3 OBP " + obp.toFixed(3) }; }
      if (hasB) return { factor: 1, obp: null, batters, note: "lineup posted" };
    } catch { /* neutral */ } return { factor: 1, obp: null, note: "lineup n/a", batters: null };
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
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const idx = i++; try { out[idx] = await fn(items[idx]); } catch (e) { mapLimit.errs = (mapLimit.errs || 0) + 1; mapLimit.lastErr = e; if (process.env.BTDEBUG) console.error("ROW ERR: " + ((e && e.stack) || e)); out[idx] = null; } } });
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
      const [awayLineup, homeLineup] = await Promise.all([topOrder(lu.awayPlayers, se, homeMeta.hand, homeMeta.id), topOrder(lu.homePlayers, se, awayMeta.hand, awayMeta.id)]);
      const hpUmp = (g.officials || []).find((o) => o.officialType === "Home Plate");
      const ctx = { awayName: a.team.name, homeName: h.team.name, awayPP: ap.fullName, homePP: hp.fullName,
        awayOff, homeOff, awayPit, homePit, awayMeta, homeMeta, awayLineup, homeLineup, awayTravel, homeTravel,
        wx: weatherPark(g, h.team.abbreviation), awayPeri: periBy[ap.id] || null, homePeri: periBy[hp.id] || null, lg,
        umpName: hpUmp?.official?.fullName || null, umpFactor: 1 };
      // Score BOTH paths on the SAME game. nrfiEvaluate takes the base-out sim
      // whenever posted batters and pitcher allow-rates are both on file; nulling
      // `batters` is the only thing that stands the sim down, and it leaves
      // lineup.factor intact, so the fallback is the real lambda path rather than
      // a lineup-blind strawman. Comparing the two on a paired subset is the
      // point: a sim-vs-lambda split across DIFFERENT games would confound the
      // path with "lineups posted early enough to scrape", which is itself a
      // selection on day games, marquee matchups, and well-run clubhouses.
      const ev = nrfiEvaluate(ctx);
      const noB = (l) => ({ ...l, batters: null });
      const evLam = nrfiEvaluate({ ...ctx, awayLineup: noB(ctx.awayLineup), homeLineup: noB(ctx.homeLineup) });
      if (evLam.method === "sim") throw new Error("suppressing batters did not stand the sim down");
      const inn1 = g.linescore.innings[0];
      const runs = (+(inn1.away?.runs || 0)) + (+(inn1.home?.runs || 0));
      if (ev.pNRFI == null || evLam.pNRFI == null) return null;
      return { pModel: ev.pNRFI, pLam: evLam.pNRFI, method: ev.method,
        actual: runs === 0 ? 1 : 0, key: date + " " + a.team.abbreviation + "@" + h.team.abbreviation };
    });
    for (const r of rows) if (r) samples.push(r);
    process.stderr.write(`  ${date}: ${rows.filter(Boolean).length} games (total ${samples.length})\n`);
  }

  // Fail loudly. This file spent an unknown number of commits reporting
  // "No samples." while every single row threw ReferenceError on a factor that
  // had been added to nrfiEvaluate without a matching slice here. Silence read
  // as "the schedule was empty" instead of "the model does not load", so the
  // shipped NRFI_CALIB_SEED kept its authority long after the model it was fit
  // to had stopped existing. A backtest is allowed to find nothing; it is not
  // allowed to find nothing because it is broken.
  if (mapLimit.errs) {
    const rate = mapLimit.errs / (mapLimit.errs + samples.length);
    console.error(`\n!! ${mapLimit.errs} of ${mapLimit.errs + samples.length} games failed to evaluate (${(rate * 100).toFixed(0)}%)`);
    console.error("!! last error: " + ((mapLimit.lastErr && mapLimit.lastErr.message) || mapLimit.lastErr));
    if (mapLimit.lastErr instanceof ReferenceError) {
      console.error("!! A ReferenceError here means the model bundle is missing a slice.");
      console.error("!! Run: node scripts/nrfi-slice-gap.js   (lists app.jsx decls the bundle never defines)");
    }
    if (rate > 0.2) { console.error("!! >20% failure — refusing to report numbers off a partial model.\n"); process.exitCode = 1; return; }
  }
  const n = samples.length;
  if (!n) { console.log("No samples."); return; }
  const cl = (x) => C(x, 1e-6, 1 - 1e-6);

  // AUC via the rank identity (Mann-Whitney U). Brier and log-loss both mix
  // discrimination with calibration, so a path can look bad purely because its
  // level is off by a constant. AUC is invariant to any monotone recentring,
  // which is exactly the question here: does the sim path KNOW more, or is it
  // merely shifted? Ties split, so a constant predictor scores 0.500.
  function auc(rows, get) {
    const pos = rows.filter((r) => r.actual === 1).map(get);
    const neg = rows.filter((r) => r.actual === 0).map(get);
    if (!pos.length || !neg.length) return null;
    const all = rows.map(get).slice().sort((a, b) => a - b);
    const rank = new Map();
    for (let i = 0; i < all.length;) {
      let j = i; while (j + 1 < all.length && all[j + 1] === all[i]) j++;
      const r = (i + j) / 2 + 1;
      rank.set(all[i], r); i = j + 1;
    }
    const sumPos = pos.reduce((a, v) => a + rank.get(v), 0);
    return (sumPos - pos.length * (pos.length + 1) / 2) / (pos.length * neg.length);
  }

  function metrics(rows, get) {
    const m = rows.length;
    const actualRate = rows.filter((r) => r.actual).length / m;
    const meanPred = rows.reduce((a, r) => a + get(r), 0) / m;
    const brier = rows.reduce((a, r) => a + (get(r) - r.actual) ** 2, 0) / m;
    const logloss = -rows.reduce((a, r) => a + (r.actual ? Math.log(cl(get(r))) : Math.log(cl(1 - get(r)))), 0) / m;
    const picks = rows.filter((r) => Math.abs(get(r) - 0.5) >= 0.03);
    const pickAcc = picks.length ? picks.filter((r) => (get(r) >= 0.5) === (r.actual === 1)).length / picks.length : 0;
    const shrink = Math.min(1, m / 100);
    const c = C((logit(cl(actualRate)) - logit(cl(meanPred))) * shrink, -0.6, 0.6);
    // Brier after the shift this path's own data implies. If a path's Brier is
    // bad only because it is off-level, recentring fixes it and the gap closes;
    // if the gap survives recentring, the path genuinely discriminates worse.
    const brierCal = rows.reduce((a, r) => a + (unlogit(logit(cl(get(r))) + c) - r.actual) ** 2, 0) / m;
    return { m, actualRate, meanPred, brier, brierCal, logloss, pickAcc, nPicks: picks.length,
      c, auc: auc(rows, get), brierBase: actualRate * (1 - actualRate),
      spread: Math.sqrt(rows.reduce((a, r) => a + (get(r) - meanPred) ** 2, 0) / m) };
  }

  const unlogit = (x) => 1 / (1 + Math.exp(-x));
  const pc = (x) => (x * 100).toFixed(1) + "%";
  function show(title, s) {
    console.log("\n--- " + title + " ---");
    console.log(`  games            ${s.m}`);
    console.log(`  actual NRFI      ${pc(s.actualRate)}`);
    console.log(`  mean prediction  ${pc(s.meanPred)}   bias ${((s.meanPred - s.actualRate) * 100).toFixed(1)} pts`);
    console.log(`  prediction sd    ${(s.spread * 100).toFixed(1)} pts`);
    console.log(`  Brier            ${s.brier.toFixed(4)}   (base-rate ${s.brierBase.toFixed(4)})`);
    console.log(`  Brier recentred  ${s.brierCal.toFixed(4)}   (after this path's own shift c=${s.c.toFixed(3)})`);
    console.log(`  log-loss         ${s.logloss.toFixed(4)}`);
    console.log(`  AUC              ${s.auc == null ? "n/a" : s.auc.toFixed(4)}`);
    console.log(`  pick-side acc    ${pc(s.pickAcc)}  on ${s.nPicks} off-the-fence`);
    console.log(`  implied seed c   ${s.c.toFixed(3)}`);
  }
  function reliability(rows, get) {
    const buckets = {};
    for (const r of rows) { const b = Math.floor(get(r) * 20) / 20; (buckets[b] = buckets[b] || []).push(r.actual); }
    Object.keys(buckets).map(Number).sort((a, b) => a - b).forEach((b) => {
      const arr = buckets[b], rate = arr.reduce((x, y) => x + y, 0) / arr.length;
      console.log(`  ${(b * 100).toFixed(0)}-${(b * 100 + 5).toFixed(0)}%  n=${String(arr.length).padStart(3)}  actual ${(rate * 100).toFixed(0)}%`);
    });
  }

  const simRows = samples.filter((s) => s.method === "sim");
  const P = (r) => r.pModel, L = (r) => r.pLam;

  console.log("\n================ NRFI BACKTEST — BOTH PATHS ================");
  console.log(`window: last ${days} days of ${se}   games scored: ${n}`);
  console.log(`sim path fired on ${simRows.length}/${n} (${pc(simRows.length / n)}) — the rest had no posted lineup`);

  console.log("\n============ AS SHIPPED (whatever path the app took) ============");
  show("shipped", metrics(samples, P));

  console.log("\n============ PAIRED HEAD-TO-HEAD (sim-eligible games only) ============");
  console.log("Same games, same inputs, only the path differs. This is the comparison");
  console.log("that means something; everything else is confounded by lineup availability.");
  if (simRows.length < 25) {
    console.log(`\n  !! only ${simRows.length} sim-eligible games — too thin to conclude. Run more days.`);
  }
  if (simRows.length) {
    const sSim = metrics(simRows, P), sLam = metrics(simRows, L);
    show("SIM path", sSim);
    show("LAMBDA path (same games)", sLam);
    const dB = sSim.brier - sLam.brier, dA = (sSim.auc || 0) - (sLam.auc || 0);
    console.log("\n  verdict on the pair:");
    console.log(`    Brier   sim ${sSim.brier.toFixed(4)} vs lambda ${sLam.brier.toFixed(4)}   -> ${dB < 0 ? "SIM better" : "LAMBDA better"} by ${Math.abs(dB).toFixed(4)}`);
    console.log(`    AUC     sim ${(sSim.auc || 0).toFixed(4)} vs lambda ${(sLam.auc || 0).toFixed(4)}   -> ${dA > 0 ? "SIM better" : "LAMBDA better"} by ${Math.abs(dA).toFixed(4)}`);
    console.log(`    seed c  sim ${sSim.c.toFixed(3)} vs lambda ${sLam.c.toFixed(3)}   (shipped NRFI_CALIB_SEED.c = 0.050)`);
    const near = (x) => Math.abs(x - 0.05);
    console.log(`    -> the shipped seed sits closer to the ${near(sSim.c) < near(sLam.c) ? "SIM" : "LAMBDA"} path's own fit`);
    const disagree = simRows.filter((r) => (P(r) >= 0.5) !== (L(r) >= 0.5));
    console.log(`\n    the two paths pick different sides on ${disagree.length}/${simRows.length} games`);
    if (disagree.length) {
      const simWins = disagree.filter((r) => (P(r) >= 0.5) === (r.actual === 1)).length;
      console.log(`    on those, sim was right ${simWins}/${disagree.length}, lambda ${disagree.length - simWins}/${disagree.length}`);
    }
    const md = simRows.reduce((a, r) => a + Math.abs(P(r) - L(r)), 0) / simRows.length;
    console.log(`    mean |sim - lambda| = ${(md * 100).toFixed(2)} pts`);
    console.log("\n  reliability, SIM path:"); reliability(simRows, P);
    console.log("\n  reliability, LAMBDA path (same games):"); reliability(simRows, L);
  }

  // ---- the two things a user actually notices ----
  // "more accurate" is Brier/AUC above. "more common picks" is this: the ladder
  // only fires above 52/55/57/63, so a path that compresses toward 50 produces
  // fewer playable games even when its accuracy is unchanged. Report volume and
  // hit-rate together, because either alone is easy to move in a useless way.
  const LADDER = [["LEAN 52+", 0.52], ["BET 55+", 0.55], ["STRONG 57+", 0.57], ["STRONGEST 63+", 0.63]];
  function ladder(rows, get, label) {
    console.log("\n  " + label);
    for (const [name, thr] of LADDER) {
      const nr = rows.filter((r) => get(r) >= thr);
      const yr = rows.filter((r) => 1 - get(r) >= thr);
      const hit = (a, side) => a.length ? (a.filter((r) => r.actual === side).length / a.length * 100).toFixed(0) + "%" : "  —";
      console.log(`    ${name.padEnd(14)} NRFI ${String(nr.length).padStart(3)} games @ ${hit(nr, 1).padStart(4)}` +
        `   YRFI ${String(yr.length).padStart(3)} @ ${hit(yr, 0).padStart(4)}` +
        `   total ${String(nr.length + yr.length).padStart(3)}`);
    }
  }
  if (simRows.length) {
    console.log("\n============ PLAYABLE VOLUME AND HIT RATE BY TIER ============");
    console.log("Same games. If one path shows fewer playable games at similar hit rates,");
    console.log("that is the 'fewer picks' complaint, and it is a spread problem, not a skill one.");
    ladder(simRows, P, "SIM path:");
    ladder(simRows, L, "LAMBDA path (same games):");

    // What the SHIPPED seed does to each path. NRFI_CALIB_SEED is a single
    // constant applied regardless of which path produced the number, so if the
    // two paths need different shifts, one of them is being actively mis-set.
    const SHIPPED_C = 0.050;
    console.log("\n============ THE SHIPPED SEED, APPLIED TO EACH PATH ============");
    console.log(`NRFI_CALIB_SEED.c = ${SHIPPED_C.toFixed(3)} is applied to both paths indiscriminately.`);
    for (const [name, get] of [["SIM", P], ["LAMBDA", L]]) {
      const raw = metrics(simRows, get);
      const shifted = simRows.map((r) => ({ actual: r.actual, p: unlogit(logit(cl(get(r))) + SHIPPED_C) }));
      const bShift = shifted.reduce((a, r) => a + (r.p - r.actual) ** 2, 0) / shifted.length;
      const meanShift = shifted.reduce((a, r) => a + r.p, 0) / shifted.length;
      console.log(`  ${name.padEnd(7)} own fit c=${raw.c.toFixed(3)}  |  under shipped c: mean ${pc(meanShift)} ` +
        `(actual ${pc(raw.actualRate)}, bias ${((meanShift - raw.actualRate) * 100).toFixed(1)} pts), ` +
        `Brier ${bShift.toFixed(4)} vs ${raw.brier.toFixed(4)} raw -> ${bShift < raw.brier ? "helped" : "HURT"}`);
    }
  }

  console.log("\n============ LAMBDA PATH OVER EVERY GAME ============");
  show("lambda, full window", metrics(samples, L));
  console.log("\n  reliability:"); reliability(samples, L);

  const shipped = metrics(samples, P);
  const seed = { c: Math.round(shipped.c * 1000) / 1000, n, active: n >= 25 };
  console.log("\ncalibration seed for the SHIPPED mix (NRFI_CALIB_SEED):");
  console.log("  " + JSON.stringify(seed));
  console.log("  NOTE: this is a blended fit over two paths with different biases.");
  console.log("  If the paired section shows their implied c's far apart, one seed");
  console.log("  cannot serve both and the seed should be made path-aware.");
  fs.writeFileSync(path.join(__dirname, "nrfi-backtest.json"), JSON.stringify({
    ...seed, at: new Date().toISOString(), days, season: se,
    shipped, lambdaAll: metrics(samples, L),
    paired: simRows.length ? { sim: metrics(simRows, P), lambda: metrics(simRows, L) } : null,
  }, null, 2));
  console.log("  (written to scripts/nrfi-backtest.json)");
})();
