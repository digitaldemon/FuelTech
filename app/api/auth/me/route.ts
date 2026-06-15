import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession, getMembershipStatus } from "../../../../lib/session";

export async function GET() {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? "";
  if (!token || !(await verifySession(token))) {
    return Response.json({ username: null }, { status: 401 });
  }
  const info = getMembershipStatus(token);
  if (!info) return Response.json({ username: null }, { status: 401 });
  if (info.membershipExpired) {
    return Response.json({ username: null, expired: true }, { status: 403 });
  }
  return Response.json({ username: info.username });
}
