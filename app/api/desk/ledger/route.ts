// Contract Desk ledger — every analysis the app has made and how it
// resolved. Stored in the desk_store table (name = "ledger").
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

type LedgerEntry = { id: string } & Record<string, unknown>;

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ entries: await readStore<LedgerEntry[]>("ledger", []) });
}

export async function POST(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const incoming: LedgerEntry[] = Array.isArray(body) ? body : body ? [body] : [];

  const entries = await readStore<LedgerEntry[]>("ledger", []);
  for (const e of incoming) {
    if (!e || !e.id) continue;
    const i = entries.findIndex((x) => x.id === e.id);
    if (i >= 0) entries[i] = { ...entries[i], ...e };
    else entries.unshift(e);
  }
  await writeStore("ledger", entries.slice(0, 500));
  return Response.json({ ok: true, count: entries.length });
}

export async function DELETE(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await writeStore("ledger", []);
  return Response.json({ ok: true });
}
