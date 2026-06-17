import { sql } from "@vercel/postgres";
import { cookies } from "next/headers";
import { verifySession, getMembershipStatus, COOKIE_NAME } from "../../../lib/session";

async function getUsernameFromLicenseKey(key: string): Promise<string | null> {
  if (!key || !key.startsWith("FTAI-")) return null;
  const result = await sql`
    SELECT u.username
    FROM console_licenses cl
    JOIN users u ON u.console_license_key = cl.license_key
    WHERE cl.license_key = ${key}
      AND cl.active = true
      AND cl.expires_at > NOW()
      AND u.active = true
    LIMIT 1
  `;
  return (result.rows[0]?.username as string) ?? null;
}

// POST — Electron app pushes ATG snapshot, receives back pending commands
export async function POST(req: Request) {
  const licenseKey = req.headers.get("x-license-key") ?? "";
  const username = await getUsernameFromLicenseKey(licenseKey);
  if (!username) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    output?: string;
    connStatus?: string;
  };

  const output = (body.output ?? "").slice(-30_000);
  const connStatus = body.connStatus ?? "connected";

  try {
    await sql`
      INSERT INTO remote_sessions (username, output, conn_status, updated_at)
      VALUES (${username}, ${output}, ${connStatus}, NOW())
      ON CONFLICT (username) DO UPDATE
        SET output      = EXCLUDED.output,
            conn_status = EXCLUDED.conn_status,
            updated_at  = NOW()
    `;

    const pending = await sql`
      SELECT id, command, label
      FROM remote_commands
      WHERE username = ${username} AND sent_at IS NULL
      ORDER BY created_at ASC
      LIMIT 10
    `;

    return Response.json({ ok: true, commands: pending.rows });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

// GET — Phone polls for latest ATG snapshot
export async function GET() {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? "";
  if (!token || !(await verifySession(token))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const info = getMembershipStatus(token);
  if (!info || info.membershipExpired) {
    return Response.json({ error: "Subscription expired" }, { status: 403 });
  }

  try {
    const result = await sql`
      SELECT output, conn_status, updated_at
      FROM remote_sessions
      WHERE username = ${info.username}
      LIMIT 1
    `;

    if (result.rows.length === 0) return Response.json({ noSession: true });

    const row = result.rows[0];
    return Response.json({
      output:     row.output as string,
      connStatus: row.conn_status as string,
      updatedAt:  row.updated_at as string,
    });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
