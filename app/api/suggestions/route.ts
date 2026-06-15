import { cookies } from 'next/headers';
import { sql } from '@vercel/postgres';
import { COOKIE_NAME, verifySession, getMembershipStatus } from '../../../lib/session';

async function getUsername(req: Request): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? '';
  if (!token || !(await verifySession(token))) return null;
  const info = getMembershipStatus(token);
  if (!info || info.membershipExpired) return null;
  return info.username;
}

export async function GET(req: Request) {
  const username = await getUsername(req);
  if (!username) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows } = await sql`
    SELECT id, username, title, body, category, status, created_at
    FROM suggestions
    ORDER BY created_at DESC
    LIMIT 200
  `;
  return Response.json({ suggestions: rows });
}

export async function POST(req: Request) {
  const username = await getUsername(req);
  if (!username) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { title?: string; body?: string; category?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const title    = (body.title ?? '').trim().slice(0, 200);
  const text     = (body.body  ?? '').trim().slice(0, 2000);
  const category = ['feature', 'improvement', 'bug', 'other'].includes(body.category ?? '')
    ? (body.category as string)
    : 'feature';

  if (!title || !text) return Response.json({ error: 'Title and description are required.' }, { status: 400 });

  const { rows } = await sql`
    INSERT INTO suggestions (username, title, body, category)
    VALUES (${username}, ${title}, ${text}, ${category})
    RETURNING id, username, title, body, category, status, created_at
  `;
  return Response.json({ suggestion: rows[0] }, { status: 201 });
}
