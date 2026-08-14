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

export async function GET(req: Request) {
  if (!(await requireDeskUser(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const creds = await readStore<Creds | null>("kalshi_creds", null);
  if (!creds?.keyId)
    return Response.json({ error: "No Kalshi credentials configured." }, { status: 400 });

  try {
    // Fetch all positions, paginate if needed
    let allPositions: Array<Record<string, unknown>> = [];
    let cursor = "";
    for (let page = 0; page < 5; page++) {
      const url = "/trade-api/v2/portfolio/positions?count_filter=position&limit=100" +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
      const d = await kget(creds, url);
      const rows = (d.positions || d.market_positions || []) as Array<Record<string, unknown>>;
      allPositions = allPositions.concat(rows);
      cursor = d.cursor || "";
      if (!cursor || rows.length < 100) break;
    }

    // Filter to NRFI series only
    const nrfi = allPositions.filter((p) =>
      /^KXMLBRFI/i.test(String(p.ticker || ""))
    );

    const positions = nrfi.map((p) => {
      const ticker = String(p.ticker || "");
      // position > 0 = long YES (YRFI), < 0 = long NO (NRFI)
      const position = num(p.position) ?? 0;
      const side = position >= 0 ? "YES" : "NO";
      const contracts = Math.abs(position);
      const call = side === "NO" ? "NRFI" : "YRFI";

      // prices are in cents (0-100) in Kalshi API
      const lastYesPrice = num(p.last_fill_price_yes) ?? null;
      const entryPrice = side === "YES"
        ? lastYesPrice
        : (lastYesPrice != null ? 100 - lastYesPrice : null);

      const unrealizedPnl = num(p.unrealized_pnl);  // cents
      const realizedPnl = num(p.realized_pnl);       // cents
      const totalCost = entryPrice != null ? contracts * (entryPrice / 100) : null;

      // Build a readable game label from the ticker
      const parts = ticker.split("-").slice(1);
      const game = parts.slice(1).join(" @ ") || ticker;

      return {
        ticker,
        game,
        side,
        call,
        contracts,
        entryPrice,   // cents
        totalCost,    // dollars
        unrealizedPnl: unrealizedPnl != null ? unrealizedPnl / 100 : null,  // dollars
        realizedPnl: realizedPnl != null ? realizedPnl / 100 : null,
        marketExposure: num(p.market_exposure),
      };
    }).filter((p) => p.contracts > 0);

    const totalExposure = positions.reduce((s, p) => s + (p.totalCost || 0), 0);

    return Response.json({ positions, totalExposure });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
