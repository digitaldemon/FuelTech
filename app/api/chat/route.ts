import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message;

    // Create thread and try assistant first
    const thread = await openai.beta.threads.create();

    // Add user message to assistant thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID!,
    });

    // Wait for assistant run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(
      thread.id,
      run.id
    );

    while (
      runStatus.status !== "completed" &&
      runStatus.status !== "failed"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(
        thread.id,
        run.id
      );
    }

    // Get latest assistant message
    const messages = await openai.beta.threads.messages.list(thread.id);
    const latestMessage = messages.data[0];

    // Extract assistant reply
    const assistantReply =
      latestMessage &&
      latestMessage.content[0].type === "text"
        ? latestMessage.content[0].text.value
        : null;

    if (assistantReply) {
      return Response.json({ reply: assistantReply });
    }

    // Fallback: use Chat Completions
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a fueling facility expert specializing in Veeder-Root, Gilbarco, Wayne, Mag VFC, startup procedures, troubleshooting, and diagnostics.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const fallbackReply =
      completion.choices &&
      completion.choices.length > 0 &&
      completion.choices[0].message
        ? completion.choices[0].message.content
        : "No response";

    return Response.json({ reply: fallbackReply });
  } catch (error) {
    console.error(error);
    return Response.json({ reply: "An error occurred." });
  }
}
