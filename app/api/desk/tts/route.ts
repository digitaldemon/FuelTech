// Azure neural TTS for the live callout — the cloud mouth. The client keeps
// its whole speech queue (staleness gates, dedupe, watchdogs) and only swaps
// where the audio comes from: a line is POSTed here, synthesized by Azure's
// neural voice, and played from the returned MP3. Unconfigured, GET reports so
// and the client never calls the synth path — the browser voice carries on.
import { requireDeskUser, readStore, writeStore } from "../../../../lib/desk";

type TtsCfg = { key: string; region: string; voice: string };

// Azure's most natural American male as of 2026 — override via POST {voice}.
const DEFAULT_VOICE = "en-US-AndrewMultilingualNeural";
// The callout's longest lines (a play description plus a settle verdict) sit
// well under this; anything bigger is not a callout line and is refused rather
// than billed.
const MAX_CHARS = 300;

/* Warm-instance cache: the callout repeats itself constantly ("94, foul.",
 * "ball. one and oh.") and a serverless instance that stays warm through an
 * inning can answer most lines without touching Azure at all. Keyed on
 * voice+text so a voice change cannot serve the old man's audio. */
const cache = new Map<string, ArrayBuffer>();
const CACHE_MAX = 500;

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");

export async function GET(req: Request) {
  if (!(await requireDeskUser(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await readStore<TtsCfg | null>("azure_tts", null);
  return Response.json({ configured: !!(cfg && cfg.key && cfg.region), voice: (cfg && cfg.voice) || DEFAULT_VOICE });
}

export async function POST(req: Request) {
  if (!(await requireDeskUser(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 });

  // Config save — {key, region, voice}, any subset, merged over what exists.
  if (body.key !== undefined || body.region !== undefined || body.voice !== undefined) {
    const existing = await readStore<TtsCfg | null>("azure_tts", null);
    const cfg: TtsCfg = {
      key: body.key ?? existing?.key ?? "",
      region: body.region ?? existing?.region ?? "eastus",
      voice: body.voice ?? existing?.voice ?? DEFAULT_VOICE,
    };
    await writeStore("azure_tts", cfg);
    cache.clear();
    return Response.json({ ok: true, configured: !!(cfg.key && cfg.region), voice: cfg.voice });
  }

  const text = String(body.text || "").trim().slice(0, MAX_CHARS);
  if (!text) return Response.json({ error: "No text" }, { status: 400 });
  const cfg = await readStore<TtsCfg | null>("azure_tts", null);
  if (!cfg || !cfg.key || !cfg.region)
    return Response.json({ error: "Azure TTS not configured — POST {key, region} first" }, { status: 409 });

  const voice = cfg.voice || DEFAULT_VOICE;
  const ck = voice + "|" + text;
  const hit = cache.get(ck);
  if (hit) return new Response(hit.slice(0), { headers: { "Content-Type": "audio/mpeg", "X-TTS-Cache": "hit" } });

  const ssml = "<speak version='1.0' xml:lang='en-US'><voice name='" + voice + "'>" + escapeXml(text) + "</voice></speak>";
  const r = await fetch("https://" + cfg.region + ".tts.speech.microsoft.com/cognitiveservices/v1", {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": cfg.key,
      "Content-Type": "application/ssml+xml",
      // 48kbps mono MP3: a one-second callout line is ~6KB — broadcast-clean
      // over any connection without buffering delay.
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "digital-demons-nrfi",
    },
    body: ssml,
  });
  if (!r.ok) return Response.json({ error: "azure " + r.status }, { status: 502 });
  const buf = await r.arrayBuffer();
  cache.set(ck, buf);
  if (cache.size > CACHE_MAX) { const k = cache.keys().next().value; if (k !== undefined) cache.delete(k); }
  return new Response(buf.slice(0), { headers: { "Content-Type": "audio/mpeg", "X-TTS-Cache": "miss" } });
}
