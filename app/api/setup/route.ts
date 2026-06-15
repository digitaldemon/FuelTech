import { sql } from "@vercel/postgres";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  await sql`ALTER TABLE fuel_tech_docs ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 0`;
  await sql`ALTER TABLE fuel_tech_docs ADD COLUMN IF NOT EXISTS model TEXT DEFAULT ''`;

  await sql`
    CREATE INDEX IF NOT EXISTS fuel_tech_docs_embedding_idx
    ON fuel_tech_docs
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS fuel_tech_docs_model_idx
    ON fuel_tech_docs (model)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS fuel_tech_docs_fts_idx
    ON fuel_tech_docs
    USING gin (to_tsvector('english', coalesce(title,'') || ' ' || chunk_text))
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fuel_tech_figures (
      id TEXT PRIMARY KEY,
      doc_url TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS fuel_tech_figures_doc_url_idx
    ON fuel_tech_figures (doc_url)
  `;

  // Backfill model tags on existing chunks using title patterns.
  // Ordered most-specific first so TLS-450PLUS is never overwritten by TLS-450.
  const modelMigrations: { patterns: string[]; model: string }[] = [
    { patterns: ['%TLS-450PLUS%', '%TLS-450 PLUS%', '%TLS450PLUS%'], model: 'TLS-450PLUS' },
    { patterns: ['%TLS-450iS%'],                                       model: 'TLS-450iS' },
    { patterns: ['%TLS-450i%'],                                        model: 'TLS-450i' },
    { patterns: ['%TLS-450%'],                                         model: 'TLS-450' },
    { patterns: ['%TLS-350R%'],                                        model: 'TLS-350R' },
    { patterns: ['%TLS-350%'],                                         model: 'TLS-350' },
    { patterns: ['%TLS-300%'],                                         model: 'TLS-300' },
    { patterns: ['%TLS-4B%'],                                          model: 'TLS-4B' },
    { patterns: ['%TLS-4 %', '%TLS4 %'],                              model: 'TLS-4' },
    { patterns: ['%Encore 700S%', '%Encore S700%'],                   model: 'Encore 700S' },
    { patterns: ['%Encore 700%'],                                      model: 'Encore 700' },
    { patterns: ['%Encore S%'],                                        model: 'Encore S' },
    { patterns: ['%CRIND%'],                                           model: 'CRIND' },
    { patterns: ['%Eclipse%'],                                         model: 'Eclipse' },
    { patterns: ['%FlexPay IV%'],                                      model: 'FlexPay IV' },
    { patterns: ['%FlexPay%'],                                         model: 'FlexPay' },
    { patterns: ['%Passport%'],                                        model: 'Passport' },
    { patterns: ['%TS-550%'],                                          model: 'TS-550' },
    { patterns: ['%TS-750%'],                                          model: 'TS-750' },
    { patterns: ['%FE Petro%', '%FE-Petro%'],                         model: 'FE Petro' },
  ];

  for (const { patterns, model } of modelMigrations) {
    for (const pat of patterns) {
      await sql`
        UPDATE fuel_tech_docs
        SET model = ${model}
        WHERE model = '' AND title ILIKE ${pat}
      `;
    }
  }

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      active BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMPTZ
    )
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;

  await sql`
    CREATE TABLE IF NOT EXISTS console_licenses (
      id           TEXT PRIMARY KEY,
      license_key  TEXT UNIQUE NOT NULL,
      tech_name    TEXT NOT NULL,
      machine_id   TEXT,
      activated_at TIMESTAMPTZ,
      expires_at   TIMESTAMPTZ NOT NULL,
      active       BOOLEAN DEFAULT TRUE,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS console_licenses_key_idx ON console_licenses (license_key)`;

  await sql`
    CREATE TABLE IF NOT EXISTS enterprise_waitlist (
      email    TEXT PRIMARY KEY,
      company  TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      company     TEXT,
      rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      review_text TEXT NOT NULL,
      approved    BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS reviews_approved_idx ON reviews (approved, created_at DESC)`;

  return Response.json({ ok: true, message: "Database initialized" });
}

export async function GET(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sql`
    SELECT source, COUNT(*) AS count
    FROM fuel_tech_docs
    GROUP BY source
    ORDER BY source
  `;
  const total = result.rows.reduce((sum, r) => sum + Number(r.count), 0);

  const modelResult = await sql`
    SELECT model, COUNT(*) AS count
    FROM fuel_tech_docs
    WHERE model != ''
    GROUP BY model
    ORDER BY count DESC
    LIMIT 20
  `;

  let figures = 0;
  let sampleFigureUrl = "";
  try {
    const figResult = await sql`SELECT COUNT(*) AS count FROM fuel_tech_figures`;
    figures = Number(figResult.rows[0]?.count ?? 0);
    const sample = await sql`SELECT image_url FROM fuel_tech_figures LIMIT 1`;
    sampleFigureUrl = (sample.rows[0]?.image_url as string) ?? "";
  } catch { /* table may not exist yet */ }

  return Response.json({ total, bySource: result.rows, byModel: modelResult.rows, figures, sampleFigureUrl });
}
