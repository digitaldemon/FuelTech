// Tail feed — pulls one or more JuiceReel sellers' first-inning picks
// server-side (their profile API is public) and normalizes them into NRFI/YRFI
// calls the First Inning tab can tail. Each seller is reported active or
// "subscription not active" (feed unreachable / no accessible picks).
//
// Default sellers: nrfikingky (318949, NRFI specialist) + deeeen (196626,
// top-ranked). Override with desk_store key "nrfi_sellers" = [{name,id}].
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

const DEFAULT_SELLERS = [
  { name: "NRFIKINGKY", id: "318949" },
  { name: "deeeen", id: "196626" },
];
const TTL_MS = 8 * 60 * 1000;
const JR = "https://www.juicereel.com/api";

type KingPick = {
  id: string; side: "NRFI" | "YRFI"; line: number; odds: number | null;
  teams: string[]; startUtc: string | null; kalshiTicker: string | null;
  placedAt: string | null; result: string;
};

async function jget(url: string) {
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "contract-desk/2.0" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}

// Handles both "Milwaukee vs Los Angeles D First Inning Run?" and
// "MIL Brewers @ LA Dodgers - Under 0.5 - Runs - 1st".
function teamsFromDesc(desc: string): string[] {
  if (!desc) return [];
  let s = String(desc);
  s = s.split(/\s+First Inning/i)[0];
  s = s.split(/\s+-\s+(?:Under|Over)/i)[0];
  s = s.replace(/\?.*$/, "").trim();
  const parts = s.split(/\s+(?:vs\.?|@|at)\s+/i).map((x) => x.trim()).filter(Boolean);
  return parts.length === 2 ? parts : [];
}

function extractFirstInning(rows: any[]): KingPick[] {
  const out: KingPick[] = [];
  for (const r of rows || []) {
    for (const s of r.Subbets || []) {
      const dur = String(s.duration || "");
      const desc = String(s.description || s.scrapeDescription || "");
      const isFirstInning = /1I/i.test(dur) || /first[_\s]?inning|- 1st\b|Runs - 1st/i.test(desc);
      if (!isFirstInning) continue;
      const pos = String(s.position || "").toLowerCase();
      const side: "NRFI" | "YRFI" = pos.includes("under") ? "NRFI" : "YRFI";
      const ticket = String(r.ticketNum || "");
      out.push({
        id: String(s.id || r.id), side, line: Number(s.value ?? 0.5),
        odds: r.vig != null ? Number(r.vig) : null,
        teams: teamsFromDesc(desc), startUtc: s.startDate || null,
        kalshiTicker: (ticket.match(/KXMLBRFI-[A-Z0-9]+/i) || [])[0] || null,
        placedAt: r.datePlaced || null, result: String(r.result || "Pending"),
      });
    }
  }
  return out;
}

async function buildSeller(s: { name: string; id: string }) {
  try {
    const [openRaw, settledRaw] = await Promise.all([
      jget(`${JR}/bets/${s.id}?page=0`),
      jget(`${JR}/bets/${s.id}/settled?page=0`).catch(() => null),
    ]);
    const openRows = openRaw?.data?.bets?.data?.rows;
    if (!Array.isArray(openRows)) return { name: s.name, id: s.id, active: false, open: [], record: null };
    const open = extractFirstInning(openRows).filter((p) => p.result === "Pending");
    const settled = extractFirstInning(settledRaw?.data?.bets?.data?.rows || []);
    let wins = 0, losses = 0, pushes = 0;
    for (const x of settled) { if (/won/i.test(x.result)) wins++; else if (/lost/i.test(x.result)) losses++; else if (/push/i.test(x.result)) pushes++; }
    return { name: s.name, id: s.id, active: true, open, record: { wins, losses, pushes, sample: settled.length } };
  } catch {
    // Feed unreachable / gated -> treat as no active subscription.
    return { name: s.name, id: s.id, active: false, open: [], record: null };
  }
}

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const sellers = await readStore<{ name: string; id: string }[]>("nrfi_sellers", DEFAULT_SELLERS);
  const cacheKey = "nrfiking_cache_multi";
  if (!force) {
    const cached = await readStore<any>(cacheKey, null);
    if (cached && Date.now() - (cached.at || 0) < TTL_MS) return Response.json({ ...cached, cached: true });
  }
  const built = await Promise.all(sellers.map(buildSeller));
  const data = { sellers: built, at: Date.now() };
  await writeStore(cacheKey, data);
  return Response.json({ ...data, cached: false });
}
