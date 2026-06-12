// Stateless HMAC-SHA256 session tokens — works in both Node.js and Edge runtimes.

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

export async function signSession(username: string): Promise<string> {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${username}:${expiresAt}`;
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
    const colon = payload.lastIndexOf(":");
    return Date.now() < parseInt(payload.slice(colon + 1), 10);
  } catch {
    return false;
  }
}
