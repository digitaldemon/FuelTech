import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession, getMembershipStatus } from "../../../../lib/session";

export async function GET() {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? "";
  if (!token || !(await verifySession(token))) {
    return Response.json({ username: null }, { status: 401 });
  }
  const info = getMembershipStatus(token);
  return Response.json({ username: info?.username ?? null });
}
