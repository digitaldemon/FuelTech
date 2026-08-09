// Kalshi native parlay (multivariate event collection). Looks up the single
// combined market for a set of selected legs, then optionally buys it. A
// preview call (place=false) creates/prices the combo but places NO order
// and spends nothing; only place=true submits a real buy.
export const maxDuration = 30;

import crypto from "crypto";
import { requireDeskUser, readStore } from "../../../../../lib/desk";

const BASE = "https://api.elections.kalshi.com";
type Creds = { keyId: string; privateKey: string };

function signedHeaders(creds: Creds, method: string, fullPath: string) {
  const ts = Date.now().toString();
  const path = fullPath.split("?")[0];
  const sig = crypto.sign("sha256", Buffer.from(ts + method + path), {
    key: creds.privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }).toString("base64");
  return {
    accept: "application/json",
    "content-type": "application/json",
    "KALSHI-ACCESS-KEY": creds.keyId,
    "KALSHI-ACCESS-TIMESTAMP": ts,
    "KALSHI-ACCESS-SIGNATURE": sig,
  };
}

async function ksigned(creds: Creds, method: string, path: string, body?: unknown) {
  const r = await fetch(BASE + path, {
    method,
    headers: signedHeaders(creds, method, path),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, text: await r.text() };
}

const num = (...vals: unknown[]): number | null => {
  for (const v of vals) {
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};
const cents = (plain: unknown, dollars: unknown): number | null => {
  const p = num(plain);
  if (p !== null) return p;
  const d = num(dollars);
  return d !== null ? d * 100 : null;
};

const eventOf = (ticker: string) => ticker.split("-").slice(0, -1).join("-");

export async function POST(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const creds = await readStore<Creds | null>("kalshi_creds", null);
  if (!creds || !creds.keyId) {
    return Response.json({ error: "Kalshi account is not connected." }, { status: 400 });
  }

  const b = (await req.json().catch(() => null)) as
    | { tickers?: string[]; count?: number; place?: boolean; collection?: string }
    | null;
  const tickers = (b && Array.isArray(b.tickers) ? b.tickers : []).map((t) => String(t).toUpperCase());
  if (tickers.length < 2) {
    return Response.json({ error: "A parlay needs at least 2 legs." }, { status: 400 });
  }
  if (tickers.length > 20) {
    return Response.json({ error: "Too many legs." }, { status: 400 });
  }
  const collection = (b && b.collection) || "KXMVESPORTSMULTIGAMEEXTENDED-R";
  const selected_markets = tickers.map((t) => ({ event_ticker: eventOf(t), market_ticker: t, side: "yes" }));

  try {
    // Look up / create the single combined market for these legs.
    const lu = await ksigned(creds, "POST", "/trade-api/v2/multivariate_event_collections/" + collection, { selected_markets });
    if (lu.status >= 400) {
      return Response.json({ error: "Parlay lookup failed (" + lu.status + "): " + lu.text.slice(0, 300) }, { status: 502 });
    }
    let ld: Record<string, unknown> = {};
    try { ld = JSON.parse(lu.text); } catch { /* handled below */ }
    const market = (ld.market || ld) as Record<string, unknown>;
    // Lookup returns { event_ticker, market_ticker } for the combined market.
    const ticker = String(ld.market_ticker || market.ticker || "");
    if (!ticker) {
      return Response.json({ error: "Lookup returned no combined market.", raw: lu.text.slice(0, 400) }, { status: 502 });
    }

    // Fetch the combined market's live price.
    let price: number | null = null, ask: number | null = null;
    try {
      const mr = await fetch(BASE + "/trade-api/v2/markets/" + ticker, { headers: { accept: "application/json" } });
      if (mr.ok) {
        const md = await mr.json();
        const m = md.market || {};
        ask = cents(m.yes_ask, m.yes_ask_dollars);
        const bid = cents(m.yes_bid, m.yes_bid_dollars);
        const last = cents(m.last_price, m.last_price_dollars);
        price = ask != null && bid != null ? (ask + bid) / 2 : last;
      }
    } catch { /* price optional for preview */ }

    const count = Math.max(1, Math.floor(num(b && b.count) ?? 1));

    if (!(b && b.place)) {
      return Response.json({ preview: true, ticker, price, ask, legs: tickers.length });
    }

    // Place a real market buy on the combined parlay market. buy_max_cost
    // caps total spend so it can never overspend a moved price.
    const capPer = Math.min(99, Math.ceil((ask != null ? ask : price != null ? price : 50)) + 3);
    const order = {
      ticker,
      action: "buy",
      side: "yes",
      count,
      type: "market",
      buy_max_cost: count * capPer,
      client_order_id: crypto.randomUUID(),
    };
    const od = await ksigned(creds, "POST", "/trade-api/v2/portfolio/orders", order);
    if (od.status >= 400) {
      return Response.json({ error: "Order rejected (" + od.status + "): " + od.text.slice(0, 300) }, { status: 502 });
    }
    return Response.json({ ok: true, ticker, count, price, ask });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 502 });
  }
}
