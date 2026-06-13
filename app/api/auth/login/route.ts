import { NextResponse } from "next/server";
import { signSession, COOKIE_NAME, MAX_AGE_SECONDS } from "../../../../lib/session";
import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";

// Legacy accounts kept for backwards compatibility.
// New users are stored in the `users` database table via /api/auth/create-user.
const LEGACY_USERS: Record<string, string> = {
  tech1: "password123",
  tech2: "password456",
  bill: "hercules",
  tauny: "wsk",
  jesse: "wsk",
};

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

  // Check database first — covers all accounts created after PayPal payment
  try {
    const result = await sql`
      SELECT id, password_hash FROM users
      WHERE username = ${username} AND active = true
    `;
    if (result.rows.length > 0) {
      const valid = await bcrypt.compare(password, result.rows[0].password_hash as string);
      if (!valid) {
        return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
      }
      const token = await signSession(username);
      const res = NextResponse.json({ ok: true });
      setSessionCookie(res, token);
      return res;
    }
  } catch {
    // DB unavailable — fall through to legacy check below
  }

  // Legacy hardcoded accounts
  if (!LEGACY_USERS[username] || LEGACY_USERS[username] !== password) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = await signSession(username);
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, token);
  return res;
}
