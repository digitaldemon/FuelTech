// How much does the backtest cache move when NOTHING changes?
//
//   node scripts/nrfi-cache-noise.js <cacheA.json> <cacheB.json>
//
// This is the noise floor every other number in this directory has to clear,
// and until 2026-08-16 nobody had measured it.
//
// WHY IT EXISTS. modelSig pins the MODEL, and the whole point of that guard is
// that a cache built by different code is stale. What it cannot pin is the
// data, and the data turns out to move on its own. Two rebuilds five minutes
// apart, same commit, same modelSig 956697bbc201, same 1,282 games:
//
//   identical p   663
//   changed p     619   (48.3%)
//   changed >0.5pp 30
//   max |dp|      1.28pp
//
// The drift is uniform across the whole season — 33-73% of games on every
// slate from 2026-04-15 to 2026-08-15, mean |dp| about 0.18pp — so it is not
// live results arriving. April games cannot change. It is also far too large
// for floating-point summation order: 0.18pp is 1.8e-3, thirteen orders of
// magnitude above float noise. The fetch counters were byte-identical between
// the two runs (pit 2445/miss 121/api 0), so the disk-cached feeds behaved the
// same; the uncounted live fetchers (topOrder, travelRest, savant) are the
// remaining suspects, and topOrder in particular drops a batter silently from
// its weighted OBP whenever a hydrate response comes back short.
//
// WHAT IT MEANS FOR READING RESULTS. In the unit that matters — games the
// ladder actually plays — the same two runs differed by 7 games out of a
// 379-game union, 1.8%, with 0 side flips and 2 strength changes. So:
//
//   a backtest delta of fewer than ~7 plays, or ~2pp of hit rate on a
//   ~370-play slate, is INDISTINGUISHABLE from running the harness twice.
//
// That retroactively voids at least one comparison I made earlier the same
// day: the pitching-check neutralisation was "verified" by TRAIN 119->118 and
// TEST 103->100 plays across a rebuild. Both moves sit inside this floor. The
// change may well still be right — the argument for it was that its NRFI
// threshold was unreachable, which was measured directly — but the ladder
// delta was never evidence either way.
//
// Compare two caches you built yourself, e.g.:
//   cp scripts/nrfi-tout-vs-model.json /tmp/a.json
//   node scripts/nrfi-tout-vs-model.js
//   node scripts/nrfi-cache-noise.js /tmp/a.json scripts/nrfi-tout-vs-model.json
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("usage: node scripts/nrfi-cache-noise.js <cacheA.json> <cacheB.json>");
  console.error("       build the second one with: node scripts/nrfi-tout-vs-model.js");
  process.exit(2);
}
const [A, B] = args.map((f) => JSON.parse(fs.readFileSync(f, "utf8")));

/* Refuse to compare caches from different models.
 *
 * The whole question here is "how much moves when nothing changes". If the two
 * caches were built by different code, every difference is confounded and the
 * number this prints would be read as noise when it is signal. That is the
 * mistake this file exists to stop, so it must not make it itself. */
if (A.modelSig !== B.modelSig) {
  console.error(`different models: ${A.modelSig} vs ${B.modelSig}.`);
  console.error("This measures run-to-run noise, which only means something within one model.");
  console.error("Rebuild both caches from the same commit, or use nrfi-ladder-split.js to compare models.");
  process.exit(1);
}

const idx = (c) => new Map(c.slates.flatMap(([, gs]) => gs).map((g) => [g.gamePk, g]));
const ga = idx(A), gb = idx(B);
const shared = [...ga.keys()].filter((k) => gb.has(k));

console.log(`same model ${A.modelSig}`);
console.log(`  run A  ${A.at}  ${ga.size} games`);
console.log(`  run B  ${B.at}  ${gb.size} games`);
console.log(`  shared ${shared.length}   only in A ${ga.size - shared.length}   only in B ${gb.size - shared.length}`);

if (JSON.stringify(A.pitStats) === JSON.stringify(B.pitStats)) {
  console.log("  fetch counters identical between runs — the disk-cached feeds behaved the same");
} else {
  console.log("  fetch counters DIFFER — some feed answered differently, which explains drift honestly:");
  console.log("    A " + JSON.stringify(A.pitStats));
  console.log("    B " + JSON.stringify(B.pitStats));
}

console.log("\n=============== PROBABILITY DRIFT ===============");
let same = 0, moved = 0, over50 = 0, maxd = 0, sumd = 0;
for (const k of shared) {
  const pa = ga.get(k).p, pb = gb.get(k).p;
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) continue;
  const d = Math.abs(pa - pb);
  if (d === 0) { same++; continue; }
  moved++; sumd += d;
  if (d > 0.005) over50++;
  if (d > maxd) maxd = d;
}
const scored = same + moved;
console.log(`  identical p     ${String(same).padStart(5)}`);
console.log(`  changed p       ${String(moved).padStart(5)}   (${(moved / Math.max(1, scored) * 100).toFixed(1)}%)`);
console.log(`  changed >0.5pp  ${String(over50).padStart(5)}`);
console.log(`  mean |dp| among changed  ${(sumd / Math.max(1, moved) * 100).toFixed(3)}pp`);
console.log(`  max  |dp|                ${(maxd * 100).toFixed(2)}pp`);

/* Per-date, because WHERE the drift sits identifies what causes it.
 *
 * Concentrated in the last few days means live results still landing, which is
 * expected and harmless. Spread evenly back to April means something inside
 * the harness is not deterministic, because a game from four months ago has no
 * new information to receive. */
const byDate = new Map();
for (const [d, gs] of A.slates) {
  for (const g of gs) {
    const o = gb.get(g.gamePk);
    if (!o || !Number.isFinite(g.p) || !Number.isFinite(o.p)) continue;
    const e = byDate.get(d) || { n: 0, ch: 0 };
    e.n++; if (Math.abs(g.p - o.p) > 1e-12) e.ch++;
    byDate.set(d, e);
  }
}
const dates = [...byDate.entries()].sort();
const half = Math.floor(dates.length / 2);
const rate = (rs) => {
  const n = rs.reduce((s, [, e]) => s + e.n, 0), c = rs.reduce((s, [, e]) => s + e.ch, 0);
  return { n, c, pct: c / Math.max(1, n) * 100 };
};
const oldH = rate(dates.slice(0, half)), newH = rate(dates.slice(half));
console.log("\n=============== WHERE ===============");
console.log(`  older half (${dates[0][0]}..${dates[half - 1][0]})  ${oldH.c}/${oldH.n} changed  ${oldH.pct.toFixed(1)}%`);
console.log(`  newer half (${dates[half][0]}..${dates[dates.length - 1][0]})  ${newH.c}/${newH.n} changed  ${newH.pct.toFixed(1)}%`);
if (oldH.pct > 10) {
  console.log("  => games months old are being rescored differently. That is not new information");
  console.log("     arriving; something in the scoring path is not deterministic.");
} else if (newH.pct > 10) {
  console.log("  => drift is confined to recent slates, consistent with results still landing.");
} else {
  console.log("  => essentially reproducible.");
}

/* The only unit that decides anything: which games the ladder plays.
 *
 * Probability drift of 0.18pp is invisible unless it crosses a rung, so the
 * headline number has to be slate churn, not mean |dp|. A reader comparing two
 * backtests cares whether the play list moved. */
const { makeVerdict } = require("./nrfi-model-lib");
const { nrfiVerdict } = makeVerdict({});
const verdictOf = (g) => {
  if (!Number.isFinite(g.p)) return null;
  return nrfiVerdict({
    pMax: Math.max(g.p, 1 - g.p) * 100,
    call: g.p >= 0.5 ? "NRFI" : "YRFI",
    market: null, awayPP: "away", homePP: "home",
    aligned: g.aligned || { total: 3, agree: 3 },
    confidence: g.confidence == null ? 1 : g.confidence,
    pitProfiles: { away: { sample: 99 }, home: { sample: 99 } },
  });
};
let both = 0, onlyA = 0, onlyB = 0, sideFlip = 0, strFlip = 0;
for (const k of shared) {
  const va = verdictOf(ga.get(k)), vb = verdictOf(gb.get(k));
  if (!va || !vb) continue;
  if (va.isBet && vb.isBet) {
    both++;
    if (va.side !== vb.side) sideFlip++;
    if (va.strength !== vb.strength) strFlip++;
  } else if (va.isBet) onlyA++;
  else if (vb.isBet) onlyB++;
}
const union = both + onlyA + onlyB;
console.log("\n=============== SLATE CHURN (the unit that matters) ===============");
console.log(`  played in both runs        ${both}`);
console.log(`  played only in A           ${onlyA}`);
console.log(`  played only in B           ${onlyB}`);
console.log(`  churn                      ${onlyA + onlyB} of ${union} (${((onlyA + onlyB) / Math.max(1, union) * 100).toFixed(1)}%)`);
console.log(`  side flipped on a shared play      ${sideFlip}`);
console.log(`  strength changed on a shared play  ${strFlip}`);
console.log("\n  READ EVERY OTHER BACKTEST AGAINST THIS. A change that moves the play list by");
console.log(`  fewer than ~${onlyA + onlyB} games has not been shown to do anything; that is what this harness does`);
console.log("  to itself with no change at all.");
if (sideFlip) {
  console.log("\n  Side flips are worse than churn: the same game got opposite recommendations");
  console.log("  from identical code. Anything above zero here is a bug, not a tolerance.");
}
