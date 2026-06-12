import crypto from "crypto";
import OpenAI from "openai";
import { sql } from "@vercel/postgres";

export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PEI_SECTIONS = [2, 4, 6, 7];
const GILBARCO_SEED = "https://docs.gilbarco.com/gold/";
const CHUNK_WORDS = 500;
const OVERLAP_WORDS = 50;

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

async function fetchPage(
  url: string
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FuelTechBot/1.0 (fuel tech knowledge base)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  }
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
    if (chunk.split(/\s+/).length < 20) continue;

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

async function scrapePei(limit: number): Promise<number> {
  let total = 0;
  const perSection = Math.ceil(limit / PEI_SECTIONS.length);

  for (const section of PEI_SECTIONS) {
    if (total >= limit) break;
    const page = await fetchPage(
      `https://www.pei.org/forum/?f=${section}`
    );
    if (!page) continue;

    const title = extractTitle(page.html);
    const text = stripHtml(page.html);
    const chunks = chunkText(text);
    total += await upsertChunks(
      page.finalUrl,
      title,
      chunks,
      "pei",
      perSection
    );
  }
  return total;
}

async function scrapeGilbarco(limit: number): Promise<number> {
  const visited = new Set<string>();
  const queue: string[] = [GILBARCO_SEED];
  let total = 0;

  while (queue.length > 0 && total < limit) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const page = await fetchPage(url);
    if (!page) continue;

    const title = extractTitle(page.html);
    const text = stripHtml(page.html);
    const chunks = chunkText(text);
    const remaining = limit - total;
    total += await upsertChunks(
      page.finalUrl,
      title,
      chunks,
      "gilbarco",
      remaining
    );

    // Discover sub-pages within the Gilbarco docs domain
    if (total < limit) {
      const linkRe =
        /href="(https:\/\/docs\.gilbarco\.com\/gold\/[^"#?]+)"/gi;
      let m;
      while ((m = linkRe.exec(page.html)) !== null) {
        const href = m[1];
        if (!visited.has(href) && !queue.includes(href)) {
          queue.push(href);
        }
      }
    }
  }

  return total;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    source?: string;
    limit?: number;
  };
  const source = body.source ?? "both";
  const limit = Number(body.limit ?? 20);

  let total = 0;

  if (source === "pei" || source === "both") {
    const peiLimit = source === "both" ? Math.ceil(limit / 2) : limit;
    total += await scrapePei(peiLimit);
  }

  if (source === "gilbarco" || source === "both") {
    const gilbarcoLimit = source === "both" ? Math.floor(limit / 2) : limit;
    total += await scrapeGilbarco(gilbarcoLimit);
  }

  return Response.json({ ok: true, upserted: total });
}
