// Picks record — every projected winner the board displays pregame gets
// logged, then scored when the game goes final. This is the honest track
// record for the Today's picks tab, separate from the analysis ledger.
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

type PickRec = { id: string } & Record<string, unknown>;

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ record: await readStore<PickRec[]>("picks_record", []) });
}

// Upsert by id — new calls append, scored calls update in place.
export async function POST(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const incoming: PickRec[] = Array.isArray(body) ? body : body ? [body] : [];
  const record = await readStore<PickRec[]>("picks_record", []);
  for (const p of incoming) {
    if (!p || !p.id) continue;
    const i = record.findIndex((x) => x.id === p.id);
    if (i >= 0) record[i] = { ...record[i], ...p };
    else record.unshift(p);
  }
  await writeStore("picks_record", record.slice(0, 1000));
  return Response.json({ ok: true, count: record.length });
}

export async function DELETE(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await writeStore("picks_record", []);
  return Response.json({ ok: true });
}
