import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendCredentialsEmail } from "../../../../lib/email";

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

function generateUsername(email: string): string {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "user";
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(8);
  return "Fuel" + Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

export async function POST(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { email?: string; durationDays?: number };
  const { email } = body;
  const durationDays = Math.round(Number(body.durationDays ?? 365));

  if (!email || !email.includes("@")) {
    return Response.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 3650) {
    return Response.json({ error: "durationDays must be between 1 and 3650." }, { status: 400 });
  }

  const baseUsername = generateUsername(email);
  const password = generatePassword();
  const hash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();
  const expiresIso = new Date(Date.now() + durationDays * 86_400_000).toISOString();
  const expiresAt  = new Date(expiresIso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  let consoleKey = "";
  try { consoleKey = await issueConsoleKey(baseUsername, expiresIso); } catch { /* non-fatal */ }

  for (let attempt = 0; attempt <= 9; attempt++) {
    const username = attempt === 0 ? baseUsername : `${baseUsername}${attempt}`;
    try {
      await sql`
        INSERT INTO users (id, username, password_hash, email, expires_at, console_license_key)
        VALUES (${id}, ${username}, ${hash}, ${email}, ${expiresIso}, ${consoleKey || null})
      `;
      const emailResult = await sendCredentialsEmail({ to: email, username, password, expiresAt, consoleKey: consoleKey || undefined });
      return Response.json({ ok: true, username, password, consoleKey, emailSent: emailResult.ok, emailError: emailResult.error });
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : "").toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate")) continue;
      return Response.json({ error: "Could not create account. Please try again." }, { status: 500 });
    }
  }

  return Response.json({ error: "Username unavailable. Contact info@fueltechaipro.com." }, { status: 409 });
}
