// Home-plate umpire tendency table. There's no clean public API for umpire
// zone/run tendencies, so this is a populatable store: keyed by umpire full
// name -> { runFactor, note }. runFactor < 1 = suppresses runs (NRFI lean),
// > 1 = inflates (YRFI lean). The model applies it only when the assigned ump
// is present here; unknown umps stay neutral. Fill via POST (paste from a
// source like umpscorecards / thecapper), same pattern as the NRFIKINGKY feed.
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

type UmpTable = Record<string, { runFactor: number; note?: string }>;

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ umpires: await readStore<UmpTable>("umpire_tendencies", {}) });
}

// POST { "James Hoye": { runFactor: 0.94, note: "large zone" }, ... } — upserts.
export async function POST(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Expected an object of { name: { runFactor } }" }, { status: 400 });
  }
  const table = await readStore<UmpTable>("umpire_tendencies", {});
  for (const [name, v] of Object.entries(body as UmpTable)) {
    const rf = Number((v as any).runFactor);
    if (!name || !Number.isFinite(rf)) continue;
    table[name] = { runFactor: Math.max(0.8, Math.min(1.2, rf)), note: (v as any).note || "" };
  }
  await writeStore("umpire_tendencies", table);
  return Response.json({ ok: true, count: Object.keys(table).length });
}

export async function DELETE(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await writeStore("umpire_tendencies", {});
  return Response.json({ ok: true });
}
