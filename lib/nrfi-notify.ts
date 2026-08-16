// Notification logic for NRFI picks — Telegram, email (Resend), SMS (Twilio).
// Dedup tracked in desk_store key "nrfi_notified" (array of notified IDs).
import { readStore, writeStore } from "./desk";

type PitcherProfile = {
  name?: string;
  hand?: string;
  sample?: number;
  cleanPct?: number;
  score?: number;
  grade?: string;
  rolling?: { l10?: { pct?: number; n?: number }; szn?: { pct?: number } };
};

type NotifyEntry = {
  id: string;
  game?: string;
  date?: string;
  call?: string;
  prob?: number;
  mktAtPick?: number | null;
  result?: string | null;
  thinPass?: boolean;
  source?: string;
  isBet?: boolean;
  strength?: string;
  awayPP?: string;
  homePP?: string;
  pitProfiles?: { away?: PitcherProfile; home?: PitcherProfile };
  method?: string;
  lineupUpdatedAt?: number;
};

/* Every sender returns whether it actually put a message on the wire.
 *
 * "skipped" is not "sent": a channel whose env vars are absent returns without
 * calling anything, and the dedup decision below has to be able to tell that
 * apart from a real delivery. Collapsing the two is how you get a desk that
 * marks a pick notified because two unconfigured channels no-opped while the
 * one configured channel threw. */
type Sent = "sent" | "skipped";

// ── Telegram ──────────────────────────────────────────────────────────────────
async function sendTelegram(text: string): Promise<Sent> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return "skipped";
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!r.ok) throw new Error("Telegram " + r.status + ": " + await r.text());
  return "sent";
}

// ── SMS (Twilio) ───────────────────────────────────────────────────────────────
async function sendSms(body: string): Promise<Sent> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const to = process.env.ALERT_TO_PHONE;
  if (!sid || !token || !from || !to) return "skipped";
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
    }
  );
  if (!r.ok) throw new Error("SMS " + r.status + ": " + await r.text());
  return "sent";
}

// ── Email (Resend) ─────────────────────────────────────────────────────────────
async function sendEmail(subject: string, html: string): Promise<Sent> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_TO_EMAIL;
  if (!key || !to) return "skipped";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "NRFI Desk <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!r.ok) throw new Error("Email " + r.status + ": " + await r.text());
  return "sent";
}

/* Fan a card out to its channels WITHOUT letting one failure void the others.
 *
 * This replaced a Promise.all, and the difference is not stylistic. The GET
 * route is a Vercel cron on a 10-minute tick, and the caller only records a
 * pick as notified when its send resolves. Under Promise.all, one channel
 * throwing rejected the whole send even though the other two had already
 * delivered — so the id never reached "nrfi_notified" and the next tick sent
 * the same card again through the channels that worked. A Twilio balance
 * running out, one bad ALERT_TO_PHONE, or an SMS rate limit therefore did not
 * cost you SMS; it cost you the same Telegram message and the same email every
 * ten minutes until the game resolved.
 *
 * `delivered` counts only channels that actually transmitted, which is what the
 * dedup rule below keys on. */
async function deliver(
  channels: [name: string, send: () => Promise<Sent>][]
): Promise<{ delivered: number; errors: string[] }> {
  const settled = await Promise.allSettled(channels.map(([, send]) => send()));
  let delivered = 0;
  const errors: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") { if (r.value === "sent") delivered++; }
    else errors.push(`${channels[i][0]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  });
  return { delivered, errors };
}

/* Mark a pick notified when at least one channel transmitted, OR when nothing
 * failed at all.
 *
 * The second clause is the all-skipped case — no channel is configured, so no
 * amount of retrying will ever deliver this card and leaving it unmarked just
 * means re-walking it every ten minutes forever. The first clause is the
 * partial-failure case: one delivery is enough, because the alternative is the
 * duplicate storm described above. Only a run where every configured channel
 * threw stays unmarked, which is exactly when a retry has something to gain. */
const shouldMark = (d: { delivered: number; errors: string[] }) =>
  d.delivered > 0 || d.errors.length === 0;

/* Commit ids to a dedup set WITHOUT clobbering a concurrent run's ids.
 *
 * This is the same duplicate-storm failure `deliver` above fixed, at a
 * different layer, and the shape is a plain lost update. The old code read the
 * set at the top of the notify function, then wrote `[...notified, ...sent]`
 * at the bottom — so the read-modify-write window spanned the ENTIRE delivery
 * loop: every pick, every channel, every network round trip to Telegram,
 * Twilio and Resend. Seconds, not milliseconds.
 *
 * Two callers overlap in that window by design. app/api/desk/nrfi/route.ts
 * fires runNrfiNotify() from POST without awaiting it, and the GET route is a
 * Vercel cron on a 10-minute tick. Interleave them and the second write is
 * computed from a snapshot taken before the first one landed:
 *
 *   POST reads [A] ─── sends B ──────────── writes [A,B]
 *   cron reads [A] ────────── sends C ───────────────── writes [A,C]
 *
 * B is now missing from the set, so the next tick re-sends a card the user has
 * already been alerted on — a phone buzz for a pick they are already holding.
 *
 * Re-reading immediately before the write cuts the window from the whole
 * delivery loop to a single round trip, and merging instead of overwriting
 * means whatever landed in between survives. This does NOT make the update
 * atomic — desk_store is plain read/write with no CAS (lib/desk.ts), so a true
 * fix is a jsonb `||` append done server-side in the ON CONFLICT clause. That
 * is a one-line SQL change, but it is unverifiable from here without database
 * credentials, and shipping untested SQL into the alert path to close a
 * millisecond window is the worse trade.
 *
 * The cap is safe rather than arbitrary: a pick can only be re-notified if it
 * is still in `nrfi_record`, and that is capped at 1000 newest-first by the
 * POST route. Ids are appended in the order picks are created, so keeping the
 * newest 3000 covers the entire re-notifiable window three times over. Without
 * it the set grew forever and was fully read and rewritten on every 10-minute
 * tick for the life of the deployment. */
const DEDUP_CAP = 3000;
async function commitNotified(key: string, ids: string[]): Promise<void> {
  const latest = await readStore<string[]>(key, []);
  const merged = [...new Set([...latest, ...ids])];
  await writeStore(key, merged.slice(-DEDUP_CAP));
}

// ── Message builders ───────────────────────────────────────────────────────────
function pitLine(p: PitcherProfile | undefined, name: string | undefined): string {
  if (!p) return name ?? "TBD";
  const hand = p.hand ? ` (${p.hand})` : "";
  const gradeTag = p.grade && p.grade !== "—" ? ` [${p.grade}]` : "";
  const szn = p.rolling?.szn?.pct != null ? `${Math.round(p.rolling.szn.pct)}%` : (p.cleanPct != null ? `${Math.round(p.cleanPct)}%` : null);
  const l10n = p.rolling?.l10?.n ?? 0;
  const l10pct = l10n >= 3 && p.rolling?.l10?.pct != null ? Math.round(p.rolling.l10.pct) : null;
  const sznNum = p.rolling?.szn?.pct != null ? p.rolling.szn.pct : (p.cleanPct ?? null);
  const arrow = l10pct != null && sznNum != null
    ? (l10pct - sznNum >= 10 ? " ↑" : l10pct - sznNum <= -10 ? " ↓" : "")
    : "";
  const clean = szn ? `${szn} clean` : "";
  const recent = l10pct != null ? `L10 ${l10pct}%${arrow}` : "";
  const stats = [clean, recent].filter(Boolean).join(" · ");
  return `${name ?? p.name ?? "TBD"}${hand}${gradeTag}${stats ? " — " + stats : ""}`;
}

function pitLineHtml(p: PitcherProfile | undefined, name: string | undefined): string {
  if (!p) return `<b>${name ?? "TBD"}</b>`;
  const hand = p.hand ? ` <span style="color:#64748b">(${p.hand})</span>` : "";
  const gradeColor = p.score != null ? (p.score >= 74 ? "#22c55e" : p.score >= 52 ? "#f59e0b" : "#ef4444") : "#64748b";
  const gradeTag = p.grade && p.grade !== "—" ? ` <span style="color:${gradeColor};font-weight:800">${p.grade}</span>` : "";
  const szn = p.rolling?.szn?.pct != null ? Math.round(p.rolling.szn.pct) : (p.cleanPct != null ? Math.round(p.cleanPct) : null);
  const l10n = p.rolling?.l10?.n ?? 0;
  const l10pct = l10n >= 3 && p.rolling?.l10?.pct != null ? Math.round(p.rolling.l10.pct) : null;
  const arrow = l10pct != null && szn != null
    ? (l10pct - szn >= 10 ? `<span style="color:#22c55e"> ↑</span>` : l10pct - szn <= -10 ? `<span style="color:#ef4444"> ↓</span>` : "")
    : "";
  const sznTag = szn != null ? `<span style="color:#94a3b8">${szn}%</span>` : "";
  const l10Tag = l10pct != null ? `L10 <b>${l10pct}%</b>${arrow}` : "";
  const stats = [sznTag ? `SZN ${sznTag}` : "", l10Tag].filter(Boolean).join(" · ");
  return `<b>${name ?? p.name ?? "TBD"}</b>${hand}${gradeTag}${stats ? `  <span style="color:#64748b;font-size:12px">${stats}</span>` : ""}`;
}

function buildCard(e: NotifyEntry) {
  const isStrong = e.strength === "STRONG";
  const tier = isStrong ? "🔥 STRONG" : "✅ BET";
  const tierPlain = isStrong ? "STRONG" : "BET";
  const accent = isStrong ? "#f59e0b" : "#22c55e";
  const pct = e.prob != null ? `${e.prob}%` : "—";
  const mkt = e.mktAtPick != null ? `${e.mktAtPick}¢ NO` : "—";
  const game = e.game ?? e.date ?? e.id;
  const pp = e.pitProfiles;
  const awayLine = pitLine(pp?.away, e.awayPP);
  const homeLine = pitLine(pp?.home, e.homePP);

  const telegram = [
    `${tier} <b>NRFI</b>`,
    `━━━━━━━━━━━━━━━`,
    `🏟 <b>${game}</b>`,
    ``,
    `📊 Model: <b>${pct}</b>   💰 Market: <b>${mkt}</b>`,
    ``,
    `⚾ ${awayLine}`,
    `⚾ ${homeLine}`,
    ``,
    `<a href="https://fueltechaipro.com/desk">View Desk →</a>`,
  ].join("\n");

  const sms = `NRFI ${tierPlain} | ${game} | ${pct} model / ${mkt} | ${e.awayPP ?? "?"} vs ${e.homePP ?? "?"} | fueltechaipro.com/desk`;

  const emailHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;background:#0f172a;color:#f1f5f9;border-radius:12px;overflow:hidden;margin:0 auto">
  <div style="background:${accent};padding:10px 20px;display:flex;align-items:center;gap:8px">
    <span style="font-size:12px;font-weight:800;letter-spacing:2px;color:#000">NRFI ${tierPlain}</span>
  </div>
  <div style="padding:20px 20px 8px">
    <div style="font-size:22px;font-weight:700;margin-bottom:4px">${game}</div>
  </div>
  <div style="padding:0 20px 16px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr>
        <td style="padding:7px 0;color:#94a3b8;border-bottom:1px solid #1e293b">Model Prob</td>
        <td style="padding:7px 0;font-weight:700;text-align:right;border-bottom:1px solid #1e293b">${pct}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;color:#94a3b8;border-bottom:1px solid #1e293b">Market at Pick</td>
        <td style="padding:7px 0;font-weight:700;text-align:right;border-bottom:1px solid #1e293b">${mkt}</td>
      </tr>
    </table>
  </div>
  <div style="padding:0 20px 16px">
    <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#475569;margin-bottom:8px">PITCHERS</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #1e293b;width:24px;color:#94a3b8;vertical-align:top">✈</td>
        <td style="padding:6px 8px 6px 0;border-bottom:1px solid #1e293b">${pitLineHtml(pp?.away, e.awayPP)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#94a3b8;vertical-align:top">🏠</td>
        <td style="padding:6px 8px 6px 0">${pitLineHtml(pp?.home, e.homePP)}</td>
      </tr>
    </table>
  </div>
  <div style="padding:0 20px 20px">
    <a href="https://fueltechaipro.com/desk"
       style="display:inline-block;background:${accent};color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
      View Desk →
    </a>
  </div>
</div>`.trim();

  return { telegram, sms, emailHtml, subject: `NRFI ${tierPlain}: ${game}` };
}

// ── Lineup card ───────────────────────────────────────────────────────────────
function buildLineupCard(e: NotifyEntry) {
  const tierPlain = e.strength === "STRONG" ? "STRONG" : "BET";
  const accent = e.strength === "STRONG" ? "#f59e0b" : "#22c55e";
  const pct = e.prob != null ? `${e.prob}%` : "—";
  const mkt = e.mktAtPick != null ? `${e.mktAtPick}¢ NO` : "—";
  const game = e.game ?? e.id;
  const pp = e.pitProfiles;
  const awayLine = pitLine(pp?.away, e.awayPP);
  const homeLine = pitLine(pp?.home, e.homePP);

  const telegram = [
    `📋 LINEUPS IN — ${tierPlain} <b>NRFI</b>`,
    `━━━━━━━━━━━━━━━`,
    `🏟 <b>${game}</b>`,
    ``,
    `📊 Model: <b>${pct}</b>   💰 Market: <b>${mkt}</b>`,
    ``,
    `⚾ ${awayLine}`,
    `⚾ ${homeLine}`,
    ``,
    `<a href="https://fueltechaipro.com/desk">View Desk →</a>`,
  ].join("\n");

  const sms = `LINEUPS IN — NRFI ${tierPlain} | ${game} | ${pct} model / ${mkt} | fueltechaipro.com/desk`;

  const emailHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;background:#0f172a;color:#f1f5f9;border-radius:12px;overflow:hidden;margin:0 auto">
  <div style="background:${accent};padding:10px 20px">
    <span style="font-size:12px;font-weight:800;letter-spacing:2px;color:#000">LINEUPS IN — NRFI ${tierPlain}</span>
  </div>
  <div style="padding:20px 20px 8px">
    <div style="font-size:22px;font-weight:700;margin-bottom:4px">${game}</div>
    <div style="font-size:12px;color:#64748b">Simulation updated with posted lineups</div>
  </div>
  <div style="padding:0 20px 16px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr>
        <td style="padding:7px 0;color:#94a3b8;border-bottom:1px solid #1e293b">Model Prob</td>
        <td style="padding:7px 0;font-weight:700;text-align:right;border-bottom:1px solid #1e293b">${pct}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;color:#94a3b8;border-bottom:1px solid #1e293b">Market at Pick</td>
        <td style="padding:7px 0;font-weight:700;text-align:right;border-bottom:1px solid #1e293b">${mkt}</td>
      </tr>
    </table>
  </div>
  <div style="padding:0 20px 16px">
    <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#475569;margin-bottom:8px">PITCHERS</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #1e293b;width:24px;color:#94a3b8;vertical-align:top">✈</td>
        <td style="padding:6px 8px 6px 0;border-bottom:1px solid #1e293b">${pitLineHtml(pp?.away, e.awayPP)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#94a3b8;vertical-align:top">🏠</td>
        <td style="padding:6px 8px 6px 0">${pitLineHtml(pp?.home, e.homePP)}</td>
      </tr>
    </table>
  </div>
  <div style="padding:0 20px 20px">
    <a href="https://fueltechaipro.com/desk"
       style="display:inline-block;background:${accent};color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
      View Desk →
    </a>
  </div>
</div>`.trim();

  return { telegram, sms, emailHtml, subject: `LINEUPS IN — NRFI ${tierPlain}: ${game}` };
}

// ── Lineup notify ──────────────────────────────────────────────────────────────
export async function runLineupNotify(): Promise<{ sent: number; errors: string[] }> {
  const record = await readStore<NotifyEntry[]>("nrfi_record", []);
  const lineupNotified = await readStore<string[]>("nrfi_lineup_notified", []);
  const notifiedSet = new Set(lineupNotified);

  // Fire for BET/STRONG picks that upgraded to sim (lineup posted) and haven't been notified yet.
  const toNotify = record.filter(
    (e) =>
      !notifiedSet.has(e.id) &&
      !e.result &&
      !e.thinPass &&
      e.source !== "kalshi-import" &&
      e.method === "sim" &&
      e.lineupUpdatedAt != null &&
      (e.isBet === true || (e.prob ?? 0) >= 57)
  );

  const errors: string[] = [];
  const sent: string[] = [];

  for (const e of toNotify) {
    const card = buildLineupCard(e);
    // No SMS on the lineup ping — it is the second alert for a pick you have
    // already been told about, and it is not worth a per-message charge.
    const d = await deliver([
      ["telegram", () => sendTelegram(card.telegram)],
      ["email", () => sendEmail(card.subject, card.emailHtml)],
    ]);
    for (const msg of d.errors) errors.push(`${e.id}: ${msg}`);
    if (shouldMark(d)) sent.push(e.id);
  }

  if (sent.length) {
    await commitNotified("nrfi_lineup_notified", sent);
  }

  return { sent: sent.length, errors };
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function runNrfiNotify(
  candidates?: NotifyEntry[],
  opts?: { force?: boolean }
): Promise<{ sent: number; errors: string[] }> {
  const record = candidates ?? await readStore<NotifyEntry[]>("nrfi_record", []);
  const notified = await readStore<string[]>("nrfi_notified", []);
  const notifiedSet = new Set(notified);

  const toNotify = opts?.force
    ? record
    : record.filter(
        (e) =>
          !notifiedSet.has(e.id) &&
          !e.result &&
          !e.thinPass &&
          e.source !== "kalshi-import" &&
          (e.isBet === true || (e.prob ?? 0) >= 57)
      );

  const errors: string[] = [];
  const sent: string[] = [];

  for (const e of toNotify) {
    const card = buildCard(e);
    const d = await deliver([
      ["telegram", () => sendTelegram(card.telegram)],
      ["sms", () => sendSms(card.sms)],
      ["email", () => sendEmail(card.subject, card.emailHtml)],
    ]);
    for (const msg of d.errors) errors.push(`${e.id}: ${msg}`);
    if (shouldMark(d)) sent.push(e.id);
  }

  // A forced send is a test against an entry the caller supplied; it
  // deliberately ignores the dedup set on the way in, so writing to it on the
  // way out would silence the real alert for that game.
  if (sent.length && !opts?.force) {
    await commitNotified("nrfi_notified", sent);
  }

  return { sent: sent.length, errors };
}
