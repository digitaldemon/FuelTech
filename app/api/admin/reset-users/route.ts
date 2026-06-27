import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const KEY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateConsoleKey(): string {
  const seg = () => Array.from(crypto.randomBytes(4)).map(b => KEY_CHARS[b % KEY_CHARS.length]).join("");
  return `FTAI-${seg()}-${seg()}-${seg()}`;
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, password, email, confirm } = (await req.json()) as {
    username: string; password: string; email: string; confirm?: string;
  };
  if (!username || !password || !email) {
    return Response.json({ error: "username, password, email required" }, { status: 400 });
  }
  if (confirm !== "DELETE_ALL_USERS") {
    return Response.json({ error: 'Must pass confirm: "DELETE_ALL_USERS"' }, { status: 400 });
  }

  try {
    // Delete users first (FK references console_licenses), then licenses
    await sql`DELETE FROM users`;
    await sql`DELETE FROM console_licenses`;

    // Create new account + console key
    const expiresAt = new Date(Date.now() + 365 * 86_400_000).toISOString();
    const consoleKey = generateConsoleKey();
    await sql`
      INSERT INTO console_licenses (id, license_key, tech_name, expires_at)
      VALUES (${crypto.randomUUID()}, ${consoleKey}, ${username}, ${expiresAt})
    `;
    const hash = await bcrypt.hash(password, 12);
    await sql`
      INSERT INTO users (id, username, password_hash, email, expires_at, console_license_key)
      VALUES (${crypto.randomUUID()}, ${username}, ${hash}, ${email}, ${expiresAt}, ${consoleKey})
    `;

    return Response.json({ ok: true, username, consoleKey, expiresAt });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Database error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
