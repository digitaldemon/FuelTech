import { sql } from "@vercel/postgres";

export async function POST() {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
    CREATE TABLE IF NOT EXISTS fuel_tech_docs (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT,
      chunk_text TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      source TEXT NOT NULL,
      embedding vector(1536),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ivfflat index is most effective after data is loaded; recreate with larger
  // lists value (e.g. rows/1000) once the table exceeds ~10k rows.
  await sql`
    CREATE INDEX IF NOT EXISTS fuel_tech_docs_embedding_idx
    ON fuel_tech_docs
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `;

  return Response.json({ ok: true, message: "Database initialized" });
}

export async function GET() {
  const result = await sql`
    SELECT source, COUNT(*) AS count
    FROM fuel_tech_docs
    GROUP BY source
    ORDER BY source
  `;
  const total = result.rows.reduce((sum, r) => sum + Number(r.count), 0);
  return Response.json({ total, bySource: result.rows });
}
