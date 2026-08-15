// Notification logic for NRFI picks — Telegram, email (Resend), SMS (Twilio).
// Dedup tracked in desk_store key "nrfi_notified" (array of notified IDs).
import { readStore, writeStore } from "./desk";

type PitcherProfile = {
  name?: string;
  hand?: string;
  sample?: number;
  cleanPct?: number;
  score?: number;
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
};

// ── Telegram ──────────────────────────────────────────────────────────────────
async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
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
}

// ── SMS (Twilio) ───────────────────────────────────────────────────────────────
async function sendSms(body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const to = process.env.ALERT_TO_PHONE;
  if (!sid || !token || !from || !to) return;
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
}

// ── Email (Resend) ─────────────────────────────────────────────────────────────
async function sendEmail(subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_TO_EMAIL;
  if (!key || !to) return;
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
}

// ── Message builders ───────────────────────────────────────────────────────────
function pitLine(p: PitcherProfile | undefined, name: string | undefined): string {
  if (!p) return name ?? "TBD";
  const hand = p.hand ? ` (${p.hand})` : "";
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
  return `${name ?? p.name ?? "TBD"}${hand}${stats ? " — " + stats : ""}`;
}

function pitLineHtml(p: PitcherProfile | undefined, name: string | undefined): string {
  if (!p) return `<b>${name ?? "TBD"}</b>`;
  const hand = p.hand ? ` <span style="color:#64748b">(${p.hand})</span>` : "";
  const szn = p.rolling?.szn?.pct != null ? Math.round(p.rolling.szn.pct) : (p.cleanPct != null ? Math.round(p.cleanPct) : null);
  const l10n = p.rolling?.l10?.n ?? 0;
  const l10pct = l10n >= 3 && p.rolling?.l10?.pct != null ? Math.round(p.rolling.l10.pct) : null;
  const arrow = l10pct != null && szn != null
    ? (l10pct - szn >= 10 ? `<span style="color:#22c55e"> ↑</span>` : l10pct - szn <= -10 ? `<span style="color:#ef4444"> ↓</span>` : "")
    : "";
  const sznTag = szn != null ? `<span style="color:#94a3b8">${szn}%</span>` : "";
  const l10Tag = l10pct != null ? `L10 <b>${l10pct}%</b>${arrow}` : "";
  const stats = [sznTag ? `SZN ${sznTag}` : "", l10Tag].filter(Boolean).join(" · ");
  return `<b>${name ?? p.name ?? "TBD"}</b>${hand}${stats ? `  <span style="color:#64748b;font-size:12px">${stats}</span>` : ""}`;
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
          (e.isBet === true || (e.prob ?? 0) >= 63)
      );

  const errors: string[] = [];
  const sent: string[] = [];

  for (const e of toNotify) {
    const card = buildCard(e);
    try {
      await Promise.all([
        sendTelegram(card.telegram),
        sendSms(card.sms),
        sendEmail(card.subject, card.emailHtml),
      ]);
      sent.push(e.id);
    } catch (err) {
      errors.push(`${e.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (sent.length) {
    await writeStore("nrfi_notified", [...notified, ...sent]);
  }

  return { sent: sent.length, errors };
}
