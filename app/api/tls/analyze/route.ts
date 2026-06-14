import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `You are a Veeder-Root TLS-450PLUS ATG diagnostic assistant used by fuel system field technicians.

The user will provide raw ATG terminal output from RS-232 serial commands. Analyze it and respond with:

1. **Summary** — one or two sentences on what the output shows overall.
2. **Active Alarms & Faults** — list every alarm code or fault condition found, explain what each means, and give the recommended corrective action in numbered steps. If none, say so clearly.
3. **Readings of Concern** — any tank levels, water levels, temperatures, or pressures outside normal range. Include the actual values from the output.
4. **Normal Items** — briefly confirm what looks good so the tech knows what to ignore.

Be specific. Reference exact alarm codes, tank numbers, sensor IDs, and numeric readings from the output. Do not guess at values not present in the output. If the output is incomplete or cut off, say so.`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { output?: string };
  const output = (body.output ?? "").trim();

  if (!output) {
    return Response.json({ error: "No output provided." }, { status: 400 });
  }
  if (output.length > 60_000) {
    return Response.json({ error: "Output too large — clear and re-run a single report." }, { status: 400 });
  }

  const stream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: `Analyze this ATG output:\n\n${output}` }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
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
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
