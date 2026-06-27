import { verifySession, getMembershipStatus, COOKIE_NAME } from "../../../lib/session";

export const maxDuration = 60;

// Only allow proxying from known document portals — prevents SSRF
const ALLOWED_HOSTS = new Set([
  "docs.gilbarco.com",
  "interactive.gilbarco.com",
  "docs.veeder.com",
  "www.veeder.com",
]);

function isAllowedUrl(raw: string): boolean {
  try {
    const { hostname, protocol } = new URL(raw);
    return protocol === "https:" && ALLOWED_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

async function getCfSession(baseUrl: string): Promise<string> {
  try {
    const res = await fetch(baseUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FuelTechBot/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    const sc = res.headers.get("set-cookie") ?? "";
    const cfid = sc.match(/cfid=([^;,\s]+)/i)?.[1] ?? "";
    const cftoken = sc.match(/cftoken=([^;,\s]+)/i)?.[1] ?? "";
    return cfid ? `cfid=${cfid}; cftoken=${cftoken}` : "";
  } catch {
    return "";
  }
}

function extractSetCookies(headers: Headers): Map<string, string> {
  const jar = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookies: string[] = (headers as any).getSetCookie?.() ?? [];
  const src = cookies.length > 0 ? cookies : (headers.get("set-cookie") ?? "").split(/,(?=\s*\w+=)/);
  for (const c of src) {
    const pair = c.split(";")[0].trim();
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
  }
  return jar;
}

async function getExtranetSession(): Promise<string> {
  const user = process.env.GILBARCO_EXTRANET_USER;
  const pass = process.env.GILBARCO_EXTRANET_PASS;
  if (!user || !pass) return "";
  try {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    const cookieJar = new Map<string, string>();
    const getRes = await fetch("https://interactive.gilbarco.com/", {
      headers: { "User-Agent": ua },
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });
    for (const [k, v] of extractSetCookies(getRes.headers)) cookieJar.set(k, v);
    const cookieStr = () => [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const body = new URLSearchParams({ user_id: user, loginpassword: pass, isPost: "Y" });
    const postRes = await fetch("https://interactive.gilbarco.com/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": ua,
        "Cookie": cookieStr(),
      },
      body: body.toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });
    for (const [k, v] of extractSetCookies(postRes.headers)) cookieJar.set(k, v);
    const loc = postRes.headers.get("location");
    if (loc) {
      const followRes = await fetch(loc.startsWith("http") ? loc : `https://interactive.gilbarco.com${loc}`, {
        headers: { "User-Agent": ua, "Cookie": cookieStr() },
        redirect: "manual",
        signal: AbortSignal.timeout(12000),
      });
      for (const [k, v] of extractSetCookies(followRes.headers)) cookieJar.set(k, v);
    }
    return cookieStr();
  } catch {
    return "";
  }
}

export async function GET(req: Request) {
  // Session auth — logged-in users only
  const rawCookie = req.headers.get("cookie") ?? "";
  const tokenMatch = rawCookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const token = tokenMatch ? tokenMatch[1] : null;
  if (!token || !(await verifySession(token))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const memberInfo = await getMembershipStatus(token);
  if (!memberInfo || memberInfo.membershipExpired) {
    return new Response("Subscription expired", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const docUrl = searchParams.get("url");
  const source = searchParams.get("source") ?? "";

  if (!docUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  if (!isAllowedUrl(docUrl)) {
    return new Response("URL not permitted", { status: 403 });
  }

  let fetchUrl = docUrl;
  let cookie = "";

  if (source === "gilbarco") {
    cookie = await getCfSession("https://docs.gilbarco.com/gold/");
  } else if (source === "veeder-root") {
    cookie = await getCfSession("https://docs.veeder.com/gold/");
  } else if (source === "gilbarco-extranet") {
    cookie = await getExtranetSession();
    // Bulletin detail URL is .../downloads/{b64id}
    // Attachment PDF is at   .../download/{b64id}/1
    fetchUrl = docUrl.replace(/\/downloads\/([^/]+)$/, "/download/$1/1");
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (compatible; FuelTechBot/1.0)",
    };
    if (cookie) headers["Cookie"] = cookie;

    const res = await fetch(fetchUrl, {
      headers,
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      return new Response(`Document fetch failed (${res.status})`, { status: 502 });
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("pdf")) {
      return new Response("Document is not a PDF", { status: 422 });
    }

    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Failed to fetch document", { status: 502 });
  }
}
