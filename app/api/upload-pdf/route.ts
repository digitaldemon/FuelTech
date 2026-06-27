import crypto from "crypto";
import OpenAI from "openai";
import { sql } from "@vercel/postgres";

export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

const CHUNK_WORDS = 500;
const OVERLAP_WORDS = 50;

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

const MODEL_PATTERNS: [RegExp, string][] = [
  [/TLS[-\s]?450\s*PLUS/i,  "TLS-450PLUS"],
  [/TLS[-\s]?450[Ii][Ss]/i, "TLS-450iS"],
  [/TLS[-\s]?450[Ii]/i,     "TLS-450i"],
  [/TLS[-\s]?450/i,         "TLS-450"],
  [/TLS[-\s]?350R/i,        "TLS-350R"],
  [/TLS[-\s]?350/i,         "TLS-350"],
  [/TLS[-\s]?300/i,         "TLS-300"],
  [/TLS[-\s]?4B/i,          "TLS-4B"],
  [/\bTLS[-\s]?4\b/i,       "TLS-4"],
  [/Encore\s*700S/i,        "Encore 700S"],
  [/Encore\s*700/i,         "Encore 700"],
  [/Encore\s*S\b/i,         "Encore S"],
  [/\bEncore\s*500\b/i,     "Encore 500"],
  [/\bEncore\b/i,           "Encore"],
  [/\bEclipse\b/i,          "Eclipse"],
  [/\bCRIND\b/i,            "CRIND"],
  [/FlexPay\s*IV/i,         "FlexPay IV"],
  [/\bFlexPay\b/i,          "FlexPay"],
  [/\bPassport\b/i,         "Passport"],
  [/\bTS[-\s]?750\b/i,      "TS-750"],
  [/\bTS[-\s]?550\b/i,      "TS-550"],
  [/\bFE.?Petro\b/i,        "FE Petro"],
  [/\bRed\s*Jacket\b/i,     "Red Jacket"],
];

function sanitizeText(s: string): string {
  return s
    .replace(/\0/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, " ")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/�/g, "");
}

function extractModel(text: string): string {
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

  const url = new URL(req.url);
  const titleParam = (url.searchParams.get("title") ?? "").slice(0, 200);
  const rawSource = url.searchParams.get("source") ?? "gilbarco";
  const VALID_SOURCES = new Set(["gilbarco", "veeder_root", "pei", "franklin", "dover", "gilbarco_extranet"]);
  const sourceParam = VALID_SOURCES.has(rawSource) ? rawSource : "gilbarco";
  const docId = url.searchParams.get("doc_id") ?? crypto.randomUUID();

  const docUrl = `local://${sourceParam}/${docId}`;

  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 20 * 1024 * 1024) {
    return Response.json({ error: 'File too large (max 20 MB)' }, { status: 413 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let pdfBuf: Buffer;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (file && file.size > 20 * 1024 * 1024) {
        return Response.json({ error: 'File too large (max 20 MB)' }, { status: 413 });
      }
      if (!file) return Response.json({ error: "No file field in form data" }, { status: 400 });
      pdfBuf = Buffer.from(await file.arrayBuffer());
    } else {
      // Raw binary body
      pdfBuf = Buffer.from(await req.arrayBuffer());
      if (pdfBuf.length > 20 * 1024 * 1024) {
        return Response.json({ error: 'File too large (max 20 MB)' }, { status: 413 });
      }
    }

    if (!pdfBuf.length) return Response.json({ error: "Empty file" }, { status: 400 });

    const parsed = await pdfParse(pdfBuf);
    const fullText = parsed.text;
    if (!fullText.trim()) return Response.json({ error: "No text extracted from PDF" }, { status: 422 });

    const title = sanitizeText(titleParam || `Uploaded Document (${new Date().toLocaleDateString()})`);
    const model = extractModel(`${title}\n${fullText}`);

    // Remove any previous version
    await sql`DELETE FROM fuel_tech_docs WHERE url = ${docUrl}`;

    const rawChunks = chunkText(fullText);
    const validChunks = rawChunks
      .map((c, i) => ({ index: i, text: sanitizeText(c) }))
      .filter(c => c.text.split(/\s+/).length >= 20);

    let count = 0;
    const EMBED_BATCH = 100;
    for (let b = 0; b < validChunks.length; b += EMBED_BATCH) {
      const batch = validChunks.slice(b, b + EMBED_BATCH);
      const embRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: batch.map(c => c.text),
      });
      for (let j = 0; j < batch.length; j++) {
        const { index, text: chunk } = batch[j];
        const embedding = embRes.data[j]?.embedding;
        if (!embedding) { console.error('Missing embedding for chunk', index); continue; }
        const embStr = JSON.stringify(embedding);
        const id = makeId(docUrl, index);
        await sql`
          INSERT INTO fuel_tech_docs (id, url, title, chunk_text, chunk_index, source, embedding, page_number, model)
          VALUES (${id}, ${docUrl}, ${title}, ${chunk}, ${index}, ${sourceParam}, ${embStr}::vector, ${-1}, ${model})
          ON CONFLICT (id) DO UPDATE
            SET chunk_text = EXCLUDED.chunk_text,
                embedding  = EXCLUDED.embedding,
                title      = EXCLUDED.title,
                model      = EXCLUDED.model
        `;
        count++;
      }
    }

    return Response.json({ ok: true, upserted: count, title, model, pages: parsed.numpages });
  } catch (err) {
    console.error('upload-pdf error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
