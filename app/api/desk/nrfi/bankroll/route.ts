import { requireDeskUser, readStore, writeStore } from "../../../../../lib/desk";

type BankrollSettings = {
  startingBankroll: number | null;
  riskLevel: string;
  growthSpeed: string;
  betCapPct: number | null;
  dayCapPct: number | null;
  anchorAt: number | null;
  createdAt: number;
  lastUpdated: number;
};

export async function GET(req: Request) {
  if (!(await requireDeskUser(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await readStore<BankrollSettings | null>("bankroll_settings", null);
  return Response.json({ settings });
}

export async function POST(req: Request) {
  if (!(await requireDeskUser(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 });
  const existing = await readStore<BankrollSettings | null>("bankroll_settings", null);
  const settings: BankrollSettings = {
    startingBankroll: body.startingBankroll ?? existing?.startingBankroll ?? null,
    riskLevel: body.riskLevel ?? existing?.riskLevel ?? "moderate",
    growthSpeed: body.growthSpeed ?? existing?.growthSpeed ?? "steady",
    betCapPct: body.betCapPct ?? existing?.betCapPct ?? null,
    dayCapPct: body.dayCapPct ?? existing?.dayCapPct ?? null,
    anchorAt: body.anchorAt ?? existing?.anchorAt ?? null,
    createdAt: existing?.createdAt ?? Date.now(),
    lastUpdated: Date.now(),
  };
  await writeStore("bankroll_settings", settings);
  return Response.json({ ok: true, settings });
}
