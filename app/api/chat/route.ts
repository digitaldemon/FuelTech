import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TERMINAL_STATES = new Set([
  "completed",
  "failed",
  "cancelled",
  "expired",
  "incomplete",
]);

const MAX_POLL_MS = 120_000;

export async function POST(req: Request) {
  const body = await req.json();
  const { message, threadId: existingThreadId } = body;

  // Reuse the thread across turns so the assistant retains conversation context.
  // If no threadId is provided this is the start of a new conversation.
  let threadId: string = existingThreadId;
  if (!threadId) {
    const thread = await openai.beta.threads.create({
      tool_resources: {
        file_search: {
          vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID!],
        },
      },
    });
    threadId = thread.id;
  }

  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: message,
  });

  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: process.env.OPENAI_ASSISTANT_ID!,
  });

  // Poll with a hard timeout and handle all terminal states.
  const deadline = Date.now() + MAX_POLL_MS;
  let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

  while (!TERMINAL_STATES.has(runStatus.status)) {
    if (Date.now() > deadline) {
      await openai.beta.threads.runs.cancel(threadId, run.id).catch(() => {});
      return Response.json(
        { error: "Request timed out. Please try again.", threadId },
        { status: 504 }
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
  }

  if (runStatus.status !== "completed") {
    return Response.json(
      { error: `Assistant run ended with status: ${runStatus.status}`, threadId },
      { status: 500 }
    );
  }

  const messages = await openai.beta.threads.messages.list(threadId, {
    limit: 1,
    order: "desc",
  });

  const latest = messages.data[0];

  if (!latest || latest.content[0]?.type !== "text") {
    return Response.json({ reply: "No response", threadId });
  }

  const textContent = latest.content[0].text;

  // Collect unique file citations so the UI can show which documents were used.
  const citations = [
    ...new Set(
      textContent.annotations
        .filter(
          (a): a is OpenAI.Beta.Threads.FileCitationAnnotation =>
            a.type === "file_citation"
        )
        .map((a) => a.file_citation?.file_id ?? "")
        .filter(Boolean)
    ),
  ];

  // Strip the inline citation markers (e.g. 【4:0†source】) from the reply text.
  const reply = textContent.value.replace(/【\d+:\d+†[^】]+】/g, "").trim();

  return Response.json({ reply, threadId, citations });
}
