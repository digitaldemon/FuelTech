// Is the SHIPPED model calibrated? Measured against finished slates.
//
// NRFI_CALIB_SEED is applied as a flat logit shift to every prediction, so if
// its sign or size is wrong the whole board is pushed off the base rate -- and
// the verdict ladder is a set of fixed thresholds, so a systematic push moves
// picks across BET/LEAN/PASS lines for no reason connected to the game. The
// value is READ from app.jsx below (c.read("NRFI_CALIB_SEED")), never retyped;
// this header used to describe it as "+0.050, n = 4015, backtest-v5" long after
// the shipped seed had become -0.063 on 558 games, which is the same drift that
// once had desk-nrfi-backtest.js correcting predictions in the wrong direction.
//
// THIS SCRIPT WAS NOT SCORING THE SHIPPED MODEL UNTIL 2026-08-15, despite the
// first line of this file. It carried the same relative-URL fetch stub as eight
// other analysis scripts, so /api/desk/savant failed, ctx.awayPeri/homePeri came
// back null, and pitchSkillFactor returned exactly 1.00 on every game. That
// factor is the single largest source of movement in the model (~37% of it), so
// every calibration verdict this file produced before that date was fit to a
// model missing its dominant pitcher term. Statcast now arrives for real through
// nrfi-local-api.js. Treat any recorded number from an earlier run as void.
//
// LEAKAGE, STATED UP FRONT: scanNrfi's pitcher and team feeds are season-to-date
// and are not rewound, so a scan of a past date sees stats that include that
// date and everything after it. That inflates per-game discrimination (a pitcher
// who got shelled that day looks worse in the season line the model reads), so
// AUC/Brier here read better than the model would live. It does NOT much move
// the MEAN prediction level, which is the only thing a single scalar `c`
// corrects -- that is what this is for. Recent dates only, to keep the window
// where leakage is smallest.
const path = require("path");
const { loadDeskModel } = require("./nrfi-model-load");
const { installLocalApi } = require("./nrfi-local-api");

const DAYS = Number(process.argv[2] || 10);
const c = loadDeskModel();
const realFetch = global.fetch;
// Serves /api/desk/savant for real and refuses the rest loudly; see nrfi-local-api.js
const localApi = installLocalApi(c);

const iso = (d) => d.toISOString().slice(0, 10);
const lg = (p) => Math.log(p / (1 - p));
const ul = (x) => 1 / (1 + Math.exp(-x));
function wilson(k, n) {
  if (!n) return [0, 0];
  const p = k / n, z = 1.96, z2 = z * z;
  const cc = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n);
  return [cc - h, cc + h];
}
const pct = (x) => (x * 100).toFixed(1) + "%";

(async () => {
  const rows = [];
  // Yesterday backwards -- today's games are not graded yet.
  for (let i = 1; i <= DAYS; i++) {
    const d = iso(new Date(Date.now() - i * 864e5));
    let got;
    try { got = await c.scanNrfi(null, d); } catch (e) { console.error("  " + d + " failed: " + e.message); continue; }
    const usable = got.filter((r) => r.dataOk && Number.isFinite(r.pNRFI) && r.inning1runs != null && r.final);
    console.log("  " + d + "  " + String(usable.length).padStart(2) + "/" + got.length + " graded games");
    for (const r of usable) rows.push({ p: r.pNRFI, nrfi: r.inning1runs === 0, g: (r.awayAbbr || "?") + "@" + (r.homeAbbr || "?"), d });
  }
  if (rows.length < 20) { console.log("\nnot enough graded games (" + rows.length + ")"); process.exit(0); }

  const n = rows.length;
  const k = rows.filter((r) => r.nrfi).length;
  const meanP = rows.reduce((s, r) => s + r.p, 0) / n;
  const actual = k / n;
  const [lo, hi] = wilson(k, n);
  console.log("\n" + "=".repeat(72) + "\nLEVEL  (" + n + " graded games, last " + DAYS + " days)");
  console.log("  mean raw pNRFI:      " + pct(meanP));
  console.log("  actual NRFI rate:    " + pct(actual) + "  [" + pct(lo) + ", " + pct(hi) + "]");
  const need = lg(actual) - lg(meanP);
  console.log("  bias (actual - pred): " + ((actual - meanP) * 100 >= 0 ? "+" : "") + ((actual - meanP) * 100).toFixed(2) + "pp");
  console.log("  logit shift that would centre the model:  c = " + (need >= 0 ? "+" : "") + need.toFixed(4));
  const seed = c.read("NRFI_CALIB_SEED");
  console.log("  NRFI_CALIB_SEED currently ships:          c = " + (seed.c >= 0 ? "+" : "") + seed.c.toFixed(4) +
    "  (n=" + seed.n + ", " + seed.source + ")");
  const withSeed = rows.reduce((s, r) => s + ul(lg(r.p) + seed.c), 0) / n;
  console.log("  mean AFTER the shipped seed is applied:   " + pct(withSeed) +
    "   (" + ((withSeed - actual) * 100 >= 0 ? "+" : "") + ((withSeed - actual) * 100).toFixed(2) + "pp vs actual)");
  const sigLevel = meanP < lo || meanP > hi;
  console.log("  is the raw model off the base rate by more than noise? " + (sigLevel ? "YES" : "no"));

  /* ---- discrimination: does a higher number actually mean more NRFI? ---- */
  console.log("\n" + "=".repeat(72) + "\nRELIABILITY  (does the number mean anything?)");
  const sorted = [...rows].sort((a, b) => a.p - b.p);
  const BINS = 5, per = Math.ceil(n / BINS);
  console.log("  bucket        games   mean pred   actual NRFI      95% CI");
  let monotone = true, prevAct = -1;
  for (let i = 0; i < n; i += per) {
    const b = sorted.slice(i, i + per);
    if (!b.length) continue;
    const mp = b.reduce((s, r) => s + r.p, 0) / b.length;
    const ak = b.filter((r) => r.nrfi).length;
    const [l, h] = wilson(ak, b.length);
    if (ak / b.length < prevAct - 1e-9) monotone = false;
    prevAct = ak / b.length;
    console.log("  " + (pct(b[0].p) + ".." + pct(b[b.length - 1].p)).padEnd(15) +
      String(b.length).padStart(4) + "     " + pct(mp).padStart(7) + "     " +
      pct(ak / b.length).padStart(7) + "    [" + pct(l) + ", " + pct(h) + "]");
  }
  console.log("  buckets rise monotonically with the prediction: " + (monotone ? "YES" : "no"));

  const brier = rows.reduce((s, r) => s + Math.pow(r.p - (r.nrfi ? 1 : 0), 2), 0) / n;
  const brierBase = actual * (1 - actual);
  console.log("\n  Brier (raw model):        " + brier.toFixed(4));
  console.log("  Brier (always base rate): " + brierBase.toFixed(4));
  console.log("  skill vs base rate:       " + ((1 - brier / brierBase) * 100).toFixed(2) + "%" +
    (brier < brierBase ? "" : "   <- the model is WORSE than a constant"));
  // AUC: probability a random NRFI game is scored above a random YRFI game.
  const pos = rows.filter((r) => r.nrfi).map((r) => r.p), neg = rows.filter((r) => !r.nrfi).map((r) => r.p);
  let wins = 0;
  for (const a of pos) for (const b of neg) wins += a > b ? 1 : a === b ? 0.5 : 0;
  const auc = wins / (pos.length * neg.length);
  console.log("  AUC (leakage-inflated):   " + auc.toFixed(4) + "   (0.5 = coin flip)");
  console.log("\n  spread: " + pct(sorted[0].p) + " .. " + pct(sorted[n - 1].p) +
    "   sd " + Math.sqrt(rows.reduce((s, r) => s + Math.pow(r.p - meanP, 2), 0) / n).toFixed(4));
  // Printed unconditionally: a reader has to be able to tell which inputs the
  // model was actually handed. Empty when everything was reachable.
  const note = localApi.note();
  if (note) console.log(note);
  console.log("\n  Statcast peripherals: " + (localApi.served().includes("/api/desk/savant")
    ? "LIVE (pitchSkillFactor exercised)" : "!! NOT SERVED — skill term is pinned at 1.00, verdict is void"));
})().catch((e) => { console.error(e); process.exit(1); });
