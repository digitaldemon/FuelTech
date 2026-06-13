import crypto from "crypto";
import OpenAI from "openai";
import { sql } from "@vercel/postgres";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  buf: Buffer
) => Promise<{ text: string }>;

export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHUNK_WORDS = 500;
const OVERLAP_WORDS = 50;

const MODEL_PATTERNS: [RegExp, string][] = [
  [/TLS[-\s]?450\s*PLUS/i,  "TLS-450PLUS"],
  [/TLS[-\s]?450[Ii][Ss]/i, "TLS-450iS"],
  [/TLS[-\s]?450[Ii]/i,     "TLS-450i"],
  [/TLS[-\s]?450/i,         "TLS-450"],
  [/TLS[-\s]?350R/i,        "TLS-350R"],
  [/TLS[-\s]?350/i,         "TLS-350"],
  [/TLS[-\s]?300/i,         "TLS-300"],
  [/Encore\s*700S/i,        "Encore 700S"],
  [/Encore\s*700/i,         "Encore 700"],
  [/\bEncore\b/i,           "Encore"],
  [/\bEclipse\b/i,          "Eclipse"],
  [/\bCRIND\b/i,            "CRIND"],
  [/FlexPay\s*IV/i,         "FlexPay IV"],
  [/\bFlexPay\b/i,          "FlexPay"],
];

function sanitizeText(s: string): string {
  return s
    .replace(/\0/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, " ")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/�/g, "");
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

function extractDocTitle(text: string, fallback: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 30)) {
    if (line.length < 8 || line.length > 120) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^(page|rev|revision|version|date|copyright|©)/i.test(line)) continue;
    if (/^[^A-Za-z]/.test(line)) continue;
    if ((line.match(/[A-Za-z]/g) ?? []).length < 4) continue;
    return line.replace(/\s+/g, " ");
  }
  return fallback;
}

function extractDocModel(text: string): string {
  const sample = text.substring(0, 800);
  for (const [re, model] of MODEL_PATTERNS) {
    if (re.test(sample)) return model;
  }
  return "";
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url, source = "pei" } = (await req.json()) as {
    url: string;
    source?: string;
  };
  if (!url) return Response.json({ error: "url required" }, { status: 400 });

  // Fetch the PDF from Vercel Blob
  let buf: Buffer;
  try {
    const fetchRes = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
    buf = Buffer.from(await fetchRes.arrayBuffer());
  } catch (err) {
    return Response.json(
      { error: `Could not fetch PDF: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  // Extract text
  let text = "";
  try {
    const parsed = await pdfParse(buf);
    text = parsed.text;
  } catch (err) {
    return Response.json(
      { error: `PDF parse failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (!text.trim()) {
    return Response.json({ error: "No extractable text in PDF" }, { status: 400 });
  }

  const rawName = decodeURIComponent(url.split("/").pop() ?? "");
  const fallback = rawName.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
  const title = extractDocTitle(text, fallback);
  const model = extractDocModel(`${title}\n${text}`);
  const chunks = chunkText(text);

  await sql`DELETE FROM fuel_tech_docs WHERE url = ${url}`;

  let added = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = sanitizeText(chunks[i]);
    if (chunk.split(/\s+/).length < 30) continue;

    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
    });
    const embStr = JSON.stringify(embRes.data[0].embedding);
    const id = makeId(url, i);

    await sql`
      INSERT INTO fuel_tech_docs
        (id, url, title, chunk_text, chunk_index, source, embedding, page_number, model)
      VALUES
        (${id}, ${url}, ${sanitizeText(title)}, ${chunk}, ${i},
         ${source}, ${embStr}::vector, ${0}, ${sanitizeText(model)})
      ON CONFLICT (id) DO UPDATE
        SET chunk_text = EXCLUDED.chunk_text,
            embedding  = EXCLUDED.embedding,
            title      = EXCLUDED.title,
            model      = EXCLUDED.model
    `;
    added++;
  }

  return Response.json({ ok: true, url, title, chunks: added });
}
