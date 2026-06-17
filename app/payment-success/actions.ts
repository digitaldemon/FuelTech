'use server';

import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendCredentialsEmail } from "../../lib/email";

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

export async function registerAccount(
  email: string,
  durationDays: number = 365
): Promise<{ ok: true; username: string; password: string; consoleKey: string } | { ok: false; error: string }> {
  if (!email || !email.includes("@")) {
    return { ok: false, error: "A valid email address is required." };
  }

  const baseUsername = generateUsername(email);
  const password = generatePassword();
  const hash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();
  const expiresIso = new Date(Date.now() + durationDays * 86_400_000).toISOString();
  const expiresAt  = new Date(expiresIso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

  let consoleKey = "";
  try {
    consoleKey = await issueConsoleKey(baseUsername, expiresIso);
  } catch {
    // Non-fatal — account still created, user can contact support for key
  }

  for (let attempt = 0; attempt <= 9; attempt++) {
    const username = attempt === 0 ? baseUsername : `${baseUsername}${attempt}`;
    try {
      await sql`
        INSERT INTO users (id, username, password_hash, email, expires_at, console_license_key)
        VALUES (${id}, ${username}, ${hash}, ${email}, ${expiresIso}, ${consoleKey || null})
      `;
      await sendCredentialsEmail({ to: email, username, password, expiresAt, consoleKey: consoleKey || undefined });
      return { ok: true, username, password, consoleKey };
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : "").toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate")) continue;
      return { ok: false, error: "Could not create account. Please try again." };
    }
  }

  // All username slots taken — clean up the orphaned console key so it's not wasted
  if (consoleKey) {
    await sql`DELETE FROM console_licenses WHERE license_key = ${consoleKey}`.catch(() => {});
  }
  return { ok: false, error: "Username unavailable. Contact info@fueltechaipro.com." };
}
