// Contract Desk backend helpers — auth gate and Postgres-backed key/value
// store replacing the JSON files the standalone app kept in data/.
import { sql } from "@vercel/postgres";
import { verifySession, getMembershipStatus, COOKIE_NAME } from "./session";
import { isDeskUser } from "./desk-users";

// Returns the username when the request may use the desk APIs, else null.
// Accepts either a logged-in allowlisted member, or the x-admin-secret
// header (used for one-off data imports from the command line).
export async function requireDeskUser(req: Request): Promise<string | null> {
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret && process.env.ADMIN_SECRET && adminSecret === process.env.ADMIN_SECRET) {
    return "admin";
  }

  const rawCookie = req.headers.get("cookie") ?? "";
  const tokenMatch = rawCookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const token = tokenMatch ? tokenMatch[1] : null;
  if (!token || !(await verifySession(token))) return null;

  const memberInfo = await getMembershipStatus(token);
  if (!memberInfo || memberInfo.membershipExpired) return null;
  if (!isDeskUser(memberInfo.username)) return null;
  return memberInfo.username;
}

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await sql`CREATE TABLE IF NOT EXISTS desk_store (
    name TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  tableReady = true;
}

export async function readStore<T>(name: string, fallback: T): Promise<T> {
  await ensureTable();
  const { rows } = await sql`SELECT value FROM desk_store WHERE name = ${name}`;
  return rows.length ? (rows[0].value as T) : fallback;
}

export async function writeStore(name: string, value: unknown): Promise<void> {
  await ensureTable();
  await sql`INSERT INTO desk_store (name, value) VALUES (${name}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}
