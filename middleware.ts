import { NextRequest, NextResponse } from "next/server";
import { verifySession, getMembershipStatus, COOKIE_NAME } from "./lib/session";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token || !(await verifySession(token))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect expired members to the renewal page — no DB hit needed,
  // expiry is encoded in the session token at login time.
  const status = getMembershipStatus(token);
  if (status?.membershipExpired) {
    return NextResponse.redirect(new URL("/expired", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat", "/chat/:path*", "/tls/:path*", "/tls", "/account", "/remote", "/suggestions"],
};
