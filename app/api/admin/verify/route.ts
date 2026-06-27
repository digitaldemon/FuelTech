import crypto from "crypto";

export async function POST(req: Request) {
  const { secret } = await req.json().catch(() => ({ secret: "" }));
  const expected = process.env.ADMIN_SECRET ?? "";
  if (!secret || !expected) return Response.json({ ok: false }, { status: 401 });
  const match = secret.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
  if (!match) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true });
}
