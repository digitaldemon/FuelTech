import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
 export async function POST(req: Request) {
  const body = await req.json();

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You are FuelTech AI, an assistant for petroleum equipment technicians. Help troubleshoot TLS consoles, sensors, STPs, dispensers, and fueling equipment safely and professionally.",
      },
      {
        role: "user",
        content: body.message,
      },
    ],
  });

  return Response.json({
    reply: completion.choices[0].message.content,
  });
}
