import { NextRequest, NextResponse } from "next/server";
import { verifySession, getMembershipStatus, COOKIE_NAME } from "./lib/session";
import { isDeskUser } from "./lib/desk-users";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token || !(await verifySession(token))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect expired members to the renewal page — no DB hit needed,
  // expiry is encoded in the session token at login time.
  const status = await getMembershipStatus(token);
  if (status?.membershipExpired) {
    return NextResponse.redirect(new URL("/expired", req.url));
  }

  // Contract Desk is allowlist-only; other members see a 404.
  if (req.nextUrl.pathname.startsWith("/desk") && !isDeskUser(status?.username)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat", "/chat/:path*", "/tls/:path*", "/tls", "/account", "/remote", "/suggestions", "/admin", "/admin/:path*", "/desk", "/desk/:path*"],
};
