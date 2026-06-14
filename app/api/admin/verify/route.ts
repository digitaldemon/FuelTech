export async function POST(req: Request) {
  const { secret } = await req.json().catch(() => ({ secret: "" }));
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ ok: false }, { status: 401 });
  }
  return Response.json({ ok: true });
}
