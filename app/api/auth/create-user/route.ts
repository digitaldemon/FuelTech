import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// POST /api/auth/create-user
// Protected with x-admin-secret header (set ADMIN_SECRET env var on Vercel).
// Use this after a customer pays via PayPal to create their login.
// Automatically generates a console license key (same expiry) and links it to the account.
//
// Example (curl):
//   curl -X POST https://www.fueltechaipro.com/api/auth/create-user \
//     -H "Content-Type: application/json" \
//     -H "x-admin-secret: YOUR_ADMIN_SECRET" \
//     -d '{"username":"jsmith","password":"TempPass1!","email":"jsmith@company.com","techName":"John Smith"}'

const KEY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateConsoleKey(): string {
  const seg = () =>
    Array.from(crypto.randomBytes(4))
      .map((b) => KEY_CHARS[b % KEY_CHARS.length])
      .join("");
  return `FTAI-${seg()}-${seg()}-${seg()}`;
}

async function issueConsoleKey(techName: string, expiresAt: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateConsoleKey();
    const existing = await sql`SELECT 1 FROM console_licenses WHERE license_key = ${key}`;
    if (existing.rows.length === 0) {
      await sql`
        INSERT INTO console_licenses (id, license_key, tech_name, expires_at)
        VALUES (${crypto.randomUUID()}, ${key}, ${techName}, ${expiresAt})
      `;
      return key;
    }
  }
  throw new Error("Console key generation failed");
}

export async function POST(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, password, email, techName } = (await req.json()) as {
    username: string;
    password: string;
    email?: string;
    techName?: string;
  };

  const safeUsername = (username ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  if (!safeUsername || !password) {
    return Response.json({ error: "username and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  if (email) {
    const dup = await sql`SELECT 1 FROM users WHERE email = ${email} LIMIT 1`;
    if (dup.rows.length > 0) {
      return Response.json({ error: "Email already registered" }, { status: 409 });
    }
  }

  const hash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 365 * 86_400_000).toISOString();
  const displayName = techName?.trim() || username;

  try {
    const consoleKey = await issueConsoleKey(displayName, expiresAt);

    await sql`
      INSERT INTO users (id, username, password_hash, email, expires_at, console_license_key)
      VALUES (${id}, ${safeUsername}, ${hash}, ${email ?? null}, ${expiresAt}, ${consoleKey})
    `;
    return Response.json({ ok: true, id, username: safeUsername, consoleKey });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "DB error";
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate")) {
      return Response.json({ error: "Username already exists" }, { status: 409 });
    }
    console.error('create-user DB error:', msg);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/auth/create-user  — list all web users (admin only)
export async function GET(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sql`
      SELECT id, username, email, active, expires_at, created_at
      FROM users
      ORDER BY created_at DESC
    `;
    return Response.json({ ok: true, users: result.rows });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

// PATCH /api/auth/create-user  — activate or deactivate a user
export async function PATCH(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, active, password } = (await req.json().catch(() => ({}))) as { username?: string; active?: boolean; password?: string };
  if (!username) return Response.json({ error: "username is required" }, { status: 400 });

  try {
    if (typeof password === 'string') {
      if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      const hash = await bcrypt.hash(password, 12);
      await sql`UPDATE users SET password_hash = ${hash} WHERE username = ${username}`;
      return Response.json({ ok: true, updated: "password" });
    }
    if (typeof active !== 'boolean') return Response.json({ error: "active or password is required" }, { status: 400 });
    await sql`UPDATE users SET active = ${active} WHERE username = ${username}`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

// DELETE /api/auth/create-user  — remove a user by username
export async function DELETE(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = (await req.json().catch(() => ({}))) as { username?: string };
  if (!username) {
    return Response.json({ error: "username is required" }, { status: 400 });
  }

  try {
    const result = await sql`DELETE FROM users WHERE username = ${username}`;
    const deleted = result.rowCount ?? 0;
    return Response.json({ ok: true, deleted });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
