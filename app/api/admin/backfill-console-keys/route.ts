import { sql } from "@vercel/postgres";
import crypto from "crypto";

// POST /api/admin/backfill-console-keys (admin only)
// Issues console license keys for any web users who don't have one yet.
// Safe to run multiple times — skips users who already have a key.

const KEY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateConsoleKey(): string {
  const seg = () =>
    Array.from(crypto.randomBytes(4))
      .map((b) => KEY_CHARS[b % KEY_CHARS.length])
      .join("");
  return `FTAI-${seg()}-${seg()}-${seg()}`;
}

async function issueKey(techName: string, expiresAt: string | null): Promise<string> {
  const exp = expiresAt ?? new Date(Date.now() + 365 * 86_400_000).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateConsoleKey();
    const existing = await sql`SELECT 1 FROM console_licenses WHERE license_key = ${key}`;
    if (existing.rows.length === 0) {
      await sql`
        INSERT INTO console_licenses (id, license_key, tech_name, expires_at)
        VALUES (${crypto.randomUUID()}, ${key}, ${techName}, ${exp})
      `;
      return key;
    }
  }
  throw new Error("Key generation failed");
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await sql`
    SELECT id, username, expires_at
    FROM users
    WHERE console_license_key IS NULL
  `;

  const results: { username: string; key: string }[] = [];

  for (const user of users.rows) {
    const techName = user.username as string;
    const expiresAt = user.expires_at as string | null;
    const key = await issueKey(techName, expiresAt);
    await sql`
      UPDATE users SET console_license_key = ${key} WHERE id = ${user.id as string}
    `;
    results.push({ username: techName, key });
  }

  return Response.json({ ok: true, backfilled: results.length, results });
}
