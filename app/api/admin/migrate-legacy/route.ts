// Migration complete — all legacy accounts are now in the database with bcrypt hashes.
// This endpoint is disabled.
export async function POST() {
  return Response.json({ ok: true, message: "Migration already complete." });
}
