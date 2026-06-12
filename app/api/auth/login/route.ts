import { NextResponse } from "next/server";
import { signSession, COOKIE_NAME, MAX_AGE_SECONDS } from "../../../../lib/session";

// Credentials stay server-side and are never sent to the browser.
// Move these to environment variables for production use.
const USERS: Record<string, string> = {
  tech1: "password123",
  tech2: "password456",
  bill: "hercules",
  tauny: "wsk",
  jesse: "wsk",
};

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !USERS[username] || USERS[username] !== password) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = await signSession(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
