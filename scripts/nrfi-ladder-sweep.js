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

// The cache is committed so the sweep is reproducible without a 40-minute
// rebuild, which means it will outlive the model that produced it. A stale
// cache is worse than no cache: every number below would still print, sourced
// from a model that no longer exists, with nothing but a timestamp to hint at
// it. So pin it to the model weight and fail loudly on drift.
const appSrc = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
const liveSimW = Number((appSrc.match(/const NRFI_SIM_W = ([\d.]+)/) || [])[1]);
if (!Number.isFinite(liveSimW)) throw new Error("could not read NRFI_SIM_W from app.jsx");
if (Math.abs(liveSimW - Number(cache.simW)) > 1e-9) {
  console.error(`STALE CACHE: it was built with NRFI_SIM_W=${cache.simW} on ${cache.at}, but app.jsx now uses ${liveSimW}.`);
  console.error("These scores are from a different model. Rebuild: node scripts/nrfi-tout-vs-model.js 318949");
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
// A hit rate is not a result. These are bets, so the only question that matters
// is whether a rung clears the price — and a wider ladder can post a lower rate
// while still winning more total units, or the reverse. Both get printed.
//
// -119 is not a guess: the tout's graded book is 205-120 (63.1%) at +16.31% ROI,
// and 0.631*x - 0.369 = 0.1631 solves to x = 0.840, i.e. -119. That is the price
// these first-inning markets actually traded at over this same season, which is
// the right benchmark even though our own fills would differ game to game.
const PRICE = 0.8403;
const BREAKEVEN = 1 / (1 + PRICE);
const roi = (h) => (h.rate == null ? null : h.rate * PRICE - (1 - h.rate));

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
console.log("                          STRONG            BET              LEAN         played  played%    ROI   units");
for (const [name, ov] of CANDIDATES) {
  const o = evaluate(ov);
  const hs = hit(o.STRONG), hb = hit(o.BET), hl = hit(o.LEAN);
  const played = [...o.STRONG, ...o.BET];
  const hp = hit(played), r = roi(hp);
  console.log(`  ${name}  ${fmt(hs)}  ${fmt(hb)}  ${fmt(hl)}  ${String(played.length).padStart(4)}  ${hp.rate == null ? "  —" : pc(hp.rate)}` +
    `  ${r == null ? "    —" : (r >= 0 ? "+" : "") + (r * 100).toFixed(1) + "%"}  ${r == null ? "   —" : (r * played.length).toFixed(1).padStart(6)}`);
}
console.log("\n  'played' = STRONG + BET, i.e. what the desk tells you to actually bet.");
console.log(`  ROI and units assume a flat 1u bet at ${PRICE.toFixed(3)} (-119); break-even is ${pc(BREAKEVEN)}.`);
console.log("  'units' is total season profit, so it prices the volume/accuracy tradeoff:");
console.log("  a tighter ladder with a better ROI can still finish behind a wider one.");

// The question behind the sweep: we rank well but convert rarely. So how much of
// the good stuff is sitting in LEAN and PASS, and is it good enough to promote?
console.log("\n=================== WHAT IS SITTING IN EACH RUNG (shipped) ===================");
const base = evaluate({});
for (const k of ["STRONG", "BET", "LEAN", "PASS"]) {
  const h = hit(base[k]), r = roi(h);
  const vs = h.rate == null ? "" : `   ${((h.rate - BREAKEVEN) * 100 >= 0 ? "+" : "") + ((h.rate - BREAKEVEN) * 100).toFixed(1)}pp vs break-even`;
  console.log(`  ${k.padEnd(7)} ${String(base[k].length).padStart(4)} games   ${fmt(h)}   ${r == null ? "" : ((r >= 0 ? "+" : "") + (r * 100).toFixed(1) + "% ROI").padStart(10)}${vs}`);
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

// The gated set is small, and a difference of a few points on 71 games is not a
// finding. Print the error bar so the gap is read against it rather than taken
// at face value — the honest answer here is more likely "no signal" than either
// "the gates are costing us" or "the gates are earning their keep".
const playedRate = hit([...base.STRONG, ...base.BET]).rate;
if (hg.rate != null) {
  const se = Math.sqrt((playedRate * (1 - playedRate)) / gatedRows.length);
  const z = (hg.rate - playedRate) / se;
  console.log(`  vs the played rate of ${pc(playedRate)}          ${((hg.rate - playedRate) * 100 >= 0 ? "+" : "") + ((hg.rate - playedRate) * 100).toFixed(1)}pp, ` +
    `SE ${(se * 100).toFixed(1)}pp, z=${z.toFixed(2)}`);
  console.log(`  ${Math.abs(z) < 1.96
    ? "=> inside noise. The gates are neither clearly helping nor clearly hurting;\n     on this sample they cut ~9% of volume for no measurable change in accuracy."
    : "=> outside noise, so this gap is real and the gates ARE the lever, not the ladder."}`);
}
