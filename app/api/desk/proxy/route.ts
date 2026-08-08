// Market data proxy for Contract Desk — Kalshi refuses browser requests
// from other origins, so the server fetches on the client's behalf.
// Only the hostnames below are reachable through this endpoint.
import { requireDeskUser } from "../../../../lib/desk";

const ALLOWED = new Set([
  "gamma-api.polymarket.com",
  "clob.polymarket.com",
  "api.elections.kalshi.com",
  "trading-api.kalshi.com",
  "site.api.espn.com",
  "site.web.api.espn.com",
  "sports.core.api.espn.com",
  "statsapi.mlb.com",
  "api-web.nhle.com",
  "cdn.nba.com",
]);

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let target: URL;
  try {
    target = new URL(new URL(req.url).searchParams.get("url") ?? "");
  } catch {
    return Response.json({ error: "Bad target URL." }, { status: 400 });
  }
  if (!ALLOWED.has(target.hostname)) {
    return Response.json({ error: "Host not allowed: " + target.hostname }, { status: 403 });
  }

  try {
    const r = await fetch(target, {
      headers: { accept: "application/json", "user-agent": "contract-desk/2.0" },
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: "Upstream fetch failed: " + msg }, { status: 502 });
  }
}
