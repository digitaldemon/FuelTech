import { sql } from "@vercel/postgres";

// GET /api/console/licenses  (admin only)
// Returns all console license keys with activation status.

export async function GET(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}
