// Contract Desk framework library — the user-editable analysis pillar
// definitions. Stored in the desk_store table (name = "frameworks");
// null means "never edited, use the defaults baked into app.jsx".
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ frameworks: await readStore<unknown>("frameworks", null) });
}

export async function POST(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Bad JSON body." }, { status: 400 });
  await writeStore("frameworks", body);
  return Response.json({ ok: true });
}
