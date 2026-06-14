import crypto from "crypto";
import { sql } from "@vercel/postgres";

// POST /api/console/issue  (admin only — x-admin-secret header required)
// Issues a new license key for a technician.
// Body: { techName: string, durationDays?: number }
// Returns the generated license key — share this with the tech.
//
// Example:
//   curl -X POST https://www.fueltechaipro.com/api/console/issue \
//     -H "Content-Type: application/json" \
//     -H "x-admin-secret: YOUR_ADMIN_SECRET" \
//     -d '{"techName":"John Smith","durationDays":365}'

function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0,O,1,I)
  const seg = () => Array.from(crypto.randomBytes(4)).map(b => chars[b % chars.length]).join("");
  return `FTAI-${seg()}-${seg()}-${seg()}`;
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { techName, durationDays = 365 } = (await req.json()) as {
    techName: string;
    durationDays?: number;
  };

  if (!techName?.trim()) {
    return Response.json({ error: "techName is required" }, { status: 400 });
  }

  const days = Math.round(Number(durationDays));
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    return Response.json({ error: "durationDays must be between 1 and 3650" }, { status: 400 });
  }

  // Generate a unique key (retry on collision, though vanishingly unlikely)
  let licenseKey = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateKey();
    const existing = await sql`SELECT 1 FROM console_licenses WHERE license_key = ${candidate}`;
    if (existing.rows.length === 0) { licenseKey = candidate; break; }
  }
  if (!licenseKey) {
    return Response.json({ error: "Key generation failed — try again" }, { status: 500 });
  }

  const id        = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

  await sql`
    INSERT INTO console_licenses (id, license_key, tech_name, expires_at)
    VALUES (${id}, ${licenseKey}, ${techName.trim()}, ${expiresAt})
  `;

  return Response.json({ ok: true, licenseKey, techName: techName.trim(), expiresAt });
}

// DELETE /api/console/issue  — revoke a license key
export async function DELETE(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { licenseKey } = (await req.json()) as { licenseKey: string };
  if (!licenseKey) {
    return Response.json({ error: "licenseKey is required" }, { status: 400 });
  }

  await sql`
    UPDATE console_licenses SET active = FALSE WHERE license_key = ${licenseKey.trim().toUpperCase()}
  `;
  return Response.json({ ok: true });
}
