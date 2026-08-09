// Kalshi account sync — READ-ONLY. Signs requests with the user's API key
// (stored in desk_store under "kalshi_creds") and mirrors real portfolio
// positions and fills into the Contract Desk ledger. This route only ever
// calls portfolio read endpoints; it cannot place or cancel orders.
export const maxDuration = 60;

import crypto from "crypto";
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

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
    "KALSHI-ACCESS-KEY": creds.keyId,
    "KALSHI-ACCESS-TIMESTAMP": ts,
    "KALSHI-ACCESS-SIGNATURE": sig,
  };
}

async function kget(creds: Creds, path: string) {
  const r = await fetch(BASE + path, { headers: signedHeaders(creds, "GET", path) });
  if (!r.ok) {
    const body = (await r.text()).slice(0, 200);
    throw new Error("Kalshi " + path.split("?")[0] + " -> " + r.status + ": " + body);
  }
  return r.json();
}

// Event-page link, matching the frontend's kalshiEventLink. Only the series
// synced positions actually land on need slugs here.
const WEB_SLUG: Record<string, string> = {
  KXNBAGAME: "pro-basketball-game", KXWNBAGAME: "womens-pro-basketball-game",
  KXMLBGAME: "professional-baseball-game", KXNFLGAME: "professional-football-game",
  KXNHLGAME: "nhl-game", KXCFBGAME: "college-football-game",
  KXCBBGAME: "college-basketball-game", KXEPLGAME: "english-premier-league-game",
  KXMLSGAME: "major-league-soccer-game",
};
function kalshiWebLink(ticker: string): string {
  const parts = String(ticker || "").split("-");
  const series = parts[0];
  // Combos have no public market page — they only exist in the portfolio.
  if (/^KXMVE/.test(series)) return "https://kalshi.com/portfolio";
  const base = "https://kalshi.com/markets/" + series.toLowerCase();
  const slug = WEB_SLUG[series];
  if (!slug || parts.length < 2) return base;
  return base + "/" + slug + "/" + parts.slice(0, -1).join("-").toLowerCase();
}

const num = (...vals: unknown[]): number | null => {
  for (const v of vals) {
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};
// Kalshi payloads mix integer cents and "0.2000"-style dollar strings.
const cents = (plain: unknown, dollars: unknown): number | null => {
  const p = num(plain);
  if (p !== null) return p;
  const d = num(dollars);
  return d !== null ? d * 100 : null;
};

function marketPrice(m: Record<string, unknown>): number | null {
  const last = cents(m.last_price, m.last_price_dollars);
  const bid = cents(m.yes_bid, m.yes_bid_dollars);
  const ask = cents(m.yes_ask, m.yes_ask_dollars);
  if (bid !== null && ask !== null) return (bid + ask) / 2;
  if (last !== null && last > 0) return last;
  return bid !== null ? bid : ask;
}

async function marketInfo(tickers: string[]): Promise<Record<string, Record<string, unknown>>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i < tickers.length; i += 40) {
    const batch = tickers.slice(i, i + 40).join(",");
    try {
      const r = await fetch(BASE + "/trade-api/v2/markets?tickers=" + encodeURIComponent(batch), {
        headers: { accept: "application/json" },
      });
      if (r.ok) {
        const d = await r.json();
        (d.markets || []).forEach((m: Record<string, unknown>) => { out[String(m.ticker)] = m; });
      }
    } catch { /* partial info is fine */ }
  }
  return out;
}

// Save API credentials. Gated like everything else; the key is stored in
// Postgres and never echoed back.
export async function POST(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => null)) as Creds | null;
  if (!b || !b.keyId || !b.privateKey || !/BEGIN [A-Z ]*PRIVATE KEY/.test(b.privateKey)) {
    return Response.json({ error: "keyId and a PEM privateKey are required." }, { status: 400 });
  }
  await writeStore("kalshi_creds", { keyId: b.keyId.trim(), privateKey: b.privateKey });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await writeStore("kalshi_creds", null);
  return Response.json({ ok: true });
}

// Sync: pull live positions + fills, merge into the ledger, report back.
export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const creds = await readStore<Creds | null>("kalshi_creds", null);
  if (!creds || !creds.keyId) return Response.json({ configured: false });

  try {
    const pd = await kget(creds, "/trade-api/v2/portfolio/positions?limit=200&count_filter=position");
    const raw = (pd.market_positions || []) as Array<Record<string, unknown>>;
    const held = raw
      .map((p) => ({ ticker: String(p.ticker), pos: num(p.position_fp, p.position) ?? 0 }))
      .filter((p) => Math.abs(p.pos) > 0.0001);

    const info = await marketInfo(held.map((p) => p.ticker));

    const positions: Array<{ ticker: string; side: string; contracts: number; avg: number | null;
      title: string; name: string; close: string | null; price: number | null }> = [];
    for (const p of held) {
      const side = p.pos > 0 ? "YES" : "NO";
      let avg: number | null = null;
      try {
        const fd = await kget(creds, "/trade-api/v2/portfolio/fills?ticker=" + encodeURIComponent(p.ticker) + "&limit=200");
        let qty = 0, cost = 0;
        for (const f of (fd.fills || []) as Array<Record<string, unknown>>) {
          if (f.action !== "buy") continue;
          const isYes = f.side === "yes";
          if ((side === "YES") !== isYes) continue;
          const c = num(f.count_fp, f.count) ?? 0;
          const price = isYes ? cents(f.yes_price, f.yes_price_dollars) : cents(f.no_price, f.no_price_dollars);
          if (c > 0 && price !== null) { qty += c; cost += c * price; }
        }
        if (qty > 0) avg = cost / qty;
      } catch { /* fills are a nicety; the position still syncs */ }
      const m = info[p.ticker] || {};
      positions.push({
        ticker: p.ticker, side, contracts: Math.abs(p.pos), avg,
        title: String(m.title || p.ticker), name: String(m.yes_sub_title || m.subtitle || ""),
        close: m.close_time ? String(m.close_time) : null, price: marketPrice(m),
      });
    }

    // Merge into the ledger: adopt existing entries for the same market,
    // create entries for unknown positions, clear ones sold on Kalshi.
    const ledger = await readStore<Array<Record<string, any>>>("ledger", []);
    const now = Date.now();
    const have = new Set(positions.map((p) => p.ticker));
    let created = 0, updated = 0, cleared = 0;

    for (const p of positions) {
      // A market can have several ledger entries (a sync stub plus later
      // re-analyses). The one with a real analysis carries the position;
      // any other entry for the same market must NOT keep a stale `taken`
      // or the trades tab shows the position twice.
      const matches = ledger.filter((x) => x.venue === "Kalshi" && x.marketId === p.ticker);
      const e = matches.find((x) => Array.isArray(x.pillars) && x.pillars.length > 0) || matches[0];
      const entryPrice = p.avg !== null ? Math.round(p.avg * 100) / 100
        : e && e.taken && e.taken.entryPrice != null ? e.taken.entryPrice
        : p.price !== null ? Math.round(p.price * 10) / 10 : 50;
      const taken = { side: p.side, entryPrice, contracts: Math.round(p.contracts * 100) / 100,
        at: e && e.taken ? e.taken.at : now, source: "kalshi" };
      if (e) {
        e.taken = taken;
        matches.forEach((x) => { if (x !== e && x.taken) x.taken = null; });
        updated++;
      }
      else {
        const price = p.price !== null ? Math.round(p.price * 10) / 10 : entryPrice;
        ledger.unshift({
          id: "kalshi-" + p.ticker, ts: now, venue: "Kalshi", marketId: p.ticker, slug: null,
          question: p.title, name: p.name || p.title, category: "sports", price, fair: price,
          edge: 0, call: "SYNCED", confidence: "LOW", close: p.close,
          link: kalshiWebLink(p.ticker),
          status: "open", outcome: null, pillars: [], entry: entryPrice, verify: null, taken,
        });
        created++;
      }
    }

    // A tracked Kalshi entry with no live position was either sold or has
    // settled. Only clear it if the market is still open — settled ones stay
    // for the resolution checker to score.
    const gone = ledger.filter((e) => e.venue === "Kalshi" && e.taken && e.status === "open" && !have.has(e.marketId));
    if (gone.length) {
      const goneInfo = await marketInfo(gone.map((e) => String(e.marketId)));
      for (const e of gone) {
        const m = goneInfo[String(e.marketId)];
        const st = m ? String(m.status || "") : "";
        if (/open|active/i.test(st)) { e.taken = null; cleared++; }
      }
    }

    await writeStore("ledger", ledger.slice(0, 500));
    return Response.json({ configured: true, synced: positions.length, created, updated, cleared,
      positions: positions.map((p) => ({ ticker: p.ticker, side: p.side, contracts: p.contracts, avg: p.avg })) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ configured: true, error: msg }, { status: 502 });
  }
}
