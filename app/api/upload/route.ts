import crypto from "crypto";
import OpenAI from "openai";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";

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
  const secret =
    req.headers.get("x-admin-secret") ??
    new URL(req.url).searchParams.get("secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const source = (formData.get("source") as string | null) ?? "pei";
  const files = formData.getAll("file") as File[];

  if (!files.length) {
    return Response.json({ error: "No files provided" }, { status: 400 });
  }

  let totalChunks = 0;
  const results: { name: string; title: string; chunks: number; url: string }[] = [];

  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());

    // Store in Vercel Blob for a stable public URL (also used by figure backfill)
    const blob = await put(`fuel-tech-uploads/${file.name}`, buf, {
      access: "public",
      contentType: "application/pdf",
    });
    const docUrl = blob.url;

    // Extract text
    let text = "";
    try {
      const parsed = await pdfParse(buf);
      text = parsed.text;
    } catch (err) {
      console.error(`[upload] pdf-parse failed for ${file.name}:`, err);
      results.push({ name: file.name, title: "(parse error)", chunks: 0, url: docUrl });
      continue;
    }

    if (!text.trim()) {
      results.push({ name: file.name, title: "(no text)", chunks: 0, url: docUrl });
      continue;
    }

    const fallback = file.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
    const title = extractDocTitle(text, fallback);
    const model = extractDocModel(`${title}\n${text}`);
    const chunks = chunkText(text);

    await sql`DELETE FROM fuel_tech_docs WHERE url = ${docUrl}`;

    let added = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = sanitizeText(chunks[i]);
      if (chunk.split(/\s+/).length < 30) continue;

      const embRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      });
      const embStr = JSON.stringify(embRes.data[0].embedding);
      const id = makeId(docUrl, i);

      await sql`
        INSERT INTO fuel_tech_docs
          (id, url, title, chunk_text, chunk_index, source, embedding, page_number, model)
        VALUES
          (${id}, ${docUrl}, ${sanitizeText(title)}, ${chunk}, ${i},
           ${source}, ${embStr}::vector, ${0}, ${sanitizeText(model)})
        ON CONFLICT (id) DO UPDATE
          SET chunk_text = EXCLUDED.chunk_text,
              embedding  = EXCLUDED.embedding,
              title      = EXCLUDED.title,
              model      = EXCLUDED.model
      `;
      added++;
    }

    totalChunks += added;
    results.push({ name: file.name, title, chunks: added, url: docUrl });
  }

  return Response.json({ ok: true, total_chunks: totalChunks, files: results });
}
