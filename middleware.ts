import { NextRequest, NextResponse } from "next/server";
import { verifySession, COOKIE_NAME } from "./lib/session";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*"],
};
