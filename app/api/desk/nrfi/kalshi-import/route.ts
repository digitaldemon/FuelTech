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

/* Parse teams and date from a KXMLBRFI ticker.
 *
 * THE LIVE FORMAT HAS ONE DASH, NOT TWO: KXMLBRFI-26AUG151915MILLAD, i.e.
 * yy MON dd hhmm away+home all in a single part. The dashed shapes this
 * function used to describe (KXMLBRFI-25AUG13-NYYMETS) do not occur — checked
 * against scripts/nrfi-kalshi-prices.json, where 855 of 855 tickers have
 * exactly one dash.
 *
 * That mattered, because the old regex was /^(\d{2})([A-Z]{3})(\d{2})$/ with a
 * hard $ anchor, tested against "26AUG151915MILLAD". It never matched, so date
 * fell through to "" on EVERY import the account has ever done. Nothing threw
 * and nothing looked wrong on the record card, because the only visible field
 * that parseTicker feeds is `game`, and `game` is overridden by Kalshi's own
 * settlement title a line later. The blank date stayed invisible until the
 * BET SIGNALS tile tried to join on it and reported "0 of 15 taken" against a
 * real 18W/9L.
 *
 * Both shapes are accepted below anyway: matching the date prefix WITHOUT the
 * end anchor covers the live format and the legacy one in the same expression.
 */
function parseTicker(ticker: string): { date: string; game: string } {
  const parts = ticker.split("-").slice(1); // drop series prefix
  const datePart = parts[0] || "";
  const mo: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };
  // No $ anchor: "25AUG13" and "26AUG151915MILLAD" both start with the date.
  const dm = datePart.match(/^(\d{2})([A-Z]{3})(\d{2})/);
  const dateStr = dm && mo[dm[2]] ? "20" + dm[1] + mo[dm[2]] + dm[3] : "";

  /* Teams. In the live format the remainder after the 4-digit time is the two
   * codes CONCATENATED, and they cannot be split reliably: codes run 2-3 chars,
   * so "MILLAD" is MIL+LAD or MI+LLAD with nothing in the string to decide.
   * nrfi-vs-kalshi.js only gets away with splitting because it already knows the
   * matchup and can build the expected suffix; here there is no such label. So
   * return the blob unsplit rather than inventing an " @ " in the wrong place —
   * this value is a fallback for Kalshi's settlement title and rarely shown. */
  const rest = dm ? datePart.slice(dm[0].length).replace(/^\d{4}/, "") : "";
  const teams = parts.slice(1).join(" @ ") || rest || ticker;
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

    /* Repair records written while parseTicker was returning "" (see above).
     * Fixing the parser alone would strand them: the loop below skips anything
     * whose id is already present, so a bet imported with a blank date keeps it
     * forever and stays invisible to the participation join. The ticker is
     * recoverable either from the field or from the id, which is "nrfi-k-" plus
     * the ticker, so no Kalshi round trip is needed.
     *
     * Only ever FILLS A BLANK. A record that already carries a date is left
     * alone, so this cannot rewrite history that was correct to begin with. */
    let repaired = 0;
    for (const e of existing) {
      if (e.source !== "kalshi-import" || e.date) continue;
      // NrfiRec is Record<string, unknown>, so coerce rather than trust the shape.
      const tk = String(e.ticker || (e.id.startsWith("nrfi-k-") ? e.id.slice(7) : ""));
      if (!tk) continue;
      const d = parseTicker(tk).date;
      if (d) { e.date = d; repaired++; }
    }

    /* NO in-place repair of contract counts. A "fractional means fp-scaled,
     * divide by 100" pass ran here briefly and was NOT idempotent — fp/100 is
     * usually still fractional, so every import run divided the same rows
     * again (213.35 -> 2.13 -> 0.02, precision gone to rounding). The durable
     * fix is at ingestion (fp/100 above); rows written before it are deleted
     * and re-imported from Kalshi, the source of truth, not patched in place. */
    const existingIds = new Set(existing.map((e) => e.id));
    const toUpsert: NrfiRec[] = [];
    let skipped = 0;

    for (const s of nrfiRows) {
      const res = String(s.market_result || "");
      if (res !== "yes" && res !== "no") { skipped++; continue; } // unresolved

      const ticker = String(s.ticker || "");
      /* *_count_fp is the DECIMAL CONTRACT COUNT, verified against a live
       * settlement on 2026-08-20: no_count_fp "667.91" for a position the
       * positions API reported as 668 contracts, revenue 66791 cents = the
       * same count paying $1. The old /100 here dated from an era when the
       * field really was ×100 fixed-point; Kalshi changed the semantics and
       * every import since stored contracts 100× too small, which poisoned
       * the day's realized P&L and the stop-loss reading it. */
      const yc = num(s.yes_count_fp ?? s.yes_count) ?? 0;
      const nc = num(s.no_count_fp ?? s.no_count) ?? 0;
      if (yc <= 0 && nc <= 0) { skipped++; continue; } // no position held

      const side = yc >= nc ? "YES" : "NO";
      // YES on Kalshi NRFI = YRFI (you think a run scores). NO = NRFI.
      const call = side === "YES" ? "YRFI" : "NRFI";
      const won = (res === "yes") === (side === "YES");
      // res=yes means a run scored, regardless of which side the user was on.
      const firstInningRuns = res === "yes" ? 1 : 0;

      /* The settlement row carries the exact money: per-side cost in dollars,
       * the fee, and revenue in cents. These beat anything recomputed from a
       * price estimate, so they are stored on the record and the client's
       * realized-P&L (stop-loss, day cap) prefers them when present. */
      const heldCount = Math.max(yc, nc);
      const costDollars = num(side === "YES" ? s.yes_total_cost_dollars : s.no_total_cost_dollars) ?? null;
      const feeDollars = num(s.fee_cost) ?? 0;
      const revenueDollars = (num(s.revenue) ?? 0) / 100;
      const pnl = costDollars != null ? Math.round((revenueDollars - costDollars - feeDollars) * 100) / 100 : null;

      // Entry price in cents for our side: exact average from the settlement's
      // own cost when available, the fills average as fallback.
      const entryRaw = costDollars != null && heldCount > 0 ? (costDollars / heldCount) * 100 : entryPrices[ticker];
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
        contracts: heldCount,
        costDollars,
        feeDollars,
        revenueDollars,
        pnl,
        side,
      };

      /* An existing row is REPAIRED, not skipped: every Kalshi-derived field
       * is overwritten from the fresh settlement. Idempotent by construction
       * — the values come from the feed, never from the stored row, so a
       * re-run cannot compound a scaling error the way the old in-place /100
       * pass did. This is what heals the rows written while the count field
       * was misread. */
      if (existingIds.has(id)) {
        const old = existing.find((e) => e.id === id);
        if (old) {
          Object.assign(old, {
            contracts: heldCount, costDollars, feeDollars, revenueDollars, pnl,
            mktAtPick: mktAtPick ?? old.mktAtPick, result: won ? "won" : "lost", side, call,
          });
          repaired++;
        }
        skipped++;
        continue;
      }
      toUpsert.push(rec);
    }

    // `repaired` counts in-place edits to `existing`, so a run that imports
    // nothing but fixes dates still has to write. Testing only toUpsert.length
    // would silently drop the backfill.
    if (toUpsert.length || repaired) {
      // Upsert via the existing nrfi route logic: prepend new, keep ≤1000.
      const updated = [...toUpsert, ...existing].slice(0, 1000);
      await writeStore("nrfi_record", updated);
    }

    const repairNote = repaired
      ? " Backfilled the missing date on " + repaired + " previously imported bet" +
        (repaired === 1 ? "" : "s") + "."
      : "";
    return Response.json({
      imported: toUpsert.length,
      skipped,
      repaired,
      total: nrfiRows.length,
      message: (toUpsert.length
        ? "Imported " + toUpsert.length + " NRFI bet" + (toUpsert.length === 1 ? "" : "s") + " from Kalshi."
        : "No new bets to import (" + skipped + " already in history or unresolved).") + repairNote,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
