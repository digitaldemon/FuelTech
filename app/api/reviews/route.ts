import { sql } from "@vercel/postgres";

export async function GET() {
  try {
    const result = await sql`
      SELECT id, name, company, rating, review_text, created_at
      FROM reviews
      WHERE approved = true
      ORDER BY created_at DESC
      LIMIT 20
    `;
    return Response.json({ reviews: result.rows });
  } catch {
    return Response.json({ reviews: [] });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    name?: string; company?: string; rating?: number; review_text?: string;
  };

  const name = (body.name ?? "").trim();
  const company = (body.company ?? "").trim() || null;
  const rating = Number(body.rating);
  const review_text = (body.review_text ?? "").trim();

  if (!name || name.length > 60)
    return Response.json({ error: "Name is required (max 60 characters)." }, { status: 400 });
  if (!review_text || review_text.length < 20)
    return Response.json({ error: "Review must be at least 20 characters." }, { status: 400 });
  if (review_text.length > 600)
    return Response.json({ error: "Review must be 600 characters or less." }, { status: 400 });
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating))
    return Response.json({ error: "Rating must be a whole number from 1 to 5." }, { status: 400 });

  try {
    await sql`
      INSERT INTO reviews (name, company, rating, review_text)
      VALUES (${name}, ${company}, ${rating}, ${review_text})
    `;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not save your review. Please try again." }, { status: 500 });
  }
}

// PATCH /api/reviews  — approve or reject a review
// Header: x-admin-secret: YOUR_ADMIN_SECRET
// Body:   { "id": "uuid", "approved": true }
export async function PATCH(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { id?: string; approved?: boolean };
  if (!body.id) return Response.json({ error: "id is required." }, { status: 400 });
  await sql`UPDATE reviews SET approved = ${body.approved ?? true} WHERE id = ${body.id}`;
  return Response.json({ ok: true });
}

// GET /api/reviews/pending — list unapproved reviews (admin only)
// Use as: GET /api/reviews?pending=1 with x-admin-secret header
