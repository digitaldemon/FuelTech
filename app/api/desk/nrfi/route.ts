// NRFI/YRFI record — every first-inning call the board makes pregame gets
// logged, then graded from the real first-inning line score. Separate track
// record for the First Inning tab, alongside the main picks_record.
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";
import { runNrfiNotify } from "../../../../lib/nrfi-notify";

type NrfiRec = { id: string } & Record<string, unknown>;

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ record: await readStore<NrfiRec[]>("nrfi_record", []) });
}

// Upsert by id — new calls append, graded calls update in place.
export async function POST(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const incoming: NrfiRec[] = Array.isArray(body) ? body : body ? [body] : [];
  const record = await readStore<NrfiRec[]>("nrfi_record", []);
  const newIds = new Set<string>();
  for (const p of incoming) {
    if (!p || !p.id) continue;
    const i = record.findIndex((x) => x.id === p.id);
    if (i >= 0) record[i] = { ...record[i], ...p };
    else { record.unshift(p); newIds.add(p.id); }
  }
  await writeStore("nrfi_record", record.slice(0, 1000));

  // Fire notifications for any freshly-added BET/STRONG picks.
  if (newIds.size > 0) {
    const newEntries = record.filter((e) => newIds.has(e.id));
    runNrfiNotify(newEntries).catch(() => {/* non-fatal */});
  }

  return Response.json({ ok: true, count: record.length });
}

export async function DELETE(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const record = await readStore<NrfiRec[]>("nrfi_record", []);
    const filtered = record.filter((x) => x.id !== id);
    if (filtered.length === record.length) {
      return Response.json({ error: "Not found", id }, { status: 404 });
    }
    await writeStore("nrfi_record", filtered);
    return Response.json({ ok: true, removed: 1, remaining: filtered.length });
  }
  await writeStore("nrfi_record", []);
  return Response.json({ ok: true });
}
