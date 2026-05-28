import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const body = await req.json();
  const message = body.message;

  // Create thread
  const thread = await openai.beta.threads.create();

  // Add user message
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: message,
  });

  // Run assistant
  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: process.env.OPENAI_ASSISTANT_ID!,
  });

  // Wait for completion
  let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
  while (runStatus.status !== "completed") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
  }

  // Get messages
  const messages = await openai.beta.threads.messages.list(thread.id);

  const latestMessage = messages.data[0];

  return Response.json({
    reply:
      latestMessage.content[0].type === "text"
        ? latestMessage.content[0].text.value
        : "No response",
  });
}
