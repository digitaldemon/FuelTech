// NRFIKINGKY feed — pulls a JuiceReel seller's first-inning picks server-side
// (his profile API is public) and normalizes them into NRFI/YRFI calls the
// First Inning tab can tail. Cached in desk_store to avoid hammering JuiceReel.
//
// Seller "nrfikingky" = JuiceReel userId 318949. Override with ?userId= or the
// desk_store key "nrfiking_userId".
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

const DEFAULT_USER = "318949";
const TTL_MS = 8 * 60 * 1000;
const JR = "https://www.juicereel.com/api";

type KingPick = {
  id: string;
  side: "NRFI" | "YRFI";
  line: number;
  odds: number | null;
  teams: string[];
  startUtc: string | null;
  kalshiTicker: string | null;
  placedAt: string | null;
  result: string; // Pending | Won | Lost | Push
};

async function jget(url: string) {
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "contract-desk/2.0" },
    // JuiceReel's profile API is public; no cookies needed.
    cache: "no-store",
  });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}

// "Milwaukee vs Los Angeles D First Inning Run? Yes | No" -> ["Milwaukee","Los Angeles D"]
// "Los Angeles Angels vs Texas Rangers - Under 0.5"       -> ["Los Angeles Angels","Texas Rangers"]
function teamsFromDesc(desc: string): string[] {
  if (!desc) return [];
  let s = String(desc);
  s = s.split(/\s+First Inning/i)[0];
  s = s.split(/\s+-\s+(?:Under|Over)/i)[0];
  s = s.replace(/\?.*$/, "").trim();
  const parts = s.split(/\s+vs\.?\s+/i).map((x) => x.trim()).filter(Boolean);
  return parts.length === 2 ? parts : [];
}

// A first-inning total is NRFIKINGKY's bread and butter: duration "1I",
// subbetType "GameOu". Under 0.5 = NRFI, Over 0.5 = YRFI.
function extractFirstInning(rows: any[]): KingPick[] {
  const out: KingPick[] = [];
  for (const r of rows || []) {
    for (const s of r.Subbets || []) {
      const dur = String(s.duration || "");
      const type = String(s.subbetType || "");
      const isFirstInning =
        /1I/i.test(dur) ||
        /first[_\s]?inning/i.test(String(s.scrapeDescription || s.description || ""));
      if (!isFirstInning) continue;
      if (type && !/ou|total/i.test(type)) continue;
      const pos = String(s.position || "").toLowerCase();
      const side: "NRFI" | "YRFI" = pos.includes("under") ? "NRFI" : "YRFI";
      const ticket = String(r.ticketNum || "");
      out.push({
        id: String(s.id || r.id),
        side,
        line: Number(s.value ?? 0.5),
        odds: r.vig != null ? Number(r.vig) : null,
        teams: teamsFromDesc(s.description || s.scrapeDescription || ""),
        startUtc: s.startDate || null,
        kalshiTicker: (ticket.match(/KXMLBRFI-[A-Z0-9]+/i) || [])[0] || null,
        placedAt: r.datePlaced || null,
        result: String(r.result || "Pending"),
      });
    }
  }
  return out;
}

async function build(userId: string) {
  const [openRaw, settledRaw] = await Promise.all([
    jget(`${JR}/bets/${userId}?page=0`),
    jget(`${JR}/bets/${userId}/settled?page=0`).catch(() => null),
  ]);
  const openRows = openRaw?.data?.bets?.data?.rows || [];
  const open = extractFirstInning(openRows).filter((p) => p.result === "Pending");

  const settledRows = settledRaw?.data?.bets?.data?.rows || [];
  const settled = extractFirstInning(settledRows);
  let wins = 0, losses = 0, pushes = 0;
  for (const s of settled) {
    if (/won/i.test(s.result)) wins++;
    else if (/lost/i.test(s.result)) losses++;
    else if (/push/i.test(s.result)) pushes++;
  }
  const displayName = openRaw?.data?.user?.displayName || openRaw?.username || userId;

  return {
    userId,
    displayName,
    open,
    settledRecent: settled.slice(0, 20),
    record: { wins, losses, pushes, sample: settled.length },
    at: Date.now(),
  };
}

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const userId =
    url.searchParams.get("userId") ||
    (await readStore<string>("nrfiking_userId", DEFAULT_USER));

  const cacheKey = "nrfiking_cache_" + userId;
  if (!force) {
    const cached = await readStore<any>(cacheKey, null);
    if (cached && Date.now() - (cached.at || 0) < TTL_MS) {
      return Response.json({ ...cached, cached: true });
    }
  }
  try {
    const data = await build(userId);
    await writeStore(cacheKey, data);
    return Response.json({ ...data, cached: false });
  } catch (e) {
    // Fall back to any stale cache so the tab still shows his last-known picks.
    const cached = await readStore<any>(cacheKey, null);
    if (cached) return Response.json({ ...cached, cached: true, stale: true });
    return Response.json({ error: "Feed unavailable: " + (e as Error).message }, { status: 502 });
  }
}
