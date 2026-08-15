// GET /api/desk/nrfi/backtest?from=2026-04-01&to=2026-08-13
// Pulls historical MLB data and runs the simplified λ-model to produce a
// calibration curve. Uses season-cumulative pitcher/team stats (minor leakage
// vs true walk-forward, but adequate for calibration diagnosis).
// Requires desk session auth. Takes 30-90s for a 30-day window.
import { requireDeskUser } from "../../../../../lib/desk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LG_RATE = 0.52;   // league avg first-inning run rate
const PIT_REG  = 15;    // pseudo-starts prior for pitcher rate
const OFF_REG  = 6;     // pseudo-games prior for team offense rate

function regress(rate: number | null, n: number, reg: number): number {
  const r = rate ?? LG_RATE;
  return (r * n + LG_RATE * reg) / (n + reg);
}
function halfNoRun(off: number, pit: number): number {
  return Math.exp(-off * pit / LG_RATE);
}
function nClamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)); }
function logit(p: number) { return Math.log(p / (1 - p)); }
function unlogit(x: number) { return 1 / (1 + Math.exp(-x)); }

function parseIp(ip: string | number | null): number {
  if (ip == null) return 0;
  const s = String(ip);
  const [w, f = "0"] = s.split(".");
  return parseInt(w) + parseInt(f) / 3;
}

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function mapLimit<T, R>(arr: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(arr.length);
  let i = 0;
  const worker = async () => {
    while (i < arr.length) {
      const idx = i++;
      out[idx] = await fn(arr[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, worker));
  return out;
}

// Cache within the request to avoid duplicate API calls across games.
const pitCache = new Map<string, number | null>();
const offCache = new Map<string, number | null>();
const pitNCache = new Map<string, number>();
const offNCache = new Map<string, number>();

async function getPitRate(pid: number, season: number): Promise<{ rate: number | null; n: number }> {
  const k = `${pid}:${season}`;
  if (pitCache.has(k)) return { rate: pitCache.get(k)!, n: pitNCache.get(k) ?? 0 };
  try {
    const d = await getJson(
      `https://statsapi.mlb.com/api/v1/people/${pid}/stats?stats=statSplits&group=pitching&sitCodes=i01&season=${season}`
    );
    const st = d.stats?.[0]?.splits?.[0]?.stat;
    if (st?.gamesPlayed) {
      const rate = Number(st.runs ?? 0) / Number(st.gamesPlayed);
      pitCache.set(k, rate); pitNCache.set(k, Number(st.gamesPlayed));
      return { rate, n: Number(st.gamesPlayed) };
    }
  } catch { /* fall through */ }
  pitCache.set(k, null); pitNCache.set(k, 0);
  return { rate: null, n: 0 };
}

async function getOffRate(teamId: number, season: number): Promise<{ rate: number | null; n: number }> {
  const k = `${teamId}:${season}`;
  if (offCache.has(k)) return { rate: offCache.get(k)!, n: offNCache.get(k) ?? 0 };
  try {
    const d = await getJson(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=statSplits&group=hitting&sitCodes=i01&season=${season}`
    );
    const splits: any[] = d.stats?.[0]?.splits ?? [];
    const st = splits.find((s: any) => /first inning/i.test(s.split?.description ?? ""))?.stat;
    if (st?.gamesPlayed) {
      const rate = Number(st.runs ?? 0) / Number(st.gamesPlayed);
      offCache.set(k, rate); offNCache.set(k, Number(st.gamesPlayed));
      return { rate, n: Number(st.gamesPlayed) };
    }
  } catch { /* fall through */ }
  offCache.set(k, null); offNCache.set(k, 0);
  return { rate: null, n: 0 };
}

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const toDate   = url.searchParams.get("to")   ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const fromDate = url.searchParams.get("from") ?? (() => {
    const d = new Date(toDate); d.setDate(d.getDate() - 44); return d.toISOString().slice(0, 10);
  })();

  // Build date list
  const dates: string[] = [];
  for (let d = new Date(fromDate + "T12:00:00Z"); d.toISOString().slice(0, 10) <= toDate; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  type GameRow = {
    date: string; gamePk: number;
    away: string; home: string; awayPP: string; homePP: string;
    pNRFI: number; actual: 0 | 1; runs: number; isDayGame: boolean;
  };

  const rows: GameRow[] = [];

  await mapLimit(dates, 3, async (date) => {
    try {
      const sch = await getJson(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,linescore,team`
      );
      const games: any[] = sch.dates?.[0]?.games ?? [];
      await mapLimit(games, 4, async (g: any) => {
        try {
          const awayT = g.teams?.away, homeT = g.teams?.home;
          const awayPP = awayT?.probablePitcher, homePP = homeT?.probablePitcher;
          if (!awayPP?.id || !homePP?.id) return;
          const ls = g.linescore;
          const inn1 = ls?.innings?.[0];
          if (!inn1 || inn1.away?.runs == null || inn1.home?.runs == null) return;
          const runs = Number(inn1.away.runs) + Number(inn1.home.runs);
          const actual: 0 | 1 = runs === 0 ? 1 : 0;

          const season = new Date(date).getFullYear();
          const [awayPit, homePit, awayOff, homeOff] = await Promise.all([
            getPitRate(awayPP.id, season),
            getPitRate(homePP.id, season),
            getOffRate(awayT.team.id, season),
            getOffRate(homeT.team.id, season),
          ]);

          const awayPitR = regress(awayPit.rate, awayPit.n, PIT_REG);
          const homePitR = regress(homePit.rate, homePit.n, PIT_REG);
          const awayOffR = regress(awayOff.rate, awayOff.n, OFF_REG);
          const homeOffR = regress(homeOff.rate, homeOff.n, OFF_REG);

          // Home advantage: home pitcher ~3% better, home offense ~2% more scoring.
          // Mirrors the structural factors in the live model (homePitAdvantage/homeOffAdvantage).
          const p0top = halfNoRun(awayOffR * 0.98, homePitR * 0.97); // away bats vs home pitcher
          const p0bot = halfNoRun(homeOffR * 1.02, awayPitR * 1.03); // home bats vs away pitcher
          const rawNRFI = p0top * p0bot;

          // Day game shift (games before ~4pm ET = UTC < 20:00)
          const utcH = g.gameDate ? new Date(g.gameDate).getUTCHours() : null;
          const isDayGame = utcH != null && utcH < 20;
          const shift = isDayGame ? 0.15 : 0;
          const pNRFI = shift > 0
            ? nClamp(unlogit(logit(nClamp(rawNRFI, 0.02, 0.98)) - shift), 0.02, 0.98)
            : rawNRFI;

          rows.push({
            date, gamePk: g.gamePk,
            away: awayT.team.name, home: homeT.team.name,
            awayPP: awayPP.fullName, homePP: homePP.fullName,
            pNRFI: Math.round(pNRFI * 1000) / 1000,
            actual, runs, isDayGame,
          });
        } catch { /* skip game */ }
      });
    } catch { /* skip date */ }
  });

  if (!rows.length) return Response.json({ error: "No graded games found", fromDate, toDate });

  // ── Calibration breakdown ────────────────────────────────────────────────
  const total = rows.length;
  const nrfiActual = rows.filter(r => r.actual === 1).length;

  // Bucket by 5pp model probability
  const buckets: Record<string, { n: number; w: number; sumP: number }> = {};
  for (const r of rows) {
    const p = Math.round(Math.max(r.pNRFI, 1 - r.pNRFI) * 100);
    const b = Math.floor(p / 5) * 5;
    const key = `${b}-${b + 4}`;
    if (!buckets[key]) buckets[key] = { n: 0, w: 0, sumP: 0 };
    buckets[key].n++;
    buckets[key].sumP += p;
    if ((r.pNRFI >= 0.5 && r.actual === 1) || (r.pNRFI < 0.5 && r.actual === 0)) buckets[key].w++;
  }

  // Day vs night
  const day   = rows.filter(r => r.isDayGame);
  const night = rows.filter(r => !r.isDayGame);
  const dayNrfi   = day.filter(r => r.actual === 1).length;
  const nightNrfi = night.filter(r => r.actual === 1).length;

  // Bias: mean model prob minus actual rate
  const meanModelP = rows.reduce((s, r) => s + Math.max(r.pNRFI, 1 - r.pNRFI), 0) / total;
  const actualRate = rows.filter(r => (r.pNRFI >= 0.5 ? r.actual === 1 : r.actual === 0)).length / total;
  const bias = meanModelP - actualRate;

  // Brier score (raw)
  const brier = rows.reduce((s, r) => s + Math.pow(r.pNRFI - r.actual, 2), 0) / total;
  const brierNaive = rows.reduce((s, r) => s + Math.pow(nrfiActual / total - r.actual, 2), 0) / total;
  const brierSkill = 1 - brier / brierNaive;

  // Brier score after Platt calibration: logit(cal) = 1.243*logit(dir) - 0.7396
  const plattSlope = 1.243, plattC = -0.7396;
  function plattCal(p: number): number {
    const isNRFI = p >= 0.5;
    const dir = isNRFI ? p : 1 - p;
    const clamped = Math.min(Math.max(dir, 0.5001), 0.98);
    const cal = Math.min(Math.max(1 / (1 + Math.exp(-(plattSlope * Math.log(clamped / (1 - clamped)) + plattC))), 0.5), 0.98);
    return isNRFI ? cal : 1 - cal;
  }
  const brierCal = rows.reduce((s, r) => s + Math.pow(plattCal(r.pNRFI) - r.actual, 2), 0) / total;
  const brierSkillCal = 1 - brierCal / brierNaive;

  // BET-tier win rate — raw thresholds equivalent to calibrated ≥57% (BET) and ≥63% (STRONG)
  // after Platt scaling: logit(cal) = 1.243*logit(raw) - 0.7396
  const betRows  = rows.filter(r => Math.max(r.pNRFI, 1 - r.pNRFI) >= 0.70);
  const betWins  = betRows.filter(r => (r.pNRFI >= 0.5 && r.actual === 1) || (r.pNRFI < 0.5 && r.actual === 0)).length;
  const strongRows = rows.filter(r => Math.max(r.pNRFI, 1 - r.pNRFI) >= 0.74);
  const strongWins = strongRows.filter(r => (r.pNRFI >= 0.5 && r.actual === 1) || (r.pNRFI < 0.5 && r.actual === 0)).length;

  const pct = (w: number, n: number) => n ? `${(w / n * 100).toFixed(1)}% (${n}g)` : "—";

  return Response.json({
    meta: {
      fromDate, toDate, games: total,
      note: "Uses season-cumulative pitcher/team stats — minor data leakage vs walk-forward. For trend/calibration diagnosis only.",
    },
    summary: {
      overallNrfiRate: pct(nrfiActual, total),
      meanModelProb: (meanModelP * 100).toFixed(1) + "%",
      bias: (bias > 0 ? "+" : "") + (bias * 100).toFixed(1) + "pp (model over-estimates by this much)",
      brierSkillScore_raw: (brierSkill * 100).toFixed(1) + "% (raw model)",
      brierSkillScore_platt: (brierSkillCal * 100).toFixed(1) + "% (after Platt calibration)",
    },
    tiers: {
      "BET (raw≥70%, cal≥57%)":    pct(betWins,    betRows.length),
      "STRONG (raw≥74%, cal≥63%)": pct(strongWins, strongRows.length),
    },
    dayVsNight: {
      day:   `${pct(dayNrfi, day.length)} NRFI rate`,
      night: `${pct(nightNrfi, night.length)} NRFI rate`,
      dayGamePenalty: day.length && night.length
        ? ((nightNrfi / night.length - dayNrfi / day.length) * 100).toFixed(1) + "pp less NRFI in day games"
        : "—",
    },
    calibration: Object.fromEntries(
      Object.entries(buckets)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([k, v]) => [
          `model ~${Math.round(v.sumP / v.n)}%`,
          `actual ${(v.w / v.n * 100).toFixed(0)}% (${v.n}g)`,
        ])
    ),
  });
}
