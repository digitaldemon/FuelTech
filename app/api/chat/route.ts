import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@vercel/postgres";
import { verifySession, getMembershipStatus, COOKIE_NAME } from "../../../lib/session";

export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Atlas — the AI field assistant inside FuelTech AI Pro, built for gas station fuel system technicians. You specialise in Gilbarco and Wayne dispensers (Encore, Eclipse, CRIND, FlexPay), Veeder-Root ATGs (TLS-300/350/450/450PLUS), Franklin Fueling and Red Jacket submersible pumps, EMV/payment compliance, UST monitoring, and site startup/commissioning.

## Core behavior

You are a senior technician who has read every manual. You think before you answer. You take your time to reason through the problem correctly rather than rushing to a generic response. When a problem could have multiple causes, work through them systematically — most likely first. When a procedure has sub-steps, include every one. When a spec matters, give the exact number.

## Troubleshooting format — follow exactly

**For troubleshooting or "why is X happening" questions:**
1. **Root cause summary** — one sentence stating the most likely cause based on the symptom.
2. **Diagnostic steps** — numbered list. Each step must include:
   - What to check/measure and exactly how to access it (menu path, terminal, component location).
   - What the expected result is (exact value, display reading, or visual indicator).
   - What the result means: "If you see X → proceed to step N" or "If you see Y → the fault is Z, fix is…"
3. **Fix** — the specific corrective action once the cause is confirmed, with exact settings, values, or parts.
4. **Verify** — how to confirm the fix worked (clear the alarm, recheck the reading, run a test).
5. **Escalate if** — one line on when to call Gilbarco/Veeder-Root support or replace hardware.

**For procedures ("how do I…" / "steps to…"):**
- Use a numbered list for every step, in exact order.
- Quote exact button names, menu paths, settings, and values directly from the documentation.
- Include every sub-step — do not skip or compress.
- State any prerequisite conditions before step 1 (e.g. "Unit must be in Programming mode", "Tanks must be empty").
- Never paraphrase steps — copy the exact sequence from the manual.

**For error/alarm/fault codes:**
- State the equipment model the code belongs to first.
- Give the exact fault description from the manual.
- List the recommended corrective action as numbered steps with pass/fail criteria for each check.
- Never apply one model's codes to a different model — they are not interchangeable.

**For specification lookups (voltages, pressures, part numbers, settings):**
- Give the exact value with units.
- State which model, revision, or configuration it applies to.

## Always

- No inline citations — source documents appear separately in the UI.
- If multiple documents cover the same topic for different models, address each model separately with a clear heading.
- If the provided documentation does not contain the answer, say exactly: "I don't have documentation covering that. Based on general knowledge: [answer] — verify against your official manual before proceeding."
- If [WEB SEARCH RESULTS] are present, use them and note the technician should verify against their official manual.
- **Never ask for clarification.** If the question is vague, state your assumption ("Assuming this is an Encore 700 with a standard CRIND configuration…") and answer for the most common scenario. A technician in the field needs an answer now, not a follow-up question.
- **Interpret field language.** "Won't turn on" = power/startup failure. "Keeps beeping" = active alarm. "Not reading" = sensor/communication fault. "Stuck on screen X" = UI/software issue. Match the intent to the technical topic.
- **Read every provided chunk before answering.** Documentation is split into chunks and the exact answer may be in any of them. Scan ALL [DOC N] sections — do not stop at the first partial match. If a procedure spans multiple consecutive chunks, assemble the full step sequence before presenting it.
- **Quote exact procedures verbatim.** Do not summarize, compress, or paraphrase numbered steps. Copy each step exactly as it appears in the source, including sub-steps, menu paths, and exact values. A missing step can cause a real equipment failure in the field.
- **Never truncate a procedure.** If a procedure has 15 steps, include all 15. Never write "continue following the procedure" or "repeat for remaining steps" — write every step out in full.
- **Think before concluding.** If a symptom has more than one plausible cause, reason through each one in order of likelihood before settling on a diagnosis. Do not jump to the most obvious answer if the symptom pattern suggests something more specific.`;

// ── Equipment model detection ──────────────────────────────────────────────────
// Ordered most-specific → least-specific. Shared with the scraper's MODEL_PATTERNS.
const MODEL_PATTERNS: [RegExp, string][] = [
  [/TLS[-\s]?450\s*PLUS/i,   "TLS-450PLUS"],
  [/TLS[-\s]?450[Ii][Ss]/i,  "TLS-450iS"],
  [/TLS[-\s]?450[Ii]/i,      "TLS-450i"],
  [/TLS[-\s]?450/i,          "TLS-450"],
  [/TLS[-\s]?350R/i,         "TLS-350R"],
  [/TLS[-\s]?350/i,          "TLS-350"],
  [/TLS[-\s]?300/i,          "TLS-300"],
  [/TLS[-\s]?4B/i,           "TLS-4B"],
  [/\bTLS[-\s]?4\b/i,        "TLS-4"],
  [/Encore\s*700S/i,         "Encore 700S"],
  [/Encore\s*700/i,          "Encore 700"],
  [/Encore\s*S\b/i,          "Encore S"],
  [/\bEncore\b/i,            "Encore"],
  [/\bEclipse\b/i,           "Eclipse"],
  [/\bCRIND\b/i,             "CRIND"],
  [/FlexPay\s*IV/i,          "FlexPay IV"],
  [/\bFlexPay\b/i,           "FlexPay"],
  [/\bPassport\b/i,          "Passport"],
  [/\bTS[-\s]?750\b/i,       "TS-750"],
  [/\bTS[-\s]?550\b/i,       "TS-550"],
  [/\bFE.?Petro\b/i,         "FE Petro"],
  [/\bRed\s*Jacket\b/i,      "Red Jacket"],
];

function detectEquipmentModel(query: string): string | null {
  for (const [re, model] of MODEL_PATTERNS) {
    if (re.test(query)) return model;
  }
  return null;
}

// ── HyDE — generate a hypothetical document excerpt to improve retrieval ───────
async function generateHypotheticalDoc(query: string): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a fuel system service manual. Write 3–4 sentences of technical documentation that directly answers the question, as if from an official Gilbarco or Veeder-Root manufacturer manual. Use exact technical terminology, part names, and procedure language found in service manuals.",
        },
        { role: "user", content: query },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });
    return res.choices[0].message.content ?? query;
  } catch {
    return query;
  }
}

// ── Query expansion — rephrase the question in documentation vocabulary ────────
// Techs describe problems in field language; manuals use technical terms.
// Three alternate phrasings increase the chance of a vocabulary match.
async function expandQuery(query: string): Promise<string[]> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            `You are a fuel system technical expert. Rewrite the user's question into exactly 5 alternative phrasings that use the vocabulary found in Gilbarco, Veeder-Root, and Franklin Fueling manufacturer service manuals and technical bulletins. Cover different angles: (1) exact manual terminology, (2) procedure/step phrasing, (3) symptom/diagnostic phrasing, (4) component/part name phrasing, (5) alarm/fault code phrasing. Return only the 5 phrasings separated by newlines, no numbering or extra text.`,
        },
        { role: "user", content: query },
      ],
      max_tokens: 250,
      temperature: 0.3,
    });
    const text = res.choices[0].message.content ?? "";
    return text.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 5);
  } catch {
    return [];
  }
}

// ── Cohere re-ranking (optional — gracefully skipped if no API key) ────────────
type ChunkRow = {
  url: unknown;
  title: unknown;
  chunk_text: unknown;
  chunk_index: unknown;
  source: unknown;
  page_number: unknown;
  distance: unknown;
};

async function rerankWithCohere(query: string, candidates: ChunkRow[]): Promise<ChunkRow[]> {
  const key = process.env.COHERE_API_KEY;
  if (!key || candidates.length <= 20) return candidates.slice(0, 20);

  try {
    const res = await fetch("https://api.cohere.com/v2/rerank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: "rerank-v3.5",
        query,
        // Send full chunk text — no truncation so Cohere sees the complete passage
        documents: candidates.map((c) => `${c.title as string}\n${c.chunk_text as string}`),
        top_n: 20,
        return_documents: false,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) { await res.body?.cancel(); return candidates.slice(0, 20); }
    const data = (await res.json()) as { results: { index: number }[] };
    return data.results.map((r) => candidates[r.index]);
  } catch {
    return candidates.slice(0, 20);
  }
}

// ── Web search fallback ────────────────────────────────────────────────────────
async function openAiWebSearch(query: string): Promise<{ summary: string; urls: string[] }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai as any).responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview" }],
      input: `Fuel system field technician question: ${query}`,
    });

    const summary: string = response.output_text ?? "";
    const urls: string[] = [];
    for (const block of response.output ?? []) {
      for (const content of block.content ?? []) {
        for (const ann of content.annotations ?? []) {
          if (ann.url) urls.push(ann.url as string);
        }
      }
    }
    return { summary, urls: [...new Set(urls)] };
  } catch {
    return { summary: "", urls: [] };
  }
}

// ── Error code detection ───────────────────────────────────────────────────────
function extractErrorCode(text: string): string | null {
  const patterns = [
    /\berr(?:or)?\s*[#:]?\s*([A-Z0-9]{2,8})\b/i,
    /\bfault\s*[#:]?\s*([A-Z0-9]{2,8})\b/i,
    /\balarm\s*[#:]?\s*([A-Z0-9]{2,8})\b/i,
    /\bcode\s*[#:]?\s*([A-Z0-9]{2,8})\b/i,
    /\b([A-Z]{1,4}[-_]\d{2,5})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

const GUIDED_MODE_ADDENDUM = `

## GUIDED MODE — ACTIVE

The technician is working hands-on with live equipment. Present ONE step at a time. Rules you MUST follow:

**Structure of every response in guided mode:**
1. **Step N — [Short title]:** The exact action to take. Be specific: name the exact menu, button, terminal, tool, or measurement. Include the exact expected result (what the display should show, what the meter should read, what the component should look like).
2. **What to look for:** Tell the technician exactly what a PASS looks like and what a FAIL looks like for this step.
3. **Your prompt:** End every response with one of these:
   - "Tell me what you see and I'll give you the next step." — when you need their observation to continue.
   - "Done? Say **next** and I'll continue." — for steps that are straightforward actions with no variable outcome.
   - "What does it show?" — when a specific reading or display state is needed to branch the diagnosis.

**Branching:**
- If the technician reports an unexpected result, STOP the numbered sequence. Diagnose the unexpected result first. Label it **⚠ Unexpected result — let's address this before continuing.** Resolve it, then resume with the next numbered step.
- If the technician reports a result that changes the diagnosis path, acknowledge it and re-route: "That tells me [interpretation]. We're going to skip to Step N because [reason]."

**Other rules:**
- Number steps sequentially across the entire conversation — do not restart numbering.
- On your FIRST response: one sentence confirming the procedure and equipment, then Step 1 only.
- NEVER show more than one step per response, no matter how simple the next step is.
- NEVER say "here are all the steps" — that defeats the purpose of guided mode.
- Keep each step short enough to hold in working memory while the tech has their hands on the equipment.`;

const SPANISH_ADDENDUM = `

## IDIOMA — ESPAÑOL
El técnico ha seleccionado respuestas en español. Responde SIEMPRE en español, sin importar el idioma de la pregunta. Mantén todos los términos técnicos (nombres de equipos, códigos de error, rutas de menú) exactamente como aparecen en los manuales de fábrica —en inglés—. Traduce todas las explicaciones, instrucciones y comentarios al español.`;

// ── Jurisdiction regulatory data ──────────────────────────────────────────────
const STATE_REGS: Record<string, { name: string; agency: string; regs: string }> = {
  AK: { name: 'Alaska',               agency: 'ADEC',         regs: '18 AAC 78 — ADEC UST Program. Follows EPA 40 CFR 280.' },
  AL: { name: 'Alabama',              agency: 'ADEM',         regs: 'ADEM Admin. Code R.335-6-15 — closely follows EPA 40 CFR 280.' },
  AR: { name: 'Arkansas',             agency: 'ADEQ',         regs: 'Ark. Code §8-7-801; ADEQ UST Program — closely follows EPA 40 CFR 280.' },
  AZ: { name: 'Arizona',              agency: 'ADEQ',         regs: 'ARS §49-1001 et seq.; ADEQ UST Section — closely tracks EPA 40 CFR 280; LUST corrective action under ADEQ.' },
  CA: { name: 'California',           agency: 'SWRCB / CUPA', regs: 'Health & Safety Code §25280–25299.8; 23 CCR §§2610–2660; 27 CCR §15000–16100. CARB Phase I/II EVR required on all dispensing equipment. Secondary containment performance standard: 0.1 gph. Annual line testing required. CUPA (Certified Unified Program Agency) is the local enforcement authority — requirements vary by county.' },
  CO: { name: 'Colorado',             agency: 'CDPHE',        regs: '6 CCR 1007-2, Part 264 — CDPHE UST Program. Closely tracks EPA 40 CFR 280; Colorado-specific release detection and corrective action requirements apply.' },
  CT: { name: 'Connecticut',          agency: 'CT DEEP',      regs: 'CGS §22a-449(d); RCSA §22a-449(d)-1 through -107. Enhanced release detection and secondary containment requirements exceed federal minimums.' },
  DC: { name: 'District of Columbia', agency: 'DOEE',         regs: '20 DCMR Ch. 56 — DOEE UST Program. Closely tracks EPA 40 CFR 280.' },
  DE: { name: 'Delaware',             agency: 'DNREC',        regs: '7 DE Admin. Code §1302 — DNREC UST Program. Closely tracks EPA 40 CFR 280.' },
  FL: { name: 'Florida',              agency: 'FDEP',         regs: '62-761 FAC (Petroleum Contamination) and 62-762 FAC (UST Systems). Secondary containment required since 1991. Monthly monitoring required. FDEP Discharge Reporting Rules and cleanup criteria are often stricter than federal minimums.' },
  GA: { name: 'Georgia',              agency: 'GA EPD',       regs: 'OCGA §12-13-1 et seq. — GA EPD UST Management Program. Closely follows EPA 40 CFR 280.' },
  HI: { name: 'Hawaii',               agency: 'HDOH',         regs: 'HAR §11-281 — Hawaii UST Program. Closely tracks EPA 40 CFR 280.' },
  IA: { name: 'Iowa',                 agency: 'Iowa DNR',     regs: '567 IAC Ch. 135 — Iowa UST Program. Closely tracks EPA 40 CFR 280.' },
  ID: { name: 'Idaho',                agency: 'IDEQ',         regs: 'IDAPA 58.01.07 — Idaho DEQ UST Program. Closely follows EPA 40 CFR 280.' },
  IL: { name: 'Illinois',             agency: 'OSFM / IEPA',  regs: '41 Ill. Admin. Code Part 170 (OSFM — installation/equipment) and 35 Ill. Admin. Code Part 734 (IEPA — LUST corrective action). UST oversight is split between OSFM and IEPA.' },
  IN: { name: 'Indiana',              agency: 'IDEM',         regs: '329 IAC 9 — IDEM UST Program. Closely follows EPA 40 CFR 280.' },
  KS: { name: 'Kansas',               agency: 'KDHE',         regs: 'KAR 28-44 — KDHE Bureau of Environmental Remediation. Closely follows EPA 40 CFR 280.' },
  KY: { name: 'Kentucky',             agency: 'KDEP',         regs: '401 KAR Ch. 42 — KDEP UST Branch. Closely follows EPA 40 CFR 280.' },
  LA: { name: 'Louisiana',            agency: 'LDEQ',         regs: 'LAC 33:XI — LDEQ UST Program. Closely follows EPA 40 CFR 280.' },
  MA: { name: 'Massachusetts',        agency: 'MassDEP',      regs: '310 CMR 80.00 (UST) and 310 CMR 40.00 (MCP). Massachusetts Contingency Plan (MCP) governs cleanup and is often stricter than EPA standards. Enhanced release prevention requirements apply.' },
  MD: { name: 'Maryland',             agency: 'MDE',          regs: 'COMAR 26.10.01–26.10.08 — MDE Oil Control Program. Enhanced secondary containment and spill bucket testing; annual spill containment and overfill device inspections required.' },
  ME: { name: 'Maine',                agency: 'MEDEP',        regs: '06-096 CMR Ch. 691 — Maine UST Program. Closely tracks EPA 40 CFR 280.' },
  MI: { name: 'Michigan',             agency: 'EGLE',         regs: 'MCL 324.21501 et seq.; R 29.2001 et seq. — EGLE UST Program. Enhanced facility inspection requirements and release reporting timelines apply.' },
  MN: { name: 'Minnesota',            agency: 'MPCA',         regs: 'Minn. Stat. §115C; Minn. R. 7150. Stricter than federal — 30-day monitoring, annual line testing, SIR or ATG with monthly printouts required. MPCA Petroleum Remediation Program.' },
  MO: { name: 'Missouri',             agency: 'MDNR',         regs: '10 CSR 26-2.010 et seq. — MDNR UST Program. Closely tracks EPA 40 CFR 280; Petroleum Storage Tank Insurance Fund (PSTIF) available for eligible cleanup costs.' },
  MS: { name: 'Mississippi',          agency: 'MDEQ',         regs: 'Miss. Code §49-17-401 et seq. — MDEQ UST Program. Closely follows EPA 40 CFR 280.' },
  MT: { name: 'Montana',              agency: 'MT DEQ',       regs: 'ARM 17.56.101 et seq. — Montana UST Program. Closely follows EPA 40 CFR 280.' },
  NC: { name: 'North Carolina',       agency: 'NCDEQ',        regs: '15A NCAC 02N .0100 et seq. — NCDEQ UST Section. Closely follows EPA 40 CFR 280; state-specific risk-based corrective action criteria apply.' },
  ND: { name: 'North Dakota',         agency: 'NDDH',         regs: 'N.D. Admin. Code Art. 33-24 — ND UST Program. Closely tracks EPA 40 CFR 280.' },
  NE: { name: 'Nebraska',             agency: 'NDEE',         regs: '178 NAC 12 — Nebraska UST Program. Closely tracks EPA 40 CFR 280.' },
  NH: { name: 'New Hampshire',        agency: 'NHDES',        regs: 'RSA 146-C; Env-Or 400 — NHDES UST Program. Enhanced groundwater protection standards apply.' },
  NJ: { name: 'New Jersey',           agency: 'NJDEP',        regs: 'N.J.A.C. 7:14B. Stricter than federal — mandatory secondary containment on all USTs including existing tanks, annual line leak testing, enhanced release detection. NJDEP requires more frequent monitoring and reporting than EPA 40 CFR 280 minimums.' },
  NM: { name: 'New Mexico',           agency: 'NMED',         regs: '20 NMAC 5.1 — New Mexico Petroleum Storage Tank Bureau. Closely follows EPA 40 CFR 280.' },
  NV: { name: 'Nevada',               agency: 'NDEP',         regs: 'NRS 459.740–459.999; NAC 459.900 et seq. — NDEP Bureau of Corrective Actions. Closely tracks EPA 40 CFR 280.' },
  NY: { name: 'New York',             agency: 'NYSDEC',       regs: '6 NYCRR Part 613 (effective 2015). Stricter than federal — spill prevention equipment testing every 3 years, overfill protection required, annual release detection certifications. Petroleum Bulk Storage (PBS) registration required. New York City may have additional Local Law requirements.' },
  OH: { name: 'Ohio',                 agency: 'BUSTR',        regs: 'OAC Ch. 1301:7-9 — BUSTR (Bureau of Underground Storage Tank Regulations) under Ohio Commerce Dept. Detailed release detection and SIR requirements. BUSTR conducts facility inspections — maintain an updated facility record.' },
  OK: { name: 'Oklahoma',             agency: 'OK DEQ',       regs: 'OAC 252:652 — Oklahoma UST Division. Closely follows EPA 40 CFR 280.' },
  OR: { name: 'Oregon',               agency: 'OR DEQ',       regs: 'OAR 340-150 — Oregon UST Program. Enhanced secondary containment requirements; cathodic protection testing required every 3 years.' },
  PA: { name: 'Pennsylvania',         agency: 'PADEP',        regs: '25 Pa. Code Ch. 245 — PADEP USTMO. Closely tracks EPA 40 CFR 280; corrective action governed by Act 2 (Land Recycling Program).' },
  RI: { name: 'Rhode Island',         agency: 'RIDEM',        regs: 'RIGL §46-12.3 — RIDEM UST Program. Closely tracks EPA 40 CFR 280.' },
  SC: { name: 'South Carolina',       agency: 'SCDHEC',       regs: 'S.C. Code §44-2-10 et seq.; R.61-92 — SCDHEC UST Program. Closely follows EPA 40 CFR 280.' },
  SD: { name: 'South Dakota',         agency: 'DENR',         regs: 'ARSD 74:36:07 — SD UST Program. Closely tracks EPA 40 CFR 280.' },
  TN: { name: 'Tennessee',            agency: 'TDEC',         regs: 'T.C.A. §68-215-101 et seq. — TDEC UST Program. Closely follows EPA 40 CFR 280.' },
  TX: { name: 'Texas',                agency: 'TCEQ',         regs: '30 TAC Chapter 334 — TCEQ Underground Storage Tanks program. Release detection at 30-day intervals. Secondary containment required for new and upgraded installations. Annual line testing required. Tier II annual reports required. TCEQ LPST (Leaking Petroleum Storage Tank) guidance governs corrective action. Phase I/II ESAs follow ASTM E1527-21.' },
  UT: { name: 'Utah',                 agency: 'DERR',         regs: 'UAC R311-200 et seq. — DERR UST Program. Closely tracks EPA 40 CFR 280.' },
  VA: { name: 'Virginia',             agency: 'VDEQ',         regs: '9 VAC 25-580-10 et seq. — Virginia UST Regulations. Closely tracks EPA 40 CFR 280; Virginia Risk-Based Corrective Action (VRBCA) applies for petroleum cleanups.' },
  VT: { name: 'Vermont',              agency: 'ANR',          regs: 'Vermont Environmental Protection Rules Ch. 13 — Petroleum Storage Tank Rules. Enhanced secondary containment and release detection requirements for new and upgraded tanks.' },
  WA: { name: 'Washington',           agency: 'Ecology',      regs: 'WAC 173-360A (effective 2018). Stricter than federal — enhanced secondary containment, annual spill bucket testing required, monthly monitoring records required. 3-year facility inspection cycles required.' },
  WI: { name: 'Wisconsin',            agency: 'WDNR / DSPS',  regs: 'Wis. Admin. Code ATCP Ch. 93 (DSPS — installation) and NR Ch. 700-754 (WDNR — corrective action). Detailed release detection requirements; NR 700 governs environmental remediation.' },
  WV: { name: 'West Virginia',        agency: 'WVDEP',        regs: '33 CSR 30 — WV UST Program. Closely tracks EPA 40 CFR 280.' },
  WY: { name: 'Wyoming',              agency: 'WDEQ',         regs: 'Wyoming Solid Waste and Hazardous Waste Rules Ch. 21 — WDEQ UST Program. Closely follows EPA 40 CFR 280.' },
};

function buildJurisdictionAddendum(stateAbbr: string): string {
  const st = STATE_REGS[stateAbbr.toUpperCase()];
  const stateDisplay = st ? `${st.name} (${stateAbbr.toUpperCase()})` : stateAbbr;
  const agencyLine = st ? `\nPrimary enforcement agency: **${st.agency}**` : '';
  const regDetails = st?.regs ?? `Follow EPA 40 CFR Part 280 as the minimum federal standard. Verify current requirements with your state environmental agency — many states have requirements that exceed federal minimums.`;

  return `

## JURISDICTION — ${stateDisplay}

The technician is working in ${stateDisplay}. Apply the following regulatory context to all compliance-related answers:

**Federal baseline (EPA 40 CFR Part 280):** Establishes national minimum standards for release detection, spill/overfill protection, corrosion protection, financial responsibility, and corrective action. States may only adopt requirements at least as stringent.${agencyLine}

**State-specific requirements:**
${regDetails}

**How to apply this context:**
- For questions about alarm reporting timelines, release detection methods, corrective action requirements, or regulatory documentation — apply the applicable state standard, not just the federal minimum.
- Cite specific rule numbers (e.g., "30 TAC §334.50" or "40 CFR §280.43") when referencing any requirement so the technician can verify directly.
- If a state standard is stricter than the federal floor, always apply the stricter requirement.
- If you don't have state-specific regulatory documentation, clearly state: "I don't have [state] regulatory documentation. Based on EPA 40 CFR 280 and general knowledge: [answer]. Verify current requirements with [agency]."`;
}

// ── Main route ────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // Session auth — only logged-in subscribers may consume API tokens
  const rawCookie = req.headers.get("cookie") ?? "";
  const tokenMatch = rawCookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const token = tokenMatch ? tokenMatch[1] : null;
  if (!token || !(await verifySession(token))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const memberInfo = await getMembershipStatus(token);
  if (!memberInfo || memberInfo.membershipExpired) {
    return Response.json({ error: "Subscription expired", expired: true }, { status: 403 });
  }

  const { message, history = [], guidedMode = false, imageBase64, imageMediaType, lang = "en", jurisdiction } = (await req.json().catch(() => ({}))) as {
    message?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    guidedMode?: boolean;
    imageBase64?: string;
    imageMediaType?: string;
    lang?: "en" | "es";
    jurisdiction?: string;
  };

  if (!message?.trim()) {
    return Response.json({ error: "No message provided." }, { status: 400 });
  }
  if (imageBase64 && imageBase64.length > 5_000_000) {
    return Response.json({ error: 'Image too large (max ~3.5 MB).' }, { status: 413 });
  }
  const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
  if (imageMediaType && !ALLOWED_MEDIA_TYPES.has(imageMediaType)) {
    return Response.json({ error: "Invalid image media type." }, { status: 400 });
  }

  // Step 1: Generate HyDE + query expansions + embed original, all in parallel
  const [origEmbRes, hydeText, expandedQueries] = await Promise.all([
    openai.embeddings.create({ model: "text-embedding-3-small", input: message }),
    generateHypotheticalDoc(message),
    expandQuery(message),
  ]);

  // Step 2: Embed HyDE doc + all expanded queries in parallel
  const [hydeEmbRes, ...expandedEmbResults] = await Promise.all([
    openai.embeddings.create({ model: "text-embedding-3-small", input: hydeText.trim() || message }),
    ...expandedQueries.map((q) =>
      openai.embeddings.create({ model: "text-embedding-3-small", input: q })
    ),
  ]);

  // Step 3: Fuse original + HyDE embeddings, then re-normalize (improves recall)
  if (!origEmbRes.data.length || !hydeEmbRes.data.length) {
    return Response.json({ error: 'Embedding service unavailable — please try again.' }, { status: 502 });
  }
  const origEmb = origEmbRes.data[0].embedding as number[];
  const hydeEmb = hydeEmbRes.data[0].embedding as number[];
  const fused = origEmb.map((v, i) => (v + hydeEmb[i]) / 2);
  const norm = Math.sqrt(fused.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return Response.json({ error: 'Embedding error — please rephrase your question.' }, { status: 502 });
  const searchEmbStr = JSON.stringify(fused.map((v) => v / norm));

  // Build search strings for each expanded query (guard against empty data or zero-norm vectors)
  const expandedEmbStrs = expandedEmbResults
    .filter(r => r.data.length > 0)
    .map(r => {
      const emb = r.data[0].embedding as number[];
      const n = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
      if (n === 0) return null;
      return JSON.stringify(emb.map(v => v / n));
    })
    .filter((s): s is string => s !== null);

  // Step 4: Detect equipment model — used to run a parallel model-boosted search
  const detectedModel = detectEquipmentModel(message);

  // Step 5: Semantic search — always run unfiltered (40), plus model-specific (20) if
  // a model is detected. Merging gives Cohere more diverse candidates while still
  // amplifying signal from model-specific chunks.
  const errorCode = extractErrorCode(message);
  const codePattern = errorCode ? `%${errorCode}%` : null;

  const [semanticRows, modelRows, keywordRows, fulltextRows, ...expandedRows] = await Promise.all([
    // Broad semantic search — large pool for Cohere to re-rank
    sql`
      SELECT url, title, chunk_text, chunk_index, source, page_number,
             (embedding <=> ${searchEmbStr}::vector) AS distance
      FROM fuel_tech_docs
      ORDER BY distance
      LIMIT 80
    ` as Promise<{ rows: ChunkRow[] }>,

    // Model-specific boost — prioritise exact equipment match
    detectedModel
      ? (sql`
          SELECT url, title, chunk_text, chunk_index, source, page_number,
                 (embedding <=> ${searchEmbStr}::vector) AS distance
          FROM fuel_tech_docs
          WHERE model ILIKE ${`%${detectedModel}%`}
          ORDER BY distance
          LIMIT 40
        ` as Promise<{ rows: ChunkRow[] }>)
      : Promise.resolve({ rows: [] as ChunkRow[] }),

    // Exact error/alarm code keyword match
    codePattern
      ? (sql`
          SELECT url, title, chunk_text, chunk_index, source, page_number, 0 AS distance
          FROM fuel_tech_docs
          WHERE chunk_text ILIKE ${codePattern}
          LIMIT 30
        ` as Promise<{ rows: ChunkRow[] }>)
      : Promise.resolve({ rows: [] as ChunkRow[] }),

    // Full-text search — catches multi-word phrases vector search misses
    (sql`
      SELECT url, title, chunk_text, chunk_index, source, page_number, 0 AS distance
      FROM fuel_tech_docs
      WHERE to_tsvector('english', coalesce(title,'') || ' ' || chunk_text)
            @@ plainto_tsquery('english', ${message})
      LIMIT 30
    ` as Promise<{ rows: ChunkRow[] }>).catch(() => ({ rows: [] as ChunkRow[] })),

    // Expanded query searches — 25 results each, run in parallel
    ...expandedEmbStrs.map((embStr) =>
      sql`
        SELECT url, title, chunk_text, chunk_index, source, page_number,
               (embedding <=> ${embStr}::vector) AS distance
        FROM fuel_tech_docs
        ORDER BY distance
        LIMIT 25
      ` as Promise<{ rows: ChunkRow[] }>
    ),
  ]);

  // Step 6: Merge — priority order: exact code hits → model-specific → full-text → semantic → expansions.
  // Dedup so Cohere sees each passage exactly once.
  const seenKeys = new Set<string>();
  const candidates: ChunkRow[] = [
    ...keywordRows.rows,
    ...fulltextRows.rows,
    ...modelRows.rows,
    ...semanticRows.rows,
    ...expandedRows.flatMap((r) => r.rows),
  ].filter((r) => {
    const key = `${r.url as string}::${r.chunk_text as string}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  // Step 7: Re-rank with Cohere (falls back to top-12 by distance if no key)
  const topRows = await rerankWithCohere(message, candidates);

  // Step 8: Fetch neighboring chunks — captures answers split across chunk boundaries.
  // For each of the top-ranked chunks, pull the chunk immediately before and after it
  // in the same document so Claude gets the full surrounding context.
  const alreadyFetched = new Set(
    topRows.map((r) => `${r.url as string}::${r.chunk_index as number}`)
  );
  const neighborPromises: Promise<{ rows: ChunkRow[] }>[] = [];

  for (const r of topRows) {
    const url = r.url as string;
    const ci = Number(r.chunk_index);
    for (const offset of [-2, -1, 1, 2]) {
      const neighborIdx = ci + offset;
      if (neighborIdx < 0) continue;
      const key = `${url}::${neighborIdx}`;
      if (alreadyFetched.has(key)) continue;
      alreadyFetched.add(key);
      neighborPromises.push(
        sql`
          SELECT url, title, chunk_text, chunk_index, source, page_number, 0 AS distance
          FROM fuel_tech_docs
          WHERE url = ${url} AND chunk_index = ${neighborIdx}
          LIMIT 1
        ` as Promise<{ rows: ChunkRow[] }>
      );
    }
  }

  const neighborResults = neighborPromises.length > 0 ? await Promise.all(neighborPromises) : [];
  const neighborRows: ChunkRow[] = neighborResults.flatMap((r) => r.rows);

  // Step 9: Web search — only when there are truly no good local results
  const topDistance = Number(semanticRows.rows[0]?.distance ?? 1);
  const hasAnyResults = candidates.length > 0;
  const shouldWebSearch = !hasAnyResults || topDistance > 0.45;

  let webResult: { summary: string; urls: string[] } = { summary: "", urls: [] };
  if (shouldWebSearch) {
    webResult = await openAiWebSearch(message);
  }

  // Step 10: Source URLs for citation panel
  const sourceUrls = Array.from(
    new Set([...topRows.map((r) => r.url as string), ...webResult.urls])
  );

  // Step 11: Figure lookup — only for visual questions, matched to exact retrieved pages
  const visualKeywords =
    /\b(diagram|wiring|schematic|illustration|figure|layout|photo|picture|install|location|where is|how to install|connect|cable|harness|drawing)\b/i;
  const wantsVisuals =
    visualKeywords.test(message) ||
    topRows.some((r) => visualKeywords.test(r.chunk_text as string));

  let figureUrls: string[] = [];
  if (wantsVisuals) {
    const pagePairs = topRows
      .filter((r) => Number(r.page_number) > 0)
      .map((r) => ({ url: r.url as string, page: Number(r.page_number) }));

    const pairsSeen = new Set<string>();
    for (const { url, page } of pagePairs) {
      if (figureUrls.length >= 4) break;
      const k = `${url}::${page}`;
      if (pairsSeen.has(k)) continue;
      pairsSeen.add(k);
      try {
        const figRows = await sql`
          SELECT image_url FROM fuel_tech_figures
          WHERE doc_url = ${url} AND page_number = ${page}
          LIMIT 1
        `;
        if (figRows.rows.length > 0) figureUrls.push(figRows.rows[0].image_url as string);
      } catch { /* skip */ }
    }
  }

  // Step 12: Build context — group top chunks + their neighbors by document.
  // Chunks are ordered by chunk_index within each document so Claude reads
  // them in sequence and can assemble multi-chunk procedures correctly.
  const docMap = new Map<
    string,
    { title: string; source: string; chunkMap: Map<number, string>; fromKeyword: boolean }
  >();

  const addToDocMap = (r: ChunkRow, fromKeyword: boolean) => {
    const url = r.url as string;
    const ci = Number(r.chunk_index);
    const text = r.chunk_text as string;
    if (!docMap.has(url)) {
      docMap.set(url, {
        title: r.title as string,
        source: r.source as string,
        chunkMap: new Map([[ci, text]]),
        fromKeyword,
      });
    } else {
      const doc = docMap.get(url)!;
      if (!doc.chunkMap.has(ci)) doc.chunkMap.set(ci, text);
    }
  };

  for (const r of keywordRows.rows) {
    if (!topRows.find((tr) => tr.url === r.url)) continue;
    addToDocMap(r, true);
  }
  for (const r of topRows) addToDocMap(r, false);
  for (const r of neighborRows) addToDocMap(r, false);

  const dbContext = Array.from(docMap.entries())
    .map(([url, doc], i) => {
      const matchNote = doc.fromKeyword && errorCode ? ` [CONTAINS "${errorCode}"]` : "";
      const label = `[DOC ${i + 1}]${matchNote} ${(doc.source ?? "").toUpperCase()} — ${doc.title || "Untitled"}\nURL: ${url}`;
      const sortedChunks = Array.from(doc.chunkMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, text]) => text);
      return `${label}\n\n${sortedChunks.join("\n\n")}`;
    })
    .join("\n\n===\n\n");

  const contextParts: string[] = [];
  if (dbContext) contextParts.push(dbContext);
  if (webResult.summary) {
    const webLabel = hasAnyResults
      ? `[WEB SEARCH — supplemental, verify against your equipment manual]\n\n${webResult.summary}`
      : `[WEB SEARCH RESULTS — no local documentation found for this query]\n\n${webResult.summary}`;
    contextParts.push(webLabel);
  }
  const context = contextParts.join("\n\n===\n\n");

  const textContent = context
    ? `${detectedModel ? `Equipment model in question: **${detectedModel}**\n` : ""}${errorCode ? `Error/fault code in question: **${errorCode}**\n` : ""}${detectedModel || errorCode ? "\n" : ""}Context from documentation:\n\n${context}\n\n---\n\nQuestion: ${message}`
    : message;

  const userContent: Anthropic.MessageParam["content"] = imageBase64
    ? [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: (imageMediaType ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: imageBase64,
          },
        },
        { type: "text", text: textContent },
      ]
    : textContent;

  const messages: Anthropic.MessageParam[] = [
    ...(history as Anthropic.MessageParam[]),
    {
      role: "user",
      content: userContent,
    },
  ];

  // Step 13: Build source doc list with titles for the citation panel
  const sourceDocs = Array.from(docMap.entries()).map(([url, doc]) => ({
    url,
    title: (doc.title as string) || "Document",
    source: doc.source as string,
  }));
  for (const wu of webResult.urls) {
    if (!sourceDocs.find((d) => d.url === wu)) {
      sourceDocs.push({ url: wu, title: wu, source: "web" });
    }
  }

  // Step 14: Stream Claude response
  const encoder = new TextEncoder();

  let pendingAiStream: ReturnType<typeof anthropic.messages.stream> | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "sources", urls: sourceUrls, docs: sourceDocs })}\n\n`
        )
      );

      if (figureUrls.length > 0) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "figures", urls: figureUrls })}\n\n`
          )
        );
      }

      try {
        let sysPrompt = guidedMode ? SYSTEM_PROMPT + GUIDED_MODE_ADDENDUM : SYSTEM_PROMPT;
        if (lang === "es") sysPrompt += SPANISH_ADDENDUM;
        // Validate against STATE_REGS keys (2-letter abbr) — prevents prompt injection
        const rawJurisdiction = (jurisdiction ?? '').trim().toUpperCase();
        const safeJurisdiction = Object.prototype.hasOwnProperty.call(STATE_REGS, rawJurisdiction) ? rawJurisdiction : '';
        if (safeJurisdiction) sysPrompt += buildJurisdictionAddendum(safeJurisdiction);

        const aiStream = anthropic.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 20000,
          thinking: { type: "enabled", budget_tokens: 10000 },
          system: sysPrompt,
          messages,
        });
        pendingAiStream = aiStream;

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
      try { controller.close(); } catch { /* already closed by client cancel */ }
    },
    cancel() {
      pendingAiStream?.abort();
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
