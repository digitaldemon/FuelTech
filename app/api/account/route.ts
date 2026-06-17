import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import { COOKIE_NAME, verifySession, getMembershipStatus } from "../../../lib/session";

// GET /api/account — returns full account details for the logged-in user
export async function GET() {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? "";
  if (!token || !(await verifySession(token))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const info = getMembershipStatus(token);
  if (!info || info.membershipExpired) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sql`
      SELECT username, email, expires_at, console_license_key
      FROM users
      WHERE username = ${info.username} AND active = true
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const row = result.rows[0];
    return Response.json({
      username:          row.username as string,
      email:             row.email as string | null,
      expiresAt:         row.expires_at as string | null,
      consoleLicenseKey: row.console_license_key as string | null,
    });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
