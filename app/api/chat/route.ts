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
          "You are an expert fueling facility AI assistant specializing in Veeder-Root, Gilbarco, Wayne, UST systems, startup procedures, ATG troubleshooting, fueling facility maintenance, annual certifications, wiring diagrams, alarm troubleshooting, and dispenser diagnostics. You will be able to access any manuals online as well..",
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
