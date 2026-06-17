import { sql } from "@vercel/postgres";

function auth(req: Request): boolean {
  const s = req.headers.get("x-admin-secret");
  return !!s && s === process.env.ADMIN_SECRET;
}

// GET  — list last N distinct docs with optional source filter
// ?source=pei&limit=20
export async function GET(req: Request) {
  if (!auth(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  const rows = source
    ? (await sql`
        SELECT url, title, source, MAX(created_at) AS last_created
        FROM fuel_tech_docs
        WHERE source = ${source}
        GROUP BY url, title, source
        ORDER BY last_created DESC
        LIMIT ${limit}
      `).rows
    : (await sql`
        SELECT url, title, source, MAX(created_at) AS last_created
        FROM fuel_tech_docs
        GROUP BY url, title, source
        ORDER BY last_created DESC
        LIMIT ${limit}
      `).rows;

  return Response.json({ docs: rows });
}

// PATCH — update source for a list of URLs
// body: { urls: string[], source: string }
export async function PATCH(req: Request) {
  if (!auth(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { urls, source } = (await req.json()) as { urls: string[]; source: string };
  if (!Array.isArray(urls) || !urls.length) return Response.json({ error: "urls required" }, { status: 400 });
  if (!source) return Response.json({ error: "source required" }, { status: 400 });

  let updated = 0;
  for (const url of urls) {
    const res = await sql`UPDATE fuel_tech_docs SET source = ${source} WHERE url = ${url}`;
    updated += res.rowCount ?? 0;
  }

  return Response.json({ ok: true, rowsUpdated: updated });
}
