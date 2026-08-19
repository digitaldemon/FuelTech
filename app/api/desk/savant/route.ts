// Statcast whiff% per pitcher, from Baseball Savant's public CSV export.
// Season-long whiff is a stable skill signal that stabilizes the small
// first-inning strikeout sample. Cached in desk_store (12h).
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

const TTL_MS = 12 * 60 * 60 * 1000;

/* THE LEAGUE BASELINE IS INNINGS-WEIGHTED, and it was not until 2026-08-16.
 *
 * pitchSkillFactor compares a starter's peripherals against `lg` and every one
 * of its six terms is a ratio to it, so `lg` decides where the factor centres.
 * It was the UNWEIGHTED mean over every pitcher the leaderboard returns at
 * min=1 — one row for a September call-up with two innings, one row for an ace
 * with 180. 183 of 758 arms this season have under 10 IP: 24% of the rows and
 * 2.7% of the innings, and they walk 12.50 per 100 against a starter's 8.03.
 *
 * So the baseline was not "an average inning of major league pitching", it was
 * "an average pitcher who appeared", and it sat well off the real one:
 *
 *     k 21.01 vs 22.33    bb 10.22 vs 8.80    gb 41.49 vs 42.50
 *
 * Measured over the 196 arms working as starters, that mis-centred the factor
 * to a geometric mean of 0.9475 and pushed 13.8% of them onto the 0.80 floor
 * against only 5.6% at the ceiling. The tilt itself is cheap — a constant is
 * what a calibrator absorbs — but the saturation is not: an arm past the clamp
 * gets the same 0.80 however good it is, so the factor stopped discriminating
 * precisely among the extremes it exists to find. Innings-weighted, the same
 * population centres at 1.0075 with 6.1% floor and 12.8% ceiling.
 *
 * p_formatted_ip is baseball's notation, where 25.1 means 25 and a third. It is
 * used here only as a WEIGHT, so treating it as a decimal misplaces an arm by
 * at most two thirds of an inning out of hundreds, which cannot move a mean.
 * Do not reuse this number as an innings COUNT without converting it.
 */
async function build(year: number) {
  // Pitcher peripherals — the stable skill signals that actually predict a
  // clean first inning: strikeouts, walks, barrels (HR risk), grounders (DPs),
  // whiff, first-pitch strikes. Innings come last, for weighting only.
  const sel = "k_percent,bb_percent,barrel_batted_rate,groundballs_percent,whiff_percent,f_strike_percent,p_formatted_ip";
  const url = "https://baseballsavant.mlb.com/leaderboard/custom?year=" + year +
    "&type=pitcher&min=1&selections=" + sel + "&csv=true";
  const r = await fetch(url, { headers: { "user-agent": "contract-desk/2.0" }, cache: "no-store" });
  if (!r.ok) throw new Error("savant " + r.status);
  const csv = await r.text();
  const byId: Record<string, any> = {};
  const acc: any = { k: 0, bb: 0, barrel: 0, gb: 0, whiff: 0, fstrike: 0 };
  let ip = 0, n = 0;
  const uacc: any = { k: 0, bb: 0, barrel: 0, gb: 0, whiff: 0, fstrike: 0 };
  for (const line of csv.split(/\r?\n/).slice(1)) {
    // "Webb, Logan",657277,2026,19.1,5.9,5.3,52.5,20.5,62.6,"180.1"
    const m = line.match(/^".*?",(\d+),\d{4},([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+),"?([\d.]+)"?/);
    if (!m) continue;
    const row: Record<string, number> = { k: +m[2], bb: +m[3], barrel: +m[4], gb: +m[5], whiff: +m[6], fstrike: +m[7] };
    if (!Number.isFinite(row.k)) continue;
    byId[m[1]] = row;
    // byId keeps every arm — a probable starter with few innings still needs his
    // own peripherals. Only the BASELINE is weighted, and a row with no innings
    // contributes nothing to it rather than voting equally.
    const w = +m[8];
    n++;
    for (const key of Object.keys(acc)) uacc[key] += row[key];
    if (Number.isFinite(w) && w > 0) {
      for (const key of Object.keys(acc)) acc[key] += row[key] * w;
      ip += w;
    }
  }
  const div = (a: any, d: number) => ({ k: a.k / d, bb: a.bb / d, barrel: a.barrel / d, gb: a.gb / d, whiff: a.whiff / d, fstrike: a.fstrike / d });
  // If the innings column ever stops parsing, fall back to the unweighted mean
  // rather than to the frozen literals — it is wrong in a known direction and
  // still tracks the season, which the 2026-era constants below do not.
  const lg = ip > 0 ? div(acc, ip)
    : n ? div(uacc, n)
    : { k: 22, bb: 8, barrel: 7.5, gb: 44, whiff: 24.5, fstrike: 60 };
  return { byId, lg, lgAvg: lg.whiff, ipWeighted: ip > 0, at: Date.now() };
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
