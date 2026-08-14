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

// Safely extract ticker from a position object — Kalshi uses different field names across API versions
function getTicker(p: Record<string, unknown>): string {
  return String(p.ticker || p.market_ticker || p.marketTicker || "");
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
      // Kalshi v2 uses market_positions; older docs show positions
      const rows = (d.market_positions || d.positions || []) as Array<Record<string, unknown>>;
      allPositions = allPositions.concat(rows);
      cursor = d.cursor || "";
      if (!cursor || rows.length < 100) break;
    }

    // Debug mode: return raw tickers so we can see the format
    if (debug) {
      return Response.json({
        total: allPositions.length,
        sample: allPositions.slice(0, 20).map((p) => ({
          ticker: getTicker(p),
          position: p.position,
          keys: Object.keys(p),
        })),
      });
    }

    // Filter: match KXMLBRFI series (handles KXMLBRFI-... and KXMLB-RFI-... formats)
    const nrfi = allPositions.filter((p) => {
      const t = getTicker(p).toUpperCase();
      return t.includes("KXMLBRFI") || (t.includes("KXMLB") && t.includes("RFI"));
    });

    const positions = nrfi.map((p) => {
      const ticker = getTicker(p);
      const position = num(p.position) ?? 0;
      const side = position >= 0 ? "YES" : "NO";
      const contracts = Math.abs(position);
      const call = side === "NO" ? "NRFI" : "YRFI";

      // prices in cents (0-100)
      const lastYesPrice = num(p.last_fill_price_yes) ?? num(p.last_price) ?? null;
      const entryPrice = side === "YES"
        ? lastYesPrice
        : (lastYesPrice != null ? 100 - lastYesPrice : null);

      const unrealizedPnl = num(p.unrealized_pnl);
      const realizedPnl = num(p.realized_pnl);
      const totalCost = entryPrice != null ? contracts * (entryPrice / 100) : null;

      // Parse game label from ticker: KXMLBRFI-26AUG14-NYY-BOS → "NYY @ BOS"
      const parts = ticker.split("-");
      const teamParts = parts.slice(2); // skip series + date
      const game = teamParts.length >= 2
        ? teamParts[0] + " @ " + teamParts[1]
        : parts.slice(1).join(" ") || ticker;

      return {
        ticker,
        game,
        side,
        call,
        contracts,
        entryPrice,
        totalCost,
        unrealizedPnl: unrealizedPnl != null ? unrealizedPnl / 100 : null,
        realizedPnl: realizedPnl != null ? realizedPnl / 100 : null,
      };
    }).filter((p) => p.contracts > 0);

    const totalExposure = positions.reduce((s, p) => s + (p.totalCost || 0), 0);

    return Response.json({ positions, totalExposure });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
