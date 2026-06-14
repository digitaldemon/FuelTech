import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@vercel/postgres";

export const maxDuration = 120;

const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic();

type ChunkRow = {
  url: unknown; title: unknown; chunk_text: unknown;
  chunk_index: unknown; source: unknown; page_number: unknown; distance: unknown;
};

// Distil the raw ATG output into a focused search query for the documentation DB.
async function extractDiagnosticQuery(output: string): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are analyzing raw Veeder-Root TLS ATG serial port output. Extract: the ATG model if visible, every alarm/fault code present, and the main issues shown. Return a concise search query (2–4 sentences) for finding the relevant sections in a Veeder-Root service manual. Focus on exact alarm codes, fault types, and affected components.",
        },
        { role: "user", content: output.slice(0, 4000) },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });
    return res.choices[0].message.content ?? output.slice(0, 500);
  } catch {
    return output.slice(0, 500);
  }
}

async function rerankWithCohere(query: string, candidates: ChunkRow[]): Promise<ChunkRow[]> {
  const key = process.env.COHERE_API_KEY;
  if (!key || candidates.length <= 15) return candidates.slice(0, 15);
  try {
    const res = await fetch("https://api.cohere.com/v2/rerank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "rerank-v3.5",
        query,
        documents: candidates.map((c) => `${c.title as string}\n${c.chunk_text as string}`),
        top_n: 15,
        return_documents: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return candidates.slice(0, 15);
    const data = (await res.json()) as { results: { index: number }[] };
    return data.results.map((r) => candidates[r.index]);
  } catch {
    return candidates.slice(0, 15);
  }
}

const SYSTEM = `You are a Veeder-Root TLS-450PLUS ATG diagnostic assistant for fuel system field technicians.

You will receive raw ATG terminal output together with relevant sections pulled from official Veeder-Root and manufacturer service manuals. Use both to produce an accurate, actionable diagnosis.

Structure your response exactly as follows — use these exact headings:

**Summary**
One or two sentences on the overall ATG condition.

**Active Alarms & Faults**
For each alarm or fault code found in the output:
- State the exact code and its official name from the documentation
- Explain what it means and what caused it
- Numbered corrective action steps pulled from the manual
If no alarms are present, state "No active alarms detected."

**Readings of Concern**
Tank levels, water levels, temperatures, or pressures outside normal operating range — include the exact values from the output. If everything is within normal range, state that clearly.

**Normal Items**
Brief list of items confirmed normal so the tech knows what to ignore.

Be specific. Reference exact codes and readings from the output. Quote corrective steps verbatim from the documentation where available. Do not guess at values not in the output.`;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { output?: string };
  const output = (body.output ?? "").trim();

  if (!output) return Response.json({ error: "No output provided." }, { status: 400 });
  if (output.length > 60_000) {
    return Response.json(
      { error: "Output too large — clear and re-run a single report." },
      { status: 400 }
    );
  }

  // Step 1: Distil the terminal output into a focused DB search query
  const query = await extractDiagnosticQuery(output);

  // Step 2: Embed the query
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const emb = embRes.data[0].embedding as number[];
  const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
  const embStr = JSON.stringify(emb.map((v) => v / norm));

  // Pull all alarm codes from the output for exact keyword search
  const codeMatches = [...output.matchAll(/\b([A-Z]{1,4}[-_]?\d{3,6})\b/g)].map((m) => m[1]);
  const uniqueCodes = [...new Set(codeMatches)].slice(0, 5);

  // Step 3: Parallel DB search — semantic + keyword hits for each code + full-text
  const [semanticRows, fulltextRows, ...codeRows] = await Promise.all([
    sql`
      SELECT url, title, chunk_text, chunk_index, source, page_number,
             (embedding <=> ${embStr}::vector) AS distance
      FROM fuel_tech_docs
      ORDER BY distance
      LIMIT 60
    ` as Promise<{ rows: ChunkRow[] }>,

    (sql`
      SELECT url, title, chunk_text, chunk_index, source, page_number, 0 AS distance
      FROM fuel_tech_docs
      WHERE to_tsvector('english', coalesce(title,'') || ' ' || chunk_text)
            @@ plainto_tsquery('english', ${query})
      LIMIT 20
    `.catch(() => ({ rows: [] as ChunkRow[] }))) as Promise<{ rows: ChunkRow[] }>,

    ...uniqueCodes.map((code) =>
      sql`
        SELECT url, title, chunk_text, chunk_index, source, page_number, 0 AS distance
        FROM fuel_tech_docs
        WHERE chunk_text ILIKE ${`%${code}%`}
        LIMIT 15
      ` as Promise<{ rows: ChunkRow[] }>
    ),
  ]);

  // Step 4: Merge + dedup — exact code hits first for Cohere priority
  const seenKeys = new Set<string>();
  const candidates: ChunkRow[] = [
    ...codeRows.flatMap((r) => r.rows),
    ...fulltextRows.rows,
    ...semanticRows.rows,
  ].filter((r) => {
    const key = `${r.url as string}::${r.chunk_text as string}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  // Step 5: Cohere rerank
  const topRows = await rerankWithCohere(query, candidates);

  // Step 6: Neighbor chunks — context on either side of each top hit
  const alreadyFetched = new Set(
    topRows.map((r) => `${r.url as string}::${r.chunk_index as number}`)
  );
  const neighborPromises: Promise<{ rows: ChunkRow[] }>[] = [];
  for (const r of topRows) {
    const url = r.url as string;
    const ci = Number(r.chunk_index);
    for (const offset of [-1, 1]) {
      const ni = ci + offset;
      if (ni < 0) continue;
      const key = `${url}::${ni}`;
      if (alreadyFetched.has(key)) continue;
      alreadyFetched.add(key);
      neighborPromises.push(
        sql`
          SELECT url, title, chunk_text, chunk_index, source, page_number, 0 AS distance
          FROM fuel_tech_docs
          WHERE url = ${url} AND chunk_index = ${ni}
          LIMIT 1
        ` as Promise<{ rows: ChunkRow[] }>
      );
    }
  }
  const neighborRows = neighborPromises.length
    ? (await Promise.all(neighborPromises)).flatMap((r) => r.rows)
    : [];

  // Step 7: Build documentation context string
  const docMap = new Map<string, { title: string; chunkMap: Map<number, string> }>();
  const addDoc = (r: ChunkRow) => {
    const url = r.url as string;
    const ci = Number(r.chunk_index);
    const text = r.chunk_text as string;
    if (!docMap.has(url)) {
      docMap.set(url, { title: r.title as string, chunkMap: new Map([[ci, text]]) });
    } else {
      const d = docMap.get(url)!;
      if (!d.chunkMap.has(ci)) d.chunkMap.set(ci, text);
    }
  };
  for (const r of [...topRows, ...neighborRows]) addDoc(r);

  const docContext = Array.from(docMap.entries())
    .map(([url, doc], i) => {
      const chunks = Array.from(doc.chunkMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, t]) => t);
      return `[DOC ${i + 1}] ${doc.title || "Untitled"}\nURL: ${url}\n\n${chunks.join("\n\n")}`;
    })
    .join("\n\n===\n\n");

  // Step 8: Build final user message — docs first, then ATG output
  const userMessage = docContext
    ? `Relevant sections from manufacturer documentation:\n\n${docContext}\n\n---\n\nATG terminal output to diagnose:\n\n${output}`
    : `ATG terminal output to diagnose (no matching documentation found):\n\n${output}`;

  // Step 9: Stream Claude response
  const aiStream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of aiStream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
    cancel() {
      aiStream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
