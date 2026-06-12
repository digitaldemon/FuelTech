import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@vercel/postgres";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are FuelTech AI Pro — an expert field assistant for gas station fuel systems, including dispensers, pumps, POS systems, EMV/payment compliance, underground storage tanks (UST), environmental monitoring, and maintenance procedures.

Answer questions clearly and directly. Cite source documents when relevant. If you don't know the answer, say so rather than guessing. Keep responses concise and actionable for field technicians.`;

export async function POST(req: Request) {
  const { message, history = [] } = (await req.json()) as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  // Embed the query
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: message,
  });
  const embStr = JSON.stringify(embRes.data[0].embedding);

  // Semantic search via pgvector
  const rows = await sql`
    SELECT url, title, chunk_text
    FROM fuel_tech_docs
    ORDER BY embedding <=> ${embStr}::vector
    LIMIT 6
  `;

  const sourceUrls = Array.from(new Set(rows.rows.map((r) => r.url as string)));

  const context = rows.rows
    .map((r, i) => `[${i + 1}]${r.title ? ` ${r.title}\n` : " "}${r.chunk_text}`)
    .join("\n\n---\n\n");

  const messages: Anthropic.MessageParam[] = [
    ...(history as Anthropic.MessageParam[]),
    {
      role: "user",
      content: context
        ? `Context from documentation:\n\n${context}\n\n---\n\nQuestion: ${message}`
        : message,
    },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "sources", urls: sourceUrls })}\n\n`
        )
      );

      try {
        const aiStream = anthropic.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          system: SYSTEM_PROMPT,
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
