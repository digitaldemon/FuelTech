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
  const { email } = (await req.json()) as { email: string };

  if (!email || !email.includes("@")) {
    return Response.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const baseUsername = generateUsername(email);
  const password = generatePassword();
  const hash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();

  // Try base username, then base+1, base+2, … if it's already taken
  for (let attempt = 0; attempt <= 9; attempt++) {
    const username = attempt === 0 ? baseUsername : `${baseUsername}${attempt}`;
    try {
      await sql`
        INSERT INTO users (id, username, password_hash, email)
        VALUES (${id}, ${username}, ${hash}, ${email})
      `;
      return Response.json({ ok: true, username, password });
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : "").toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate")) {
        continue; // username taken — try next suffix
      }
      return Response.json({ error: "Could not create account. Please try again." }, { status: 500 });
    }
  }

  return Response.json({ error: "Username unavailable. Contact digitaldemon@wskandsons.com." }, { status: 409 });
}
