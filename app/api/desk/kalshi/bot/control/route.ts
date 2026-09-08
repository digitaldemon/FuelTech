// Desk-side control channel for the Kalshi bot. The desk UI POSTs desired
// settings (market on/off, trade size); the bot's pusher polls GET every 30s
// and applies them to its local config, which hot-reloads. Config-level only —
// there is no path from here to orders, credentials, or the exchange.
import { requireDeskUser, readStore, writeStore } from "../../../../../../lib/desk";

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) return new Response("forbidden", { status: 403 });
  return Response.json(await readStore("kalshi_bot_control", {}));
}

export async function POST(req: Request) {
  const user = await requireDeskUser(req);
  if (!user) return new Response("forbidden", { status: 403 });
  const body = (await req.json()) as Record<string, unknown>;
  const cur = await readStore<Record<string, unknown>>("kalshi_bot_control", {});
  const next = { ...cur, ...body, ts: Date.now(), by: user };
  await writeStore("kalshi_bot_control", next);
  return Response.json({ ok: true, control: next });
}
