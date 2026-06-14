import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@vercel/postgres";
import { verifySession, COOKIE_NAME } from "../../../lib/session";

export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are FuelTech AI Pro — a field service assistant for gas station fuel system technicians. You specialise in Gilbarco and Wayne dispensers (Encore, Eclipse, CRIND, FlexPay), Veeder-Root ATGs (TLS-300/350/450/450PLUS), Franklin Fueling and Red Jacket submersible pumps, EMV/payment compliance, UST monitoring, and site startup/commissioning.

## Response format rules — follow these exactly

**For troubleshooting or "why is X happening" questions:**
- Start with the most likely cause in one sentence.
- List diagnostic steps as a numbered list.
- End with the fix or escalation path.

**For procedures ("how do I..." / "steps to..."):**
- Use a numbered list for every step, in order.
- Quote exact button names, menu paths, settings, and values from the documentation.
- Do not paraphrase procedure steps — copy the exact sequence.

**For error/alarm/fault codes:**
- State the equipment model the code belongs to first.
- Give the exact fault description from the manual.
- List the recommended corrective action as numbered steps.
- Never apply one model's codes to a different model.

**For specification lookups (voltages, pressures, part numbers, settings):**
- Give the exact value with units.
- State which model/revision it applies to.

**Always:**
- No inline citations — source documents are shown separately in the UI.
- If multiple documents cover the same topic for different models, address each model separately with a clear heading.
- If the provided documentation does not contain the answer, say exactly: "I don't have documentation covering that. Based on general knowledge: [answer] — verify against your official manual before proceeding."
- If [WEB SEARCH RESULTS] are present, use them and note the technician should verify against their official manual.
- **Never ask for clarification.** If the question is vague, state your assumption ("Assuming this is an Encore 700 with a standard CRIND configuration…") and answer for the most common scenario. A technician in the field needs an answer now, not a follow-up question.
- **Interpret field language.** "Won't turn on" = power/startup failure. "Keeps beeping" = active alarm. "Not reading" = sensor/communication fault. "Stuck on screen X" = UI/software issue. Match the intent to the technical topic.
- **Read every provided chunk before answering.** Documentation is split into chunks and the exact answer may be in any of them. Scan ALL [DOC N] sections — do not stop at the first partial match. If a procedure spans multiple consecutive chunks, assemble the full step sequence before presenting it.
- **Quote exact procedures verbatim.** Do not summarize, compress, or paraphrase numbered steps. Copy each step exactly as it appears in the source, including sub-steps, menu paths, and exact values. A missing step can cause a real equipment failure in the field.
- **Never truncate a procedure.** If a procedure has 15 steps, include all 15. Never write "continue following the procedure" or "repeat for remaining steps" — write every step out in full.`;

// ── Equipment model detection ──────────────────────────────────────────────────
// Ordered most-specific → least-specific. Shared with the scraper's MODEL_PATTERNS.
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

function detectEquipmentModel(query: string): string | null {
  for (const [re, model] of MODEL_PATTERNS) {
    if (re.test(query)) return model;
  }
  return null;
}

// ── HyDE — generate a hypothetical document excerpt to improve retrieval ───────
async function generateHypotheticalDoc(query: string): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a fuel system service manual. Write 3–4 sentences of technical documentation that directly answers the question, as if from an official Gilbarco or Veeder-Root manufacturer manual. Use exact technical terminology, part names, and procedure language found in service manuals.",
        },
        { role: "user", content: query },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });
    return res.choices[0].message.content ?? query;
  } catch {
    return query;
  }
}

// ── Query expansion — rephrase the question in documentation vocabulary ────────
// Techs describe problems in field language; manuals use technical terms.
// Three alternate phrasings increase the chance of a vocabulary match.
async function expandQuery(query: string): Promise<string[]> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            `You are a fuel system technical expert. Rewrite the user's question into exactly 5 alternative phrasings that use the vocabulary found in Gilbarco, Veeder-Root, and Franklin Fueling manufacturer service manuals and technical bulletins. Cover different angles: (1) exact manual terminology, (2) procedure/step phrasing, (3) symptom/diagnostic phrasing, (4) component/part name phrasing, (5) alarm/fault code phrasing. Return only the 5 phrasings separated by newlines, no numbering or extra text.`,
        },
        { role: "user", content: query },
      ],
      max_tokens: 250,
      temperature: 0.3,
    });
    const text = res.choices[0].message.content ?? "";
    return text.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 5);
  } catch {
    return [];
  }
}

// ── Cohere re-ranking (optional — gracefully skipped if no API key) ────────────
type ChunkRow = {
  url: unknown;
  title: unknown;
  chunk_text: unknown;
  chunk_index: unknown;
  source: unknown;
  page_number: unknown;
  distance: unknown;
};

async function rerankWithCohere(query: string, candidates: ChunkRow[]): Promise<ChunkRow[]> {
  const key = process.env.COHERE_API_KEY;
  if (!key || candidates.length <= 20) return candidates.slice(0, 20);

  try {
    const res = await fetch("https://api.cohere.com/v2/rerank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: "rerank-v3.5",
        query,
        // Send full chunk text — no truncation so Cohere sees the complete passage
        documents: candidates.map((c) => `${c.title as string}\n${c.chunk_text as string}`),
        top_n: 20,
        return_documents: false,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return candidates.slice(0, 20);
    const data = (await res.json()) as { results: { index: number }[] };
    return data.results.map((r) => candidates[r.index]);
  } catch {
    return candidates.slice(0, 20);
  }
}

// ── Web search fallback ────────────────────────────────────────────────────────
async function openAiWebSearch(query: string): Promise<{ summary: string; urls: string[] }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai as any).responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview" }],
      input: `Fuel system field technician question: ${query}`,
    });

    const summary: string = response.output_text ?? "";
    const urls: string[] = [];
    for (const block of response.output ?? []) {
      for (const content of block.content ?? []) {
        for (const ann of content.annotations ?? []) {
          if (ann.url) urls.push(ann.url as string);
        }
      }
    }
    return { summary, urls: [...new Set(urls)] };
  } catch {
    return { summary: "", urls: [] };
  }
}

// ── Error code detection ───────────────────────────────────────────────────────
function extractErrorCode(text: string): string | null {
  const patterns = [
    /\berr(?:or)?\s*[#:]?\s*([A-Z0-9]{2,8})\b/i,
    /\bfault\s*[#:]?\s*([A-Z0-9]{2,8})\b/i,
    /\balarm\s*[#:]?\s*([A-Z0-9]{2,8})\b/i,
    /\bcode\s*[#:]?\s*([A-Z0-9]{2,8})\b/i,
    /\b([A-Z]{1,4}[-_]\d{2,5})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

const GUIDED_MODE_ADDENDUM = `

## GUIDED MODE — ACTIVE
The technician has enabled step-by-step guided mode. Rules you MUST follow:
- Present ONLY ONE step at a time per response.
- After each step, ask the technician to confirm completion or describe what they observe (e.g. "What does the display show?" or "Let me know when that's done and I'll continue.").
- Wait for their response before presenting the next step.
- If they report an unexpected result or error, stop and diagnose before proceeding.
- Number steps sequentially across the entire conversation (Step 1, Step 2, Step 3…).
- On your FIRST response: briefly confirm what procedure you are beginning, then present Step 1 only.
- NEVER dump the full procedure at once — one step per response, always.`;

const SPANISH_ADDENDUM = `

## IDIOMA — ESPAÑOL
El técnico ha seleccionado respuestas en español. Responde SIEMPRE en español, sin importar el idioma de la pregunta. Mantén todos los términos técnicos (nombres de equipos, códigos de error, rutas de menú) exactamente como aparecen en los manuales de fábrica —en inglés—. Traduce todas las explicaciones, instrucciones y comentarios al español.`;

// ── Main route ────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // Session auth — only logged-in subscribers may consume API tokens
  const rawCookie = req.headers.get("cookie") ?? "";
  const tokenMatch = rawCookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const token = tokenMatch ? tokenMatch[1] : null;
  if (!token || !(await verifySession(token))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, history = [], guidedMode = false, imageBase64, imageMediaType, lang = "en" } = (await req.json()) as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    guidedMode?: boolean;
    imageBase64?: string;
    imageMediaType?: string;
    lang?: "en" | "es";
  };

  // Step 1: Generate HyDE + query expansions + embed original, all in parallel
  const [origEmbRes, hydeText, expandedQueries] = await Promise.all([
    openai.embeddings.create({ model: "text-embedding-3-small", input: message }),
    generateHypotheticalDoc(message),
    expandQuery(message),
  ]);

  // Step 2: Embed HyDE doc + all expanded queries in parallel
  const [hydeEmbRes, ...expandedEmbResults] = await Promise.all([
    openai.embeddings.create({ model: "text-embedding-3-small", input: hydeText }),
    ...expandedQueries.map((q) =>
      openai.embeddings.create({ model: "text-embedding-3-small", input: q })
    ),
  ]);

  // Step 3: Fuse original + HyDE embeddings, then re-normalize (improves recall)
  const origEmb = origEmbRes.data[0].embedding as number[];
  const hydeEmb = hydeEmbRes.data[0].embedding as number[];
  const fused = origEmb.map((v, i) => (v + hydeEmb[i]) / 2);
  const norm = Math.sqrt(fused.reduce((s, v) => s + v * v, 0));
  const searchEmbStr = JSON.stringify(fused.map((v) => v / norm));

  // Build search strings for each expanded query
  const expandedEmbStrs = expandedEmbResults.map((r) => {
    const emb = r.data[0].embedding as number[];
    const n = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
    return JSON.stringify(emb.map((v) => v / n));
  });

  // Step 4: Detect equipment model — used to run a parallel model-boosted search
  const detectedModel = detectEquipmentModel(message);

  // Step 5: Semantic search — always run unfiltered (40), plus model-specific (20) if
  // a model is detected. Merging gives Cohere more diverse candidates while still
  // amplifying signal from model-specific chunks.
  const errorCode = extractErrorCode(message);
  const codePattern = errorCode ? `%${errorCode}%` : null;

  const [semanticRows, modelRows, keywordRows, fulltextRows, ...expandedRows] = await Promise.all([
    // Broad semantic search — large pool for Cohere to re-rank
    sql`
      SELECT url, title, chunk_text, chunk_index, source, page_number,
             (embedding <=> ${searchEmbStr}::vector) AS distance
      FROM fuel_tech_docs
      ORDER BY distance
      LIMIT 80
    ` as Promise<{ rows: ChunkRow[] }>,

    // Model-specific boost — prioritise exact equipment match
    detectedModel
      ? (sql`
          SELECT url, title, chunk_text, chunk_index, source, page_number,
                 (embedding <=> ${searchEmbStr}::vector) AS distance
          FROM fuel_tech_docs
          WHERE model ILIKE ${`%${detectedModel}%`}
          ORDER BY distance
          LIMIT 40
        ` as Promise<{ rows: ChunkRow[] }>)
      : Promise.resolve({ rows: [] as ChunkRow[] }),

    // Exact error/alarm code keyword match
    codePattern
      ? (sql`
          SELECT url, title, chunk_text, chunk_index, source, page_number, 0 AS distance
          FROM fuel_tech_docs
          WHERE chunk_text ILIKE ${codePattern}
          LIMIT 30
        ` as Promise<{ rows: ChunkRow[] }>)
      : Promise.resolve({ rows: [] as ChunkRow[] }),

    // Full-text search — catches multi-word phrases vector search misses
    (sql`
      SELECT url, title, chunk_text, chunk_index, source, page_number, 0 AS distance
      FROM fuel_tech_docs
      WHERE to_tsvector('english', coalesce(title,'') || ' ' || chunk_text)
            @@ plainto_tsquery('english', ${message})
      LIMIT 30
    ` as Promise<{ rows: ChunkRow[] }>).catch(() => ({ rows: [] as ChunkRow[] })),

    // Expanded query searches — 25 results each, run in parallel
    ...expandedEmbStrs.map((embStr) =>
      sql`
        SELECT url, title, chunk_text, chunk_index, source, page_number,
               (embedding <=> ${embStr}::vector) AS distance
        FROM fuel_tech_docs
        ORDER BY distance
        LIMIT 25
      ` as Promise<{ rows: ChunkRow[] }>
    ),
  ]);

  // Step 6: Merge — priority order: exact code hits → model-specific → full-text → semantic → expansions.
  // Dedup so Cohere sees each passage exactly once.
  const seenKeys = new Set<string>();
  const candidates: ChunkRow[] = [
    ...keywordRows.rows,
    ...fulltextRows.rows,
    ...modelRows.rows,
    ...semanticRows.rows,
    ...expandedRows.flatMap((r) => r.rows),
  ].filter((r) => {
    const key = `${r.url as string}::${r.chunk_text as string}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  // Step 7: Re-rank with Cohere (falls back to top-12 by distance if no key)
  const topRows = await rerankWithCohere(message, candidates);

  // Step 8: Fetch neighboring chunks — captures answers split across chunk boundaries.
  // For each of the top-ranked chunks, pull the chunk immediately before and after it
  // in the same document so Claude gets the full surrounding context.
  const alreadyFetched = new Set(
    topRows.map((r) => `${r.url as string}::${r.chunk_index as number}`)
  );
  const neighborPromises: Promise<{ rows: ChunkRow[] }>[] = [];

  for (const r of topRows) {
    const url = r.url as string;
    const ci = Number(r.chunk_index);
    for (const offset of [-2, -1, 1, 2]) {
      const neighborIdx = ci + offset;
      if (neighborIdx < 0) continue;
      const key = `${url}::${neighborIdx}`;
      if (alreadyFetched.has(key)) continue;
      alreadyFetched.add(key);
      neighborPromises.push(
        sql`
          SELECT url, title, chunk_text, chunk_index, source, page_number, 0 AS distance
          FROM fuel_tech_docs
          WHERE url = ${url} AND chunk_index = ${neighborIdx}
          LIMIT 1
        ` as Promise<{ rows: ChunkRow[] }>
      );
    }
  }

  const neighborResults = neighborPromises.length > 0 ? await Promise.all(neighborPromises) : [];
  const neighborRows: ChunkRow[] = neighborResults.flatMap((r) => r.rows);

  // Step 9: Web search — only when there are truly no good local results
  const topDistance = Number(semanticRows.rows[0]?.distance ?? 1);
  const hasAnyResults = candidates.length > 0;
  const shouldWebSearch = !hasAnyResults || topDistance > 0.8;

  let webResult: { summary: string; urls: string[] } = { summary: "", urls: [] };
  if (shouldWebSearch) {
    webResult = await openAiWebSearch(message);
  }

  // Step 10: Source URLs for citation panel
  const sourceUrls = Array.from(
    new Set([...topRows.map((r) => r.url as string), ...webResult.urls])
  );

  // Step 11: Figure lookup — only for visual questions, matched to exact retrieved pages
  const visualKeywords =
    /\b(diagram|wiring|schematic|illustration|figure|layout|photo|picture|install|location|where is|how to install|connect|cable|harness|drawing)\b/i;
  const wantsVisuals =
    visualKeywords.test(message) ||
    topRows.some((r) => visualKeywords.test(r.chunk_text as string));

  let figureUrls: string[] = [];
  if (wantsVisuals) {
    const pagePairs = topRows
      .filter((r) => Number(r.page_number) > 0)
      .map((r) => ({ url: r.url as string, page: Number(r.page_number) }));

    const pairsSeen = new Set<string>();
    for (const { url, page } of pagePairs) {
      if (figureUrls.length >= 4) break;
      const k = `${url}::${page}`;
      if (pairsSeen.has(k)) continue;
      pairsSeen.add(k);
      try {
        const figRows = await sql`
          SELECT image_url FROM fuel_tech_figures
          WHERE doc_url = ${url} AND page_number = ${page}
          LIMIT 1
        `;
        if (figRows.rows.length > 0) figureUrls.push(figRows.rows[0].image_url as string);
      } catch { /* skip */ }
    }
  }

  // Step 12: Build context — group top chunks + their neighbors by document.
  // Chunks are ordered by chunk_index within each document so Claude reads
  // them in sequence and can assemble multi-chunk procedures correctly.
  const docMap = new Map<
    string,
    { title: string; source: string; chunkMap: Map<number, string>; fromKeyword: boolean }
  >();

  const addToDocMap = (r: ChunkRow, fromKeyword: boolean) => {
    const url = r.url as string;
    const ci = Number(r.chunk_index);
    const text = r.chunk_text as string;
    if (!docMap.has(url)) {
      docMap.set(url, {
        title: r.title as string,
        source: r.source as string,
        chunkMap: new Map([[ci, text]]),
        fromKeyword,
      });
    } else {
      const doc = docMap.get(url)!;
      if (!doc.chunkMap.has(ci)) doc.chunkMap.set(ci, text);
    }
  };

  for (const r of keywordRows.rows) {
    if (!topRows.find((tr) => tr.url === r.url)) continue;
    addToDocMap(r, true);
  }
  for (const r of topRows) addToDocMap(r, false);
  for (const r of neighborRows) addToDocMap(r, false);

  const dbContext = Array.from(docMap.entries())
    .map(([url, doc], i) => {
      const matchNote = doc.fromKeyword && errorCode ? ` [CONTAINS "${errorCode}"]` : "";
      const label = `[DOC ${i + 1}]${matchNote} ${(doc.source ?? "").toUpperCase()} — ${doc.title || "Untitled"}\nURL: ${url}`;
      const sortedChunks = Array.from(doc.chunkMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, text]) => text);
      return `${label}\n\n${sortedChunks.join("\n\n")}`;
    })
    .join("\n\n===\n\n");

  const contextParts: string[] = [];
  if (dbContext) contextParts.push(dbContext);
  if (webResult.summary) {
    const webLabel = hasAnyResults
      ? `[WEB SEARCH — supplemental, verify against your equipment manual]\n\n${webResult.summary}`
      : `[WEB SEARCH RESULTS — no local documentation found for this query]\n\n${webResult.summary}`;
    contextParts.push(webLabel);
  }
  const context = contextParts.join("\n\n===\n\n");

  const textContent = context
    ? `${detectedModel ? `Equipment model in question: **${detectedModel}**\n` : ""}${errorCode ? `Error/fault code in question: **${errorCode}**\n` : ""}${detectedModel || errorCode ? "\n" : ""}Context from documentation:\n\n${context}\n\n---\n\nQuestion: ${message}`
    : message;

  const userContent: Anthropic.MessageParam["content"] = imageBase64
    ? [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: (imageMediaType ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: imageBase64,
          },
        },
        { type: "text", text: textContent },
      ]
    : textContent;

  const messages: Anthropic.MessageParam[] = [
    ...(history as Anthropic.MessageParam[]),
    {
      role: "user",
      content: userContent,
    },
  ];

  // Step 13: Build source doc list with titles for the citation panel
  const sourceDocs = Array.from(docMap.entries()).map(([url, doc]) => ({
    url,
    title: (doc.title as string) || "Document",
    source: doc.source as string,
  }));
  for (const wu of webResult.urls) {
    if (!sourceDocs.find((d) => d.url === wu)) {
      sourceDocs.push({ url: wu, title: wu, source: "web" });
    }
  }

  // Step 14: Stream Claude response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "sources", urls: sourceUrls, docs: sourceDocs })}\n\n`
        )
      );

      if (figureUrls.length > 0) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "figures", urls: figureUrls })}\n\n`
          )
        );
      }

      try {
        let sysPrompt = guidedMode ? SYSTEM_PROMPT + GUIDED_MODE_ADDENDUM : SYSTEM_PROMPT;
        if (lang === "es") sysPrompt += SPANISH_ADDENDUM;

        const aiStream = anthropic.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 20000,
          thinking: { type: "adaptive" },
          system: sysPrompt,
          messages,
        });

        for await (const event of aiStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`
              )
            );
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Streaming error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: msg })}\n\n`
          )
        );
      }

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
