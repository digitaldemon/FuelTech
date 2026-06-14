// Stateless HMAC-SHA256 session tokens — works in both Node.js and Edge runtimes.
// Payload format: `username:sessionExpiresAt:membershipExpiresAt`
// membershipExpiresAt = 0 means no expiry (accounts with expires_at = NULL in DB)

export const COOKIE_NAME = "ft_session";
export const MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

function secret(): string {
  return process.env.AUTH_SECRET ?? "dev-insecure-secret-change-in-production";
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function encodeBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function decodeBase64Url(s: string): Uint8Array {
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0)
  );
}

// membershipExpiresAt: Unix timestamp ms, 0 = no expiry
export async function signSession(username: string, membershipExpiresAt = 0): Promise<string> {
  const sessionExpiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${username}:${sessionExpiresAt}:${membershipExpiresAt}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload) as unknown as ArrayBuffer
  );
  const payloadB64 = encodeBase64Url(new TextEncoder().encode(payload));
  return `${payloadB64}.${encodeBase64Url(sig)}`;
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return false;
    const payloadB64 = token.slice(0, dot);
    const sig = decodeBase64Url(token.slice(dot + 1));
    const payloadBytes = decodeBase64Url(payloadB64);
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sig as unknown as ArrayBuffer,
      payloadBytes as unknown as ArrayBuffer
    );
    if (!valid) return false;
    const payload = new TextDecoder().decode(payloadBytes);
    const parts = payload.split(":");
    // parts[0]=username, parts[1]=sessionExpiresAt, parts[2]=membershipExpiresAt
    const sessionExpiry = parseInt(parts[1] ?? "0", 10);
    return Date.now() < sessionExpiry;
  } catch {
    return false;
  }
}

// Decode membership status from a verified token — no HMAC re-check, call after verifySession.
// Returns null if token is malformed.
export function getMembershipStatus(token: string): { username: string; membershipExpired: boolean } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payloadBytes = decodeBase64Url(token.slice(0, dot));
    const payload = new TextDecoder().decode(payloadBytes);
    const parts = payload.split(":");
    const username = parts[0];
    const membershipExpiresAt = parts.length >= 3 ? parseInt(parts[2], 10) : 0;
    // 0 = no expiry
    const membershipExpired = membershipExpiresAt > 0 && Date.now() > membershipExpiresAt;
    return { username, membershipExpired };
  } catch {
    return null;
  }
}
