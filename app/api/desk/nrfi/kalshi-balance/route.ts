import crypto from "crypto";
import { requireDeskUser, readStore } from "../../../../../lib/desk";

type Creds = { keyId: string; privateKey: string };

function signedHeaders(creds: Creds, method: string, fullPath: string) {
  const ts = Date.now().toString();
  const path = fullPath.split("?")[0];
  const sig = crypto
    .sign("sha256", Buffer.from(ts + method + path), {
      key: creds.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    })
    .toString("base64");
  return {
    accept: "application/json",
    "KALSHI-ACCESS-KEY": creds.keyId,
    "KALSHI-ACCESS-TIMESTAMP": ts,
    "KALSHI-ACCESS-SIGNATURE": sig,
  };
}

export async function GET(req: Request) {
  if (!(await requireDeskUser(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const creds = await readStore<Creds | null>("kalshi_creds", null);
  if (!creds?.keyId)
    return Response.json({ error: "No Kalshi credentials configured." }, { status: 400 });
  try {
    const path = "/trade-api/v2/portfolio/balance";
    const r = await fetch("https://api.elections.kalshi.com" + path, {
      headers: signedHeaders(creds, "GET", path),
    });
    if (!r.ok) throw new Error("Kalshi balance -> " + r.status);
    const d = await r.json();
    // balance field is in cents on Kalshi API
    const cents = d.balance ?? d.available_balance ?? null;
    const dollars = cents != null ? cents / 100 : null;
    return Response.json({ balance: dollars, raw: d });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
