import { sql } from "@vercel/postgres";
import { cookies } from "next/headers";
import { verifySession, getMembershipStatus, COOKIE_NAME } from "../../../../lib/session";

async function isValidLicenseKey(key: string): Promise<boolean> {
  if (!key || !key.startsWith('FTAI-')) return false;
  const result = await sql`
    SELECT 1 FROM console_licenses
    WHERE license_key = ${key}
      AND active = true
      AND expires_at > NOW()
    LIMIT 1
  `;
  return result.rows.length > 0;
}

async function getSessionUsername(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? "";
  if (!token || !(await verifySession(token))) return null;
  const info = getMembershipStatus(token);
  if (!info || info.membershipExpired) return null;
  return info.username;
}

// POST — Phone queues a command to relay to the ATG
export async function POST(req: Request) {
  const username = await getSessionUsername();
  if (!username) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    command?: string;
    label?: string;
  };

  const command = (body.command ?? "").trim().toUpperCase().slice(0, 40);
  const label   = (body.label ?? command).slice(0, 100);

  if (!command) return Response.json({ error: "No command provided" }, { status: 400 });

  // Only allow valid VR function codes — no injection possible
  if (!/^[IiSsPp]\d{5}/.test(command)) {
    return Response.json({ error: "Invalid command format" }, { status: 400 });
  }

  try {
    // Require an active session (updated in last 2 minutes)
    const session = await sql`
      SELECT 1 FROM remote_sessions
      WHERE username = ${username}
        AND updated_at > NOW() - INTERVAL '2 minutes'
      LIMIT 1
    `;
    if (session.rows.length === 0) {
      return Response.json({ error: "No active remote session — laptop may be offline" }, { status: 409 });
    }

    const result = await sql`
      INSERT INTO remote_commands (username, command, label)
      VALUES (${username}, ${command}, ${label})
      RETURNING id
    `;
    const id = result.rows[0]?.id as string | undefined;
    if (!id) return Response.json({ error: "Command insert failed" }, { status: 500 });
    return Response.json({ ok: true, id });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

// PATCH — Electron app marks commands as sent (prevents re-delivery)
export async function PATCH(req: Request) {
  const licenseKey = req.headers.get("x-license-key") ?? "";
  if (!(await isValidLicenseKey(licenseKey))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const ids = (body.ids ?? []).slice(0, 20);
  if (!ids.length) return Response.json({ ok: true });

  try {
    await sql`
      UPDATE remote_commands
      SET sent_at = NOW()
      WHERE id = ANY(${ids as unknown as string}::uuid[])
        AND sent_at IS NULL
    `;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
