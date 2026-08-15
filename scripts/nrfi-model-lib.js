// The real NRFI model, loaded out of app.jsx, plus the data fetchers needed to
// build the context it expects. Extracted from desk-nrfi-backtest.js so that
// anything wanting to score a historical game scores it through THIS path.
//
// The alternative — each analysis script carrying its own copy of the slice
// list and its own ctx builder — fails silently. Two builders that agree today
// drift the first time a factor is added to nrfiEvaluate, and the scripts keep
// printing numbers the whole time. desk-nrfi-backtest.js already lost an
// unknown number of commits to exactly that failure mode, in the smaller form
// of a slice list that stopped matching the model.
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
  slice("const NRFI_SIM_W = 0.20;", "const nClamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));"),
  slice("function nrfiRegress(", "\n}"),
  slice("function halfNoRun(", "\n}"),
  slice("function pitchSkillFactor(", "\n}"),
  slice("function openerGameFactor(", "\n}"),
  slice("function openerFactor(", "\n}"),
  slice("function seasonLoadFactor(", "\n}"),
  // These nine went into nrfiEvaluate after the last time the backtest was run,
  // and nothing caught it: mapLimit swallowed the ReferenceError per row, every
  // row came back null, and the script printed "No samples." A backtest that
  // reports nothing looks like a backtest with no data, not a broken one. See
  // the guard in desk-nrfi-backtest.js, and scripts/nrfi-slice-gap.js, which
  // diffs this list against app.jsx's top-level declarations.
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
// Read from app.jsx, never redeclared here. A script that carries its own copy
// of a model constant stops measuring the model the moment the two drift, and
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

// Build the context nrfiEvaluate expects for one scheduled game. `g` must come
// from a schedule call hydrated with probablePitcher, linescore, team, lineups,
// weather, venue and officials — anything less and the factors quietly go
// neutral, which reads as a confident model rather than a starved one.
async function buildCtx(g, date, se, peri) {
  const a = g.teams?.away, h = g.teams?.home, ap = a?.probablePitcher, hp = h?.probablePitcher;
  if (!ap?.id || !hp?.id) return null;
  const lu = g.lineups || {};
  const [awayPit, homePit, awayMeta, homeMeta, awayOff, homeOff, awayTravel, homeTravel] = await Promise.all([
    pitI01(ap.id, se), pitI01(hp.id, se), pitMeta(ap.id, se), pitMeta(hp.id, se),
    teamOff(a.team.id, se), teamOff(h.team.id, se), travelRest(a.team.id, date, g.venue?.id), travelRest(h.team.id, date, g.venue?.id)]);
  const [awayLineup, homeLineup] = await Promise.all([topOrder(lu.awayPlayers, se, homeMeta.hand, homeMeta.id), topOrder(lu.homePlayers, se, awayMeta.hand, awayMeta.id)]);
  const hpUmp = (g.officials || []).find((o) => o.officialType === "Home Plate");
  return { awayName: a.team.name, homeName: h.team.name, awayPP: ap.fullName, homePP: hp.fullName,
    awayOff, homeOff, awayPit, homePit, awayMeta, homeMeta, awayLineup, homeLineup, awayTravel, homeTravel,
    wx: weatherPark(g, h.team.abbreviation), awayPeri: peri[ap.id] || null, homePeri: peri[hp.id] || null,
    umpName: hpUmp?.official?.fullName || null, umpFactor: 1 };
}

// Score both paths on the SAME game. nrfiEvaluate takes the base-out sim
// whenever posted batters and pitcher allow-rates are both on file; nulling
// `batters` is the only thing that stands the sim down, and it leaves
// lineup.factor intact, so the fallback is the real lambda path rather than a
// lineup-blind strawman.
function scoreBothPaths(ctx, lg) {
  const full = { ...ctx, lg };
  const ev = nrfiEvaluate(full);
  const noB = (l) => ({ ...l, batters: null });
  const evLam = nrfiEvaluate({ ...full, awayLineup: noB(full.awayLineup), homeLineup: noB(full.homeLineup) });
  if (evLam.method !== "model") throw new Error("suppressing batters did not stand the sim down: " + evLam.method);
  return { ev, evLam };
}

// The verdict half of the pipeline, loaded separately so the ladder thresholds
// can be substituted. `pNRFI` is only the first step: nrfiVerdict then applies a
// consensus gate, a confidence gate and thin-arm penalties, any of which can
// drop a game two rungs. Sweeping thresholds against the raw probability would
// therefore promise volume the real board never produces.
//
// `overrides` replaces the ladder constants by name, e.g. {NRFI_BET_MIN: 53}.
// Substitution is on the literal declaration in app.jsx, so a rename here fails
// loudly rather than silently sweeping the shipped numbers.
const VERDICT_SLICES = [
  ["const nClamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));", ";"],
  ["const NRFI_STRONG_MIN = 63, NRFI_BET_MIN = 55, NRFI_LEAN_MIN = 52;", ";"],
  ["const NRFI_TIER_STRONG = 57;", ";"],
  ["const NRFI_THIN_STARTS = 5, NRFI_RELIEF_APPS = 15, NRFI_RELIEF_IP = 25;", ";"],
  ["function nrfiThinArm(", "\n}"],
  ["function nrfiReliefBacked(", "\n}"],
  ["function nrfiTier(", "\n}"],
  ["function applyCalibration(", "\n}"],
  ["function nrfiVerdict(", "\n}"],
];
function makeVerdict(overrides) {
  let bundle = VERDICT_SLICES.map(([a, b]) => slice(a, b)).join("\n");
  for (const [k, v] of Object.entries(overrides || {})) {
    const re = new RegExp("(\\b" + k + "\\s*=\\s*)(\\d+(?:\\.\\d+)?)");
    if (!re.test(bundle)) throw new Error(`cannot override ${k}: no literal assignment found in the verdict bundle`);
    bundle = bundle.replace(re, "$1" + v);
  }
  return eval('"use strict";\n' + bundle + "\n;({ nrfiVerdict, nrfiTier, applyCalibration, nrfiThinArm })");
}

module.exports = { nrfiEvaluate, weatherPark, paRates, NRFI_LG_TOP3_OBP, makeVerdict,
  J, parseIp, memo, pitI01, teamOff, pitMeta, topOrder, travelRest, savant, mapLimit,
  buildCtx, scoreBothPaths, C };
