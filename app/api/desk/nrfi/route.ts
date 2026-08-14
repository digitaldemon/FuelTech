// NRFI/YRFI record — every first-inning call the board makes pregame gets
// logged, then graded from the real first-inning line score. Separate track
// record for the First Inning tab, alongside the main picks_record.
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

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
  for (const p of incoming) {
    if (!p || !p.id) continue;
    const i = record.findIndex((x) => x.id === p.id);
    if (i >= 0) record[i] = { ...record[i], ...p };
    else record.unshift(p);
  }
  await writeStore("nrfi_record", record.slice(0, 1000));
  return Response.json({ ok: true, count: record.length });
}

export async function DELETE(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await writeStore("nrfi_record", []);
  return Response.json({ ok: true });
}
