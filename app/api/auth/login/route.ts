import { NextResponse } from "next/server";
import { signSession, COOKIE_NAME, MAX_AGE_SECONDS } from "../../../../lib/session";
import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

// Legacy accounts — remove this block after running /api/admin/migrate-legacy
// to move these into the database with bcrypt hashes.
const LEGACY_USERS: Record<string, string> = {
  tech1: "password123",
  tech2: "password456",
  bill: "hercules",
  tauny: "wsk",
  jesse: "wsk",
};

function legacyPasswordMatch(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a.padEnd(64));
    const bb = Buffer.from(b.padEnd(64));
    return timingSafeEqual(ba, bb) && a.length === b.length;
  } catch {
    return false;
  }
}

function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function POST(req: Request) {
  const { username, password } = (await req.json()) as {
    username: string;
    password: string;
  };

  if (!username || !password) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  // Check database first — covers all paid accounts
  try {
    const result = await sql`
      SELECT id, password_hash, expires_at FROM users
      WHERE username = ${username} AND active = true
    `;
    if (result.rows.length > 0) {
      const row = result.rows[0];

      const valid = await bcrypt.compare(password, row.password_hash as string);
      if (!valid) {
        return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
      }

      // Check subscription expiry before issuing session
      const expiresAt = row.expires_at ? new Date(row.expires_at as string) : null;
      if (expiresAt && expiresAt < new Date()) {
        return NextResponse.json({
          error: "Your subscription has expired. Visit fueltechaipro.com to renew.",
          expired: true,
        }, { status: 403 });
      }

      // Encode membership expiry in token so middleware doesn't need a DB hit
      const membershipExp = expiresAt ? expiresAt.getTime() : 0;
      const token = await signSession(username, membershipExp);
      const res = NextResponse.json({ ok: true });
      setSessionCookie(res, token);
      return res;
    }
  } catch {
    // DB unavailable — fall through to legacy check
  }

  // Legacy hardcoded accounts (no expiry) — remove after running /api/admin/migrate-legacy
  const legacyPw = LEGACY_USERS[username];
  if (!legacyPw || !legacyPasswordMatch(legacyPw, password)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = await signSession(username, 0); // 0 = no expiry
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, token);
  return res;
}
