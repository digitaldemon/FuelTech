// The Odds API proxy — serves de-viggable multi-book moneylines (including
// sharp books via the EU region) to the desk frontend without ever exposing
// the API key to the browser. Responses are cached in module memory to
// stretch the credit quota; the remaining-credit headers are passed through
// so the UI can show usage.
export const maxDuration = 30;

import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

const BASE = "https://api.the-odds-api.com/v4";

type OddsCfg = { apiKey: string; regions?: string; markets?: string };

// sport key -> { at, body } ; the sports list caches under "__list".
const cache = new Map<string, { at: number; body: unknown; remaining: string | null; used: string | null }>();
const ODDS_TTL = 270 * 1000;   // odds refresh at most every 4.5 minutes
const LIST_TTL = 3600 * 1000;  // the sports list is free but changes rarely

async function getCfg(): Promise<OddsCfg | null> {
  const stored = await readStore<OddsCfg | null>("odds_api", null);
  if (stored && stored.apiKey) return stored;
  if (process.env.ODDS_API_KEY) return { apiKey: process.env.ODDS_API_KEY };
  return null;
}

async function fetchOdds(cfg: OddsCfg, sport: string) {
  const regions = cfg.regions || "us,eu";
  // totals + spreads ride along for the picks deciders. Credit cost is
  // markets x regions per request — the longer cache below pays for it.
  const markets = cfg.markets || "h2h,totals,spreads";
  const url = BASE + "/sports/" + encodeURIComponent(sport) +
    "/odds/?apiKey=" + encodeURIComponent(cfg.apiKey) +
    "&regions=" + encodeURIComponent(regions) + "&markets=" + encodeURIComponent(markets) + "&oddsFormat=american";
  const r = await fetch(url);
  const remaining = r.headers.get("x-requests-remaining");
  const used = r.headers.get("x-requests-used");
  if (!r.ok) {
    const body = (await r.text()).slice(0, 200);
    throw Object.assign(new Error("The Odds API " + sport + " -> " + r.status + ": " + body), { remaining, used });
  }
  return { body: await r.json(), remaining, used };
}

// Tennis keys are per-tournament (tennis_atp_us_open, …). Resolve the active
// ones for a tour prefix from the free sports list.
async function resolveSports(cfg: OddsCfg, sport: string): Promise<string[]> {
  if (sport !== "tennis_atp" && sport !== "tennis_wta") return [sport];
  const hit = cache.get("__list");
  let list: Array<{ key: string; active: boolean }>;
  if (hit && Date.now() - hit.at < LIST_TTL) {
    list = hit.body as typeof list;
  } else {
    const r = await fetch(BASE + "/sports/?apiKey=" + encodeURIComponent(cfg.apiKey));
    if (!r.ok) return [];
    list = await r.json();
    cache.set("__list", { at: Date.now(), body: list, remaining: null, used: null });
  }
  return list.filter((s) => s.active && s.key.startsWith(sport + "_")).map((s) => s.key).slice(0, 2);
}

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cfg = await getCfg();
  if (!cfg) return Response.json({ configured: false });

  const sport = new URL(req.url).searchParams.get("sport");
  if (!sport || !/^[a-z0-9_]+$/.test(sport)) {
    return Response.json({ error: "sport query param required" }, { status: 400 });
  }

  const hit = cache.get(sport);
  if (hit && Date.now() - hit.at < ODDS_TTL) {
    return Response.json({ configured: true, events: hit.body, remaining: hit.remaining, used: hit.used, cached: true });
  }

  try {
    const keys = await resolveSports(cfg, sport);
    if (!keys.length) {
      return Response.json({ configured: true, events: [], remaining: null, used: null, note: "no active tournament for " + sport });
    }
    const events: unknown[] = [];
    let remaining: string | null = null, used: string | null = null;
    for (const k of keys) {
      const got = await fetchOdds(cfg, k);
      events.push(...(Array.isArray(got.body) ? got.body : []));
      remaining = got.remaining; used = got.used;
    }
    cache.set(sport, { at: Date.now(), body: events, remaining, used });
    return Response.json({ configured: true, events, remaining, used });
  } catch (e) {
    const err = e as Error & { remaining?: string | null };
    // Serve a stale cache entry over an error — an odds read a few minutes
    // old still beats no read.
    if (hit) return Response.json({ configured: true, events: hit.body, remaining: hit.remaining, used: hit.used, cached: true, stale: true });
    return Response.json({ configured: true, error: err.message, remaining: err.remaining ?? null }, { status: 502 });
  }
}

// Save (or rotate) the API key and optional regions string.
export async function POST(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => null)) as OddsCfg | null;
  if (!b || !b.apiKey || !/^[a-f0-9]{16,64}$/i.test(b.apiKey.trim())) {
    return Response.json({ error: "apiKey (hex string) is required." }, { status: 400 });
  }
  await writeStore("odds_api", { apiKey: b.apiKey.trim(), regions: b.regions || "us,eu" });
  cache.clear();
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await writeStore("odds_api", null);
  cache.clear();
  return Response.json({ ok: true });
}
