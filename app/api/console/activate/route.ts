import { sql } from "@vercel/postgres";
import { createHmac } from "crypto";

// POST /api/console/activate
// Called by FuelTech AI Console Connect on first launch (or re-activation after reinstall).
// Body: { licenseKey: string, machineId: string }
// Returns signed license payload the app stores locally for offline verification.

function sign(machineId: string, licenseKey: string, expiresAt: string): string {
  const secret = process.env.CONSOLE_LICENSE_SECRET!;
  return createHmac("sha256", secret)
    .update(`${machineId}|${licenseKey}|${expiresAt}`)
    .digest("hex");
}

export async function POST(req: Request) {
  let body: { licenseKey?: string; machineId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { licenseKey, machineId } = body;
  if (!licenseKey || !machineId) {
    return Response.json({ error: "licenseKey and machineId are required" }, { status: 400 });
  }

  const key = licenseKey.trim().toUpperCase();
  const mid = machineId.trim();

  const result = await sql`
    SELECT id, tech_name, machine_id, expires_at, active
    FROM console_licenses
    WHERE license_key = ${key}
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    return Response.json({ error: "License key not found" }, { status: 404 });
  }

  const row = result.rows[0];

  if (!row.active) {
    return Response.json({ error: "License key has been revoked" }, { status: 403 });
  }

  if (new Date(row.expires_at) < new Date()) {
    return Response.json({ error: "License key has expired" }, { status: 403 });
  }

  if (row.machine_id && row.machine_id !== mid) {
    return Response.json(
      { error: "License key is already activated on a different device. Contact FuelTech AI Pro to transfer." },
      { status: 409 }
    );
  }

  // First activation or re-activation on same machine
  await sql`
    UPDATE console_licenses
    SET machine_id   = ${mid},
        activated_at = NOW()
    WHERE license_key = ${key}
  `;

  const expiresAt = new Date(row.expires_at).toISOString();
  const signature = sign(mid, key, expiresAt);

  return Response.json({
    ok:        true,
    techName:  row.tech_name as string,
    expiresAt,
    signature,
  });
}
