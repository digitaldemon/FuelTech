// Statcast whiff% per pitcher, from Baseball Savant's public CSV export.
// Season-long whiff is a stable skill signal that stabilizes the small
// first-inning strikeout sample. Cached in desk_store (12h).
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

const TTL_MS = 12 * 60 * 60 * 1000;

async function build(year: number) {
  // Pitcher peripherals — the stable skill signals that actually predict a
  // clean first inning: strikeouts, walks, barrels (HR risk), grounders (DPs),
  // whiff, first-pitch strikes.
  const sel = "k_percent,bb_percent,barrel_batted_rate,groundballs_percent,whiff_percent,f_strike_percent";
  const url = "https://baseballsavant.mlb.com/leaderboard/custom?year=" + year +
    "&type=pitcher&min=1&selections=" + sel + "&csv=true";
  const r = await fetch(url, { headers: { "user-agent": "contract-desk/2.0" }, cache: "no-store" });
  if (!r.ok) throw new Error("savant " + r.status);
  const csv = await r.text();
  const byId: Record<string, any> = {};
  const acc: any = { k: 0, bb: 0, barrel: 0, gb: 0, whiff: 0, fstrike: 0 };
  let n = 0;
  for (const line of csv.split(/\r?\n/).slice(1)) {
    // "Webb, Logan",657277,2026,19.1,5.9,5.3,52.5,20.5,62.6
    const m = line.match(/^".*?",(\d+),\d{4},([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+)/);
    if (!m) continue;
    const row: Record<string, number> = { k: +m[2], bb: +m[3], barrel: +m[4], gb: +m[5], whiff: +m[6], fstrike: +m[7] };
    if (!Number.isFinite(row.k)) continue;
    byId[m[1]] = row;
    for (const key of Object.keys(acc)) acc[key] += row[key];
    n++;
  }
  const lg = n
    ? { k: acc.k / n, bb: acc.bb / n, barrel: acc.barrel / n, gb: acc.gb / n, whiff: acc.whiff / n, fstrike: acc.fstrike / n }
    : { k: 22, bb: 8, barrel: 7.5, gb: 44, whiff: 24.5, fstrike: 60 };
  return { byId, lg, lgAvg: lg.whiff, at: Date.now() };
}

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const year = new Date().getUTCFullYear();
  const key = "savant_whiff_" + year;
  const cached = await readStore<any>(key, null);
  if (cached && Date.now() - (cached.at || 0) < TTL_MS) {
    return Response.json({ ...cached, cached: true });
  }
  try {
    const data = await build(year);
    await writeStore(key, data);
    return Response.json({ ...data, cached: false });
  } catch (e) {
    if (cached) return Response.json({ ...cached, cached: true, stale: true });
    return Response.json({ error: "Savant unavailable: " + (e as Error).message }, { status: 502 });
  }
}
