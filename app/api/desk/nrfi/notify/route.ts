// GET — called by Vercel cron every 10 min as a safety net.
// POST with x-admin-secret — send a test notification with a provided entry.
import { runNrfiNotify } from "../../../../../lib/nrfi-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runNrfiNotify();
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const entry = body?.entry;
    if (!entry?.id) return Response.json({ error: "entry with id required" }, { status: 400 });
    const result = await runNrfiNotify([entry], { force: true });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
