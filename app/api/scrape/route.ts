import crypto from "crypto";
import OpenAI from "openai";
import { sql } from "@vercel/postgres";
// Import from lib directly to avoid pdf-parse loading its test fixtures at build time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;

export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const GILBARCO_BASE = "https://docs.gilbarco.com";

// Target sections most relevant to field techs — Encore, dispensers, service manuals
const GILBARCO_SEED_SECTIONS = [
  9,   // Encore and Eclipse
  157, // Encore
  50,  // Encore and Eclipse Installers
  69,  // Service Manual
  70,  // Pump & Dispenser Start-Up & Service Manual
  288, // Fuel Dispensers
  282, // Dispensers
  368, // Dispenser Pan Monitoring
  327, // Application Guides
];
const CHUNK_WORDS = 500;
const OVERLAP_WORDS = 50;

// PEI public resource pages
const PEI_URLS = [
  "https://pei.org/resources/petroleum-equipment-forum/",
  "https://pei.org/resources/wiki-pei/",
  "https://pei.org/resources/safety/",
  "https://pei.org/resources/ust-component-compatibility-library/",
  "https://pei.org/resources/white-papers/",
];

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + CHUNK_WORDS).join(" "));
    i += CHUNK_WORDS - OVERLAP_WORDS;
  }
  return chunks;
}

function makeId(url: string, index: number): string {
  return crypto.createHash("md5").update(`${url}::${index}`).digest("hex");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : "";
}

async function upsertChunks(
  url: string,
  title: string,
  chunks: string[],
  source: string,
  limit: number
): Promise<number> {
  let count = 0;
  for (let i = 0; i < chunks.length && count < limit; i++) {
    const chunk = chunks[i];
    if (chunk.split(/\s+/).length < 30) continue;

    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
    });
    const embStr = JSON.stringify(embRes.data[0].embedding);
    const id = makeId(url, i);

    await sql`
      INSERT INTO fuel_tech_docs (id, url, title, chunk_text, chunk_index, source, embedding)
      VALUES (${id}, ${url}, ${title}, ${chunk}, ${i}, ${source}, ${embStr}::vector)
      ON CONFLICT (id) DO UPDATE
        SET chunk_text = EXCLUDED.chunk_text,
            embedding  = EXCLUDED.embedding,
            title      = EXCLUDED.title
    `;
    count++;
  }
  return count;
}

// ── Gilbarco ──────────────────────────────────────────────────────────────────

async function getGilbarcoSession(): Promise<string> {
  const res = await fetch(`${GILBARCO_BASE}/gold/`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; FuelTechBot/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  // Extract cfid and cftoken from set-cookie header
  const cfid = setCookie.match(/cfid=([^;,]+)/i)?.[1] ?? "";
  const cftoken = setCookie.match(/cftoken=([^;,]+)/i)?.[1] ?? "";
  return cfid && cftoken ? `cfid=${cfid};cftoken=${cftoken}` : "";
}

async function fetchGilbarcoPage(
  url: string,
  cookie: string
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FuelTechBot/1.0)",
        Cookie: cookie,
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchGilbarcoPdf(
  docId: string,
  cookie: string
): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `${GILBARCO_BASE}/gold/download.cfm?doc_id=${docId}&warning=0`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FuelTechBot/1.0)",
          Cookie: cookie,
        },
        signal: AbortSignal.timeout(30000),
      }
    );
    if (!res.ok || !res.headers.get("content-type")?.includes("pdf")) {
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function extractGilbarcoLinks(
  html: string
): { sections: string[]; docIds: string[] } {
  const sections: string[] = [];
  const docIds: string[] = [];

  const sectionRe = /href="((?:https:\/\/docs\.gilbarco\.com)?\/gold\/gold_public_access\.cfm\?[^"]+)"/gi;
  let m;
  while ((m = sectionRe.exec(html)) !== null) {
    const href = m[1].startsWith("http")
      ? m[1]
      : `${GILBARCO_BASE}${m[1]}`;
    sections.push(href.split("#")[0]);
  }

  const docRe = /href="download\.cfm\?doc_id=(\d+)"/gi;
  while ((m = docRe.exec(html)) !== null) {
    docIds.push(m[1]);
  }

  return { sections, docIds };
}

async function scrapeGilbarco(limit: number): Promise<number> {
  const cookie = await getGilbarcoSession();
  const visitedSections = new Set<string>();
  const processedDocs = new Set<string>();
  // Start from targeted sections rather than the index page
  const sectionQueue: string[] = GILBARCO_SEED_SECTIONS.map(
    (id) => `${GILBARCO_BASE}/gold/gold_public_access.cfm?section_id=${id}`
  );
  let total = 0;

  while (sectionQueue.length > 0 && total < limit) {
    const url = sectionQueue.shift()!;
    if (visitedSections.has(url)) continue;
    visitedSections.add(url);

    const html = await fetchGilbarcoPage(url, cookie);
    if (!html) continue;

    const { sections, docIds } = extractGilbarcoLinks(html);

    // Queue newly discovered section pages
    for (const s of sections) {
      if (!visitedSections.has(s) && !sectionQueue.includes(s)) {
        sectionQueue.push(s);
      }
    }

    // Process PDFs found on this section page
    for (const docId of docIds) {
      if (total >= limit) break;
      if (processedDocs.has(docId)) continue;
      processedDocs.add(docId);

      const pdfBuf = await fetchGilbarcoPdf(docId, cookie);
      if (!pdfBuf) continue;

      let pdfText = "";
      try {
        const parsed = await pdfParse(pdfBuf);
        pdfText = parsed.text;
      } catch {
        continue;
      }

      if (!pdfText.trim()) continue;

      const docUrl = `${GILBARCO_BASE}/gold/download.cfm?doc_id=${docId}`;
      const titleMatch = pdfText.match(/^(.{10,120})/);
      const title = titleMatch
        ? titleMatch[1].trim().replace(/\s+/g, " ")
        : `Gilbarco Doc ${docId}`;

      const chunks = chunkText(pdfText);
      const added = await upsertChunks(
        docUrl,
        title,
        chunks,
        "gilbarco",
        limit - total
      );
      total += added;
    }
  }

  return total;
}

// ── PEI ───────────────────────────────────────────────────────────────────────

async function scrapePei(limit: number): Promise<number> {
  let total = 0;
  const perPage = Math.ceil(limit / PEI_URLS.length);

  for (const url of PEI_URLS) {
    if (total >= limit) break;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; FuelTechBot/1.0; +https://fueltechaipro.com)",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const title = extractTitle(html);
      const text = stripHtml(html);
      const chunks = chunkText(text);
      total += await upsertChunks(res.url || url, title, chunks, "pei", perPage);
    } catch {
      continue;
    }
  }
  return total;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    source?: string;
    limit?: number;
  };
  const source = body.source ?? "both";
  const limit = Number(body.limit ?? 40);

  let total = 0;

  if (source === "pei" || source === "both") {
    const peiLimit = source === "both" ? Math.ceil(limit / 4) : limit;
    total += await scrapePei(peiLimit);
  }

  if (source === "gilbarco" || source === "both") {
    const gilbarcoLimit = source === "both" ? Math.floor((limit * 3) / 4) : limit;
    total += await scrapeGilbarco(gilbarcoLimit);
  }

  return Response.json({ ok: true, upserted: total });
}
