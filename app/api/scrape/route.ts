import crypto from "crypto";
import OpenAI from "openai";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";
// Import from lib directly to avoid pdf-parse loading its test fixtures at build time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;

// Lazy-loaded — pdfjs is pure JS (works on Vercel); canvas is a native dep (figure rendering only).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createCanvas: ((...args: any[]) => any) | null = null;

function loadPdfjs(): boolean {
  try {
    if (!pdfjsLib) {
      pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
      // In Node.js serverless environments, explicitly require the worker module
      // so pdfjs can run it inline (fake-worker mode with MessageChannel).
      try { require("pdfjs-dist/legacy/build/pdf.worker.js"); } catch { /* ignore */ }
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    }
    return true;
  } catch {
    return false;
  }
}

function loadNativeDeps(): boolean {
  if (!loadPdfjs()) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (!createCanvas) createCanvas = require("canvas").createCanvas;
    return true;
  } catch {
    return false;
  }
}

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

// Remove bytes that Postgres can't store as UTF-8 (e.g. null bytes, lone surrogates,
// non-printable control characters from PDF extraction artifacts).
function sanitizeText(s: string): string {
  return s
    .replace(/\0/g, "")                         // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, " ")  // control chars (keep \t \n \r)
    .replace(/[\uD800-\uDFFF]/g, "")            // lone surrogates
    .replace(/�/g, "");                    // replacement chars from bad decodes
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

// Ordered most-specific → least-specific so "TLS-450PLUS" wins over "TLS-450"
const MODEL_PATTERNS: [RegExp, string][] = [
  [/TLS[-\s]?450\s*PLUS/i,   "TLS-450PLUS"],
  [/TLS[-\s]?450[Ii][Ss]/i,  "TLS-450iS"],
  [/TLS[-\s]?450[Ii]/i,      "TLS-450i"],
  [/TLS[-\s]?450/i,          "TLS-450"],
  [/TLS[-\s]?350R/i,         "TLS-350R"],
  [/TLS[-\s]?350/i,          "TLS-350"],
  [/TLS[-\s]?300/i,          "TLS-300"],
  [/TLS[-\s]?4B/i,           "TLS-4B"],
  [/\bTLS[-\s]?4\b/i,        "TLS-4"],
  [/Encore\s*700S/i,         "Encore 700S"],
  [/Encore\s*700/i,          "Encore 700"],
  [/Encore\s*S\b/i,          "Encore S"],
  [/\bEncore\b/i,            "Encore"],
  [/\bEclipse\b/i,           "Eclipse"],
  [/\bCRIND\b/i,             "CRIND"],
  [/FlexPay\s*IV/i,          "FlexPay IV"],
  [/\bFlexPay\b/i,           "FlexPay"],
  [/\bPassport\b/i,          "Passport"],
  [/\bTS[-\s]?750\b/i,       "TS-750"],
  [/\bTS[-\s]?550\b/i,       "TS-550"],
  [/\bFE.?Petro\b/i,         "FE Petro"],
  [/\bRed\s*Jacket\b/i,      "Red Jacket"],
];

function extractDocModel(titleAndText: string): string {
  const sample = titleAndText.substring(0, 800);
  for (const [re, model] of MODEL_PATTERNS) {
    if (re.test(sample)) return model;
  }
  return "";
}

function extractPdfTitle(text: string, docId: string, brand = "Gilbarco"): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 30)) {
    if (line.length < 8 || line.length > 120) continue;
    if (/^\d+$/.test(line)) continue;                          // pure page number
    if (/^(page|rev|revision|version|date|copyright|©)/i.test(line)) continue;
    if (/^[^A-Za-z]/.test(line)) continue;                    // must start with a letter
    if ((line.match(/[A-Za-z]/g) ?? []).length < 4) continue; // must have real words
    return line.replace(/\s+/g, " ");
  }
  return `${brand} Doc ${docId}`;
}

// Extract text content per page.
//
// Strategy:
//   1. pdf-parse always provides the text (reliable encoding/font handling).
//   2. pdfjs provides per-page character counts so we can split that text
//      proportionally across pages — giving accurate page numbers for figure matching.
//   3. If pdfjs is unavailable or returns no counts, we split the full text evenly
//      across the page count (or return a single page if we can't get a count at all).
async function extractPageTexts(
  pdfBuf: Buffer
): Promise<{ pageNum: number; text: string }[]> {
  // Step 1: reliable full-text extraction via pdf-parse
  let fullText = "";
  try {
    const parsed = await pdfParse(pdfBuf);
    fullText = parsed.text;
  } catch { return []; }
  if (!fullText.trim()) return [];

  // Step 2: use pdfjs only to get per-page character counts for proportional splitting
  if (loadPdfjs()) {
    try {
      const data = new Uint8Array(pdfBuf);
      const pdfDoc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
      const pageCharCounts: number[] = [];

      for (let p = 1; p <= pdfDoc.numPages; p++) {
        const pg = await pdfDoc.getPage(p);
        const content = await pg.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chars = (content.items as any[]).reduce(
          (n, it) => n + ("str" in it ? (it.str as string).length : 0), 0
        );
        pageCharCounts.push(chars);
      }

      const totalPageChars = pageCharCounts.reduce((a, b) => a + b, 0);
      if (totalPageChars > 0) {
        // Distribute fullText proportionally based on each page's share of total chars
        const words = fullText.split(/\s+/).filter(Boolean);
        const pages: { pageNum: number; text: string }[] = [];
        let wordOffset = 0;

        for (let i = 0; i < pageCharCounts.length; i++) {
          const fraction = pageCharCounts[i] / totalPageChars;
          const wordCount = Math.max(1, Math.round(fraction * words.length));
          const pageWords = words.slice(wordOffset, wordOffset + wordCount);
          wordOffset += wordCount;
          if (pageWords.length > 0) pages.push({ pageNum: i + 1, text: pageWords.join(" ") });
        }
        // Remaining words (rounding error) go on the last page
        if (wordOffset < words.length && pages.length > 0) {
          pages[pages.length - 1].text += " " + words.slice(wordOffset).join(" ");
        }
        return pages;
      }

      // pdfjs loaded but returned no char counts — fall back to even split
      const numPages = pdfDoc.numPages;
      if (numPages > 1) {
        const words = fullText.split(/\s+/).filter(Boolean);
        const wpp = Math.ceil(words.length / numPages);
        return Array.from({ length: numPages }, (_, i) => ({
          pageNum: i + 1,
          text: words.slice(i * wpp, (i + 1) * wpp).join(" "),
        })).filter((p) => p.text.trim());
      }
    } catch { /* fall through */ }
  }

  // Last resort: full text as a single page
  return [{ pageNum: 1, text: fullText }];
}

async function upsertChunks(
  url: string,
  title: string,
  chunks: string[],
  source: string,
  limit: number,
  pageNumber = 0,
  model = ""
): Promise<number> {
  const safeUrl   = sanitizeText(url);
  const safeTitle = sanitizeText(title);
  const safeModel = sanitizeText(model);

  let count = 0;
  for (let i = 0; i < chunks.length && count < limit; i++) {
    const chunk = sanitizeText(chunks[i]);
    if (chunk.split(/\s+/).length < 30) continue;

    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
    });
    const embStr = JSON.stringify(embRes.data[0].embedding);
    const id = makeId(safeUrl, i);

    await sql`
      INSERT INTO fuel_tech_docs (id, url, title, chunk_text, chunk_index, source, embedding, page_number, model)
      VALUES (${id}, ${safeUrl}, ${safeTitle}, ${chunk}, ${i}, ${source}, ${embStr}::vector, ${pageNumber}, ${safeModel})
      ON CONFLICT (id) DO UPDATE
        SET chunk_text  = EXCLUDED.chunk_text,
            embedding   = EXCLUDED.embedding,
            title       = EXCLUDED.title,
            page_number = EXCLUDED.page_number,
            model       = EXCLUDED.model
    `;
    count++;
  }
  return count;
}

// ── Figure extraction ─────────────────────────────────────────────────────────

const FIGURE_KEYWORDS =
  /\b(figure|fig\.|diagram|wiring|schematic|illustration|drawing|circuit|harness|connector|pinout)\b/i;

class NodeCanvasFactory {
  create(width: number, height: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvas = createCanvas!(width, height) as any;
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(cc: ReturnType<NodeCanvasFactory["create"]>, width: number, height: number) {
    cc.canvas.width = width;
    cc.canvas.height = height;
  }
  destroy(cc: ReturnType<NodeCanvasFactory["create"]>) {
    cc.canvas.width = 0;
    cc.canvas.height = 0;
  }
}

async function extractAndStoreFigures(pdfBuf: Buffer, docUrl: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  if (!loadNativeDeps()) return;

  try {
    const data = new Uint8Array(pdfBuf);
    const pdfDoc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
    const canvasFactory = new NodeCanvasFactory();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OPS = (pdfjsLib as any).OPS as Record<string, number> | undefined;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);

      // Try to detect visual content via operator list (may not be available in all envs).
      let hasRaster = false;
      let hasVectorDiagram = false;
      if (OPS) {
        try {
          const ops = await page.getOperatorList();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hasRaster = ops.fnArray.some(
            (fn: any) => fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const drawOpCount = ops.fnArray.filter(
            (fn: any) => fn === OPS.stroke || fn === OPS.fill || fn === OPS.fillStroke || fn === OPS.eoFill || fn === OPS.eoFillStroke
          ).length;
          hasVectorDiagram = drawOpCount > 15;
        } catch { /* operator list unavailable — fall through to keyword check */ }
      }

      // Wiring diagrams often appear on pages whose text references figures/diagrams even
      // when the vector-op count is low (simple line art).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textContent = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = (textContent.items as any[]).map((it: any) => ("str" in it ? it.str : "")).join(" ");
      const hasVisualKeyword = FIGURE_KEYWORDS.test(pageText);

      if (!hasRaster && !hasVectorDiagram && !hasVisualKeyword) continue;

      const viewport = page.getViewport({ scale: 1.5 });
      const { canvas, context } = canvasFactory.create(
        Math.round(viewport.width),
        Math.round(viewport.height)
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: context as any, viewport, canvasFactory }).promise;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pngBuf: Buffer = (canvas as any).toBuffer("image/png");
      const figId = makeId(docUrl, pageNum);

      let url: string;
      try {
        // Production: store in Vercel Blob
        const blob = await put(`fuel-tech-figures/${figId}.png`, pngBuf, {
          access: "public",
          contentType: "image/png",
        });
        url = blob.url;
      } catch (blobErr) {
        console.error("[figures] blob put failed:", blobErr);
        // Dev fallback: write to public/figures/ and serve as static asset
        const figuresDir = path.join(process.cwd(), "public", "figures");
        if (!fs.existsSync(figuresDir)) fs.mkdirSync(figuresDir, { recursive: true });
        fs.writeFileSync(path.join(figuresDir, `${figId}.png`), pngBuf);
        url = `/figures/${figId}.png`;
      }

      await sql`
        INSERT INTO fuel_tech_figures (id, doc_url, page_number, image_url)
        VALUES (${figId}, ${docUrl}, ${pageNum}, ${url})
        ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url
      `;
    }
  } catch (err) {
    console.error("[figures] error:", err);
  }
}

// Backfill: re-download PDFs and (re-)extract figures.
// recheck=false → only docs with no figures yet
// recheck=true  → all docs, incl. those with existing figures (to pick up newly-detectable pages)
async function scrapeFiguresOnly(limit: number, recheck = false): Promise<number> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return 0;
  if (!loadNativeDeps()) return 0;

  const rows = recheck
    ? await sql`
        SELECT url FROM (
          SELECT DISTINCT url
          FROM fuel_tech_docs
          WHERE url LIKE 'http%'
            AND url NOT LIKE '%interactive.gilbarco.com%'
        ) t
        ORDER BY RANDOM()
        LIMIT ${limit}
      `
    : await sql`
        SELECT DISTINCT url
        FROM fuel_tech_docs
        WHERE url LIKE 'http%'
          AND url NOT LIKE '%interactive.gilbarco.com%'
          AND NOT EXISTS (
            SELECT 1 FROM fuel_tech_figures f WHERE f.doc_url = url
          )
        LIMIT ${limit}
      `;
  if (rows.rows.length === 0) return 0;
  const missing = rows;

  const gilbarcoSession = await getGilbarcoSession().catch(() => "");
  const veederSession = await getVeederSession().catch(() => "");

  let count = 0;
  for (const { url } of missing.rows as { url: string }[]) {
    let pdfBuf: Buffer | null = null;
    try {
      if (url.includes("docs.gilbarco.com")) {
        const docId = new URL(url).searchParams.get("doc_id") ?? "";
        pdfBuf = docId ? await fetchGilbarcoPdf(docId, gilbarcoSession) : null;
      } else if (url.includes("docs.veeder.com")) {
        const docId = new URL(url).searchParams.get("doc_id") ?? "";
        pdfBuf = docId ? await fetchVeederPdf(docId, veederSession) : null;
      } else {
        pdfBuf = await fetchDirectPdf(url);
      }
    } catch { pdfBuf = null; }

    if (!pdfBuf) continue;
    await extractAndStoreFigures(pdfBuf, url);
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

      const docUrl = `${GILBARCO_BASE}/gold/download.cfm?doc_id=${docId}`;
      // Skip docs that already have page-level chunks (page_number > 0 means already processed)
      const exists = await sql`
        SELECT 1 FROM fuel_tech_docs WHERE url = ${docUrl} AND page_number > 0 LIMIT 1
      `;
      if (exists.rows.length > 0) continue;

      const pdfBuf = await fetchGilbarcoPdf(docId, cookie);
      if (!pdfBuf) continue;

      const pageTexts = await extractPageTexts(pdfBuf);
      if (pageTexts.length === 0) continue;

      const fullText = pageTexts.map((p) => p.text).join("\n");
      const title = extractPdfTitle(fullText, docId);
      const model = extractDocModel(`${title}\n${fullText}`);

      // Remove any old chunks for this doc before inserting page-aware ones
      await sql`DELETE FROM fuel_tech_docs WHERE url = ${docUrl}`;

      for (const { pageNum, text } of pageTexts) {
        if (total >= limit) break;
        const chunks = chunkText(text);
        const added = await upsertChunks(docUrl, title, chunks, "gilbarco", limit - total, pageNum, model);
        total += added;
      }

      await extractAndStoreFigures(pdfBuf, docUrl);
    }
  }

  return total;
}

// ── Veeder-Root ───────────────────────────────────────────────────────────────

const VEEDER_BASE = "https://docs.veeder.com";
const VEEDER_LIBRARY_URL = "https://www.veeder.com/us/technical-document-library";

async function getVeederSession(): Promise<string> {
  try {
    const res = await fetch(`${VEEDER_BASE}/gold/`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FuelTechBot/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    const setCookie = res.headers.get("set-cookie") ?? "";
    const cfid = setCookie.match(/cfid=([^;,]+)/i)?.[1] ?? "";
    const cftoken = setCookie.match(/cftoken=([^;,]+)/i)?.[1] ?? "";
    return cfid && cftoken ? `cfid=${cfid};cftoken=${cftoken}` : "";
  } catch {
    return "";
  }
}

async function fetchVeederPdf(docId: string, cookie: string): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `${VEEDER_BASE}/gold/download.cfm?doc_id=${docId}&warning=0`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FuelTechBot/1.0)",
          Cookie: cookie,
        },
        signal: AbortSignal.timeout(30000),
      }
    );
    if (!res.ok || !res.headers.get("content-type")?.includes("pdf")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function fetchDirectPdf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FuelTechBot/1.0)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("pdf")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function scrapeVeederRoot(limit: number): Promise<number> {
  // Fetch the library index to discover all document IDs and direct PDF links
  let libraryHtml = "";
  try {
    const res = await fetch(VEEDER_LIBRARY_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FuelTechBot/1.0)" },
      signal: AbortSignal.timeout(20000),
    });
    libraryHtml = await res.text();
  } catch {
    return 0;
  }

  // Extract doc IDs from docs.veeder.com/gold/download.cfm?doc_id=X
  // and veeder.com/gold/download.cfm?doc_id=X (same portal, different domain alias)
  const docIdSet = new Set<string>();
  let m;
  const portalRe = /(?:docs\.veeder\.com|veeder\.com)\/gold\/download\.cfm\?doc_id=(\d+)/gi;
  while ((m = portalRe.exec(libraryHtml)) !== null) docIdSet.add(m[1]);

  // Extract direct veeder.com/us/sites/ PDF URLs (hosted on the main site, no session needed)
  const directUrls: string[] = [];
  const directPdfRe = /https:\/\/www\.veeder\.com\/us\/sites\/[^"'\s)>]+\.(?:pdf|PDF)/gi;
  while ((m = directPdfRe.exec(libraryHtml)) !== null) {
    directUrls.push(m[0].replace(/&amp;/g, "&"));
  }

  const cookie = await getVeederSession();
  let total = 0;
  const processedDocs = new Set<string>();

  // Download and process portal PDFs
  for (const docId of docIdSet) {
    if (total >= limit) break;
    if (processedDocs.has(docId)) continue;
    processedDocs.add(docId);

    const docUrl = `${VEEDER_BASE}/gold/download.cfm?doc_id=${docId}`;
    // Skip docs that already have page-level chunks
    const exists = await sql`
      SELECT 1 FROM fuel_tech_docs WHERE url = ${docUrl} AND page_number > 0 LIMIT 1
    `;
    if (exists.rows.length > 0) continue;

    const pdfBuf = await fetchVeederPdf(docId, cookie);
    if (!pdfBuf) continue;

    const pageTexts = await extractPageTexts(pdfBuf);
    if (pageTexts.length === 0) continue;

    const fullText = pageTexts.map((p) => p.text).join("\n");
    const title = extractPdfTitle(fullText, docId, "Veeder-Root");
    const model = extractDocModel(`${title}\n${fullText}`);

    await sql`DELETE FROM fuel_tech_docs WHERE url = ${docUrl}`;

    for (const { pageNum, text } of pageTexts) {
      if (total >= limit) break;
      const chunks = chunkText(text);
      const added = await upsertChunks(docUrl, title, chunks, "veeder-root", limit - total, pageNum, model);
      total += added;
    }
    await extractAndStoreFigures(pdfBuf, docUrl);
  }

  // Download and process direct-hosted PDFs
  const processedUrls = new Set<string>();
  for (const pdfUrl of directUrls) {
    if (total >= limit) break;
    if (processedUrls.has(pdfUrl)) continue;
    processedUrls.add(pdfUrl);

    const existsDirect = await sql`
      SELECT 1 FROM fuel_tech_docs WHERE url = ${pdfUrl} AND page_number > 0 LIMIT 1
    `;
    if (existsDirect.rows.length > 0) continue;

    const pdfBuf = await fetchDirectPdf(pdfUrl);
    if (!pdfBuf) continue;

    const pageTexts = await extractPageTexts(pdfBuf);
    if (pageTexts.length === 0) continue;

    const rawFileName = pdfUrl.split("/").pop() ?? "";
    const fallbackId = decodeURIComponent(rawFileName).replace(/\.pdf$/i, "");
    const fullText = pageTexts.map((p) => p.text).join("\n");
    const title = extractPdfTitle(fullText, fallbackId, "Veeder-Root");
    const model = extractDocModel(`${title}\n${fullText}`);

    await sql`DELETE FROM fuel_tech_docs WHERE url = ${pdfUrl}`;

    for (const { pageNum, text } of pageTexts) {
      if (total >= limit) break;
      const chunks = chunkText(text);
      const added = await upsertChunks(pdfUrl, title, chunks, "veeder-root", limit - total, pageNum, model);
      total += added;
    }
    await extractAndStoreFigures(pdfBuf, pdfUrl);
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

// ── Franklin Fueling ──────────────────────────────────────────────────────────

const FRANKLIN_RESOURCE_URL = "https://www.franklinfueling.com/en/support/resource-center/";

async function scrapeFranklin(limit: number): Promise<number> {
  let html = "";
  try {
    const res = await fetch(FRANKLIN_RESOURCE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FuelTechBot/1.0)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return 0;
    html = await res.text();
  } catch {
    return 0;
  }

  // Collect direct .pdf links and Widen CDN links
  const pdfUrls: string[] = [];
  const seen = new Set<string>();
  const addUrl = (u: string) => { const c = u.replace(/&amp;/g, "&"); if (!seen.has(c)) { seen.add(c); pdfUrls.push(c); } };

  let m;
  // Direct PDF hrefs
  const directRe = /https?:\/\/[^"'\s>]+\.pdf(?:\?[^"'\s>]*)?/gi;
  while ((m = directRe.exec(html)) !== null) addUrl(m[0]);
  // Widen CDN links (original file served when fetched directly)
  const widenRe = /https:\/\/fele\.widen\.net\/s\/[A-Za-z0-9]+\/[^"'\s>)]+/gi;
  while ((m = widenRe.exec(html)) !== null) addUrl(m[0]);

  let total = 0;
  const processed = new Set<string>();

  for (const pdfUrl of pdfUrls) {
    if (total >= limit) break;
    if (processed.has(pdfUrl)) continue;
    processed.add(pdfUrl);

    const exists = await sql`SELECT 1 FROM fuel_tech_docs WHERE url = ${pdfUrl} AND page_number > 0 LIMIT 1`;
    if (exists.rows.length > 0) continue;

    const pdfBuf = await fetchDirectPdf(pdfUrl);
    if (!pdfBuf) continue;

    const pageTexts = await extractPageTexts(pdfBuf);
    if (pageTexts.length === 0) continue;

    const rawName = decodeURIComponent(pdfUrl.split("/").pop() ?? "").replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
    const fullText = pageTexts.map((p) => p.text).join("\n");
    const title = extractPdfTitle(fullText, rawName, "Franklin Fueling");
    const model = extractDocModel(`${title}\n${fullText}`);

    await sql`DELETE FROM fuel_tech_docs WHERE url = ${pdfUrl}`;
    for (const { pageNum, text } of pageTexts) {
      if (total >= limit) break;
      const added = await upsertChunks(pdfUrl, title, chunkText(text), "franklin", limit - total, pageNum, model);
      total += added;
    }
    await extractAndStoreFigures(pdfBuf, pdfUrl);
  }

  return total;
}

// ── Dover Fueling Solutions (Wayne / Tokheim) ─────────────────────────────────
// Site blocks lightweight scrapers; attempt with a full browser UA, fail gracefully.

const DOVER_URLS = [
  "https://www.doverfuelingsolutions.com/en/resources/documents",
  "https://www.doverfuelingsolutions.com/en/support",
];

async function scrapeDover(limit: number): Promise<number> {
  const pdfUrls: string[] = [];
  const seen = new Set<string>();

  for (const pageUrl of DOVER_URLS) {
    let html = "";
    try {
      const res = await fetch(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      html = await res.text();
    } catch { continue; }

    const pdfRe = /https?:\/\/[^"'\s>]+\.pdf(?:\?[^"'\s>]*)?/gi;
    let m;
    while ((m = pdfRe.exec(html)) !== null) {
      const u = m[0].replace(/&amp;/g, "&");
      if (!seen.has(u)) { seen.add(u); pdfUrls.push(u); }
    }
  }

  let total = 0;
  const processed = new Set<string>();

  for (const pdfUrl of pdfUrls) {
    if (total >= limit) break;
    if (processed.has(pdfUrl)) continue;
    processed.add(pdfUrl);

    const exists = await sql`SELECT 1 FROM fuel_tech_docs WHERE url = ${pdfUrl} AND page_number > 0 LIMIT 1`;
    if (exists.rows.length > 0) continue;

    const pdfBuf = await fetchDirectPdf(pdfUrl);
    if (!pdfBuf) continue;

    const pageTexts = await extractPageTexts(pdfBuf);
    if (pageTexts.length === 0) continue;

    const rawName = decodeURIComponent(pdfUrl.split("/").pop() ?? "").replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
    const fullText = pageTexts.map((p) => p.text).join("\n");
    const title = extractPdfTitle(fullText, rawName, "Dover Fueling");
    const model = extractDocModel(`${title}\n${fullText}`);

    await sql`DELETE FROM fuel_tech_docs WHERE url = ${pdfUrl}`;
    for (const { pageNum, text } of pageTexts) {
      if (total >= limit) break;
      const added = await upsertChunks(pdfUrl, title, chunkText(text), "dover", limit - total, pageNum, model);
      total += added;
    }
    await extractAndStoreFigures(pdfBuf, pdfUrl);
  }

  return total;
}

// ── Gilbarco Extranet Tech Bulletins ─────────────────────────────────────────

const EXTRANET_BASE = "https://interactive.gilbarco.com";

// All product IDs discovered from the tech resource portal
const EXTRANET_PRODUCT_IDS = [
  2, 3, 4, 6, 10, 11, 12, 13, 14, 16, 17, 18, 20, 21, 23, 24, 25, 46, 62, 68,
  77, 78, 79, 80, 81, 82, 83, 89, 93, 94, 97, 98, 100, 101, 102, 103, 104, 105,
  108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 120, 121, 122, 123, 124,
  125, 128, 129, 134, 135, 136, 137, 139, 140, 141, 142, 144, 145, 146, 147, 148,
  149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 161, 171, 172,
];

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
    const cookieJar = new Map<string, string>();
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

    // Step 1: GET to obtain initial CF session cookies
    const getRes = await fetch(`${EXTRANET_BASE}/`, {
      headers: { "User-Agent": ua },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    for (const [k, v] of extractSetCookies(getRes.headers)) cookieJar.set(k, v);

    const cookieStr = () => [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

    // Step 2: POST credentials
    const loginBody = new URLSearchParams({ user_id: user, loginpassword: pass, isPost: "Y" });
    const postRes = await fetch(`${EXTRANET_BASE}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": ua,
        "Cookie": cookieStr(),
        "Referer": `${EXTRANET_BASE}/`,
      },
      body: loginBody.toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    for (const [k, v] of extractSetCookies(postRes.headers)) cookieJar.set(k, v);

    // Step 3: Follow redirect to complete login and pick up any final session cookies
    const loc = postRes.headers.get("location");
    if (loc) {
      const followUrl = loc.startsWith("http") ? loc : `${EXTRANET_BASE}${loc}`;
      const followRes = await fetch(followUrl, {
        headers: { "User-Agent": ua, "Cookie": cookieStr() },
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      for (const [k, v] of extractSetCookies(followRes.headers)) cookieJar.set(k, v);
    }

    return cookieStr();
  } catch {
    return "";
  }
}

async function fetchExtranetPage(url: string, cookies: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Cookie": cookies,
        "Referer": `${EXTRANET_BASE}/apps/tech_resource/`,
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // If redirected back to login page, session is invalid
    if (text.includes("loginpassword") && text.includes("Accept and Login")) return null;
    return text;
  } catch {
    return null;
  }
}

async function fetchExtranetPdf(url: string, cookies: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Cookie": cookies,
        "Referer": `${EXTRANET_BASE}/apps/tech_resource/`,
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("pdf")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function scrapeGilbarcoExtranet(limit: number): Promise<number> {
  const cookies = await getExtranetSession();
  if (!cookies) {
    console.error("[extranet] No session — check GILBARCO_EXTRANET_USER/PASS env vars");
    return 0;
  }

  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  // Step 1: Collect unique bulletin base64 IDs from all product pages
  const bulletinIds = new Set<string>(); // base64-encoded bulletin IDs

  for (const productId of EXTRANET_PRODUCT_IDS) {
    if (bulletinIds.size >= limit * 3) break; // rough cap on enumeration
    const b64 = Buffer.from(String(productId)).toString("base64");
    const productUrl = `${EXTRANET_BASE}/apps/tech_resource/product/${encodeURIComponent(b64)}`;

    let page = 1;
    while (true) {
      try {
        const formBody = new URLSearchParams({
          bulletin_result_type: "0",
          bulletin_result_per_page: "100",
          isPost: "Y",
          ...(page > 1 ? { bulletin_result_page: `next-${page - 1}` } : {}),
        });

        const res = await fetch(productUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": ua,
            "Cookie": cookies,
            "Referer": productUrl,
          },
          body: formBody.toString(),
          signal: AbortSignal.timeout(20000),
        });

        if (!res.ok) break;
        const html = await res.text();
        if (html.includes("loginpassword")) break; // session expired

        // Extract bulletin base64 IDs from download hrefs
        const idMatches = [...html.matchAll(/href="\.\/downloads\/([^"]+)"/gi)];
        if (idMatches.length === 0) break;
        for (const m of idMatches) bulletinIds.add(decodeURIComponent(m[1]));

        // Check if there's a "Next" button for more pages
        const hasNext = html.includes("bulletin_page_next") && html.includes(`value="next-${page}"`);
        if (!hasNext) break;
        page++;
      } catch { break; }
    }
  }

  console.log(`[extranet] Found ${bulletinIds.size} unique bulletins`);

  // Step 2: Process each unique bulletin
  let total = 0;
  const processed = new Set<string>();

  for (const b64id of bulletinIds) {
    if (total >= limit) break;
    if (processed.has(b64id)) continue;
    processed.add(b64id);

    const detailUrl = `${EXTRANET_BASE}/apps/tech_resource/downloads/${encodeURIComponent(b64id)}`;

    // Skip if already in DB
    const exists = await sql`SELECT 1 FROM fuel_tech_docs WHERE url = ${detailUrl} LIMIT 1`;
    if (exists.rows.length > 0) continue;

    // Fetch detail page
    const detailHtml = await fetchExtranetPage(detailUrl, cookies);
    if (!detailHtml) continue;

    // Extract bulletin metadata from HTML
    const bulletinNoMatch = detailHtml.match(/Service Bulletin #(\d+)/);
    const bulletinNo = bulletinNoMatch?.[1] ?? Buffer.from(b64id, "base64").toString();

    const titleMatch = detailHtml.match(/<tr class="bg-warning"[^>]*>\s*<td[^>]*>\s*<b>([^<]+)<\/b>/i);
    const bulletinTitle = titleMatch?.[1]?.trim() ?? `Service Bulletin ${bulletinNo}`;

    const dateMatch = detailHtml.match(/<td>\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+,\s+\d{4})/i);
    const bulletinDate = dateMatch?.[1]?.trim() ?? "";

    // Extract applicable products
    const productsMatch = detailHtml.match(/applies to:[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
    const productsList = productsMatch
      ? [...productsMatch[1].matchAll(/<li>([^<]+)<\/li>/gi)].map(m => m[1].trim()).join(", ")
      : "";

    // Extract text content from all <td> cells in the bulletin detail table
    const mainContent = detailHtml.substring(detailHtml.indexOf("bulletin_results_wrapper") || 0);
    const bulletinText = stripHtml(
      mainContent
        .replace(/<thead[\s\S]*?<\/thead>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
    );

    // Build full text for chunking
    const fullText = [
      `Service Bulletin ${bulletinNo}: ${bulletinTitle}`,
      bulletinDate ? `Date: ${bulletinDate}` : "",
      productsList ? `Applies to: ${productsList}` : "",
      bulletinText,
    ].filter(Boolean).join("\n\n");

    const docModel = extractDocModel(`${bulletinTitle}\n${productsList}\n${bulletinText}`);

    // Find all attachment download links: href="download/{b64id}/{n}"
    const attachmentMatches = [
      ...detailHtml.matchAll(/href="download\/([^"\/]+)\/(\d+)"/gi),
    ];
    const attachmentIndices = attachmentMatches.map((m) => m[2]); // ["1", "2", ...]

    let chunkSource: { texts: string[]; pageNum: number }[] = [];

    // Try each attachment — the first PDF wins
    for (const idx of attachmentIndices) {
      const attachUrl = `${EXTRANET_BASE}/apps/tech_resource/download/${encodeURIComponent(b64id)}/${idx}`;
      const attachBuf = await fetchExtranetPdf(attachUrl, cookies);
      if (!attachBuf) continue;

      const pageTexts = await extractPageTexts(attachBuf);
      if (pageTexts.length === 0) continue;

      chunkSource = pageTexts.map(({ pageNum, text }) => ({ texts: chunkText(text), pageNum }));
      await extractAndStoreFigures(attachBuf, detailUrl);
      break; // use first successful PDF attachment
    }

    // Fall back to HTML text when there are no PDF attachments
    if (chunkSource.length === 0) {
      chunkSource = [{ texts: chunkText(fullText), pageNum: 0 }];
    }

    const title = `Service Bulletin ${bulletinNo}: ${bulletinTitle}`;
    await sql`DELETE FROM fuel_tech_docs WHERE url = ${detailUrl}`;

    for (const { texts, pageNum } of chunkSource) {
      if (total >= limit) break;
      const added = await upsertChunks(detailUrl, title, texts, "gilbarco-extranet", limit - total, pageNum, docModel);
      total += added;
    }

  }

  return total;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    source?: string;
    limit?: number;
    reset?: boolean;
    recheck?: boolean;
  };
  const source = body.source ?? "both";
  const limit = Number(body.limit ?? 40);
  const recheck = body.recheck ?? false;

  const ALL_SOURCES = ["veeder-root", "gilbarco", "pei", "franklin", "dover", "gilbarco-extranet"];

  // Figure-only backfill: re-extract images for docs already in DB that are missing figures.
  // Pass recheck:true to also re-process docs that already have some figures (picks up newly-detectable pages).
  if (source === "figures") {
    const count = await scrapeFiguresOnly(limit, recheck);
    return Response.json({ ok: true, figures_backfilled: count });
  }

  if (body.reset) {
    const toReset = source === "both" ? ALL_SOURCES : [source];
    for (const s of toReset) {
      await sql`DELETE FROM fuel_tech_docs WHERE source = ${s}`;
    }
  }

  let total = 0;

  if (source === "pei" || source === "both") {
    total += await scrapePei(source === "both" ? Math.ceil(limit / 7) : limit);
  }
  if (source === "gilbarco" || source === "both") {
    total += await scrapeGilbarco(source === "both" ? Math.floor((limit * 2) / 7) : limit);
  }
  if (source === "veeder-root" || source === "both") {
    total += await scrapeVeederRoot(source === "both" ? Math.floor((limit * 2) / 7) : limit);
  }
  if (source === "franklin" || source === "both") {
    total += await scrapeFranklin(source === "both" ? Math.floor(limit / 7) : limit);
  }
  if (source === "dover" || source === "both") {
    total += await scrapeDover(source === "both" ? Math.floor(limit / 7) : limit);
  }
  if (source === "gilbarco-extranet" || source === "both") {
    total += await scrapeGilbarcoExtranet(source === "both" ? Math.floor(limit / 7) : limit);
  }

  return Response.json({ ok: true, upserted: total });
}
