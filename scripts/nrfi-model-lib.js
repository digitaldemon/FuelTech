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
  // Through the sentinel, not the IIFE's "})();": the PBT_* cutoffs and
  // pbtPosterior sit after the table, and nrfiEvaluate reads them.
  slice("const PITCHER_BT = (() => {", "// backtest bundle gets the constants and not just the table."),
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
  // The shipped calibration seed, read rather than retyped. desk-nrfi-backtest
  // had it hardcoded in two places as +0.050 — wrong magnitude AND wrong sign
  // against the -0.048 in app.jsx — so its "shipped seed applied to each path"
  // section was shifting predictions the wrong way and reporting HURT for both
  // paths on that basis. Exactly the drift the header of this file warns about,
  // caught only because the fitted c moved and the printed comparison stopped
  // making sense.
  slice("const NRFI_CALIB_SEED = {", "};"),
  slice("function paRates(", "\n}"),
  slice("function matchupPA(", "\n}"),
  slice("function advanceBaseOut(", "\n}"),
  slice("function simHalfNoRun(", "\n}"),
  slice("function nrfiEvaluate(", "\n}"),
].join("\n");
// The regression constants come out with the rest of the model, not as literals
// here. They were in scope all along (the NRFI_LG_PA slice above ends on the
// NRFI_PA_REG_H2H declaration) but were never destructured, so both fetchers
// below called paRates with `reg` undefined and got raw rates back. The app
// passes NRFI_PA_REG_PIT for a starter's allow-rates and NRFI_PA_REG_H2H for
// batter-vs-pitcher histories, so the backtest was scoring UNregressed inputs
// against a model that ships regressed ones — measuring a model that does not
// exist, and flattering it, because an unregressed 12-batter h2h line is a much
// louder signal than the shipped one.
const { nrfiEvaluate, weatherPark, paRates, NRFI_LG_TOP3_OBP,
  NRFI_PA_REG_PIT, NRFI_PA_REG_H2H, NRFI_CALIB_SEED } = eval('"use strict";\n' + model +
  "\n;({ nrfiEvaluate, weatherPark, paRates, NRFI_LG_TOP3_OBP," +
  " NRFI_PA_REG_PIT, NRFI_PA_REG_H2H, NRFI_CALIB_SEED })");
if (!Number.isFinite(NRFI_CALIB_SEED?.c)) {
  throw new Error("NRFI_CALIB_SEED did not come through the slice: " + JSON.stringify(NRFI_CALIB_SEED));
}
for (const [n, v] of [["NRFI_PA_REG_PIT", NRFI_PA_REG_PIT], ["NRFI_PA_REG_H2H", NRFI_PA_REG_H2H]]) {
  if (!(v > 0)) throw new Error(n + " did not come through the slice: " + v);
}

// ---- data (Node fetchers; faithful to the app's getJson logic) ----
const J = async (u) => { const r = await fetch(u, { headers: { accept: "application/json" } }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };
const parseIp = (ip) => { const m = String(ip == null ? "0" : ip).split("."); return Number(m[0] || 0) + (m[1] === "1" ? 1 / 3 : m[1] === "2" ? 2 / 3 : 0); };
// MLB sends "-.--" for a pitcher with no recorded innings and "INF" for one who
// has allowed runs without retiring anybody. Number() maps both to NaN, and NaN
// is not null, so every `x != null` guard downstream passes it through — which
// is how a NaN ERA reached openerFactor and came out as a NaN multiplier on the
// lambda. These are absences of a reading, not readings, so they become null.
// Mirrors numOrNull in app.jsx; both fetch paths must agree or the backtest
// stops measuring the app.
const numOrNull = (v) => { if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const cache = new Map();
const memo = (k, fn) => cache.has(k) ? cache.get(k) : cache.set(k, fn()).get(k);

/* ---- POINT-IN-TIME PITCHER SPLITS ----
 *
 * THE LEAK THIS FIXES. The call below asks the API for a starter's first-inning
 * line for a whole SEASON. Scoring a game from May with it hands the model a
 * rate that already contains that game's own result, plus every start after it.
 * An arm shelled in the 1st that afternoon reads worse in the line the model
 * sees, so the model "predicts" a run it was told about.
 *
 * It is not a small effect and it is not hypothetical. nrfi-pitreg-fit.js
 * toggles exactly this field and finds the optimal regression weight collapse
 * from 75 (clean, interior minimum) to 0 (leaky, minimum at the boundary with
 * MSE rising monotonically in the weight). A curve that rewards trusting an
 * input more the further you go is not measuring prediction; it is measuring how
 * much of the answer you let through. Everything downstream inherited it —
 * nrfi-ladder-sweep.js reported the BET rung at 62.5% against a 49.9% base rate,
 * which is the leak, not a model.
 *
 * THE FIX. nrfi-leakfree-games.json carries, per game, the two starters' MLB ids
 * and the runs each allowed in the 1st, with a date and a season. That is a
 * dated log per arm, so the season-to-date line can be rebuilt from starts
 * STRICTLY BEFORE the scored date — precisely what the live model sees at pick
 * time. 14,009 games across six seasons.
 *
 * The first attempt built this from nrfi-pitcherbt-starts.json instead, and it
 * is worth recording why that failed. That file has no pitcher id — its `arms`
 * is a plain ARRAY of {name, log}. Keying an index by the array position and
 * then looking arms up by MLB person id silently matched nothing: every arm
 * returned null, every starter fell back to the league mean, and the run still
 * produced a full set of plausible numbers with a BETTER-looking Brier, because
 * a model with no pitcher information is also a model with no leak. It was
 * caught only by a counter that printed "rewound 0". Resolving ids by
 * intersecting each arm's opponents was tried next and left 80+ arms ambiguous.
 * Both were fixes layered on a file that lacks the key; the run counts were
 * already sitting in leakfree's scan and being discarded, so the fix was to
 * stop discarding them.
 *
 * THE COUNTERS BELOW ARE LOAD-BEARING. A join that matches nothing looks exactly
 * like a clean run.
 *
 * REWOUND SO FAR: pitI01 (first done, because it is the one measured to leak and
 * it feeds pitBase at full weight — the dominant term), teamOff's first-inning
 * rate, and pitMeta's seasonEra/ip/gs/g/allow.
 *
 * STILL LEAKING: topOrder's batter OBP and per-PA rates, the batter-vs-pitcher
 * h2h lines, savant's Statcast, and teamOff's opsVsR/opsVsL — all whole-season
 * pulls, all on the offence side. Do not read a clean result here as a clean
 * harness; read it as "the pitcher side is clean".
 *
 * NO SILENT FALLBACK. An arm missing from the index returns null, so nrfiRegress
 * sends it to the league mean. Falling back to the API would quietly restore the
 * leak for exactly the arms the index cannot vouch for, and the numbers would
 * still look like numbers. Misses are counted and the harness reports them.
 */
const PIT_MODE = process.env.NRFI_LEAKY === "1" ? "leaky" : "point-in-time";
// Recorded, not just applied. The whole reason the split leak survived so long
// is that a leaky cache and a clean one were byte-indistinguishable on their
// metadata, so any artifact written by a run has to carry the mode that
// produced it or the next reader inherits the same trap.
const H2H_MODE = process.env.NRFI_NO_H2H === "1" ? "off (ablation)" : "season (leaks)";
pitI01.stats = { pit: 0, miss: 0, api: 0 };
let lfGames = null;
function leakfreeGames() {
  if (lfGames) return lfGames;
  const gf = path.join(__dirname, "nrfi-leakfree-games.json");
  if (!fs.existsSync(gf)) {
    throw new Error("point-in-time splits need nrfi-leakfree-games.json — run " +
      "node scripts/nrfi-leakfree.js --refresh, or set NRFI_LEAKY=1 to score " +
      "with the season-to-date leak left in");
  }
  const games = JSON.parse(fs.readFileSync(gf, "utf8")).games;
  if (!games.length || games[0].hpRuns == null) {
    throw new Error("nrfi-leakfree-games.json predates the hpRuns/apRuns fields — " +
      "re-run node scripts/nrfi-leakfree.js --refresh");
  }
  return (lfGames = games);
}
// Both indexes walk the same per-game log, so they share one prefix scan: sum
// the runs on every entry for this season strictly before `asOf`. The log is
// date-sorted, so the first non-prior entry ends it.
function priorRuns(log, se, asOf) {
  let runs = 0, n = 0;
  for (const e of log) {
    if (e.season !== se) continue;
    if (!(e.date < asOf)) break;
    runs += e.runs; n++;
  }
  return { runs, n };
}
const byDateAsc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
let pitIndex = null;
function pitcherIndex() {
  if (pitIndex) return pitIndex;
  const games = leakfreeGames();
  pitIndex = new Map();
  const push = (id, date, season, runs) => {
    if (id == null) return;
    const k = String(id);
    let a = pitIndex.get(k); if (!a) pitIndex.set(k, a = []);
    a.push({ date, season, runs });
  };
  for (const g of games) {
    // hpRuns is what the HOME starter allowed (the away side batted), and
    // apRuns what the AWAY starter allowed. Crossing these silently inverts
    // every arm in the model, so it is spelled out rather than inferred.
    push(g.hp, g.date, g.season, g.hpRuns);
    push(g.ap, g.date, g.season, g.apRuns);
  }
  // Sorted by date so the prefix scan is a walk-forward rather than a filter
  // over an arbitrary order, which is what lets the scan stop at the first
  // non-prior start instead of reading the whole log.
  for (const log of pitIndex.values()) log.sort(byDateAsc);
  return pitIndex;
}
/* Point-in-time TEAM first-inning offence, out of the same cache.
 *
 * The pitcher index reads the log as "runs this arm ALLOWED". The same two
 * numbers read the other way are "runs this lineup SCORED": the away side bats
 * against the home starter, so hpRuns is the AWAY team's first inning, and
 * apRuns is the HOME team's. That is the entire mapping, and getting it
 * backwards would invert every offence in the model while still producing a
 * plausible-looking rate, so it is spelled out rather than inferred.
 *
 * Only `rate` and `sample` are rewound. opsVsR/opsVsL stay whole-season: the
 * cache has no handedness and no OPS, and inventing a substitute estimator
 * would confound "rewound" with "measured a different way" in any A/B — the
 * same reason pitI01's ERA is scaled rather than recomputed. So the offence
 * term is now clean and the platoon adjustment on top of it is not.
 */
let teamIndex = null;
function teamOffIndex() {
  if (teamIndex) return teamIndex;
  teamIndex = new Map();
  const push = (id, date, season, runs) => {
    if (id == null) return;
    const k = String(id);
    let a = teamIndex.get(k); if (!a) teamIndex.set(k, a = []);
    a.push({ date, season, runs });
  };
  for (const g of leakfreeGames()) {
    push(g.away, g.date, g.season, g.hpRuns);
    push(g.home, g.date, g.season, g.apRuns);
  }
  for (const log of teamIndex.values()) log.sort(byDateAsc);
  return teamIndex;
}
const pitI01Api = (id, se) => memo("p" + id + se, async () => {
  try { const d = await J(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=statSplits&group=pitching&sitCodes=i01&season=${se}`);
    const s = d.stats?.[0]?.splits?.[0]?.stat; if (!s || !s.gamesPlayed) return null;
    return { rate: (+s.runs || 0) / s.gamesPlayed, sample: s.gamesPlayed, era: numOrNull(s.era) }; } catch { return null; }
});
function pitI01(id, se, asOf) {
  if (id == null) return Promise.resolve(null);
  if (PIT_MODE === "leaky" || !asOf) { pitI01.stats.api++; return pitI01Api(id, se); }
  const log = pitcherIndex().get(String(id));
  if (!log) { pitI01.stats.miss++; return Promise.resolve(null); }
  const { runs, n } = priorRuns(log, se, asOf);
  if (!n) { pitI01.stats.miss++; return Promise.resolve(null); }
  pitI01.stats.pit++;
  /* First-inning ERA, rewound by the same ratio as the rate.
   *
   * The log carries runs, not earned runs or first-inning IP, so a point-in-time
   * ERA cannot be computed directly. Substituting a different estimator (say
   * rate*9) would confound "rewound" with "measured a new way" in any A/B, so
   * instead the season ERA is scaled by how far the point-in-time rate sits from
   * the season rate. Identical construction, moved backwards in time.
   *
   * This is a partial fix and it is honest about which part: the season ERA it
   * scales is still a whole-season number. It feeds openerFactor at weight 0.5
   * inside a [0.9, 1.12] clamp, so the residue is second-order next to the rate,
   * which drives pitBase directly. Returning null instead would silence
   * openerFactor entirely and that is a bigger distortion than the leak it
   * removes. */
  const full = log.filter((e) => e.season === se);
  const fullRate = full.length ? full.reduce((s, e) => s + e.runs, 0) / full.length : null;
  const rate = runs / n;
  return pitI01Api(id, se).then((api) => ({
    rate, sample: n,
    era: api && api.era != null && fullRate ? api.era * (rate / fullRate) : (api ? api.era : null),
  })).catch(() => ({ rate, sample: n, era: null }));
}
const teamOffApi = (id, se) => memo("t" + id + se, async () => {
  try { const d = await J(`https://statsapi.mlb.com/api/v1/teams/${id}/stats?stats=statSplits&group=hitting&sitCodes=i01,vr,vl&season=${se}`);
    const sp = d.stats?.[0]?.splits || []; const f = (re) => sp.find((x) => re.test(x.split?.description || ""))?.stat;
    const i01 = f(/first inning/i), vr = f(/right/i), vl = f(/left/i); if (!i01 || !i01.gamesPlayed) return null;
    return { rate: (+i01.runs || 0) / i01.gamesPlayed, sample: i01.gamesPlayed, opsVsR: vr?.ops != null ? +vr.ops : null, opsVsL: vl?.ops != null ? +vl.ops : null }; } catch { return null; }
});
teamOff.stats = { pit: 0, miss: 0, api: 0 };
function teamOff(id, se, asOf) {
  if (id == null) return Promise.resolve(null);
  if (PIT_MODE === "leaky" || !asOf) { teamOff.stats.api++; return teamOffApi(id, se); }
  const log = teamOffIndex().get(String(id));
  if (!log) { teamOff.stats.miss++; return Promise.resolve(null); }
  const { runs, n } = priorRuns(log, se, asOf);
  if (!n) { teamOff.stats.miss++; return Promise.resolve(null); }
  teamOff.stats.pit++;
  // Same no-silent-fallback rule as pitI01: a team the index cannot vouch for
  // returns null and gets regressed to the league mean, rather than quietly
  // getting the season-to-date number back. The platoon OPS still comes from
  // the season call — see teamOffIndex for why it is not rewound with it.
  return teamOffApi(id, se).then((api) => ({
    rate: runs / n, sample: n,
    opsVsR: api ? api.opsVsR : null, opsVsL: api ? api.opsVsL : null,
  })).catch(() => ({ rate: runs / n, sample: n, opsVsR: null, opsVsL: null }));
}
/* Point-in-time starter season line, summed out of the game log.
 *
 * nrfiEvaluate reads seasonEra, ip, g and allow off this object — openerFactor
 * and seasonLoadFactor take the first two, pitcherI01Profile the era, and the
 * base-out sim takes `allow` as the pitcher's per-PA event distribution. All
 * four came from the `type=[season]` payload, which is the pitcher's WHOLE
 * season including the start being predicted, and for an April game including
 * every start through September. Rewinding pitI01 while leaving these whole
 * meant the pitcher's first inning was point-in-time and his overall line was
 * not, which is the harder leak to spot precisely because the loud one next to
 * it had been fixed.
 *
 * The rewind costs no extra request: the game log is already fetched here (it
 * was only being used for `form`), and every field above is a sum over it. So
 * this filters the log to starts strictly before `asOf` and re-derives the line
 * from the per-game rows. Regular season only — the log carries spring and
 * postseason rows under other gameTypes, and the season aggregate does not
 * count them, so including them would make the sum disagree with the API for a
 * reason that has nothing to do with the rewind.
 *
 * nrfi-rewind-test.js asserts the sum reproduces the API season aggregate when
 * asOf is past the last start. That equality is the whole warrant for this
 * function: it is the difference between "rewound" and "computed a different
 * statistic and called it rewound".
 *
 * `form` is left on the object for shape parity and is NOT rewound, because
 * nrfiEvaluate does not read it — the L3-FIP factor was withdrawn on
 * measurement (see the REMOVED note in app.jsx). If it is ever restored it must
 * be rewound first: `.slice(-3)` of a full-season log is the last three starts
 * of SEPTEMBER no matter which game is being scored.
 */
const GLOG_REG = (sp) => (sp || []).filter((x) => (x.gameType || "R") === "R");
function sumPitLog(rows) {
  const n0 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const acc = { earnedRuns: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
    baseOnBalls: 0, hitByPitch: 0, battersFaced: 0, strikeOuts: 0 };
  let ipOuts = 0, gs = 0, g = 0;
  for (const r of rows) {
    const s = r.stat || {};
    for (const k of Object.keys(acc)) acc[k] += n0(s[k]);
    ipOuts += Math.round(parseIp(s.inningsPitched) * 3);
    gs += n0(s.gamesStarted); g += n0(s.gamesPlayed);
  }
  const ip = ipOuts / 3;
  return { gs, g, ip, seasonK9: ip > 0 ? acc.strikeOuts * 9 / ip : null,
    // A pitcher with appearances but no outs recorded has an undefined ERA, not
    // an infinite one — same call MLB's own "INF" sentinel forces, and null is
    // what the guards downstream are written against.
    seasonEra: ip > 0 ? acc.earnedRuns * 9 / ip : null,
    allow: acc.battersFaced > 0 ? paRates(acc, acc.battersFaced, NRFI_PA_REG_PIT) : null };
}
/* The L3 K/9 window, which nrfiEvaluate's "Pitcher K9 trend" check VOTES on.
 *
 * This was the drift that mattered most in this file. That check reads
 * recentK9, seasonK9 and recentIp off the meta object; the lib's pitMeta never
 * returned any of them, so `m.recentK9 == null` sent it to null on every
 * backtest row and the check simply was not there. It fires live, it feeds the
 * consensus, and the consensus gates which rung a game lands on — so every tier
 * volume and hit rate in the backtest was measured on a model with one fewer
 * check than the one that ships. Not a wrong number: a different model.
 *
 * Starts only, matching app.jsx — a relief appearance is not a data point about
 * a starter's stuff, and mixing one in drags the window. Point-in-time falls out
 * of the same filter: the last three starts BEFORE asOf, not the last three of
 * the season.
 */
function recentK9Window(startsBefore) {
  const last = startsBefore.slice(-3);
  let k = 0, ip = 0;
  for (const r of last) { k += Number(r.stat?.strikeOuts) || 0; ip += parseIp(r.stat?.inningsPitched); }
  return ip > 0 ? { recentK9: k * 9 / ip, recentIp: ip } : { recentK9: null, recentIp: null };
}
const pitMeta = (id, se, asOf) => id == null ? Promise.resolve({ hand: null, form: null, seasonEra: null, gs: null, g: null, ip: null, allow: null, id: null, recentK9: null, seasonK9: null, recentIp: null }) : memo("m" + id + se + (PIT_MODE === "leaky" || !asOf ? "" : ":" + asOf), async () => {
  let hand = null, form = null, seasonEra = null, gs = null, g = null, ip = null, allow = null;
  let recentK9 = null, seasonK9 = null, recentIp = null;
  try { const [p, gl] = await Promise.all([
      J(`https://statsapi.mlb.com/api/v1/people/${id}?hydrate=stats(group=[pitching],type=[season],season=${se})`),
      J(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=gameLog&group=pitching&season=${se}`)]);
    const pp = p.people?.[0]; hand = pp?.pitchHand?.code || null;
    const splits = GLOG_REG(gl.stats?.[0]?.splits);
    const isStart = (x) => Number(x.stat?.gamesStarted) === 1;
    if (PIT_MODE === "leaky" || !asOf) {
      pitMeta.stats.api++;
      const s = pp?.stats?.[0]?.splits?.[0]?.stat;
      if (s) {
        seasonEra = numOrNull(s.era); gs = numOrNull(s.gamesStarted); g = numOrNull(s.gamesPlayed);
        ip = s.inningsPitched != null ? parseIp(s.inningsPitched) : null;
        allow = paRates(s, s.battersFaced, NRFI_PA_REG_PIT);
        const k = Number(s.strikeOuts) || 0; if (ip > 0) seasonK9 = k * 9 / ip;
      }
      ({ recentK9, recentIp } = recentK9Window(splits.filter(isStart)));
    } else {
      const prior = splits.filter((x) => x.date && x.date < asOf);
      if (!prior.length) {
        // Same no-silent-fallback rule as pitI01 and teamOff: a debut start has
        // no prior line, and handing back the season one would be the leak this
        // function exists to remove. Nulls let the model regress him to the
        // league prior, which is what "no information" is supposed to look like.
        pitMeta.stats.miss++;
      } else {
        pitMeta.stats.pit++;
        ({ gs, g, ip, seasonEra, seasonK9, allow } = sumPitLog(prior));
        ({ recentK9, recentIp } = recentK9Window(prior.filter(isStart)));
      }
    }
    const last = splits.slice(-3); if (last.length) { let er = 0, lip = 0; last.forEach((x) => { er += +(x.stat?.earnedRuns || 0); lip += parseIp(x.stat?.inningsPitched); }); if (lip > 0) form = er * 9 / lip; }
  } catch { /* nulls */ }
  return { hand, form, seasonEra, gs, g, ip, allow, id, recentK9, seasonK9, recentIp };
});
// After the declaration, not before it: pitMeta is a const arrow, and a const is
// hoisted without being initialised, so touching it above throws on load.
pitMeta.stats = { pit: 0, miss: 0, api: 0 };
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
      /* The h2h line CANNOT be rewound, and this is how its leak gets bounded.
       *
       * type=[vsPlayer] returns this batter's record against this pitcher over
       * the whole season — including the plate appearances in the game being
       * scored. Unlike pitI01, teamOff and pitMeta there is no per-game log to
       * sum, so there is no honest point-in-time version to build.
       *
       * What is available is an ablation. NRFI_NO_H2H=1 drops the blend and
       * leaves the batter on his season rates, which is strictly LESS
       * information than the app has live, so it under-states the model rather
       * than over-stating it. Running the backtest both ways brackets the
       * truth: the clean number is at least the no-h2h number, and at most the
       * with-h2h one. A bracket you can state is worth more than a single
       * figure you cannot defend.
       */
      if (oppPitcherId && batters.some(Boolean) && process.env.NRFI_NO_H2H !== "1") {
        try {
          const h2hD = await J(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(",")}&hydrate=stats(group=[hitting],type=[vsPlayer],opposingPlayerId=${oppPitcherId},season=${se})`);
          const h2h = {}; (h2hD.people || []).forEach((p) => { const s = p.stats?.[0]?.splits?.[0]?.stat; const pa = s ? Number(s.plateAppearances || s.atBats || 0) : 0; if (s && pa >= 5) h2h[p.id] = { pa, rates: paRates(s, pa, NRFI_PA_REG_H2H) }; });
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
    // `date` is what rewinds the splits: pitI01, pitMeta and teamOff count only
    // games before it. topOrder still takes season aggregates.
    pitI01(ap.id, se, date), pitI01(hp.id, se, date), pitMeta(ap.id, se, date), pitMeta(hp.id, se, date),
    teamOff(a.team.id, se, date), teamOff(h.team.id, se, date), travelRest(a.team.id, date, g.venue?.id), travelRest(h.team.id, date, g.venue?.id)]);
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

// Fingerprint of the actual model math, for pinning cached model output.
// NRFI_SIM_W alone was not enough: rebuilding PITCHER_BT and its vote cutoffs
// changed every cached `aligned` value while leaving NRFI_SIM_W untouched, so a
// cache built before that change would still have passed the guard and reported
// consensus numbers from a model that no longer exists. This covers every line
// that is actually sliced, so any of them moving invalidates the cache.
//
// It also has to cover THIS file's fetchers, not just app.jsx's math. Rewinding
// teamOff to point-in-time changed what every cached score was computed from
// while touching no sliced line in app.jsx, so the fingerprint would not have
// moved and the sweep cache built minutes earlier would still have passed the
// guard — reporting hit rates from inputs the model no longer uses. A model is
// its math AND the data it is handed; a fingerprint over half of that is a
// fingerprint that lets the other half change in silence.
const dataSlice = (() => {
  const src = fs.readFileSync(__filename, "utf8");
  const a = src.indexOf("// ---- data (Node fetchers");
  const b = src.indexOf("async function buildCtx(");
  if (a < 0 || b < 0 || b <= a) throw new Error("could not slice the fetcher section for modelSig");
  return src.slice(a, b);
})();
const modelSig = require("crypto").createHash("sha1")
  .update(model + VERDICT_SLICES.map(([a, b]) => slice(a, b)).join("\n") + dataSlice)
  .digest("hex").slice(0, 12);

module.exports = { nrfiEvaluate, weatherPark, paRates, NRFI_LG_TOP3_OBP, makeVerdict,
  J, parseIp, memo, pitI01, teamOff, pitMeta, topOrder, travelRest, savant, mapLimit,
  buildCtx, scoreBothPaths, C, modelSig,
  // PIT_MODE and the counters are exported so a harness can PRINT which split
  // source it ran on. A backtest that does not say whether it rewound its inputs
  // is not reporting a result, and the difference between the two modes here is
  // larger than most of the effects these scripts are built to measure.
  PIT_MODE, H2H_MODE,
  pitStats: () => ({ ...pitI01.stats, off: { ...teamOff.stats }, meta: { ...pitMeta.stats }, h2h: H2H_MODE }),
  sumPitLog, GLOG_REG, NRFI_CALIB_SEED, NRFI_PA_REG_PIT, NRFI_PA_REG_H2H };
