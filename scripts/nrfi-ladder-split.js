/* Walk-forward test of the ladder thresholds. Does the winner survive the split?
 *
 * WHY THIS EXISTS. nrfi-ladder-sweep.js scores seven candidate ladders on all
 * 1282 cached games and prints them in one table. Read straight, the bottom row
 * looks like free money: `tighter 65/57` posts 63.5% and 36.8 units against the
 * shipped ladder's 58.4% and 27.7. That is a 5.1pp gap on the same games, far
 * outside the ~0.5pp of rebuild noise the sweep documents, so it is not a
 * measurement artifact.
 *
 * It is still not a result. Seven candidates were scored on one sample and the
 * best was read off the bottom of the table. The maximum of seven noisy
 * estimates is biased upward by construction — you would see a "winner" pull
 * clear even if every ladder were identical underneath. The sweep measures how
 * well each threshold fits the season it was chosen on, which is precisely the
 * question nobody needs answered.
 *
 * So: split the season chronologically, choose on the earlier part, and score
 * the choice on the later part it has never seen. A threshold that is real
 * carries over. A threshold that was fitted to noise reverts, and the size of
 * the reversion is the honest estimate of how much of that 5.1pp was luck.
 *
 * Chronological, never random. A random split leaks — the same starters, teams
 * and weather recur across a season, and the model's inputs are season-to-date,
 * so a randomly held-out game sits inside a window its own training rows
 * already describe. Time order is the only split that mimics how the ladder
 * would actually be used: chosen on what has happened, applied to what has not.
 *
 * READ THE `both halves` COLUMN FIRST. A candidate that leads in train and
 * trails in test has been caught fitting; a candidate that is merely mediocre
 * in both is at least honest. The verdict at the bottom is deliberately
 * conservative: it recommends a change only when the train-selected ladder also
 * beats shipped out of sample by more than the standard error of the test half.
 */
const fs = require("fs");
const path = require("path");
const { makeVerdict, modelSig } = require("./nrfi-model-lib");

const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");
const pc = (x) => (x == null ? "   —  " : (x * 100).toFixed(1) + "%");

if (!fs.existsSync(CACHE)) {
  console.error("no cached scores — run: node scripts/nrfi-tout-vs-model.js 318949");
  process.exit(1);
}
const cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));

/* The same two guards nrfi-ladder-sweep.js carries, for the same reasons: a
 * stale cache still prints, and a leaky one is byte-identical to a clean one on
 * everything except this field. A split test on leaked scores would "validate"
 * a ladder tuned to look-ahead. */
if (!cache.modelSig || cache.modelSig !== modelSig) {
  console.error(`STALE CACHE: built ${cache.at} from model ${cache.modelSig || "(unfingerprinted)"}, ` +
    `but the model is now ${modelSig}. Rebuild: node scripts/nrfi-tout-vs-model.js 318949`);
  process.exit(1);
}
if (cache.pitMode !== "point-in-time") {
  console.error(`REFUSING TO RUN: cache pitMode is "${cache.pitMode}". Thresholds chosen on leaked ` +
    "scores are thresholds fitted to the answer key.");
  process.exit(1);
}

// Keep the slate date on every game — it is what the split is made of, and the
// sweep's flatten drops it.
const seen = new Set();
const games = [];
for (const [date, gs] of cache.slates) {
  for (const g of gs) {
    if (seen.has(g.gamePk)) continue;
    seen.add(g.gamePk);
    games.push({ ...g, date });
  }
}
games.sort((a, b) => a.date.localeCompare(b.date));

const seedC = makeVerdict().NRFI_CALIB_SEED ? makeVerdict().NRFI_CALIB_SEED.c : -0.063;
const { applyCalibration } = makeVerdict();
const CAL = { c: seedC, active: true };

function rowFor(g) {
  const pcal = applyCalibration(g.p, CAL);
  const call = pcal >= 0.5 ? "NRFI" : "YRFI";
  return {
    pMax: Math.max(pcal, 1 - pcal) * 100, call,
    aligned: g.aligned, confidence: g.confidence,
    pitProfiles: { away: g.thinAway ? { sample: 0 } : { sample: 99 },
      home: g.thinHome ? { sample: 0 } : { sample: 99 } },
    awayPP: "away", homePP: "home", market: null,
    actual: g.actual, date: g.date,
  };
}
const rows = games.map(rowFor);

// Same price basis as the sweep, so the two reports are comparable: -119, solved
// from the tout's own graded book rather than assumed.
const PRICE = 0.8403;
const BREAKEVEN = 1 / (1 + PRICE);

function played(rowSet, overrides) {
  const { nrfiVerdict } = makeVerdict(overrides);
  const out = [];
  for (const r of rowSet) {
    const v = nrfiVerdict(r);
    if (v.thinPass) continue;
    if (v.strength === "STRONG" || v.strength === "BET") out.push({ ...r, side: v.side });
  }
  return out;
}
function score(rowSet, overrides) {
  const p = played(rowSet, overrides);
  const w = p.filter((r) => (r.side === "NRFI") === (r.actual === 1)).length;
  const n = p.length;
  const rate = n ? w / n : null;
  const roi = rate == null ? null : rate * PRICE - (1 - rate);
  return { n, w, l: n - w, rate, roi, units: roi == null ? null : roi * n,
    // SE of the hit rate, for asking whether any gap is bigger than the sample.
    se: n ? Math.sqrt((rate * (1 - rate)) / n) : null };
}

const CANDIDATES = [
  ["shipped        63/55/52", {}],
  ["bet 54         63/54/52", { NRFI_BET_MIN: 54 }],
  ["bet 53         63/53/51", { NRFI_BET_MIN: 53, NRFI_LEAN_MIN: 51 }],
  ["bet 52         63/52/50", { NRFI_BET_MIN: 52, NRFI_LEAN_MIN: 50 }],
  ["strong 61      61/55/52", { NRFI_STRONG_MIN: 61 }],
  ["strong 60/53   60/53/51", { NRFI_STRONG_MIN: 60, NRFI_BET_MIN: 53, NRFI_LEAN_MIN: 51 }],
  ["tighter 65/57  65/57/53", { NRFI_STRONG_MIN: 65, NRFI_BET_MIN: 57, NRFI_LEAN_MIN: 53 }],
  /* One-knob variants, to tell a real threshold from a lucky one.
   *
   * `tighter 65/57` moves three numbers at once, so a win tells you nothing
   * about which of them earned it. These move only NRFI_BET_MIN and leave
   * STRONG and LEAN at shipped. If out-of-sample hit rate climbs smoothly with
   * the cut, that is the model's probability ordering being real and the ladder
   * simply reading further up it. If 57 spikes and its neighbours sag, 57 was
   * fitted to this sample and will not survive contact with a new season. */
  ["bet 56 only    63/56/52", { NRFI_BET_MIN: 56 }],
  ["bet 57 only    63/57/52", { NRFI_BET_MIN: 57 }],
  ["bet 58 only    63/58/52", { NRFI_BET_MIN: 58 }],
  ["bet 59 only    63/59/52", { NRFI_BET_MIN: 59 }],
  ["bet 60 only    63/60/52", { NRFI_BET_MIN: 60 }],
];

const SPLIT_AT = Number(process.argv[2] || 0.6);
const dates = [...new Set(rows.map((r) => r.date))].sort();
const cut = dates[Math.floor(dates.length * SPLIT_AT)];
const train = rows.filter((r) => r.date < cut);
const test = rows.filter((r) => r.date >= cut);

console.log(`ladder split test · cache ${cache.at} · model ${cache.modelSig} · splits ${cache.pitMode}`);
console.log(`${rows.length} games over ${dates.length} slates, cut at ${cut} (${(SPLIT_AT * 100).toFixed(0)}% of slates)`);
console.log(`  TRAIN ${train.length} games, ${dates.filter((d) => d < cut).length} slates, ${dates[0]}..`);
console.log(`  TEST  ${test.length} games, ${dates.filter((d) => d >= cut).length} slates, ${cut}..${dates[dates.length - 1]}`);
console.log(`\nflat 1u at ${PRICE.toFixed(3)} (-119); break-even ${pc(BREAKEVEN)}`);

console.log("\n=============== EVERY CANDIDATE, BOTH HALVES ===============");
console.log("                            TRAIN played   rate    units  |   TEST played   rate    units");
const scored = CANDIDATES.map(([name, ov]) => ({ name, ov, tr: score(train, ov), te: score(test, ov) }));
for (const s of scored) {
  console.log(`  ${s.name}  ${String(s.tr.n).padStart(6)}  ${pc(s.tr.rate).padStart(6)}  ` +
    `${s.tr.units == null ? "    —" : s.tr.units.toFixed(1).padStart(6)}  |  ${String(s.te.n).padStart(6)}  ` +
    `${pc(s.te.rate).padStart(6)}  ${s.te.units == null ? "    —" : s.te.units.toFixed(1).padStart(6)}`);
}

// What the train half would actually have told you to do, and what that choice
// then earned on games it had never seen.
const pick = scored.slice().sort((a, b) => (b.tr.units ?? -1e9) - (a.tr.units ?? -1e9))[0];
const ship = scored.find((s) => s.name.startsWith("shipped"));

console.log("\n=============== THE ONLY COMPARISON THAT COUNTS ===============");
console.log(`  train picked:  ${pick.name.trim()}   (best units in TRAIN: ${pick.tr.units.toFixed(1)})`);
console.log(`  on TEST it went ${pick.te.w}-${pick.te.l}  ${pc(pick.te.rate)}  ${pick.te.units.toFixed(1)} units on ${pick.te.n} bets`);
console.log(`  shipped on TEST ${ship.te.w}-${ship.te.l}  ${pc(ship.te.rate)}  ${ship.te.units.toFixed(1)} units on ${ship.te.n} bets`);

const gap = pick.te.rate - ship.te.rate;
const seGap = Math.sqrt(Math.pow(pick.te.se, 2) + Math.pow(ship.te.se, 2));
console.log(`\n  out-of-sample gap: ${(gap * 100 >= 0 ? "+" : "") + (gap * 100).toFixed(1)}pp,  SE ${(seGap * 100).toFixed(1)}pp,  ` +
  `z=${(gap / seGap).toFixed(2)}`);
// The in-sample gap is printed beside it because the SHRINKAGE is the finding.
const inGap = pick.tr.rate - ship.tr.rate;
console.log(`  in-sample gap was ${(inGap * 100 >= 0 ? "+" : "") + (inGap * 100).toFixed(1)}pp — ` +
  `${Math.abs(inGap) > 1e-9 ? ((1 - gap / inGap) * 100).toFixed(0) + "% of it did not survive the split" : "n/a"}`);

/* ---- the marginal band, which is the only non-nested reading ----
 *
 * The candidate table above is nested: `bet 58`'s bets are a subset of `bet
 * 57`'s, which are a subset of `bet 56`'s. So a rate column that rises with the
 * cut is partly arithmetic — remove the worst-scoring games from a pool and
 * what remains must score better. Five nested rows are not five measurements.
 *
 * The claim being tested is narrower and can be measured on its own: are the
 * games the shipped ladder plays and a raised ladder DROPS actually losers?
 * That band is disjoint from everything above it. If it clears break-even the
 * raise is throwing away profit; if it sits below, the raise is cutting a leg
 * that does not pay for its vig, and the improvement is real rather than
 * selection. This is the number to trust. */
console.log("\n=============== THE DROPPED BAND (disjoint, not nested) ===============");
console.log("  games shipped plays that the raised cut would NOT play:");
console.log("  cut     dropped   W-L      rate    units   vs break-even");
for (const s of scored) {
  if (!s.name.startsWith("bet ") || !s.name.includes("only")) continue;
  const keep = new Set(played(test, s.ov).map((r) => r.date + "|" + r.pMax));
  const band = played(test, {}).filter((r) => !keep.has(r.date + "|" + r.pMax));
  const w = band.filter((r) => (r.side === "NRFI") === (r.actual === 1)).length;
  const n = band.length;
  if (!n) { console.log(`  ${s.name.slice(4, 12)}       0        —        —       —`); continue; }
  const rate = w / n, roi = rate * PRICE - (1 - rate);
  console.log(`  ${s.name.slice(4, 12)}  ${String(n).padStart(6)}   ${String(w) + "-" + (n - w)}`.padEnd(30) +
    `${pc(rate).padStart(6)}  ${(roi * n).toFixed(1).padStart(6)}   ` +
    `${((rate - BREAKEVEN) * 100 >= 0 ? "+" : "") + ((rate - BREAKEVEN) * 100).toFixed(1)}pp`);
}
console.log("  A band BELOW break-even is a leg that costs money to play; cutting it is a real");
console.log("  gain. A band above it means the raise is discarding profitable volume.");

console.log("\n=============== VERDICT ===============");
if (pick.name === ship.name) {
  console.log("  The train half chose the SHIPPED ladder. Nothing to change.");
} else if (gap > seGap) {
  console.log(`  CHANGE IS SUPPORTED: ${pick.name.trim()} beats shipped out of sample by more than one SE.`);
  console.log("  Still only one season and one cut point — re-run at a few split fractions before shipping.");
} else if (gap > 0) {
  console.log(`  NOT SUPPORTED: ${pick.name.trim()} leads out of sample but by less than one SE (${(gap * 100).toFixed(1)}pp vs ${(seGap * 100).toFixed(1)}pp).`);
  console.log("  That is a coin landing the same way twice, not a demonstrated edge. Keep the shipped ladder.");
} else {
  console.log(`  REJECTED: ${pick.name.trim()} won the train half and LOST the test half. That is the`);
  console.log("  signature of a threshold fitted to noise. Keep the shipped ladder.");
}
console.log("\n  Volumes are CEILINGS — the value gate against market price is not reconstructable");
console.log("  from this cache, so real played counts are lower than every number above.");
