import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Known Veeder-Root TLS function codes the AI can map to.
// Raw codes typed directly by the user bypass this and are sent as-is.
const SYSTEM = `You are a Veeder-Root TLS ATG serial command interpreter used by fuel system field technicians (supports TLS-350, TLS-350R, and TLS-450PLUS).

Given the user's natural-language request, identify the correct VR TLS function code to send over RS-232.

Known function codes:
- I10100  System setup report (complete console configuration, tank setup, alarm setpoints, probe types)
- I20100  In-tank inventory — all tanks (current fuel level, water level, temperature, ullage)
- I20100TT  In-tank inventory for one tank (TT = 01, 02, 03, 04, 05, 06)
- I20200  Delivery report (recent fuel deliveries for all tanks)
- I20200TT  Delivery report for one tank
- I20300  Shift report (shift-period inventory changes)
- I20500  In-tank status (gross/net volume, ullage, water, temp — formatted)
- I20600  Complete alarm history
- I20600MMDDYYYYMMDDYYYY  Alarm history for a specific date range
- I30100  System status (brief ATG health summary)

Rules:
1. If the user specifies a tank number, append it as two digits (e.g., "tank 2" → append "02").
2. If the user asks for a date range on alarm history, format dates as MMDDYYYY and append both (start then end).
3. Today's date is ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '')}.
4. If the request is ambiguous but leans toward a command, choose the most likely one and explain.
5. If the request cannot be mapped to any known command, set code to null and explain clearly.

Respond ONLY with valid JSON — no markdown, no commentary outside the object:
{
  "code": "I20100",
  "label": "In-Tank Inventory (all tanks)",
  "explanation": "Returns current fuel level, water level, temperature, and ullage for every tank."
}

Or when unknown:
{
  "code": null,
  "label": null,
  "explanation": "Could not match to a known command. Explanation of what to try."
}`;

// Note: no session auth here — this endpoint is also called by the Electron desktop app
// (FuelTech AI Console Connect) which uses machine-bound license keys, not web sessions.
// Cost is minimal: claude-haiku-4-5 with max 300 tokens per call.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const request: string = body.request ?? '';

  if (!request.trim()) {
    return Response.json({ code: null, label: null, explanation: 'No request provided.' });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: 'user', content: request }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
    const parsed = JSON.parse(raw);
    return Response.json(parsed);
  } catch {
    return Response.json(
      { code: null, label: null, explanation: 'Failed to interpret request. Try entering the VR function code directly (e.g. I20100).' },
      { status: 500 }
    );
  }
}
