'use server';

import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateUsername(email: string): string {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "user";
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(8);
  return "Fuel" + Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

export async function registerAccount(
  email: string
): Promise<{ ok: true; username: string; password: string } | { ok: false; error: string }> {
  if (!email || !email.includes("@")) {
    return { ok: false, error: "A valid email address is required." };
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
        VALUES (${id}, ${username}, ${hash}, ${email}, NOW() + INTERVAL '1 year')
      `;
      return { ok: true, username, password };
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : "").toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate")) continue;
      return { ok: false, error: "Could not create account. Please try again." };
    }
  }

  return { ok: false, error: "Username unavailable. Contact digitaldemon@wskandsons.com." };
}
