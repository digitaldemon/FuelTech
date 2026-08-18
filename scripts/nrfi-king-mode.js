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
 * THE WINDOWS ARE TEAM GAMES. Not starts, and not days either. "L30" is the
 * pitcher's starts inside the last thirty games HIS TEAM has played.
 *
 * This was already decoded and verified in app.jsx (see the comment on
 * pitcherRollingNRFI): for Woo and Brown on 2026-08-16, all eight cells
 * (SZN/L50/L30/L10, pct and n) reproduce exactly under team games and under no
 * other reading. This script was first written on DAYS, which is the reading
 * app.jsx had already tested and rejected — Woo has an 11-day gap in July, so 50
 * days is 7 starts where 50 team games is 9. Days is close enough to look right
 * on a summary table and wrong on any individual arm.
 *
 * Starts is the reading to rule out first and is obviously wrong: a 30-START
 * window is most of two seasons and could never show the "5gs" his card prints.
 *
 * Team games also hold ~5-6 starts for any healthy rotation regular regardless
 * of off-days, rainouts or the All-Star break, where a day window swings 5 to 7
 * on schedule shape alone. Stable n is the entire point of gating on n.
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

/* His four windows. SZN is season-to-date; the rest are trailing TEAM GAMES. */
const WINDOWS = [
  { name: "SZN", tg: null, w: 0.25 },
  { name: "L50", tg: 50, w: 0.25 },
  { name: "L30", tg: 30, w: 0.35 }, // headline window on his card, weighted most
  { name: "L10", tg: 10, w: 0.15 },
];

/* Park flags, exactly the three he names and exactly +-2%, applied to the arms.
 * COL is absent on purpose: he does not dock Coors, he refuses the game (below). */
const PARK_ADJ = { 113: -0.02, 112: -0.02, 134: +0.02 }; // GABP, Wrigley, PNC
const COORS = 19;

const D = (d) => Date.parse(d + "T00:00:00Z");
const hist = new Map(); // pid -> [{date, season, c}]

/* Every date each club played, in order — the ruler the windows are measured
 * against. A doubleheader legitimately counts twice: it is two team games, and
 * that is what "last thirty games the team has played" means. Built up as the
 * walk proceeds so it never contains future dates. */
const teamDates = new Map();
const pushTeamDate = (tid, date) => {
  if (!teamDates.has(tid)) teamDates.set(tid, []);
  teamDates.get(tid).push(date);
};
/* Cut-off date for the last n games of team tid. Starts on or after this date
 * are inside the window. Returns null when the club has not yet played n games,
 * in which case the window is simply everything so far. */
const cutFor = (tid, n) => {
  const ds = teamDates.get(tid) || [];
  return ds.length ? ds[Math.max(0, ds.length - n)] : null;
};

/* Shrink toward the league rate by start count. This is what makes his
 * thin-sample games rank below their raw mean, and it is why LAD@COL (raw mean
 * 70) sits under STL@CIN G1 (raw mean 50) on his own board. */
const shrink = (r, n) => (n > 0 ? (n * r + K * LG) / (n + K) : null);

function armWindows(pid, tid, season) {
  const h = hist.get(pid) || [];
  const out = {};
  for (const w of WINDOWS) {
    let sel;
    if (w.tg === null) {
      sel = h.filter((x) => x.season === season);
    } else {
      const cut = cutFor(tid, w.tg);
      // A start made for a PREVIOUS club still counts against the current club's
      // schedule after a trade: the window is "recent form", not a team stat, and
      // dropping those starts loses real innings. Same choice app.jsx documents.
      sel = cut === null ? h.slice() : h.filter((x) => x.date >= cut);
    }
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
  const adj = PARK_ADJ[g.venue] || 0;
  // Windows read the schedule BEFORE this game is added to it, so the ruler
  // never includes the game being predicted.
  const aw = armWindows(g.ap, g.away, g.season), hw = armWindows(g.hp, g.home, g.season);
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

  hist.set(g.ap, (hist.get(g.ap) || []).concat({ date: g.date, season: g.season, c: g.apClean }));
  hist.set(g.hp, (hist.get(g.hp) || []).concat({ date: g.date, season: g.season, c: g.hpClean }));
  pushTeamDate(g.away, g.date);
  pushTeamDate(g.home, g.date);
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
