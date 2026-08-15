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
// Settled pages to walk for the record. Ten tickets a page, so five pages is a
// couple of months of a busy seller — enough that the header means something,
// short enough to stay inside the cache refresh. Reading ONE page is what made
// this header report "4-6" for a seller graded 205-120 over his full book.
const SETTLED_PAGES = 5;

type KingPick = {
  id: string; side: "NRFI" | "YRFI"; line: number | null; odds: number | null;
  teams: string[]; startUtc: string | null; kalshiTicker: string | null;
  placedAt: string | null; result: string; legs: number; gradable: boolean;
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

// A first-inning leg is not automatically an NRFI leg. The feed mixes several
// markets under the same 1I duration, and `pos.includes("under") ? NRFI : YRFI`
// silently mislabels most of them:
//   Under/Over 0.5 Runs - 1st Inning   <- the real market, both teams
//   Under/Over 1.5, Over 5.5           <- read as NRFI/YRFI, different question
//   "No - LA Dodgers Run Scored"       <- ONE team; can win while a run scores
//   "Single - Live Hunter Goodman"     <- a player prop that happens to be 1I
// The two things that define the market are a directional Under/Over position
// and a literal 0.5 line; nothing else survives that pair. Verified against MLB
// line scores in scripts/nrfi-tout-grade.js, where admitting the rest produced
// 31 legs whose graded result contradicted the seller's own.
function gradableSide(s: any): "NRFI" | "YRFI" | null {
  const pos = String(s.position || "").trim().toLowerCase();
  if (pos !== "under" && pos !== "over") return null;
  if (s.value == null || Number(s.value) !== 0.5) return null;
  return pos === "under" ? "NRFI" : "YRFI";
}

function extractFirstInning(rows: any[]): KingPick[] {
  const out: KingPick[] = [];
  for (const r of rows || []) {
    for (const s of r.Subbets || []) {
      const dur = String(s.duration || "");
      const desc = String(s.description || s.scrapeDescription || "");
      const isFirstInning = /1I/i.test(dur) || /first[_\s]?inning|- 1st\b|Runs - 1st/i.test(desc);
      if (!isFirstInning) continue;
      const g = gradableSide(s);
      const pos = String(s.position || "").toLowerCase();
      const ticket = String(r.ticketNum || "");
      out.push({
        id: String(s.id || r.id), side: g || (pos.includes("under") ? "NRFI" : "YRFI"),
        line: s.value == null ? null : Number(s.value),
        odds: r.vig != null ? Number(r.vig) : null,
        teams: teamsFromDesc(desc), startUtc: s.startDate || null,
        kalshiTicker: (ticket.match(/KXMLBRFI-[A-Z0-9]+/i) || [])[0] || null,
        placedAt: r.datePlaced || null, result: String(r.result || "Pending"),
        legs: Number(r.numTeam || 1), gradable: g != null,
      });
    }
  }
  return out;
}

async function buildSeller(s: { name: string; id: string }) {
  try {
    const settledPages = Array.from({ length: SETTLED_PAGES }, (_, i) =>
      jget(`${JR}/bets/${s.id}/settled?page=${i}`).catch(() => null));
    const [p0, p1, ...settledRaw] = await Promise.all([
      jget(`${JR}/bets/${s.id}?page=0`),
      jget(`${JR}/bets/${s.id}?page=1`).catch(() => null),
      ...settledPages,
    ]);
    const openRows = p0?.data?.bets?.data?.rows;
    if (!Array.isArray(openRows)) return { name: s.name, id: s.id, active: false, open: [], record: null };
    const p1Rows = p1?.data?.bets?.data?.rows || [];
    const allOpenRows = [...openRows, ...p1Rows];
    // Only tail the market the First Inning tab is actually about. Without this
    // the board offers a player prop as an "NRFI call".
    const open = extractFirstInning(allOpenRows).filter((p) => p.result === "Pending" && p.gradable);
    const settledRows = settledRaw.flatMap((j: any) => j?.data?.bets?.data?.rows || []);
    // `result` is the TICKET's result, so charging it to one leg of a parlay
    // reports a number that belongs to four other legs as well. Straights only.
    const settled = extractFirstInning(settledRows).filter((p) => p.gradable && p.legs === 1);
    let wins = 0, losses = 0, pushes = 0;
    for (const x of settled) { if (/won/i.test(x.result)) wins++; else if (/lost/i.test(x.result)) losses++; else if (/push/i.test(x.result)) pushes++; }
    const nrfi = settled.filter((x) => x.side === "NRFI").length;
    return { name: s.name, id: s.id, active: true, open,
      record: { wins, losses, pushes, sample: settled.length, nrfi, pages: SETTLED_PAGES } };
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
