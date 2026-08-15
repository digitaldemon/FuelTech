// What would moving the verdict ladder actually do?
//
//   node scripts/nrfi-ladder-sweep.js
//
// app.jsx:7320 says a threshold move is a betting decision, not a cleanup, and
// that nothing should be retuned without a backtest. This is that backtest. It
// exists to make the tradeoff explicit, NOT to pick a setting — the numbers
// below say what each ladder produces; which one you want depends on how much
// volume you'll accept for a point of hit rate, and that is not a code decision.
//
// It runs the REAL nrfiVerdict, not a threshold comparison on the probability.
// That matters: the verdict applies a consensus gate, a confidence gate and
// thin-arm penalties after the ladder, any of which can drop a game two rungs.
// Sweeping on `p` alone would promise volume the board never produces.
//
// TWO THINGS IT CANNOT SEE, both of which cut against lowering thresholds:
//
//   1. The value gate. nrfiVerdict PASSes anything under a 1.5pp edge to market
//      and sizes down on short juice. Reconstructing that needs historical
//      Kalshi prices, which are not on file. So every count here is an UPPER
//      BOUND on playable volume — the real board will show fewer.
//   2. Market anchoring. The live pMax comes from nrfiBlend(pcal, market),
//      which pulls toward the market price. Here there is no market, so pMax is
//      the calibrated model number alone, which is more extreme. That inflates
//      counts at high thresholds especially.
//
// Read the hit rates, treat the volumes as ceilings.
const fs = require("fs");
const path = require("path");
const { makeVerdict } = require("./nrfi-model-lib");

const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");
const pc = (x) => (x * 100).toFixed(1) + "%";

if (!fs.existsSync(CACHE)) {
  console.error("no cached scores — run: node scripts/nrfi-tout-vs-model.js 318949");
  process.exit(1);
}
const cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));
const games = [...new Map(cache.slates.flatMap(([, gs]) => gs).map((g) => [g.gamePk, g])).values()];
if (!games.length || games[0].aligned === undefined) {
  console.error("cache predates the verdict-gate fields — re-run nrfi-tout-vs-model.js to refresh it");
  process.exit(1);
}

// Shipped calibration. It is a monotone logit shift, so it cannot reorder games,
// but it DOES move them across absolute thresholds — which is the whole subject
// here, so it has to be applied rather than assumed away.
const seedC = Number((fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8")
  .match(/const NRFI_CALIB_SEED = \{ c: (-?[\d.]+)/) || [])[1]);
if (!Number.isFinite(seedC)) throw new Error("could not read NRFI_CALIB_SEED.c from app.jsx");
const { applyCalibration } = makeVerdict();
const CAL = { c: seedC, active: true };

// Rebuild the row nrfiVerdict expects. pMax is model-only (see caveat 2).
function rowFor(g) {
  const pcal = applyCalibration(g.p, CAL);
  const call = pcal >= 0.5 ? "NRFI" : "YRFI";
  return {
    pMax: Math.max(pcal, 1 - pcal) * 100, call,
    aligned: g.aligned, confidence: g.confidence,
    pitProfiles: { away: g.thinAway ? { sample: 0 } : { sample: 99 },
      home: g.thinHome ? { sample: 0 } : { sample: 99 } },
    awayPP: "away", homePP: "home", market: null,
    actual: g.actual,
  };
}
const rows = games.map(rowFor);

function evaluate(overrides) {
  const { nrfiVerdict } = makeVerdict(overrides);
  const out = { STRONG: [], BET: [], LEAN: [], PASS: [] };
  for (const r of rows) {
    const v = nrfiVerdict(r);
    if (v.thinPass) { out.PASS.push(r); continue; }
    out[v.strength].push({ ...r, side: v.side });
  }
  return out;
}
// A verdict is right when the side it called is what happened.
const hit = (arr) => {
  const w = arr.filter((r) => (r.side === "NRFI") === (r.actual === 1)).length;
  return { w, l: arr.length - w, rate: arr.length ? w / arr.length : null };
};
const fmt = (h) => `${String(h.w).padStart(3)}-${String(h.l).padStart(3)} ${h.rate == null ? "   —  " : pc(h.rate).padStart(6)}`;

console.log(`ladder sweep over ${rows.length} finished games (${cache.dates.length} slates, season ${cache.season})`);
console.log(`cache written ${cache.at}, model NRFI_SIM_W=${cache.simW}, calibration c=${seedC}`);
console.log(`overall NRFI base rate ${pc(rows.filter((r) => r.actual === 1).length / rows.length)}`);
console.log("\nVolumes are CEILINGS: the value gate against market price is not reconstructable here.");

const SHIPPED = { NRFI_STRONG_MIN: 63, NRFI_BET_MIN: 55, NRFI_LEAN_MIN: 52 };
const CANDIDATES = [
  ["shipped        63/55/52", {}],
  ["bet 54         63/54/52", { NRFI_BET_MIN: 54 }],
  ["bet 53         63/53/51", { NRFI_BET_MIN: 53, NRFI_LEAN_MIN: 51 }],
  ["bet 52         63/52/50", { NRFI_BET_MIN: 52, NRFI_LEAN_MIN: 50 }],
  ["strong 61      61/55/52", { NRFI_STRONG_MIN: 61 }],
  ["strong 60/53   60/53/51", { NRFI_STRONG_MIN: 60, NRFI_BET_MIN: 53, NRFI_LEAN_MIN: 51 }],
  ["tighter 65/57  65/57/53", { NRFI_STRONG_MIN: 65, NRFI_BET_MIN: 57, NRFI_LEAN_MIN: 53 }],
];

console.log("\n=================== LADDER CANDIDATES ===================");
console.log("                          STRONG            BET              LEAN         played  played%");
for (const [name, ov] of CANDIDATES) {
  const o = evaluate(ov);
  const hs = hit(o.STRONG), hb = hit(o.BET), hl = hit(o.LEAN);
  const played = [...o.STRONG, ...o.BET];
  const hp = hit(played);
  console.log(`  ${name}  ${fmt(hs)}  ${fmt(hb)}  ${fmt(hl)}  ${String(played.length).padStart(4)}  ${hp.rate == null ? "  —" : pc(hp.rate)}`);
}
console.log("\n  'played' = STRONG + BET, i.e. what the desk tells you to actually bet.");

// The question behind the sweep: we rank well but convert rarely. So how much of
// the good stuff is sitting in LEAN and PASS, and is it good enough to promote?
console.log("\n=================== WHAT IS SITTING IN EACH RUNG (shipped) ===================");
const base = evaluate({});
for (const k of ["STRONG", "BET", "LEAN", "PASS"]) {
  const h = hit(base[k]);
  console.log(`  ${k.padEnd(7)} ${String(base[k].length).padStart(4)} games   ${fmt(h)}`);
}
console.log("\n  If LEAN's hit rate is at or above BET's, the ladder is cutting in the wrong");
console.log("  place and the games being withheld are as good as the ones being played.");
console.log("  If LEAN is clearly worse, the ladder is doing its job and low volume is");
console.log("  the correct answer rather than a bug.");

// Where the gates — not the thresholds — are doing the cutting. If most losses
// of volume come from the consensus/confidence gates rather than the ladder,
// moving thresholds is the wrong lever entirely.
console.log("\n=================== LADDER vs GATES (shipped) ===================");
const { nrfiVerdict } = makeVerdict();
let ladderBet = 0, gated = 0;
const gatedRows = [];
for (const r of rows) {
  const raw = r.pMax >= SHIPPED.NRFI_BET_MIN;
  if (!raw) continue;
  ladderBet++;
  const v = nrfiVerdict(r);
  if (!(v.strength === "BET" || v.strength === "STRONG")) { gated++; gatedRows.push({ ...r, side: r.call }); }
}
console.log(`  games clearing the raw ${SHIPPED.NRFI_BET_MIN}% ladder        ${ladderBet}`);
console.log(`  ...then downgraded by the gates       ${gated} (${pc(gated / Math.max(1, ladderBet))})`);
const hg = hit(gatedRows);
console.log(`  those downgraded games actually went  ${fmt(hg)}`);
console.log("\n  If the downgraded games hit at or above the played rate, the gates are");
console.log("  costing volume without buying accuracy, and THEY are the lever — not the");
console.log("  ladder. If they hit clearly worse, they are earning their keep.");
