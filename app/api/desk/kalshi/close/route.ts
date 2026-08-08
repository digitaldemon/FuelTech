// Close a Kalshi position — REDUCE-ONLY market sell of contracts already
// held. This is the ONLY desk route that places an order, and by
// construction it can only shrink an existing position: it re-reads the
// live position, forces action=sell on the held side, and clamps the count
// to what the account actually holds. It cannot open, add, or flip.
export const maxDuration = 30;

import crypto from "crypto";
import { requireDeskUser, readStore, writeStore } from "../../../../../lib/desk";

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

const num = (...vals: unknown[]): number | null => {
  for (const v of vals) {
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

export async function POST(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const creds = await readStore<Creds | null>("kalshi_creds", null);
  if (!creds || !creds.keyId) {
    return Response.json({ error: "Kalshi account is not connected." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { ticker?: string } | null;
  const ticker = body && body.ticker ? String(body.ticker).toUpperCase() : "";
  if (!ticker) return Response.json({ error: "ticker is required." }, { status: 400 });

  try {
    // Re-read the live position — never trust a count from the client.
    const posPath = "/trade-api/v2/portfolio/positions?ticker=" + encodeURIComponent(ticker) + "&count_filter=position";
    const pr = await fetch(BASE + posPath, { headers: signedHeaders(creds, "GET", posPath) });
    if (!pr.ok) throw new Error("Could not read your position (" + pr.status + ")");
    const pd = await pr.json();
    const mp = (pd.market_positions || []).find((p: Record<string, unknown>) => String(p.ticker).toUpperCase() === ticker);
    const held = mp ? (num(mp.position_fp, mp.position) ?? 0) : 0;

    if (Math.abs(held) < 1) {
      return Response.json({ error: "No open position to close on " + ticker + " (it may already be closed or settled)." }, { status: 400 });
    }

    // Held long (>0) is YES; short (<0) is NO. Closing means selling that
    // side. Kalshi trades whole contracts, so floor to be safe.
    const side = held > 0 ? "yes" : "no";
    const count = Math.floor(Math.abs(held));
    if (count < 1) {
      return Response.json({ error: "Position is smaller than one whole contract; close it on Kalshi directly." }, { status: 400 });
    }

    const order = {
      ticker,
      action: "sell",
      side,
      count,
      type: "market",
      client_order_id: crypto.randomUUID(),
    };
    const orderPath = "/trade-api/v2/portfolio/orders";
    const or = await fetch(BASE + orderPath, {
      method: "POST",
      headers: signedHeaders(creds, "POST", orderPath),
      body: JSON.stringify(order),
    });
    const otext = await or.text();
    if (!or.ok) {
      return Response.json({ error: "Kalshi rejected the order (" + or.status + "): " + otext.slice(0, 200) }, { status: 502 });
    }

    // Mark the tracked entry closed so the UI reflects it before the next
    // full sync; keep it in the ledger for the record.
    const ledger = await readStore<Array<Record<string, any>>>("ledger", []);
    const e = ledger.find((x) => x.venue === "Kalshi" && x.marketId === ticker && x.taken);
    if (e) { e.taken = null; e.closedAt = Date.now(); }
    await writeStore("ledger", ledger);

    return Response.json({ ok: true, sold: count, side });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 502 });
  }
}
