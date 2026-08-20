// Bankroll Manager sim: runs the REAL planner math (sliced from app.jsx, same
// technique as desk-math-test.js) against LIVE production data — the current
// record, bankroll settings, and open positions — and checks the invariants
// that must hold for any slate the tab could ever render. The unit tests prove
// the math on synthetic rows; this proves the wiring on today's actual one.
//
// Run: ADMIN_SECRET=<secret> node scripts/nrfi-bankroll-sim.js [YYYYMMDD]
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
function slice(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  if (a === -1) throw new Error("start marker not found: " + startMarker);
  const b = src.indexOf(endMarker, a);
  if (b === -1) throw new Error("end marker not found after: " + startMarker);
  return src.slice(a, b + endMarker.length);
}
const code = [
  slice("function kellyNRFI(", "\n}"),
  slice("const NRFI_RISK_MULT = {", "};"),
  slice("function nrfiKalshiFee(", "\n}"),
  slice("function nrfiBetPlan(", "\n}"),
  slice("function nrfiTodayPnl(", "\n}"),
  slice("function bankrollDrawdown(", "\n}"),
  slice("const NRFI_STRONG_MIN = 63,", ";"),
].join("\n");
const { kellyNRFI, NRFI_RISK_MULT, nrfiKalshiFee, nrfiBetPlan, nrfiTodayPnl, bankrollDrawdown, NRFI_BET_MIN } =
  eval('"use strict";\n' + code + "\n;({ kellyNRFI, NRFI_RISK_MULT, nrfiKalshiFee, nrfiBetPlan, nrfiTodayPnl, bankrollDrawdown, NRFI_BET_MIN })");

const BASE = process.env.DESK_BASE || "https://www.fueltechaipro.com";
const SECRET = process.env.ADMIN_SECRET;
if (!SECRET) { console.error("Set ADMIN_SECRET (the x-admin-secret value) to run against production."); process.exit(2); }
const get = (p) => fetch(BASE + p, { headers: { "x-admin-secret": SECRET } }).then((r) => {
  if (!r.ok) throw new Error(p + " -> " + r.status);
  return r.json();
});

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + " - " + msg); if (!cond) fail++; };

(async () => {
  const [recBody, brBody, posBody] = await Promise.all([
    get("/api/desk/nrfi"), get("/api/desk/nrfi/bankroll"), get("/api/desk/nrfi/kalshi-positions").catch(() => null),
  ]);
  const rec = recBody.record || [];
  const st = brBody.settings || {};
  const history = brBody.history || [];
  const positions = posBody && !posBody.error ? posBody : { positions: [], totalExposure: 0 };

  const todayET = process.argv[2] || new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).replace(/-/g, "");
  // Same speed table the tab uses (labels only differ).
  const SPEED_MIN = { patient: 63, selective: 57, steady: 52, fast: 52, blitz: 50 };
  const minProb = SPEED_MIN[st.growthSpeed] ?? 52;
  const riskMult = NRFI_RISK_MULT[st.riskLevel] || NRFI_RISK_MULT.moderate;
  const bankroll = st.startingBankroll;

  // Rebuild candidate rows from the record's ungraded entries for the slate —
  // the same fields (prob, call, mktAtPick, strength) the client logs from its
  // own scan, so the sim's rows are the board's rows.
  const smoothFee = (price) => 0.07 * price * (1 - price);
  const rows = [];
  for (const e of rec) {
    if (e.date !== todayET || e.result || e.source === "kalshi-import" || e.skipped || e.thinPass) continue;
    if (!(e.mktAtPick > 0 && e.mktAtPick < 100) || !(e.prob > 0) || !e.call) continue;
    const tierOk = e.strength === "STRONG" || e.strength === "BET" || (e.strength === "LEAN" && minProb < NRFI_BET_MIN);
    if (!tierOk || e.prob < minProb) continue;
    const yesPrice = 100 - e.mktAtPick;
    const pNRFI = e.call === "NRFI" ? e.prob / 100 : 1 - e.prob / 100;
    const kelly = kellyNRFI(pNRFI, yesPrice, e.call);
    if (kelly == null) continue;
    const priceCents = e.call === "NRFI" ? e.mktAtPick : yesPrice;
    const price = priceCents / 100, f = smoothFee(price);
    rows.push({ key: e.id, kelly, confidence: e.confidence ?? null, p: e.prob / 100, priceCents, ret: (e.prob / 100 - price - f) / (price + f), game: e.game, call: e.call, strength: e.strength });
  }
  rows.sort((a, b) => b.ret - a.ret);
  console.log("slate " + todayET + ": " + rows.length + " candidate(s) at " + (st.growthSpeed || "steady") + "/" + (st.riskLevel || "moderate") + ", bankroll $" + (bankroll ?? "unset"));

  const todayPnl = nrfiTodayPnl(rec, todayET);
  const exposure = positions.totalExposure || 0;
  const dayCapFrac = (st.dayCapPct ?? 30) / 100, betCapFrac = (st.betCapPct ?? 12) / 100;
  const dayCapDollars = bankroll != null ? dayCapFrac * bankroll : null;
  const capLeft = dayCapDollars != null ? Math.max(0, dayCapDollars - exposure - todayPnl.stake) : null;
  const remaining = bankroll != null ? Math.max(0, bankroll - exposure) : null;
  const budget = capLeft != null ? Math.min(capLeft, remaining) : null;
  const stopLossDollars = st.dayStopPct > 0 && bankroll ? (st.dayStopPct / 100) * bankroll : null;
  const stopHit = stopLossDollars != null && todayPnl.pnl <= -stopLossDollars;

  const plan = nrfiBetPlan(stopHit ? [] : rows, {
    bankroll, budget, dayCapFrac, betCapFrac, riskMult,
    cashLimited: capLeft != null && remaining < capLeft - 1e-9, stakeMult: 1,
  });

  console.log("today P&L: " + (todayPnl.pnl >= 0 ? "+" : "") + "$" + todayPnl.pnl.toFixed(2) + " on " + todayPnl.bets + " settled · committed $" + (exposure + todayPnl.stake).toFixed(2)
    + (dayCapDollars != null ? " of $" + dayCapDollars.toFixed(0) + " cap" : "") + (stopHit ? " · STOP-LOSS HIT" : ""));
  for (const b of plan.bets) {
    const r = rows.find((x) => x.key === b.key);
    console.log("  BET  " + r.game + " " + r.call + " " + (b.contracts != null ? b.contracts + " @ " + b.priceCents + "c = $" + b.actualCost.toFixed(2) + " (fee $" + b.fee.toFixed(2) + ", EV +$" + b.evDollars.toFixed(2) + ")" : (b.frac * 100).toFixed(1) + "%"));
  }
  for (const s of plan.skips) {
    const r = rows.find((x) => x.key === s.key);
    console.log("  skip " + r.game + " — " + s.reason);
  }

  // Invariants — these must hold on ANY slate.
  const KNOWN = new Set(["no edge left after Kalshi fees", "no sizeable edge at current risk level", "day cap reached", "available cash used up", "sized stake is below one contract"]);
  ok(budget == null || plan.usedDollars <= budget + 1e-6, "used dollars within the day budget");
  ok(plan.bets.every((b) => b.contracts == null || (b.contracts >= 1 && Math.abs(b.fee - nrfiKalshiFee(b.contracts, b.priceDollars)) < 1e-9)), "every bet has >=1 contract and the exact taker fee");
  ok(plan.bets.every((b) => b.contracts == null || b.actualCost <= b.frac * bankroll + 1e-6), "no bet exceeds its own sized stake");
  ok(plan.bets.every((b) => b.evDollars == null || b.evDollars > 0), "no fee-negative bet made the plan");
  ok(plan.skips.every((s) => KNOWN.has(s.reason)), "every skip carries a known reason");
  ok(rows.every((r, i) => i === 0 || rows[i - 1].ret >= r.ret - 1e-12), "candidates ranked by net return per dollar");
  ok(!stopHit || plan.bets.length === 0, "stop-loss empties the plan");
  ok(Number.isFinite(todayPnl.pnl) && Number.isFinite(todayPnl.stake), "today P&L is finite");
  const dd = bankrollDrawdown(history);
  ok(history.length === 0 || (dd && Number.isFinite(dd.peak) && dd.curDD >= 0 && dd.maxDD >= dd.curDD - 1e-12), "drawdown stats are sane on the real history");

  console.log(fail ? fail + " FAILURES" : "ALL INVARIANTS HOLD");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
