import { sql } from "@vercel/postgres";

// GET /api/console/licenses  (admin only)
// Returns all console license keys with activation status.

export async function GET(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sql`
      SELECT
        license_key,
        tech_name,
        machine_id,
        activated_at,
        expires_at,
        active,
        created_at
      FROM console_licenses
      ORDER BY created_at DESC
    `;
    return Response.json({ ok: true, licenses: result.rows });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

// DELETE /api/console/licenses  (admin only)
// Permanently deletes a license key row and clears it from the linked web user account.
// Body: { licenseKey: string }

export async function DELETE(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { licenseKey } = (await req.json().catch(() => ({}))) as { licenseKey?: string };
  if (!licenseKey) {
    return Response.json({ error: "licenseKey is required" }, { status: 400 });
  }

  const key = licenseKey.trim().toUpperCase();

  try {
    // Clear the key from any linked web user account
    await sql`UPDATE users SET console_license_key = NULL WHERE console_license_key = ${key}`;
    // Delete the key row entirely
    const result = await sql`DELETE FROM console_licenses WHERE license_key = ${key}`;
    const deleted = result.rowCount ?? 0;
    return Response.json({ ok: true, deleted });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
