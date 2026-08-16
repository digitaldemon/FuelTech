// Does a factor EXPLAIN his edge, or does he merely have a habit?
//
//   node scripts/nrfi-tout-mediate.js [cache]
//
// nrfi-tout-factors.js found seven factors that separate his NRFI legs from
// same-date, same-p peers, and then ran a "mediation" test that does not
// actually test mediation. It filtered the LEG by the factor and left the peers
// alone, so what it measured was where his edge lives, not whether the factor
// accounts for it. This is the corrected test.
//
// HOLDING A FACTOR FIXED MEANS MATCHING THE PEERS ON IT. If his legs sit 0.4 sd
// below their peers on homePitBase and that gap is the reason he wins, then
// comparing him against peers who share his homePitBase should make the edge go
// away. If the edge survives against peers matched on the factor, the factor is
// a description of his taste and copying it buys the taste, not the result.
//
// THE POPULATION TRAP, which is the whole reason this is a paired test. Adding a
// matching constraint throws away legs that have no constrained peer — here it
// costs a third of them. So an edge that falls from 14.9 to 8.0 pts proves
// nothing on its own: the drop could be entirely the change of population, since
// the legs that survive a tighter match are not a random third. Both numbers are
// therefore computed over the IDENTICAL surviving leg set, one with the
// constraint and one without, and the statistic is their DIFFERENCE under a
// paired date-clustered bootstrap. That difference is attributable to the
// constraint and to nothing else.
//
// AND THE CONSTRAINT HAS TO BE SHOWN TO BIND. A factor-matched comparison that
// still shows a factor gap did not hold anything fixed. Each row prints the
// residual gap after matching; if it has not collapsed, the row is void.

const fs = require("fs");
const path = require("path");

const CACHE = process.argv[2] || "nrfi-tout-vs-model.json";
const MATCH_P = 0.02;
const TOL_SD = 0.25;   // "same" on a factor: within a quarter of its board-wide SD
const B = 3000;

const p0 = path.isAbsolute(CACHE) ? CACHE : path.join(__dirname, CACHE);
const J = JSON.parse(fs.readFileSync(p0, "utf8"));

let _s = 0x9e3779b9 >>> 0;
const rnd = () => { _s ^= _s << 13; _s >>>= 0; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0; return _s / 4294967296; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };

const his = new Set();
for (const [d, ps] of J.byDate) for (const x of ps) if (x.side === "NRFI" && x.gamePk != null) his.add(d + ":" + x.gamePk);
const raw = [];
for (const [d, gs] of J.slates) for (const g of gs) {
  if (!Number.isFinite(g.p) || !g.factors) continue;
  raw.push({ d, pk: g.gamePk, p: g.p, y: g.actual, his: his.has(d + ":" + g.gamePk), f: g.factors });
}
const games = [...new Map(raw.map((r) => [r.pk, r])).values()];
const byDate = new Map();
for (const r of games) { if (!byDate.has(r.d)) byDate.set(r.d, []); byDate.get(r.d).push(r); }
const legs = games.filter((r) => r.his);

const SPREAD = {};
for (const k of [...new Set(games.flatMap((r) => Object.keys(r.f)))])
  SPREAD[k] = sd(games.map((r) => r.f[k]).filter(Number.isFinite));

// The factors that cleared Bonferroni in nrfi-tout-factors.js. Named here rather
// than recomputed so this script tests one stated hypothesis set instead of
// silently re-deriving one that could differ.
const CLEARED = ["homePitBase", "homeOpenG", "env", "awayPitBase", "homeOpen", "homeOffKRate", "awayOpenG"];

/* Peers on the same date at the same p, optionally also matched on a factor.
 * A binary or near-binary factor is matched by exact equality; a continuous one
 * within a quarter of its SD. Both are "same value" in the only sense that
 * matters, and the residual-gap column proves which. */
function peersOf(leg, keys) {
  return (byDate.get(leg.d) || []).filter((r) => {
    if (r.his || Math.abs(r.p - leg.p) > MATCH_P) return false;
    for (const k of keys) {
      const a = leg.f[k], b = r.f[k];
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      if (Math.abs(a - b) > TOL_SD * SPREAD[k]) return false;
    }
    return true;
  });
}

/* Paired date-clustered bootstrap on two peer sets over one leg set.
 * Resampling DATES, and resampling the SAME dates for both arms, is what makes
 * the difference interpretable: the population noise is common to both arms and
 * cancels, leaving the constraint. */
function paired(rows) {
  const val = (r, w) => r.leg.y - mean(r[w].map((x) => x.y));
  const A = mean(rows.map((r) => val(r, "free")));
  const C = mean(rows.map((r) => val(r, "held")));
  const ds = [...new Set(rows.map((r) => r.leg.d))];
  const bd = new Map(ds.map((x) => [x, rows.filter((r) => r.leg.d === x)]));
  const bA = [], bC = [], bD = [];
  for (let b = 0; b < B; b++) {
    const s = [];
    for (let i = 0; i < ds.length; i++) s.push(...bd.get(ds[(rnd() * ds.length) | 0]));
    const a = mean(s.map((r) => val(r, "free"))), c = mean(s.map((r) => val(r, "held")));
    bA.push(a); bC.push(c); bD.push(a - c);
  }
  return { free: A, held: C, seFree: sd(bA), seHeld: sd(bC), drop: A - C, seDrop: sd(bD) };
}

const base = legs.map((leg) => ({ leg, free: peersOf(leg, []) })).filter((r) => r.free.length);
const baseEdge = mean(base.map((r) => r.leg.y - mean(r.free.map((x) => x.y))));
console.log(`${games.length} games, ${legs.length} his legs, ${byDate.size} dates`);
console.log(`baseline: ${base.length} legs matched on date+p, edge +${(100 * baseEdge).toFixed(1)} pts\n`);
console.log(`holding each factor fixed as well (within ${TOL_SD} sd), on the SAME legs both ways:\n`);
console.log(`  factor            legs   gap after   edge free   edge held    drop`);
console.log(`  ${"-".repeat(68)}`);

const verdicts = [];
for (const k of CLEARED) {
  const rows = legs.map((leg) => ({ leg, held: peersOf(leg, [k]) })).filter((r) => r.held.length);
  const withFree = rows.map((r) => ({ ...r, free: peersOf(r.leg, []) })).filter((r) => r.free.length);
  if (withFree.length < 30) { console.log(`  ${k.padEnd(16)} ${String(withFree.length).padStart(5)}   too few legs survive the constraint to say anything`); continue; }
  const gap = mean(withFree.map((r) => (r.leg.f[k] - mean(r.held.map((x) => x.f[k]))) / SPREAD[k]));
  const r = paired(withFree);
  const bound = Math.abs(gap) < 0.10;
  console.log(`  ${k.padEnd(16)} ${String(withFree.length).padStart(5)}   ${(gap >= 0 ? "+" : "") + gap.toFixed(3)} sd` +
    `${bound ? "  " : " !"}  ${(100 * r.free).toFixed(1).padStart(6)} pts  ${(100 * r.held).toFixed(1).padStart(6)} pts` +
    `  ${(100 * r.drop >= 0 ? "+" : "") + (100 * r.drop).toFixed(1)} (${(r.drop / (r.seDrop || 1)).toFixed(1)}se)`);
  verdicts.push({ k, ...r, gap, n: withFree.length, bound });
}
console.log(`  ${"-".repeat(68)}`);
console.log(`  "!" marks a factor whose gap did NOT collapse — the constraint failed to bind,`);
console.log(`  and that row is void regardless of what the drop column says.\n`);

/* All of them at once. If no single factor explains the edge, the combination
 * still might; and if the combination does not either, then whatever he is using
 * is not in the 33 numbers we record, which is a far more useful thing to know
 * than another list of near-misses. */
const joint = legs.map((leg) => ({ leg, held: peersOf(leg, CLEARED) })).filter((r) => r.held.length);
const jointBoth = joint.map((r) => ({ ...r, free: peersOf(r.leg, []) })).filter((r) => r.free.length);
if (jointBoth.length >= 30) {
  const r = paired(jointBoth);
  console.log(`ALL SEVEN AT ONCE — ${jointBoth.length} legs keep a peer matched on every one`);
  console.log(`  free +${(100 * r.free).toFixed(1)} pts   held +${(100 * r.held).toFixed(1)} pts   ` +
    `drop ${(100 * r.drop >= 0 ? "+" : "") + (100 * r.drop).toFixed(1)} pts (${(r.drop / (r.seDrop || 1)).toFixed(1)}se)`);
} else {
  console.log(`ALL SEVEN AT ONCE — only ${jointBoth.length} legs keep a peer matched on every factor.`);
  console.log(`  Not enough to test jointly; the constraint set is too tight for a 95-date sample.`);
}

const real = verdicts.filter((v) => v.bound && v.drop / (v.seDrop || 1) > 2);
console.log("\n" + "=".repeat(72));
if (real.length) {
  console.log("EXPLAINS PART OF THE EDGE: " + real.map((v) => v.k).join(", "));
  console.log("  His advantage shrinks when peers share this factor, so the factor carries");
  console.log("  signal our p is not extracting from it. That is a model change worth testing.");
} else {
  const mde = 2 * mean(verdicts.map((v) => v.seDrop)) * 100;
  console.log("NOTHING EXPLAINS IT. Every factor that differs between his legs and their");
  console.log("peers keeps its full edge when the peers are matched on it — his taste, not");
  console.log(`his reason. Minimum drop detectable here: ${mde.toFixed(1)} pts against a ${(100 * baseEdge).toFixed(1)} pt edge.`);
}
