import crypto from "crypto";
import { requireDeskUser, readStore } from "../../../../../lib/desk";

type Creds = { keyId: string; privateKey: string };

function signedHeaders(creds: Creds, method: string, fullPath: string) {
  const ts = Date.now().toString();
  const path = fullPath.split("?")[0];
  const sig = crypto
    .sign("sha256", Buffer.from(ts + method + path), {
      key: creds.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    })
    .toString("base64");
  return {
    accept: "application/json",
    "KALSHI-ACCESS-KEY": creds.keyId,
    "KALSHI-ACCESS-TIMESTAMP": ts,
    "KALSHI-ACCESS-SIGNATURE": sig,
  };
}

async function kget(creds: Creds, path: string) {
  const r = await fetch("https://api.elections.kalshi.com" + path, {
    headers: signedHeaders(creds, "GET", path),
  });
  if (!r.ok) throw new Error("Kalshi " + path.split("?")[0] + " -> " + r.status);
  return r.json();
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Ordered longest-first so greedy left-to-right parse picks 3-letter codes before 2-letter
const MLB_CODES = [
  "ARI","ATL","BAL","BOS","CHC","CWS","CHW","CIN","CLE","COL","DET",
  "HOU","KCR","KC","LAA","LAD","MIA","MIL","MIN","NYM","NYY","OAK",
  "PHI","PIT","SEA","SF","SD","STL","TBR","TB","TEX","TOR","WSH","WSN",
];

function splitTeams(s: string): [string, string] | null {
  for (const away of MLB_CODES) {
    if (s.startsWith(away)) {
      const rest = s.slice(away.length);
      // rest should be a valid team code
      if (MLB_CODES.includes(rest)) return [away, rest];
    }
  }
  return null;
}

// Ticker: KXMLBRFI-26AUG141810MIACIN
// After series prefix: 26AUG14 1810 MIACIN  (date=7, time=4, teams=rest)
function parseGameLabel(ticker: string): string {
  const body = ticker.replace(/^KXMLBRFI-/i, "");
  // date part: digits+letters up to 4-digit time; date = first 7 chars (e.g. 26AUG14)
  if (body.length < 12) return ticker;
  const timePart = body.slice(7, 11); // e.g. "1810"
  const teamsPart = body.slice(11);   // e.g. "MIACIN"
  const parsed = splitTeams(teamsPart);
  const teams = parsed ? parsed[0] + " @ " + parsed[1] : teamsPart;
  // Format time as HH:MM ET
  const hh = timePart.slice(0, 2);
  const mm = timePart.slice(2, 4);
  return teams + "  " + hh + ":" + mm + " ET";
}

export async function GET(req: Request) {
  if (!(await requireDeskUser(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const creds = await readStore<Creds | null>("kalshi_creds", null);
  if (!creds?.keyId)
    return Response.json({ error: "No Kalshi credentials configured." }, { status: 400 });

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  try {
    let allPositions: Array<Record<string, unknown>> = [];
    let cursor = "";
    for (let page = 0; page < 5; page++) {
      const path = "/trade-api/v2/portfolio/positions?count_filter=position&limit=100" +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
      const d = await kget(creds, path);
      const rows = (d.market_positions || d.positions || []) as Array<Record<string, unknown>>;
      allPositions = allPositions.concat(rows);
      cursor = d.cursor || "";
      if (!cursor || rows.length < 100) break;
    }

    if (debug) {
      return Response.json({
        total: allPositions.length,
        sample: allPositions.slice(0, 20).map((p) => ({
          ticker: p.ticker || p.market_ticker,
          position_fp: p.position_fp,
          market_exposure_dollars: p.market_exposure_dollars,
          realized_pnl_dollars: p.realized_pnl_dollars,
          total_traded_dollars: p.total_traded_dollars,
          keys: Object.keys(p),
        })),
      });
    }

    // Filter to NRFI series
    const nrfi = allPositions.filter((p) => {
      const t = String(p.ticker || p.market_ticker || "").toUpperCase();
      return t.includes("KXMLBRFI");
    });

    const positions = nrfi.map((p) => {
      const ticker = String(p.ticker || p.market_ticker || "");

      // position_fp: positive = long YES (YRFI), negative = long NO (NRFI)
      const rawFp = num(p.position_fp) ?? 0;
      const side = rawFp >= 0 ? "YES" : "NO";
      const call = side === "NO" ? "NRFI" : "YRFI";

      // Magnitude: position_fp might be scaled by 100 (fixed-point cents)
      // Heuristic: if |fp| > 100 and exposure suggests smaller number, divide by 100
      const exposureDollars = num(p.market_exposure_dollars) ?? 0;
      const absFp = Math.abs(rawFp);
      // If |fp| looks like it's in cents (e.g. 1000 for 10 contracts at 100¢) vs raw (e.g. 10)
      // A contract costs at most $1, so if absFp >> exposureDollars, it's likely scaled
      const contracts = absFp > 0 && exposureDollars > 0 && absFp > exposureDollars * 5
        ? Math.round(absFp / 100)
        : Math.round(absFp);

      const realizedPnl = num(p.realized_pnl_dollars);
      const game = parseGameLabel(ticker);

      return {
        ticker,
        game,
        side,
        call,
        contracts,
        totalCost: exposureDollars || null,
        // Payout if win: exposure buys you NO contracts; each pays $1 minus cost
        // Without knowing exact NO price we estimate from exposure/contracts
        estimatedPayout: contracts > 0 && exposureDollars > 0
          ? Math.round((contracts - exposureDollars) * 100) / 100
          : null,
        realizedPnl,
        unrealizedPnl: null, // not available in this endpoint
      };
    }).filter((p) => p.contracts > 0);

    const totalExposure = positions.reduce((s, p) => s + (p.totalCost || 0), 0);

    return Response.json({ positions, totalExposure });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
