import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";

// POST /api/admin/migrate-legacy
// One-time migration: inserts legacy hardcoded accounts into the users table
// with bcrypt-hashed passwords and expires_at = NULL (no expiry).
// Safe to call multiple times — skips any username that already exists in the DB.
// Protected with x-admin-secret header.
//
// curl -X POST https://www.fueltechaipro.com/api/admin/migrate-legacy \
//   -H "x-admin-secret: YOUR_ADMIN_SECRET"

const LEGACY: { username: string; password: string }[] = [
  { username: "tech1", password: "password123" },
  { username: "tech2", password: "password456" },
  { username: "bill",  password: "hercules"    },
  { username: "tauny", password: "wsk"         },
  { username: "jesse", password: "wsk"         },
];

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { username: string; status: "created" | "skipped" | "error"; detail?: string }[] = [];

  for (const { username, password } of LEGACY) {
    try {
      const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
      if (existing.rows.length > 0) {
        results.push({ username, status: "skipped" });
        continue;
      }
      const hash = await bcrypt.hash(password, 12);
      const id   = crypto.randomUUID();
      await sql`
        INSERT INTO users (id, username, password_hash, email, expires_at)
        VALUES (${id}, ${username}, ${hash}, NULL, NULL)
      `;
      results.push({ username, status: "created" });
    } catch (e) {
      results.push({ username, status: "error", detail: e instanceof Error ? e.message : String(e) });
    }
  }

  const allOk = results.every(r => r.status !== "error");
  return Response.json({ ok: allOk, results });
}
