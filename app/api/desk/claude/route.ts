// Anthropic proxy for Contract Desk — keeps the API key server-side.
// Analysis calls run live web searches and can take minutes.
export const maxDuration = 300;

import { requireDeskUser } from "../../../../lib/desk";

export async function POST(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(await req.json()),
    });
    const body = await r.text();
    if (!r.ok) console.error("Anthropic API " + r.status + ": " + body.slice(0, 300));
    return new Response(body, {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: "Could not reach the Anthropic API: " + msg }, { status: 502 });
  }
}
