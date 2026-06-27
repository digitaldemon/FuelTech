import { sql } from "@vercel/postgres";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string; company?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const company = (body.company ?? "").trim() || null;

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "A valid email address is required." }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO enterprise_waitlist (email, company, created_at)
      VALUES (${email}, ${company}, NOW())
      ON CONFLICT (email) DO UPDATE SET company = COALESCE(EXCLUDED.company, enterprise_waitlist.company)
    `;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not save your request. Please try again." }, { status: 500 });
  }
}
