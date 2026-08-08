// Connectivity check for Contract Desk — probes both market venues so a
// blank Browse tab can be told apart from an upstream outage.
import { requireDeskUser } from "../../../../lib/desk";

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const probe = async (label: string, url: string) => {
    const t0 = Date.now();
    try {
      const r = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "contract-desk/2.0" },
      });
      const body = await r.text();
      return { label, status: r.status, ms: Date.now() - t0, bytes: body.length, sample: body.slice(0, 120) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { label, status: 0, ms: Date.now() - t0, error: msg };
    }
  };

  return Response.json({
    checks: await Promise.all([
      probe("Kalshi markets", "https://api.elections.kalshi.com/trade-api/v2/markets?limit=1&status=open"),
      probe("Polymarket events", "https://gamma-api.polymarket.com/events?closed=false&limit=1"),
    ]),
  });
}
