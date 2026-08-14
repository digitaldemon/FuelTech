// Pull the user's closed NRFI/YRFI bets from Kalshi (KXMLBRFI series) and
// upsert them into the nrfi_record so they show in the First Inning history
// and feed the calibration model. Read-only against Kalshi — no orders placed.
import crypto from "crypto";
import { requireDeskUser, readStore, writeStore } from "../../../../../lib/desk";

type Creds = { keyId: string; privateKey: string };
type NrfiRec = { id: string } & Record<string, unknown>;

const BASE = "https://api.elections.kalshi.com";

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
  const r = await fetch(BASE + path, { headers: signedHeaders(creds, "GET", path) });
  if (!r.ok) throw new Error("Kalshi " + path.split("?")[0] + " -> " + r.status);
  return r.json();
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Parse teams and date from a KXMLBRFI ticker.
// Tickers look like: KXMLBRFI-25AUG13-NYYMETS or KXMLBRFI-25AUG13-NYY-BOS
function parseTicker(ticker: string): { date: string; game: string } {
  const parts = ticker.split("-").slice(1); // drop series prefix
  const datePart = parts[0] || "";
  // Convert e.g. "25AUG13" -> "20250813"
  const mo: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };
  let dateStr = "";
  const dm = datePart.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  if (dm) {
    dateStr = "20" + dm[1] + (mo[dm[2]] || "00") + dm[3];
  }
  const teams = parts.slice(1).join(" @ ") || ticker;
  return { date: dateStr, game: teams };
}

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const creds = await readStore<Creds | null>("kalshi_creds", null);
  if (!creds?.keyId) {
    return Response.json({ error: "No Kalshi credentials configured." }, { status: 400 });
  }

  try {
    // Pull up to 500 settlements (5 pages × 100).
    let allSettlements: Array<Record<string, unknown>> = [];
    let cursor = "";
    for (let page = 0; page < 5; page++) {
      const url = "/trade-api/v2/portfolio/settlements?limit=100" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
      const sd = await kget(creds, url);
      const rows = (sd.settlements || []) as Array<Record<string, unknown>>;
      allSettlements = allSettlements.concat(rows);
      cursor = sd.cursor || "";
      if (!cursor || rows.length < 100) break;
    }

    // Filter to NRFI series only.
    const nrfiRows = allSettlements.filter((s) =>
      /^KXMLBRFI/i.test(String(s.ticker || ""))
    );

    if (!nrfiRows.length) {
      return Response.json({ imported: 0, skipped: 0, message: "No KXMLBRFI settlements found on this account." });
    }

    // Fetch fills for each ticker to get entry price (batched one at a time — small set).
    const entryPrices: Record<string, number> = {};
    await Promise.all(
      nrfiRows.map(async (s) => {
        const ticker = String(s.ticker || "");
        try {
          const fd = await kget(creds, "/trade-api/v2/portfolio/fills?ticker=" + encodeURIComponent(ticker) + "&limit=100");
          const fills = (fd.fills || []) as Array<Record<string, unknown>>;
          // Determine which side the user held from the settlement itself.
          const yc = num(s.yes_count_fp ?? s.yes_count) ?? 0;
          const nc = num(s.no_count_fp ?? s.no_count) ?? 0;
          const side = yc >= nc ? "YES" : "NO";
          let qty = 0, cost = 0;
          for (const f of fills) {
            if (f.action !== "buy") continue;
            const isYes = f.side === "yes";
            if ((side === "YES") !== isYes) continue;
            const c = num(f.count_fp ?? f.count) ?? 0;
            const price = isYes
              ? (num(f.yes_price) ?? (num(f.yes_price_dollars) != null ? num(f.yes_price_dollars)! * 100 : null))
              : (num(f.no_price) ?? (num(f.no_price_dollars) != null ? num(f.no_price_dollars)! * 100 : null));
            if (c > 0 && price !== null) { qty += c; cost += c * price; }
          }
          if (qty > 0) entryPrices[ticker] = cost / qty;
        } catch { /* fills are optional */ }
      })
    );

    const existing = await readStore<NrfiRec[]>("nrfi_record", []);
    const existingIds = new Set(existing.map((e) => e.id));
    const toUpsert: NrfiRec[] = [];
    let skipped = 0;

    for (const s of nrfiRows) {
      const res = String(s.market_result || "");
      if (res !== "yes" && res !== "no") { skipped++; continue; } // unresolved

      const ticker = String(s.ticker || "");
      const yc = num(s.yes_count_fp ?? s.yes_count) ?? 0;
      const nc = num(s.no_count_fp ?? s.no_count) ?? 0;
      if (yc <= 0 && nc <= 0) { skipped++; continue; } // no position held

      const side = yc >= nc ? "YES" : "NO";
      // YES on Kalshi NRFI = YRFI (you think a run scores). NO = NRFI.
      const call = side === "YES" ? "YRFI" : "NRFI";
      const won = (res === "yes") === (side === "YES");
      // res=yes means a run scored, regardless of which side the user was on.
      const firstInningRuns = res === "yes" ? 1 : 0;

      // Entry price in cents (for our call side).
      const entryRaw = entryPrices[ticker];
      // Convert to "our side %" — how likely we thought our side was.
      // If call=NRFI and we held NO at 55¢ NO price, marketNRFI at pick = 55%.
      // If call=YRFI and we held YES at 45¢, marketYRFI at pick = 45%.
      const mktAtPick = entryRaw != null ? Math.round(entryRaw) : null;

      // pNRFI: if bet NRFI, pNRFI ~ mktAtPick/100; if bet YRFI, pNRFI ~ 1 - mktAtPick/100
      const pNRFI = mktAtPick != null
        ? (call === "NRFI" ? Math.round(mktAtPick) / 100 : 1 - Math.round(mktAtPick) / 100)
        : 0.5;

      const settledAt = num(Date.parse(String(s.settled_time || ""))) ?? Date.now();
      const { date, game } = parseTicker(ticker);

      // Title from settlement for a better game label.
      const title = String(s.title || s.market_title || game);

      const id = "nrfi-k-" + ticker;
      const rec: NrfiRec = {
        id,
        at: settledAt,
        date,
        gamePk: null,
        game: title,
        call,
        prob: mktAtPick ?? 50,
        pNRFI: Math.round(pNRFI * 1000) / 1000,
        mktAtPick,
        mktLatest: mktAtPick,
        mktAtClose: mktAtPick, // best we have for closed bets
        result: won ? "won" : "lost",
        firstInningRuns,
        source: "kalshi-import",
        ticker,
        contracts: Math.max(yc, nc),
        side,
      };

      if (existingIds.has(id)) { skipped++; continue; } // already imported
      toUpsert.push(rec);
    }

    if (toUpsert.length) {
      // Upsert via the existing nrfi route logic: prepend new, keep ≤1000.
      const updated = [...toUpsert, ...existing].slice(0, 1000);
      await writeStore("nrfi_record", updated);
    }

    return Response.json({
      imported: toUpsert.length,
      skipped,
      total: nrfiRows.length,
      message: toUpsert.length
        ? "Imported " + toUpsert.length + " NRFI bet" + (toUpsert.length === 1 ? "" : "s") + " from Kalshi."
        : "No new bets to import (" + skipped + " already in history or unresolved).",
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
