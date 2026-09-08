// Kalshi trading-bot status relay. The bot on Billy's PC pushes a sanitized
// snapshot here every ~30s (x-admin-secret); desk members read it. Display
// data only — no controls, no credentials, cannot touch orders.
import { requireDeskUser, readStore, writeStore } from "../../../../../lib/desk";

export async function POST(req: Request) {
  const user = await requireDeskUser(req);
  if (user !== "admin") return new Response("forbidden", { status: 403 });
  const body = await req.json();
  await writeStore("kalshi_bot_status", {
    ...body,
    pushed_at: new Date().toISOString(),
  });
  return Response.json({ ok: true });
}

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) return new Response("forbidden", { status: 403 });
  return Response.json(await readStore("kalshi_bot_status", {}));
}
