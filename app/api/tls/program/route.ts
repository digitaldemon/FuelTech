import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@vercel/postgres';

const client = new Anthropic();

async function isValidLicenseKey(key: string): Promise<boolean> {
  if (!key || !key.startsWith('FTAI-')) return false;
  const result = await sql`
    SELECT 1 FROM console_licenses
    WHERE license_key = ${key}
      AND active = true
      AND expires_at > NOW()
    LIMIT 1
  `;
  return result.rows.length > 0;
}

const SYSTEM = `You are an expert Veeder-Root ATG installation engineer analyzing engineering drawings for a fuel system field technician.

You will receive one or more of the following drawing types:
  • T-SHEET / SITE PLAN — shows tank locations, piping runs, dispenser positions, sump types
  • E5 / WIRING DIAGRAM — shows the VR console chassis bay layout with module types and slot-by-slot wiring
  • DETAIL SHEET — electrical details, sensor schedules, equipment schedules

════════════════════════════════════════════════════════════════
STANDARD VR BAY ASSIGNMENT SCHEME (use this when generating or
validating the bay layout — follow this order exactly):
════════════════════════════════════════════════════════════════

MAIN CONSOLE (up to 6 bays — each USM handles 8 inputs):

BAY 1 — TANK PROBES (USM):
  • Slots 1–N: "[Product Label] PROBE" for each tank
  • If DW site (≤4 tanks): also add "[Product] ANNULAR" in slots 5–8 of same bay
  • If DW site (>4 tanks): annular gets its own bay (BAY 2)
  • Typical probe labels: "REG UNL #1 PROBE", "PREM UNL #2 PROBE", "DIESEL #3 PROBE"

BAY 2 — ANNULAR / INTERSTITIAL (USM, only if DW AND >4 tanks):
  • Slots 1–N: "[Product Label] ANNULAR" for each tank
  • Only needed if annular couldn't fit in BAY 1

BAY 3 — FILL SUMPS (USM):
  Non-CA:  Slots 1–N: "[Product Label] FILL"
  CA only: Alternating pairs — "[Product] FILL SENSOR", "[Product] FILL HYDRO" per tank
           e.g. "REG UNL #1 FILL SENSOR", "REG UNL #1 FILL HYDRO", "PREM UNL #2 FILL SENSOR"...

BAY 4 — STP SUMPS / TURBINE SUMPS (USM):
  Non-CA:  Slots 1–N: "[Product Label] STP"
  CA only: Alternating pairs — "[Product] STP SENSOR", "[Product] STP HYDRO" per tank

BAY 5+ — DISPENSER SENSORS (USM, may span multiple bays @ 8 per bay):
  Non-CA:  "DISPENSER X/X" for each pair (e.g. "DISPENSER 1/2", "DISPENSER 3/4")
  CA only: Alternating — "DISPENSER X/X SENSOR", "DISPENSER X/X HYDRO" per pair

NEXT — VAPOR FLOW METERS (VIM, California EVR sites only):
  • One slot per dispenser pair: "X/X VAPOR FLOW METER"
  • e.g. "1/2 VAPOR FLOW METER", "3/4 VAPOR FLOW METER"

NEXT — DPLLD (F-M, California OR pressurized line sites):
  • One slot per product line: "DPLLD- [Product Label]"
  • e.g. "DPLLD- REG. UNL #1", "DPLLD- PREM. UNL #2", "DPLLD- DIESEL #3"

XB EXPANSION CONSOLE (bays labeled XB BAY 1, XB BAY 2...):
  • Used when main console capacity (6 bays) is exceeded
  • Mark isExpansion: true for all XB bays

════════════════════════════════════════════════════════════════
CALIFORNIA SITES — ADDITIONAL REQUIREMENTS:
════════════════════════════════════════════════════════════════
• hasHydroSensors: true — HYDRO slots for ALL sumps and dispenser pans
• hasVaporFlowMeters: true — VIM bay with one slot per dispenser pair
• hasDPLLD: true — DPLLD slot per product line
• Double-wall REQUIRED on all tanks, piping, and sumps
• ALL sensor slots come in pairs: primary discriminating + HYDRO
• Look for: "HYDRO", "VAPOR FLOW METER", "DPLLD", "VIM", "ARID INPUT"
• California indicators: state CA, SWRCB notes, vapor recovery equipment

════════════════════════════════════════════════════════════════
READING THE E5 WIRING DIAGRAM:
════════════════════════════════════════════════════════════════
• Each column = one bay (BAY 1, BAY 2, XB BAY 1, etc.)
• Header row of each column = module type (USM, F-M, VIM, T/H-M, ISD, E5-PLUS)
• Each numbered row = one input slot
• Read slot labels EXACTLY as printed — do not interpret or reformat
• "NOT USED", "SPARE", "N/U" are all valid slot states
• "HOOK IN" slots indicate manifolded (shared) tank connections
• The bayId should match exactly what's printed: "BAY 1", "XB BAY 2", etc.

════════════════════════════════════════════════════════════════
EXTRACT EVERYTHING LISTED BELOW — return as valid JSON only.
When a field CANNOT be determined from the drawings, include it
in the "questions" array instead of guessing or leaving it blank.
════════════════════════════════════════════════════════════════

{
  "consoleModel": "TLS-450PLUS",
  "projectNumber": "14472",
  "siteName": "Costco Gasoline — N Lincoln Ave",
  "siteAddress": "3600 N Lincoln Ave, Chicago, IL 60657",
  "siteState": "IL",
  "siteOwner": "Costco Wholesale",
  "sitePhone": "",
  "facilityId": "8980",

  "piping": {
    "wallType": "double",
    "material": "fiberglass",
    "notes": "4\" over 3\" DW fiberglass product piping"
  },
  "containment": {
    "dispenserSumps": "double",
    "turbineSumps": "double",
    "fillSumps": "double",
    "notes": ""
  },

  "tanks": [
    {
      "tankNum": 1,
      "label": "REG UNL #1",
      "product": "Unleaded Regular",
      "capacity": 10000,
      "diameter": 96,
      "wallType": "double",
      "probeType": "Magnetostrictive",
      "probeModel": "846380",
      "manifoldedWith": [],
      "notes": ""
    }
  ],

  "bays": [
    {
      "bayId": "BAY 1",
      "moduleType": "USM",
      "isExpansion": false,
      "slots": [
        { "num": 1, "label": "REG UNL #1 PROBE" },
        { "num": 2, "label": "PREM UNL #2 PROBE" },
        { "num": 3, "label": "DIESEL #3 PROBE" },
        { "num": 4, "label": "NOT USED" }
      ]
    },
    {
      "bayId": "XB BAY 1",
      "moduleType": "USM",
      "isExpansion": true,
      "slots": [
        { "num": 1, "label": "DISPENSER 17/18 SENSOR" }
      ]
    }
  ],

  "sensors": [
    { "type": "Magnetostrictive Probe", "model": "846380-XXX", "qty": 4, "location": "In-tank" },
    { "type": "360 Sump Sensor", "model": "794380-XXX", "qty": 8, "location": "Containment sumps" }
  ],

  "dispenserCount": 16,
  "dispenserPairs": ["1/2","3/4","5/6","7/8","9/10","11/12","13/14","15/16"],

  "hasDPLLD": true,
  "hasVaporFlowMeters": false,
  "hasHydroSensors": false,

  "releasePrevention": {
    "overfillProtection": "Automatic overfill prevention valves",
    "spillContainment": "Spill buckets at all fill points",
    "notes": ""
  },

  "engineerOfRecord": "",
  "drawingDate": "",

  "questions": [
    {
      "id": "dispenserCount",
      "field": "dispenserPairs",
      "question": "How many dispenser fueling positions (nozzles) are there, and what are the pairs? (e.g. 1/2, 3/4, 5/6, 7/8)",
      "type": "text",
      "context": "The site plan shows multiple dispensers but the exact count and pairing could not be read clearly."
    }
  ]
}

RULES:
- Extract slot labels EXACTLY as shown on the wiring diagram (e.g. "REG UNL #1 STP", "SPARE", "DISPENSER 1/2")
- Include ALL bays — both main console bays AND XB expansion bays
- Set isExpansion=true for any bay labeled "XB"
- If no E5 wiring diagram is provided, set bays:[] and add a question asking if you should auto-generate the bay layout from the site data
- dispenserPairs must be in "X/X" format (e.g. "1/2" not "1-2")
- siteState as 2-letter code ("CA", "IL", "TX", etc.)
- capacity in gallons (number, no commas); diameter in inches (0 if unknown)
- "questions" array must be empty [] if all data was successfully extracted
- Return ONLY the JSON object — no markdown, no commentary`;

export async function POST(req: Request) {
  const licenseKey = req.headers.get('x-license-key') ?? '';
  if (!(await isValidLicenseKey(licenseKey))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const pdfs: { name: string; data: string }[] = body.pdfs ?? [];

  if (!pdfs.length) {
    return Response.json({ error: 'No PDF data provided.' }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [
      ...pdfs.map((pdf) => ({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdf.data },
        title: pdf.name,
      })),
      {
        type: 'text',
        text: 'Analyze these engineering drawings and extract all ATG programming data. If the E5 wiring diagram is included, extract the exact bay/slot layout. For anything unclear, add a question to the questions array. Return JSON only.',
      },
    ];

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8096,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });

    const raw   = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(clean);
    return Response.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: `Failed to analyze drawings: ${msg}` }, { status: 500 });
  }
}
