import { requireDeskUser, readStore, writeStore } from "../../../../../lib/desk";

type BankrollSettings = {
  startingBankroll: number | null;
  riskLevel: string;
  growthSpeed: string;
  betCapPct: number | null;
  dayCapPct: number | null;
  anchorAt: number | null;
  liveSync: boolean;
  dayStopPct: number | null;
  streakBrake: boolean;
  createdAt: number;
  lastUpdated: number;
};

type Snapshot = { at: number; equity: number; cash: number | null; exposure: number | null };

const HISTORY_KEY = "bankroll_history";
const HISTORY_MAX = 2000;
const HISTORY_RETURN = 500;
// A snapshot earns storage by being new information: the first of its
// 10-minute window, or a real dollar move since the last one kept. Live sync
// posts every minute from every open tab; without this rule the store fills
// with identical rows.
const MIN_SPACING_MS = 10 * 60 * 1000;
const MIN_DELTA = 1;

const SETTINGS_FIELDS = ["startingBankroll", "riskLevel", "growthSpeed", "betCapPct", "dayCapPct", "anchorAt", "liveSync", "dayStopPct", "streakBrake"] as const;

export async function GET(req: Request) {
  if (!(await requireDeskUser(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await readStore<BankrollSettings | null>("bankroll_settings", null);
  const history = await readStore<Snapshot[]>(HISTORY_KEY, []);
  return Response.json({ settings, history: history.slice(-HISTORY_RETURN) });
}

export async function POST(req: Request) {
  if (!(await requireDeskUser(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 });

  const existing = await readStore<BankrollSettings | null>("bankroll_settings", null);
  let settings = existing;
  // A snapshot-only POST must not rewrite settings: lastUpdated doubles as the
  // compounding anchor for pre-anchor rows, so bumping it on every live tick
  // would silently move that anchor forward.
  if (SETTINGS_FIELDS.some((k) => body[k] !== undefined)) {
    settings = {
      startingBankroll: body.startingBankroll ?? existing?.startingBankroll ?? null,
      riskLevel: body.riskLevel ?? existing?.riskLevel ?? "moderate",
      growthSpeed: body.growthSpeed ?? existing?.growthSpeed ?? "steady",
      betCapPct: body.betCapPct ?? existing?.betCapPct ?? null,
      dayCapPct: body.dayCapPct ?? existing?.dayCapPct ?? null,
      anchorAt: body.anchorAt ?? existing?.anchorAt ?? null,
      liveSync: body.liveSync ?? existing?.liveSync ?? true,
      dayStopPct: body.dayStopPct ?? existing?.dayStopPct ?? 15,
      streakBrake: body.streakBrake ?? existing?.streakBrake ?? true,
      createdAt: existing?.createdAt ?? Date.now(),
      lastUpdated: Date.now(),
    };
    await writeStore("bankroll_settings", settings);
  }

  let snapshotSaved = false;
  const s = body.snapshot;
  if (s && typeof s.equity === "number" && isFinite(s.equity) && s.equity >= 0) {
    const history = await readStore<Snapshot[]>(HISTORY_KEY, []);
    const last = history[history.length - 1];
    const at = typeof s.at === "number" && s.at > (last?.at ?? 0) ? s.at : Date.now();
    if (!last || at - last.at >= MIN_SPACING_MS || Math.abs(s.equity - last.equity) >= MIN_DELTA) {
      history.push({
        at,
        equity: Math.round(s.equity * 100) / 100,
        cash: typeof s.cash === "number" && isFinite(s.cash) ? Math.round(s.cash * 100) / 100 : null,
        exposure: typeof s.exposure === "number" && isFinite(s.exposure) ? Math.round(s.exposure * 100) / 100 : null,
      });
      await writeStore(HISTORY_KEY, history.slice(-HISTORY_MAX));
      snapshotSaved = true;
    }
  }

  return Response.json({ ok: true, settings, snapshotSaved });
}
