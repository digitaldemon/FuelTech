/* NRFIKING MODE — his published method, measured on our data.
 *
 *   node scripts/nrfi-king-mode.js [shrinkK]
 *
 * WHAT THIS IS. NRFIKINGKY's app (nrfi-edge.replit.app) states its whole rule
 * structure on the card, and this implements that structure: ONE input, the
 * starting pitcher's clean-first-inning rate over four windows, plus four hard
 * auto-passes, a +-2% park flag, tier cutoffs and a per-tier price gate. No team
 * offence, lineups, weather, bullpen, Statcast, travel or rest — he uses none of
 * it, so neither does this.
 *
 * WHAT THIS IS NOT. His DS score's actual equation is NOT published — the card
 * shows inputs and output, not the mapping — and it is not recoverable from one
 * slate. His 2026-08-17 board gives 9 usable games against 8 features; a linear
 * fit is underdetermined and reproduces that day perfectly while meaning
 * nothing. A constrained 2-parameter fit on the window means lands R2 0.707 with
 * a 5.5-point residual, and his tier boundaries are 0.7 points apart (GREEN 64.5
 * vs YELLOW 63.8), so an approximation cannot even reproduce his tiers. The
 * score below is therefore OURS: a transparent shrunk product built from his
 * inputs, fitted here on our games. It will not reproduce his DS numbers and is
 * not trying to. Do not relabel it "DS" in the UI or someone will compare the
 * two numbers and file the difference as a bug.
 *
 * THE WINDOWS ARE DAYS, NOT STARTS. His card reads "100% L30 · 5gs" — five games
 * inside L30. A 30-START window would be most of two seasons and could never
 * show 5. Reading it as starts makes his THIN gate (2-3 starts) almost unfirable
 * and collapses the LEAK gate to 508 games instead of 1255; both were measured
 * that way first and it was wrong.
 *
 * Windows are computed from PRIOR games only, and the arm's own current game is
 * appended after the row is emitted, so nothing here sees its own outcome.
 */
const fs = require("fs");
const path = require("path");

const K = Number(process.argv[2] || 6); // shrink toward league by starts
const LG = 0.711;                        // league clean-first-inning rate
const B = 4000;

const { games } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "nrfi-leakfree-games.json"), "utf8"));
games.sort((a, b) => a.date.localeCompare(b.date) || a.pk - b.pk);

/* His four windows. SZN is season-to-date; the rest are trailing DAYS. */
const WINDOWS = [
  { name: "SZN", days: null, w: 0.25 },
  { name: "L50", days: 50, w: 0.25 },
  { name: "L30", days: 30, w: 0.35 }, // headline window on his card, weighted most
  { name: "L10", days: 10, w: 0.15 },
];

/* Park flags, exactly the three he names and exactly +-2%, applied to the arms.
 * COL is absent on purpose: he does not dock Coors, he refuses the game (below). */
const PARK_ADJ = { 113: -0.02, 112: -0.02, 134: +0.02 }; // GABP, Wrigley, PNC
const COORS = 19;

const D = (d) => Date.parse(d + "T00:00:00Z");
const hist = new Map(); // pid -> [{t, season, c}]

/* Shrink toward the league rate by start count. This is what makes his
 * thin-sample games rank below their raw mean, and it is why LAD@COL (raw mean
 * 70) sits under STL@CIN G1 (raw mean 50) on his own board. */
const shrink = (r, n) => (n > 0 ? (n * r + K * LG) / (n + K) : null);

function armWindows(pid, t, season) {
  const h = hist.get(pid) || [];
  const out = {};
  for (const w of WINDOWS) {
    const sel = w.days === null
      ? h.filter((x) => x.season === season)
      : h.filter((x) => t - x.t <= w.days * 864e5);
    out[w.name] = { n: sel.length,
      r: sel.length ? sel.reduce((a, b) => a + b.c, 0) / sel.length : null };
  }
  return out;
}

/* Blend the four windows, renormalising over whichever ones have data, then
 * shrink on the L30 count — the window his card headlines and gates on. */
function armScore(win, parkAdj) {
  let num = 0, den = 0;
  for (const w of WINDOWS) {
    const v = win[w.name];
    if (v.r === null) continue;
    num += w.w * v.r; den += w.w;
  }
  if (!den) return null;
  const s = shrink(num / den, win.L30.n);
  return s === null ? null : Math.max(0, Math.min(1, s + parkAdj));
}

const rows = [];
for (const g of games) {
  const t = D(g.date), adj = PARK_ADJ[g.venue] || 0;
  const aw = armWindows(g.ap, t, g.season), hw = armWindows(g.hp, t, g.season);
  const aS = armScore(aw, adj), hS = armScore(hw, adj);

  /* His gates, in his words. BLIND and THIN key off the L30 game count, which is
   * the count his card prints next to each arm. */
  const gates = [];
  if (aw.L30.n === 0 || hw.L30.n === 0) gates.push("BLIND");
  /* THIN is 1-3 starts, not 2-3. His card flags STL@CIN G1 THIN for "home 0% on
   * 1 starts", so a single start is thin, not merely non-blind. Written as 2-3
   * first, which left every n=1 arm ungated — and n=1 arms sit at 0% or 100% by
   * construction, so they pile into both ends of the score and were the reason
   * an unshrunk score looked like it separated. */
  const minN = Math.min(aw.L30.n, hw.L30.n);
  if (minN >= 1 && minN <= 3) gates.push("THIN");
  if ((aw.L30.r !== null && aw.L30.r < 0.5) || (hw.L30.r !== null && hw.L30.r < 0.5))
    gates.push("LEAK");
  if (g.venue === COORS) gates.push("COORS");

  rows.push({ date: g.date, nrfi: g.nrfi, gates,
    score: aS !== null && hS !== null ? 100 * aS * hS : null });

  hist.set(g.ap, (hist.get(g.ap) || []).concat({ t, season: g.season, c: g.apClean }));
  hist.set(g.hp, (hist.get(g.hp) || []).concat({ t, season: g.season, c: g.hpClean }));
}

// ---- reporting -------------------------------------------------------------
const rate = (a) => (a.length ? a.reduce((t, r) => t + r.nrfi, 0) / a.length : 0);
let seed = 20260817;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/* Date-clustered: a slate shares weather, calibration state and often starters,
 * so games are not independent draws. Same unit as every other NRFI script. */
function ci(sub) {
  if (!sub.length) return null;
  const byD = {};
  for (const r of sub) (byD[r.date] = byD[r.date] || []).push(r);
  const ds = Object.keys(byD), draws = [];
  for (let b = 0; b < B; b++) {
    const s = [];
    for (let i = 0; i < ds.length; i++) s.push(...byD[ds[Math.floor(rnd() * ds.length)]]);
    draws.push(100 * rate(s));
  }
  draws.sort((a, b) => a - b);
  return { obs: 100 * rate(sub), lo: draws[Math.floor(B * 0.025)], hi: draws[Math.floor(B * 0.975)] };
}
const line = (nm, sub) => {
  const c = ci(sub);
  if (!c) return console.log("  " + nm.padEnd(30) + "  (none)");
  console.log("  " + nm.padEnd(30) + String(sub.length).padStart(6) +
    ("  " + c.obs.toFixed(1) + "%").padStart(9) +
    `  [${c.lo.toFixed(1)}, ${c.hi.toFixed(1)}]`);
};

console.log(`NRFIKING MODE on ${rows.length} games, shrink K=${K}, league ${(100 * LG).toFixed(1)}%`);
console.log(`windows ${WINDOWS.map((w) => w.name + ":" + w.w).join(" ")} (days, not starts)`);
console.log("\nHIS GATES                          n     NRFI%   95% CI");
line("no gate fires (playable)", rows.filter((r) => !r.gates.length));
for (const gt of ["BLIND", "THIN", "LEAK", "COORS"])
  line(gt, rows.filter((r) => r.gates.includes(gt)));
line("any gate fires", rows.filter((r) => r.gates.length));

const play = rows.filter((r) => !r.gates.length && r.score !== null);
play.sort((a, b) => b.score - a.score);
console.log("\nSCORE DECILES on playable games only (his gates already applied)");
console.log("decile                             n     NRFI%   95% CI");
for (let d = 0; d < 10; d++) {
  const lo = Math.floor((d * play.length) / 10), hi = Math.floor(((d + 1) * play.length) / 10);
  const sub = play.slice(lo, hi);
  line(`${d + 1} (score ${sub[sub.length - 1].score.toFixed(1)}-${sub[0].score.toFixed(1)})`, sub);
}

/* He plays ONE game out of ~11, so the decile table is far too blunt to test him
 * — his actual selectivity is the top ~2%, and a method can be flat across
 * deciles while still having a sharp tip. This is the fair version of the test. */
console.log("\nEXTREME TOP — his real selectivity is one play per slate (~9%)");
console.log("slice                              n     NRFI%   95% CI");
for (const frac of [0.01, 0.02, 0.05, 0.09, 0.20]) {
  const sub = play.slice(0, Math.max(1, Math.floor(play.length * frac)));
  line(`top ${(100 * frac).toFixed(0)}% (score >=${sub[sub.length - 1].score.toFixed(1)})`, sub);
}
/* Break-even at the prices he actually posts. His card shows -113 on the lead
 * play, and his own record page reports an average price of -107. */
console.log("\n  break-even at -113 is 53.1%; at his stated average -107, 51.7%.");

console.log(`
Read the DECILES, not the gates. A gate that changes the NRFI rate by a point is
not doing the work — his gates exist to say "the score is untrustworthy here",
which is a claim about the SCORE, not about the base rate. The deciles are what
test whether his one input ranks games at all.

Nothing here is priced. A rung that wins 70% and is charged 70% earns nothing;
run this through nrfi-rung-roi.js before treating any tier as a bet.`);
