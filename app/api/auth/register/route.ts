import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateUsername(email: string): string {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "user";
}

function generatePassword(): string {
  // Readable format: Fuel + 8 mixed alphanumeric chars (no ambiguous 0/O/1/l/I)
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

  for (let attempt = 0; attempt <= 9; attempt++) {
    const username = attempt === 0 ? baseUsername : `${baseUsername}${attempt}`;
    try {
      await sql`
        INSERT INTO users (id, username, password_hash, email, expires_at)
        VALUES (${id}, ${username}, ${hash}, ${email}, NOW() + (${durationDays} * INTERVAL '1 day'))
      `;
      return Response.json({ ok: true, username, password });
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : "").toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate")) continue;
      return Response.json({ error: "Could not create account. Please try again." }, { status: 500 });
    }
  }

  return Response.json({ error: "Username unavailable. Contact info@fueltechaipro.com." }, { status: 409 });
}
