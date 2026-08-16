// How big is the backtest leak? Put the leaky and leak-free models on the SAME
// games and compare.
//
//   node scripts/nrfi-leak-quantify.js
//
// WHY THIS EXISTS. nrfi-ladder-sweep.js reports the shipped ladder's BET rung at
// 62.5% over 501 games against a 49.9% base rate. nrfi-leakfree.js, run the same
// night over 14007 games, puts the model's Brier at .24956 against a .24982 base
// — i.e. essentially nothing, with a joint coefficient over the Kalshi price of
// z=1.83. Both cannot be true. A forecaster that hits 62.5% on a coin-flip market
// is one of the best sports models ever built; one that moves Brier by .0003 is
// a rounding error. The gap between those two claims is the leak, and until it
// is measured, every ROI and hit-rate number the desk prints is unaudited.
//
// The suspect is named in the harness itself — desk-nrfi-backtest.js header:
// "split stats are current-season (not point-in-time), so there is mild
// look-ahead leakage". nrfi-tout-vs-model.js scores through the same model lib,
// so its cache inherits it. "Mild" is the claim under test.
//
// METHOD. The sweep cache stores a model probability per gamePk. The leak-free
// walk-forward is re-run here (identical arithmetic to nrfi-leakfree.js — same
// K/KPARK/KTEAM, same mature-only Platt) over all six seasons, then restricted
// to the sweep's gamePks. Same games, same outcomes, two forecasters. Brier is
// the comparison; the ladder rungs are the second one, because a rung is what
// the desk actually acts on.
//
// A LEAK IS NOT A BUG YOU CAN SEE IN THE OUTPUT. It shows up only as accuracy
// that does not reproduce out of sample, which is precisely why it has to be
// measured against a model built under the discipline rather than inspected.
//
// ==================== WHAT IT FOUND, 2026-08-15 ====================
//
// The leak hypothesis FAILED its own test, and that is the result.
//
// Brier over 1273 shared games: base .25000, leak-free .24911, backtest .24186.
// The backtest model beats the base rate by 9x what the leak-free model does,
// which is what raised the suspicion in the first place.
//
// But the seasonal-decay test below exonerates the named mechanism. If the
// advantage came from season-to-date stats, April games (whose "season to date"
// is almost entirely future) would score far better than September ones. They do
// the OPPOSITE — Brier skill runs 1.0% -> 1.5% -> 4.9% -> 3.7% across the
// season. And the leak-free model, which cannot leak by construction, shows the
// SAME rising shape (-0.4% -> -1.4% -> 0.8% -> 0.5%). That shared gradient is
// just stats maturing: in April every arm is regressed to the league mean and
// there is nothing to know yet.
//
// So the gap is most likely real, and attributable to the inputs the leak-free
// model deliberately does not have — lineups, umpire, weather, Statcast whiff,
// K-BB. That model was built to be minimal, and the honest reading is that
// pitcher rates + park + team offence is a weak model, not that the desk's is a
// fraudulent one.
//
// WHAT THIS DOES NOT SHOW. It rules out one mechanism, not all of them. A leak
// with no seasonal shape — a stat that is same-day rather than season-to-date —
// would pass this test untouched. The header caveat on desk-nrfi-backtest.js
// should stay until someone rebuilds those splits point-in-time and reruns.
// Column 5 of the rung table is still the uncomfortable number: on the games the
// backtest model calls at 64.8%, the leak-free model says 51.9%.
const fs = require("fs");
const path = require("path");

const K = 75, KPARK = 1216, KTEAM = 646;   // derived in nrfi-park-rest.js
const lg = (x) => Math.log(x / (1 - x));
const clamp = (p) => Math.min(0.98, Math.max(0.02, p));
const pc = (x) => (x * 100).toFixed(1) + "%";

const LF = path.join(__dirname, "nrfi-leakfree-games.json");
const SW = path.join(__dirname, "nrfi-tout-vs-model.json");
for (const [f, how] of [[LF, "node scripts/nrfi-leakfree.js --refresh"],
                        [SW, "node scripts/nrfi-tout-vs-model.js 318949"]]) {
  if (!fs.existsSync(f)) { console.error(`missing ${path.basename(f)} — run: ${how}`); process.exit(1); }
}

const games = JSON.parse(fs.readFileSync(LF, "utf8")).games;
const cache = JSON.parse(fs.readFileSync(SW, "utf8"));
const leaky = new Map(cache.slates.flatMap(([, gs]) => gs).map((g) => [g.gamePk, g]));

// ---- leak-free walk-forward, verbatim from nrfi-leakfree.js ----
const lgClean = games.reduce((s, g) => s + g.hpClean + g.apClean, 0) / (2 * games.length);
const arm = new Map(), pkm = new Map(), tm = new Map();
const get = (id) => arm.get(id) || { n: 0, c: 0 };
let hN = 0, hC = 0, aN = 0, aC = 0;
const rated = [];
for (const g of games) {
  const a = get(g.ap), h = get(g.hp);
  const pa = (a.c + lgClean * K) / (a.n + K);
  const ph = (h.c + lgClean * K) / (h.n + K);
  const v = pkm.get(g.venue) || { n: 0, d: 0 };
  const adj = v.d / (v.n + KPARK);
  const sH = hN > 200 ? hC / hN - lgClean : 0;
  const sA = aN > 200 ? aC / aN - lgClean : 0;
  const tA = tm.get(g.away) || { n: 0, d: 0 }, tH = tm.get(g.home) || { n: 0, d: 0 };
  const oH = tA.d / (tA.n + KTEAM), oA = tH.d / (tH.n + KTEAM);
  rated.push({ ...g, p: clamp(clamp(ph + adj + sH + oH) * clamp(pa + adj + sA + oA)),
    mat: a.n >= 20 && h.n >= 20 });
  arm.set(g.ap, { n: a.n + 1, c: a.c + g.apClean });
  arm.set(g.hp, { n: h.n + 1, c: h.c + g.hpClean });
  pkm.set(g.venue, { n: v.n + 2, d: v.d + (g.hpClean - ph) + (g.apClean - pa) });
  tm.set(g.away, { n: tA.n + 1, d: tA.d + (g.hpClean - ph) });
  tm.set(g.home, { n: tH.n + 1, d: tH.d + (g.apClean - pa) });
  hN++; hC += g.hpClean; aN++; aC += g.apClean;
}
const platt = (rows) => {
  let a = 0, b = 1;
  for (let it = 0; it < 60; it++) {
    let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
    for (const r of rows) {
      const x = lg(r.p), mu = 1 / (1 + Math.exp(-(a + b * x))), w = mu * (1 - mu), d = r.nrfi - mu;
      g0 += d; g1 += d * x; h00 += w; h01 += w * x; h11 += w * x * x;
    }
    const det = h00 * h11 - h01 * h01;
    if (!(Math.abs(det) > 1e-12)) break;
    a += (h11 * g0 - h01 * g1) / det;
    b += (h00 * g1 - h01 * g0) / det;
  }
  return { a, b };
};
let cal = null;
for (let i = 0; i < rated.length; i++) {
  if (i >= 1000 && i % 250 === 0) {
    const hist = rated.slice(0, i).filter((r) => r.mat);
    if (hist.length >= 500) cal = platt(hist);
  }
  if (cal) rated[i].p = clamp(1 / (1 + Math.exp(-(cal.a + cal.b * lg(rated[i].p)))));
}

// ---- join ----
const rows = [];
for (const r of rated) {
  const L = leaky.get(r.pk);
  if (!L) continue;
  if (L.actual !== r.nrfi) { console.error(`outcome mismatch on ${r.pk}`); process.exit(1); }
  rows.push({ pk: r.pk, y: r.nrfi, free: r.p, leak: L.p });
}
const n = rows.length;
if (n < 300) { console.error(`only ${n} games joined — nothing to conclude`); process.exit(1); }
const base = rows.reduce((s, r) => s + r.y, 0) / n;
const brier = (f) => rows.reduce((s, r) => { const d = f(r) - r.y; return s + d * d; }, 0) / n;

console.log("=================== SAME GAMES, TWO FORECASTERS ===================");
console.log(`  ${n} games, both models scored on identical outcomes`);
console.log(`  base rate ${pc(base)}\n`);
console.log("   forecaster                      Brier      vs base");
const bb = base * (1 - base);
for (const [nm, f] of [["base rate", () => base],
                       ["leak-free (walk-forward)", (r) => r.free],
                       ["backtest model (suspect)", (r) => r.leak]]) {
  const b = brier(f);
  console.log(`  ${nm.padEnd(30)} ${b.toFixed(5)}   ${b === bb ? "  --" : (b < bb ? "-" : "+") + Math.abs(b - bb).toFixed(5)}`);
}

// The rung is what the desk acts on, so test it directly: take the games the
// leaky model calls BET, and ask what the leak-free model thought of them.
console.log("\n=================== THE BET RUNG, RE-SCORED ===================");
console.log("  Games the backtest model puts at >=55% on its called side, and what");
console.log("  the leak-free model said about those same games.\n");
console.log("   cut   n     leaky says   actually went   leak-free said");
for (const cut of [0.52, 0.55, 0.57, 0.63]) {
  const sel = rows.filter((r) => Math.max(r.leak, 1 - r.leak) >= cut);
  if (!sel.length) continue;
  const hit = sel.filter((r) => (r.leak >= 0.5 ? r.y === 1 : r.y === 0)).length / sel.length;
  const claim = sel.reduce((s, r) => s + Math.max(r.leak, 1 - r.leak), 0) / sel.length;
  // leak-free's probability on the side the leaky model chose
  const freeOnSide = sel.reduce((s, r) => s + (r.leak >= 0.5 ? r.free : 1 - r.free), 0) / sel.length;
  console.log(`  ${(cut * 100).toFixed(0)}%  ${String(sel.length).padStart(4)}    ${pc(claim).padStart(6)}` +
    `       ${pc(hit).padStart(6)}          ${pc(freeOnSide).padStart(6)}`);
}
console.log("\n  Column 3 is the leaky model's own confidence, column 4 what happened,");
console.log("  column 5 the leak-free model's confidence on the SAME side. If column 5");
console.log("  sits near 50 while columns 3 and 4 both sit far above it, the accuracy");
console.log("  is coming from information the live model will not have at pick time.");

/* THE TEST THAT SEPARATES "LEAK" FROM "RICHER MODEL".
 *
 * The objection to everything above is fair: the leak-free model only has
 * pitcher rates, park and team offence, while the backtest model also has
 * lineups, umpire, weather and Statcast. Maybe it is just better.
 *
 * Season-to-date stats make a specific, falsifiable prediction that a genuinely
 * better model does not. For a game played in April, "season to date" is
 * computed from a season that is almost entirely in that game's FUTURE, so the
 * contamination is near total. By September the same field is almost entirely
 * past, and nearly clean. So a leak of this shape must show accuracy DECAYING
 * as the season progresses. A real feature edge has no reason to.
 *
 * This is the load-bearing test in the file. */
const dateOf = new Map();
for (const [d, gs] of cache.slates) for (const g of gs) if (!dateOf.has(g.gamePk)) dateOf.set(g.gamePk, d);
const dated = rows.filter((r) => dateOf.has(r.pk)).map((r) => ({ ...r, d: dateOf.get(r.pk) }));
dated.sort((a, b) => (a.d < b.d ? -1 : 1));
if (dated.length >= 400) {
  console.log("\n=================== DOES THE EDGE DECAY THROUGH THE SEASON? ===================");
  console.log("  Season-to-date inputs are most contaminated in April and least in September.\n");
  console.log("   window          n    dates              leaky Brier   leak-free Brier");
  const Q = 4, per = Math.floor(dated.length / Q);
  const skill = [];
  for (let q = 0; q < Q; q++) {
    const s = dated.slice(q * per, q === Q - 1 ? dated.length : (q + 1) * per);
    const bq = s.reduce((a, r) => a + r.y, 0) / s.length;
    const br = (f) => s.reduce((a, r) => { const dd = f(r) - r.y; return a + dd * dd; }, 0) / s.length;
    // Brier skill score against that window's OWN base rate, so a window that
    // simply had more NRFIs is not mistaken for a window the model understood.
    const bl = br((r) => r.leak), bf = br((r) => r.free), b0 = bq * (1 - bq);
    skill.push(1 - bl / b0);
    console.log(`  Q${q + 1} ${String(s.length).padStart(6)}    ${s[0].d}..${s[s.length - 1].d}` +
      `   ${bl.toFixed(5)} (skill ${((1 - bl / b0) * 100).toFixed(1)}%)   ${bf.toFixed(5)} (skill ${((1 - bf / b0) * 100).toFixed(1)}%)`);
  }
  console.log(`\n  leaky skill, first quarter ${(skill[0] * 100).toFixed(1)}%  ->  last quarter ${(skill[Q - 1] * 100).toFixed(1)}%`);
  console.log(skill[0] > skill[Q - 1] + 0.02
    ? "  DECAYS. That is the signature of season-to-date contamination, not of a\n" +
      "  better feature set — nothing about lineups or umpires gets worse in September."
    : "  No decay. The season-to-date leak does not explain the gap on this sample;\n" +
      "  the advantage has to be attributed to the richer inputs or to something else.");
}

// Spread is the tell: a model that has seen the outcome can afford to be
// confident. One that hasn't, can't.
const sd = (f) => { const m = rows.reduce((s, r) => s + f(r), 0) / n;
  return Math.sqrt(rows.reduce((s, r) => s + (f(r) - m) ** 2, 0) / n); };
console.log("\n=================== SPREAD ===================");
console.log(`  leak-free  sd ${sd((r) => r.free).toFixed(4)}   range ${Math.min(...rows.map((r) => r.free)).toFixed(3)}..${Math.max(...rows.map((r) => r.free)).toFixed(3)}`);
console.log(`  backtest   sd ${sd((r) => r.leak).toFixed(4)}   range ${Math.min(...rows.map((r) => r.leak)).toFixed(3)}..${Math.max(...rows.map((r) => r.leak)).toFixed(3)}`);
console.log("\n  A wider spread is only earned if it is matched by accuracy. Compare the");
console.log("  Brier table above before reading a wide range as a better model.");
