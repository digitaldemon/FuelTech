import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// POST /api/auth/create-user
// Protected with x-admin-secret header (set ADMIN_SECRET env var on Vercel).
// Use this after a customer pays via PayPal to create their login.
//
// Example (curl):
//   curl -X POST https://www.fueltechaipro.com/api/auth/create-user \
//     -H "Content-Type: application/json" \
//     -H "x-admin-secret: YOUR_ADMIN_SECRET" \
//     -d '{"username":"jsmith","password":"TempPass1!","email":"jsmith@company.com"}'

export async function POST(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, password, email } = (await req.json()) as {
    username: string;
    password: string;
    email?: string;
  };

  if (!username || !password) {
    return Response.json({ error: "username and password are required" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();

  try {
    await sql`
      INSERT INTO users (id, username, password_hash, email, expires_at)
      VALUES (${id}, ${username}, ${hash}, ${email ?? null}, NOW() + INTERVAL '1 year')
    `;
    return Response.json({ ok: true, id, username });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "DB error";
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate")) {
      return Response.json({ error: "Username already exists" }, { status: 409 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/auth/create-user  — remove a user by username
export async function DELETE(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = (await req.json()) as { username: string };
  if (!username) {
    return Response.json({ error: "username is required" }, { status: 400 });
  }

  const result = await sql`DELETE FROM users WHERE username = ${username}`;
  const deleted = result.rowCount ?? 0;
  return Response.json({ ok: true, deleted });
}
