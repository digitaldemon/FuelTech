#!/usr/bin/env node
// backtest-nrfi.js — NRFI model backtest against MLB Stats API historical data
//
// Usage: node scripts/backtest-nrfi.js [startDate] [endDate] [--fast]
//   Dates: YYYY-MM-DD. Defaults to 2025-04-01 → yesterday.
//   --fast: skip rolling-NRFI per-start linescore fetches (much faster, slightly less accurate)
//
// Output: summary stats to stderr, per-game CSV to stdout.
//   node scripts/backtest-nrfi.js 2025-04-01 > results.csv

import { setTimeout as sleep } from "timers/promises";
import { writeFileSync } from "fs";

// ── Model constants (mirrored from app.jsx) ─────────────────────────────────
const LG_LAMBDA   = 0.52;
const LG_P0       = 0.72;
const OFF_REG     = 6;
const PIT_REG     = 12;
const CALIB_SEED  = { c: 0.012, active: true };

const PARK = {
  COL: 1.14, BOS: 1.06, CIN: 1.06, KC:  1.04, KCR: 1.04, ARI: 1.04,
  BAL: 1.03, PHI: 1.03, TEX: 1.02, TOR: 1.02, LAA: 1.02, MIN: 1.02,
  ATL: 1.01, HOU: 1.01, CHC: 1.01, NYY: 1.01, WSH: 1.01, WSN: 1.01,
  MIL: 1.00, CWS: 1.00, CHW: 1.00, LAD: 0.99, STL: 0.99, PIT: 0.99,
  TB:  0.98, TBR: 0.98, CLE: 0.98, DET: 0.97, NYM: 0.97,
  OAK: 0.97, ATH: 0.97, SAC: 0.97, MIA: 0.95, SEA: 0.94, SD: 0.94, SF: 0.93,
};

// NRFI_LG_PA Markov outcome distribution
const LG_PA = { out: 0.685, bb: 0.085, s1: 0.140, s2: 0.045, s3: 0.004, hr: 0.033 };

// ── Math ────────────────────────────────────────────────────────────────────
const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const logit   = (p)  => Math.log(p / (1 - p));
const unlogit = (x)  => 1 / (1 + Math.exp(-x));
const num     = (v)  => { const n = Number(v); return isFinite(n) ? n : null; };

function nrfiRegress(rate, sample, reg) {
  const r = rate ?? LG_LAMBDA;
  return (r * sample + LG_LAMBDA * reg) / (sample + reg);
}

// λ-model: log5-style half-inning no-run probability
function halfNoRun(offLam, pitLam, env) {
  const lam = clamp((offLam * pitLam) / LG_LAMBDA * (env || 1), 0.05, 1.9);
  return Math.pow(LG_P0, lam / LG_LAMBDA);
}

// Markov chain: P(scoreless half-inning) given batter per-PA rates vs pitcher allow-rates
function simHalfNoRun(batters, pAllow, lg) {
  const keys = ["out", "bb", "s1", "s2", "s3", "hr"];
  // Mix batter vs pitcher around league mean (log5)
  function log5(bRate, pRate, lgRate) {
    if (lgRate <= 0) return bRate;
    const blend = (bRate * pRate) / lgRate;
    return clamp(blend, 0, 1);
  }
  function paFor(bat) {
    return {
      out: log5(bat.out, pAllow.out, lg.out),
      bb:  log5(bat.bb,  pAllow.bb,  lg.bb),
      s1:  log5(bat.s1,  pAllow.s1,  lg.s1),
      s2:  log5(bat.s2,  pAllow.s2,  lg.s2),
      s3:  log5(bat.s3,  pAllow.s3,  lg.s3),
      hr:  log5(bat.hr,  pAllow.hr,  lg.hr),
    };
  }
  // 24-state (8 base configs × 3 out counts)
  const BASE_STATES = 8;
  let states = new Array(BASE_STATES * 3).fill(0);
  states[0] = 1; // start: bases empty, 0 outs
  let pNoRun = 0;

  function baseIdx(first, second, third) {
    return (first ? 4 : 0) | (second ? 2 : 0) | (third ? 1 : 0);
  }

  const N = Math.min(batters.length, 12);
  for (let bi = 0; bi < N; bi++) {
    const pa = paFor(batters[bi % batters.length]);
    const next = new Array(BASE_STATES * 3).fill(0);
    for (let s = 0; s < BASE_STATES * 3; s++) {
      if (states[s] === 0) continue;
      const outs = Math.floor(s / BASE_STATES);
      const base = s % BASE_STATES;
      const first  = !!(base & 4);
      const second = !!(base & 2);
      const third  = !!(base & 1);
      const prob   = states[s];

      // Out
      if (outs < 2) {
        next[(outs + 1) * BASE_STATES + base] += prob * pa.out;
      } else {
        pNoRun += prob * pa.out; // inning over, no run scored yet
      }
      // Walk
      const walkFirst = true;
      const walkSecond = first;
      const walkThird  = second || (first && second);
      const walkRun    = first && second && third;
      if (!walkRun) {
        const nb = baseIdx(walkFirst, walkSecond, walkThird || third);
        next[outs * BASE_STATES + nb] += prob * pa.bb;
      }
      // Single
      const s1Run = third || (second && Math.random() < 0.5); // simplification
      if (!s1Run) {
        const nb = baseIdx(true, false, second);
        next[outs * BASE_STATES + nb] += prob * pa.s1;
      }
      // Double
      const d2Run = third || second;
      if (!d2Run) {
        const nb = baseIdx(false, true, false);
        next[outs * BASE_STATES + nb] += prob * pa.s2;
      }
      // Triple
      if (!third) {
        const nb = baseIdx(false, false, true);
        next[outs * BASE_STATES + nb] += prob * pa.s3;
      }
      // HR — always scores (if runners on base, runs score but we only care about first run)
      if (!first && !second && !third) {
        next[outs * BASE_STATES + 0] += prob * pa.hr; // solo HR, still no run yet? No — HR always scores
        // Actually solo HR = 1 run. So this terminates the no-run state.
        // HR always produces a run, end the inning's no-run streak
      }
      // HR terminates no-run (always a run)
      // Already handled above: we do NOT add to next for HR since a run scores
    }
    states = next;
    // If all probability is in "run scored" state, break early
    const remaining = states.reduce((s, v) => s + v, 0);
    if (remaining < 0.001) break;
  }
  // Remaining state probability = inning ended (3 outs) without a run
  pNoRun += states.reduce((s, v) => s + v, 0);
  return clamp(pNoRun, 0.02, 0.98);
}

// Calibration
function applyCalibration(p) {
  if (!CALIB_SEED.active) return p;
  const pc = clamp(p, 0.02, 0.98);
  return clamp(unlogit(logit(pc) + CALIB_SEED.c), 0.02, 0.98);
}

// ── HTTP Cache ───────────────────────────────────────────────────────────────
const _cache = new Map();
let _apiCalls = 0, _cacheHits = 0;

async function getJson(url, retries = 3) {
  if (_cache.has(url)) { _cacheHits++; return _cache.get(url); }
  _apiCalls++;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (r.status === 429) { await sleep(3000); continue; }
      if (r.status === 404) { _cache.set(url, null); return null; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      _cache.set(url, d);
      return d;
    } catch (e) {
      if (attempt === retries - 1) return null;
      await sleep(600 * (attempt + 1));
    }
  }
  return null;
}

const MLB = "https://statsapi.mlb.com/api/v1";

// ── Data fetchers ────────────────────────────────────────────────────────────

async function getSchedule(date) {
  const url = `${MLB}/schedule?sportId=1&date=${date}&hydrate=probablePitcher,linescore(matchup,plays),team,weather`;
  const d = await getJson(url);
  return (d?.dates?.[0]?.games) || [];
}

async function getPitcherSplits(pid, season) {
  const url = `${MLB}/people/${pid}/stats?stats=statSplits&group=pitching&sitCodes=i01&season=${season}`;
  const d = await getJson(url);
  const splits = d?.stats?.[0]?.splits || [];
  if (!splits.length) return null;
  const s = splits[0].stat;
  const games = num(s.gamesPlayed) || 0;
  const ip    = parseFloat(s.inningsPitched || "0");
  const safIp = Math.max(ip, 0.1);
  return {
    rate:   games > 0 ? (num(s.runs) || 0) / games : null,
    era:    num(s.era),
    whip:   num(s.whip),
    k9:     (num(s.strikeOuts) || 0) * 9 / safIp,
    bb9:    (num(s.baseOnBalls) || 0) * 9 / safIp,
    hr9:    (num(s.homeRuns) || 0) * 9 / safIp,
    bf:     num(s.battersFaced) || 0,
    sample: games,
  };
}

async function getTeamSplits(teamId, season) {
  const url = `${MLB}/teams/${teamId}/stats?stats=statSplits&group=hitting&sitCodes=i01&season=${season}`;
  const d = await getJson(url);
  const splits = d?.stats?.[0]?.splits || [];
  if (!splits.length) return null;
  const s = splits[0].stat;
  const games = num(s.gamesPlayed) || 0;
  return {
    rate:   games > 0 ? (num(s.runs) || 0) / games : LG_LAMBDA,
    obp:    num(s.obp),
    sample: games,
  };
}

async function getPitcherSeason(pid, season) {
  const url = `${MLB}/people/${pid}?hydrate=stats(group=[pitching],type=[season],season=${season})`;
  const d = await getJson(url);
  const person = d?.people?.[0];
  if (!person) return null;
  const stats = person.stats || [];
  const s = stats[0]?.splits?.[0]?.stat;
  return {
    era:    s ? num(s.era) : null,
    ip:     s ? parseFloat(s.inningsPitched || "0") : 0,
    gs:     s ? num(s.gamesStarted) || 0 : 0,
    throws: person.pitchHand?.code || "R",
  };
}

async function getPitcherGameLog(pid, season) {
  const url = `${MLB}/people/${pid}/stats?stats=gameLog&group=pitching&season=${season}`;
  const d = await getJson(url);
  return d?.stats?.[0]?.splits || [];
}

async function getGameLinescore(gamePk) {
  const url = `${MLB}/game/${gamePk}/linescore`;
  return await getJson(url);
}

// ── Rolling NRFI with date cutoff (no lookahead bias) ──────────────────────
const _rollingCache = new Map();

async function rollingNRFI(pid, season, beforeDate, fast) {
  const key = `${pid}:${season}:${beforeDate}`;
  if (_rollingCache.has(key)) return _rollingCache.get(key);

  let val = null;
  if (!fast) {
    try {
      const log = await getPitcherGameLog(pid, season);
      const starts = log
        .filter(s => num(s.stat?.gamesStarted) === 1)
        .filter(s => { const d = s.date || s.game?.date; return d && d < beforeDate; })
        .map(s => ({ gamePk: s.game?.gamePk, isHome: !!s.isHome }))
        .filter(x => x.gamePk);

      if (starts.length >= 3) {
        const results = await Promise.all(starts.map(async item => {
          try {
            const ls = await getGameLinescore(item.gamePk);
            const inn1 = ls?.innings?.[0];
            if (!inn1) return null;
            const r = item.isHome
              ? num(inn1.away?.runs) || 0
              : num(inn1.home?.runs) || 0;
            return r === 0;
          } catch { return null; }
        }));
        const valid = results.filter(x => x !== null);
        if (valid.length >= 3) {
          const pct = arr => arr.length ? Math.round(arr.filter(Boolean).length / arr.length * 100) : null;
          val = {
            szn: { pct: pct(valid),           n: valid.length },
            l30: { pct: pct(valid.slice(-30)), n: Math.min(valid.length, 30) },
            l10: { pct: pct(valid.slice(-10)), n: Math.min(valid.length, 10) },
          };
        }
      }
    } catch { /* leave null */ }
  }

  _rollingCache.set(key, val);
  return val;
}

// ── Pitcher multiplier factors ───────────────────────────────────────────────

// Recent form: compare last-3-start ERA to season ERA
async function recentFormFactor(pid, season, beforeDate) {
  const log = await getPitcherGameLog(pid, season);
  const recent = log
    .filter(s => num(s.stat?.gamesStarted) === 1)
    .filter(s => { const d = s.date || s.game?.date; return d && d < beforeDate; })
    .slice(-3);
  if (!recent.length) return 1.0;
  const er = recent.reduce((s, g) => s + (num(g.stat?.earnedRuns) || 0), 0);
  const rawIp = recent.reduce((s, g) => {
    const ip = parseFloat(g.stat?.inningsPitched || "0");
    return s + Math.floor(ip) + (ip % 1) * 10 / 3;
  }, 0);
  if (rawIp < 3) return 1.0;
  const recentEra = (er / rawIp) * 9;
  const szn = await getPitcherSeason(pid, season);
  if (!szn?.era) return 1.0;
  return clamp(1 + (recentEra - szn.era) * 0.06, 0.85, 1.20);
}

// 1st-inning ERA vs season ERA: opener/slow-starter pattern
function openerFactor(pit1st, sznEra) {
  if (!pit1st?.era || !sznEra) return 1.0;
  return clamp(1 + (pit1st.era - sznEra) * 0.04, 0.90, 1.12);
}

// Season workload
function loadFactor(szn) {
  if (!szn?.ip) return 1.0;
  if (szn.ip > 160) return 1.04;
  if (szn.ip > 140) return 1.02;
  return 1.0;
}

// ── Per-PA rates from a raw stat line ────────────────────────────────────────
function paRatesFromSplits(pit) {
  if (!pit) return null;
  const bf = Math.max(pit.bf || 1, 1);
  // approximate from aggregated stats
  const ipInnings = (pit.k9 != null && pit.bb9 != null)
    ? bf / 4.3  // rough: ~4.3 BF per inning
    : bf;
  const outs = num(pit.sample) || 0;  // we don't have outs directly from i01 split
  // Estimate from 9-inning rates
  const k  = pit.k9  != null ? pit.k9  / 9 * (bf / 27) : 0.22 * bf;
  const bb = pit.bb9 != null ? pit.bb9 / 9 * (bf / 27) : 0.085 * bf;
  const hr = pit.hr9 != null ? pit.hr9 / 9 * (bf / 27) : 0.033 * bf;
  const h  = pit.whip != null ? (pit.whip - pit.bb9 / 9) * (bf / 27) : 0.22 * bf;
  const s1 = Math.max(0, h - hr * 0.3) * 0.7;
  const s2 = Math.max(0, h - hr * 0.3) * 0.2;
  const s3 = Math.max(0, h - hr * 0.3) * 0.05;
  const total = Math.max(k + bb + hr + s1 + s2 + s3, 0.01);
  return {
    out: clamp((bf - bb - hr - s1 - s2 - s3) / bf, 0.50, 0.80),
    bb:  clamp(bb / bf, 0.04, 0.16),
    s1:  clamp(s1 / bf, 0.08, 0.22),
    s2:  clamp(s2 / bf, 0.02, 0.08),
    s3:  clamp(s3 / bf, 0.001, 0.01),
    hr:  clamp(hr / bf, 0.01, 0.07),
  };
}

// ── Evaluate one game ────────────────────────────────────────────────────────

async function evaluateGame(game, date, season, fast) {
  const ls = game.linescore;
  if (!ls?.innings?.length) return null;

  // Only grade completed games
  const state = ls.currentInningOrdinal || "";
  const isFinal = /final/i.test(state) || (ls.currentInning >= 9 && ls.isTopInning === false);
  if (!isFinal && !(/final/i.test(game.status?.detailedState || ""))) return null;

  const inn1 = ls.innings[0];
  if (!inn1) return null;
  const awayRuns1 = num(inn1.away?.runs) || 0;
  const homeRuns1 = num(inn1.home?.runs) || 0;
  const totalRuns1 = awayRuns1 + homeRuns1;
  const nrfiActual = totalRuns1 === 0;

  const awayTeam = game.teams?.away;
  const homeTeam = game.teams?.home;
  const awayPP   = awayTeam?.probablePitcher;
  const homePP   = homeTeam?.probablePitcher;
  if (!awayPP || !homePP) return null;

  const awayAbbr = awayTeam?.team?.abbreviation || "";
  const homeAbbr = homeTeam?.team?.abbreviation || "";

  const [
    awayPit, homePit, awayOff, homeOff,
    awayPitSzn, homePitSzn,
    awayForm, homeForm,
    awayRoll, homeRoll,
  ] = await Promise.all([
    getPitcherSplits(awayPP.id, season),
    getPitcherSplits(homePP.id, season),
    getTeamSplits(awayTeam.team.id, season),
    getTeamSplits(homeTeam.team.id, season),
    getPitcherSeason(awayPP.id, season),
    getPitcherSeason(homePP.id, season),
    recentFormFactor(awayPP.id, season, date),
    recentFormFactor(homePP.id, season, date),
    rollingNRFI(awayPP.id, season, date, fast),
    rollingNRFI(homePP.id, season, date, fast),
  ]);

  if (!awayPit || !homePit || !awayOff || !homeOff) return null;
  if (awayPit.sample < 3 || homePit.sample < 3) return null;

  // Base rates (regressed)
  const awayPitBase = nrfiRegress(awayPit.rate, awayPit.sample, PIT_REG);
  const homePitBase = nrfiRegress(homePit.rate, homePit.sample, PIT_REG);
  const awayOffBase = nrfiRegress(awayOff.rate, awayOff.sample, OFF_REG);
  const homeOffBase = nrfiRegress(homeOff.rate, homeOff.sample, OFF_REG);

  // Pitcher context multiplier (form + opener pattern + load)
  const awayOpenF = openerFactor(awayPit, awayPitSzn?.era);
  const homeOpenF = openerFactor(homePit, homePitSzn?.era);
  const awayLoadF = loadFactor(awayPitSzn);
  const homeLoadF = loadFactor(homePitSzn);

  const awayPitMult = clamp(1 + (awayForm - 1) * 0.6 + (awayOpenF - 1) * 0.5 + (awayLoadF - 1) * 0.7, 0.78, 1.25);
  const homePitMult = clamp(1 + (homeForm - 1) * 0.6 + (homeOpenF - 1) * 0.5 + (homeLoadF - 1) * 0.7, 0.78, 1.25);

  const awayPitAdj = awayPitBase * awayPitMult;
  const homePitAdj = homePitBase * homePitMult;

  // Park factor (no weather for historical games)
  const parkF = PARK[homeAbbr] || 1.0;
  const env   = parkF; // no umpire or weather data for historical games

  // λ-model probability
  const p0top  = halfNoRun(awayOffBase, homePitAdj, env);
  const p0bot  = halfNoRun(homeOffBase, awayPitAdj, env);
  const pNRFI  = p0top * p0bot;
  const pCal   = applyCalibration(pNRFI);
  const pMax   = Math.max(pCal, 1 - pCal) * 100;
  const call   = pCal >= 0.5 ? "NRFI" : "YRFI";
  const won    = (call === "NRFI") === nrfiActual;

  // Rolling NRFI signals
  const awayL10  = awayRoll?.l10?.pct ?? null;
  const homeL10  = homeRoll?.l10?.pct ?? null;
  const avgL10   = awayL10 != null && homeL10 != null ? (awayL10 + homeL10) / 2 : null;
  const awayL30  = awayRoll?.l30?.pct ?? null;
  const homeL30  = homeRoll?.l30?.pct ?? null;
  const avgL30   = awayL30 != null && homeL30 != null ? (awayL30 + homeL30) / 2 : null;

  return {
    date, gamePk: game.gamePk,
    away: awayTeam.team.name, home: homeTeam.team.name,
    awayAbbr, homeAbbr,
    awayPitcher: awayPP.fullName, homePitcher: homePP.fullName,
    awayPitSample: awayPit.sample, homePitSample: homePit.sample,
    awayPitRate: +(awayPit.rate?.toFixed(3) ?? ""),
    homePitRate: +(homePit.rate?.toFixed(3) ?? ""),
    awayOffRate:  +(awayOff.rate?.toFixed(3) ?? ""),
    homeOffRate:  +(homeOff.rate?.toFixed(3) ?? ""),
    awayPitBase: +awayPitBase.toFixed(3), homePitBase: +homePitBase.toFixed(3),
    awayOffBase: +awayOffBase.toFixed(3), homeOffBase: +homeOffBase.toFixed(3),
    awayPitAdj: +awayPitAdj.toFixed(3),  homePitAdj: +homePitAdj.toFixed(3),
    awayForm: +awayForm.toFixed(3), homeForm: +homeForm.toFixed(3),
    awayOpenF: +awayOpenF.toFixed(3), homeOpenF: +homeOpenF.toFixed(3),
    parkF: +parkF.toFixed(3),
    pNRFI: +pNRFI.toFixed(4), pCal: +pCal.toFixed(4), pMax: +pMax.toFixed(1),
    call, nrfiActual, totalRuns1, won,
    awayL10, homeL10, avgL10, awayL30, homeL30, avgL30,
  };
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function dateRange(start, end) {
  const dates = [];
  const d = new Date(start + "T12:00:00Z");
  const e = new Date(end + "T12:00:00Z");
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// ── Stats helpers ─────────────────────────────────────────────────────────────
function pct(n, d) { return d ? (n / d * 100).toFixed(1) + "%" : "n/a"; }
function avg(arr)   { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null; }

function printBucket(label, bucket) {
  const wins = bucket.filter(r => r.won).length;
  const nrfiHit = bucket.filter(r => r.nrfiActual).length;
  const avgPred = avg(bucket.map(r => r.pMax));
  process.stderr.write(
    `  ${label.padEnd(28)} n=${String(bucket.length).padStart(4)}  win=${pct(wins, bucket.length).padStart(6)}  NRFI-hit=${pct(nrfiHit, bucket.length).padStart(6)}  avgPred=${avgPred?.toFixed(1).padStart(5)}\n`
  );
}

// ── ROI simulation ────────────────────────────────────────────────────────────
// Assume flat implied market price of 60¢ for NRFI NO (NO price = 40¢ if YRFI-favored)
// This is a rough proxy; actual Kelly ROI requires live market prices.
function simulateROI(results, threshold, riskMult) {
  const bets = results.filter(r => r.pMax >= threshold && r.call === "NRFI");
  if (!bets.length) return null;
  // Rough market proxy: use pMax as model probability, assume market is at 55¢ NO (45% implied NRFI)
  // Kelly = (p*b - q) / b where b = (100-noPrice)/noPrice
  let bankroll = 100, peak = 100, maxDD = 0;
  const LG_NO_PRICE = 45; // rough proxy for market NO price
  const b = (100 - LG_NO_PRICE) / LG_NO_PRICE;
  let wins = 0, totalBet = 0;
  for (const r of bets) {
    const p = r.pCal;
    const f = clamp((p * b - (1 - p)) / b * riskMult, 0, 0.25);
    const betAmt = bankroll * f;
    totalBet += betAmt;
    if (r.won) {
      bankroll += betAmt * b;
      wins++;
    } else {
      bankroll -= betAmt;
    }
    if (bankroll > peak) peak = bankroll;
    const dd = (peak - bankroll) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return {
    bets: bets.length, wins, winPct: wins / bets.length,
    finalBankroll: bankroll, roi: (bankroll - 100), maxDD,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter(a => a.startsWith("--"));
  const fast  = flags.includes("--fast");

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const startDate = args[0] || "2025-04-01";
  const endDate   = args[1] || yesterday;

  const err = s => process.stderr.write(s + "\n");
  err(`\n╔══════════════════════════════════════════════╗`);
  err(`║     NRFI MODEL BACKTEST                       ║`);
  err(`╚══════════════════════════════════════════════╝`);
  err(`Range:  ${startDate} → ${endDate}`);
  err(`Mode:   ${fast ? "FAST (no rolling-NRFI linescores)" : "FULL (with rolling-NRFI)"}`);
  err(`\nFetching schedule and evaluating games...\n`);

  const dates = dateRange(startDate, endDate).filter(d => {
    const m = parseInt(d.slice(5, 7));
    return m >= 3 && m <= 10; // MLB season only
  });

  const results = [];
  let datesDone = 0;

  for (const date of dates) {
    const season = parseInt(date.slice(0, 4));
    try {
      const games = await getSchedule(date);
      const finalGames = games.filter(g => {
        const st = g.status?.detailedState || g.status?.abstractGameState || "";
        return /final/i.test(st);
      });

      const dayResults = [];
      for (const game of finalGames) {
        try {
          const r = await evaluateGame(game, date, season, fast);
          if (r) dayResults.push(r);
        } catch { /* skip */ }
        await sleep(30); // gentle rate limiting
      }
      results.push(...dayResults);
      datesDone++;

      if (datesDone % 10 === 0) {
        const nrfiPct = results.filter(r => r.nrfiActual).length / Math.max(results.length, 1) * 100;
        err(`  [${date}] ${results.length} games total | NRFI rate so far: ${nrfiPct.toFixed(1)}% | API calls: ${_apiCalls} (${_cacheHits} cached)`);
      }
    } catch (e) {
      err(`  Error on ${date}: ${e.message}`);
    }
    await sleep(80);
  }

  err(`\nDone. ${results.length} games evaluated across ${datesDone} dates.`);
  err(`API calls: ${_apiCalls} made, ${_cacheHits} cache hits.\n`);

  if (!results.length) { err("No results — check date range or API connectivity."); return; }

  // ── Summary Report ──────────────────────────────────────────────────────────
  const nrfiActualRate = results.filter(r => r.nrfiActual).length / results.length;
  err(`═══════════════════════════════════════════════════`);
  err(`OVERALL SUMMARY`);
  err(`═══════════════════════════════════════════════════`);
  err(`Total games:        ${results.length}`);
  err(`Actual NRFI rate:   ${(nrfiActualRate * 100).toFixed(1)}%  (0-run first innings)`);
  err(`NRFI calls:         ${results.filter(r => r.call === "NRFI").length}`);
  err(`YRFI calls:         ${results.filter(r => r.call === "YRFI").length}`);
  err(``);

  err(`WIN RATES BY pMax THRESHOLD`);
  err(`───────────────────────────────────────────────────`);
  for (const [lo, hi, label] of [
    [50, 100, "All games (model's best side)"],
    [55, 100, "Lean+    (pMax ≥ 55)"],
    [57, 100, "Lean+    (pMax ≥ 57)"],
    [60, 100, "Solid    (pMax ≥ 60)"],
    [63, 100, "Bet      (pMax ≥ 63)"],
    [65, 100, "Bet+     (pMax ≥ 65)"],
    [70, 100, "Strong   (pMax ≥ 70)"],
  ]) {
    const b = results.filter(r => r.pMax >= lo && r.pMax < hi);
    if (b.length < 10) continue;
    printBucket(label, b);
  }

  err(``);
  err(`CALIBRATION — predicted vs actual win rate`);
  err(`───────────────────────────────────────────────────`);
  for (const [lo, hi] of [[50,55],[55,60],[60,65],[65,70],[70,80],[80,100]]) {
    const b = results.filter(r => r.pMax >= lo && r.pMax < hi);
    if (b.length < 10) continue;
    const wins = b.filter(r => r.won).length;
    const avgPred = avg(b.map(r => r.pMax));
    const bias = wins / b.length * 100 - (avgPred || 0);
    const biasStr = bias > 0 ? `+${bias.toFixed(1)}` : bias.toFixed(1);
    err(`  pMax ${String(lo).padStart(2)}-${String(hi).padEnd(3)}  n=${String(b.length).padStart(4)}  pred=${avgPred?.toFixed(1).padStart(5)}%  actual=${pct(wins, b.length).padStart(6)}  bias=${biasStr.padStart(6)}`);
  }

  err(``);
  err(`NRFI-ONLY vs YRFI-ONLY WIN RATES`);
  err(`───────────────────────────────────────────────────`);
  for (const call of ["NRFI", "YRFI"]) {
    for (const thresh of [57, 63, 70]) {
      const b = results.filter(r => r.call === call && r.pMax >= thresh);
      if (b.length < 10) continue;
      printBucket(`${call} pMax ≥ ${thresh}`, b);
    }
  }

  // Rolling NRFI signal analysis
  const withRoll = results.filter(r => r.avgL10 != null);
  if (withRoll.length >= 20) {
    err(``);
    err(`ROLLING NRFI SIGNAL ANALYSIS (L10 avg clean%)`);
    err(`───────────────────────────────────────────────────`);
    for (const [lo, hi, label] of [
      [70, 101, "Both avg L10 ≥ 70% (elite duo)"],
      [60, 101, "Both avg L10 ≥ 60%"],
      [50, 101, "Both avg L10 ≥ 50%"],
      [0,  50,  "Avg L10 < 50% (one or both shaky)"],
    ]) {
      const b = withRoll.filter(r => r.nrfiActual && r.avgL10 != null)
        .concat(withRoll.filter(r => !r.nrfiActual && r.avgL10 != null))
        .filter(() => false); // rebuild properly
      const bb = withRoll.filter(r => r.avgL10 != null && r.avgL10 >= lo && r.avgL10 < hi);
      if (bb.length < 10) continue;
      const nrfiHits = bb.filter(r => r.nrfiActual).length;
      err(`  ${label.padEnd(38)} n=${String(bb.length).padStart(4)}  NRFI-hit=${pct(nrfiHits, bb.length).padStart(6)}`);
    }

    // Correlation: does higher avgL10 → higher actual NRFI rate?
    const sorted = [...withRoll].sort((a, b) => a.avgL10 - b.avgL10);
    const tercile = Math.floor(sorted.length / 3);
    const bot = sorted.slice(0, tercile);
    const mid = sorted.slice(tercile, tercile * 2);
    const top = sorted.slice(tercile * 2);
    err(`  L10 tercile analysis:`);
    err(`    Bottom third (lowest avg L10): NRFI hit rate = ${pct(bot.filter(r => r.nrfiActual).length, bot.length)}`);
    err(`    Middle third:                  NRFI hit rate = ${pct(mid.filter(r => r.nrfiActual).length, mid.length)}`);
    err(`    Top third (highest avg L10):   NRFI hit rate = ${pct(top.filter(r => r.nrfiActual).length, top.length)}`);
  }

  // Factor correlation analysis
  err(``);
  err(`FACTOR IMPORTANCE — correlation with NRFI outcome`);
  err(`───────────────────────────────────────────────────`);
  const factors = [
    ["Avg pit base rate (lower = NRFI-friendly)", r => (r.awayPitBase + r.homePitBase) / 2, true],
    ["Avg off base rate (lower = NRFI-friendly)", r => (r.awayOffBase + r.homeOffBase) / 2, true],
    ["Avg pit adj rate (form+opener adj)",        r => (r.awayPitAdj + r.homePitAdj) / 2, true],
    ["Park factor",                               r => r.parkF, true],
    ["Avg form factor (>1 = struggling)",         r => (r.awayForm + r.homeForm) / 2, true],
  ];
  for (const [label, fn, lowerIsBetter] of factors) {
    const valid = results.filter(r => fn(r) != null);
    if (valid.length < 20) continue;
    const sorted = [...valid].sort((a, b) => fn(a) - fn(b));
    const tercile = Math.floor(sorted.length / 3);
    const bot = sorted.slice(0, tercile);
    const top = sorted.slice(tercile * 2);
    const botRate = bot.filter(r => r.nrfiActual).length / bot.length * 100;
    const topRate = top.filter(r => r.nrfiActual).length / top.length * 100;
    const better = lowerIsBetter ? bot : top;
    const betterRate = lowerIsBetter ? botRate : topRate;
    const delta = Math.abs(topRate - botRate);
    err(`  ${label.padEnd(42)} Δ=${delta.toFixed(1).padStart(5)}pp  top-tercile NRFI=${betterRate.toFixed(1)}%`);
  }

  // ROI simulation at different thresholds
  err(``);
  err(`ROI SIMULATION (flat 45¢ NO price proxy, full Kelly)`);
  err(`───────────────────────────────────────────────────`);
  for (const thresh of [57, 60, 63, 65, 70]) {
    for (const [mult, label] of [[0.25, "conservative"],[0.5, "moderate"],[1.0, "aggressive"]]) {
      const roi = simulateROI(results, thresh, mult);
      if (!roi || roi.bets < 10) continue;
      err(`  pMax≥${thresh} ${label.padEnd(12)} bets=${String(roi.bets).padStart(4)}  win=${pct(roi.wins, roi.bets).padStart(6)}  ROI=${roi.roi >= 0 ? "+" : ""}${roi.roi.toFixed(1).padStart(7)}  maxDD=${roi.maxDD.toFixed(1).padStart(5)}%`);
    }
  }

  // Best individual pitchers (most starts, highest clean rate)
  err(``);
  err(`TOP NRFI PITCHERS IN BACKTEST (min 10 starts)`);
  err(`───────────────────────────────────────────────────`);
  const pitMap = new Map();
  for (const r of results) {
    for (const [name, isNrfi] of [[r.awayPitcher, r.nrfiActual],[r.homePitcher, r.nrfiActual]]) {
      if (!pitMap.has(name)) pitMap.set(name, { starts: 0, clean: 0 });
      const e = pitMap.get(name);
      e.starts++;
      if (isNrfi) e.clean++;
    }
  }
  const topPit = [...pitMap.entries()]
    .filter(([, e]) => e.starts >= 10)
    .sort((a, b) => (b[1].clean / b[1].starts) - (a[1].clean / a[1].starts))
    .slice(0, 15);
  for (const [name, e] of topPit) {
    err(`  ${name.padEnd(25)} ${e.clean}/${e.starts} = ${pct(e.clean, e.starts).padStart(6)} clean 1sts`);
  }

  err(``);
  err(`WORST NRFI PITCHERS IN BACKTEST (min 10 starts)`);
  err(`───────────────────────────────────────────────────`);
  const botPit = [...pitMap.entries()]
    .filter(([, e]) => e.starts >= 10)
    .sort((a, b) => (a[1].clean / a[1].starts) - (b[1].clean / b[1].starts))
    .slice(0, 10);
  for (const [name, e] of botPit) {
    err(`  ${name.padEnd(25)} ${e.clean}/${e.starts} = ${pct(e.clean, e.starts).padStart(6)} clean 1sts`);
  }

  err(`\n═══════════════════════════════════════════════════`);
  err(`CSV output follows on stdout. Redirect to file:`);
  err(`  node scripts/backtest-nrfi.js > results.csv 2>report.txt`);
  err(`═══════════════════════════════════════════════════\n`);

  // ── CSV Output ──────────────────────────────────────────────────────────────
  if (results.length) {
    const headers = Object.keys(results[0]);
    console.log(headers.join(","));
    for (const r of results) {
      console.log(headers.map(h => {
        const v = r[h];
        if (v === null || v === undefined) return "";
        if (typeof v === "string" && (v.includes(",") || v.includes('"')))
          return `"${v.replace(/"/g, '""')}"`;
        return v;
      }).join(","));
    }
  }
}

main().catch(e => { process.stderr.write(`Fatal: ${e.message}\n${e.stack}\n`); process.exit(1); });
