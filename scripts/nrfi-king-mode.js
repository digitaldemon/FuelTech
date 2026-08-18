/* NRFIKING MODE — his published equation, measured on our data.
 *
 *   node scripts/nrfi-king-mode.js [shrinkK]
 *
 * WHAT THIS IS. NRFIKINGKY's app (nrfi-edge.replit.app) publishes its equation
 * in full, in the "How the dual score works" dialog behind the ⓘ on his board.
 * This implements it:
 *
 *   PER ARM   blend 60% season + 40% L30 clean-1st%
 *             shrink toward the 78% league rate by adding 10 phantom league
 *               starts to the SEASON start count
 *             capped +-3% adjustment for park tier and opposing-lineup YRFI
 *   SCORE     product of the two adjusted arms
 *   TIERS     ELITE >=68, GREEN 64-67.9, YELLOW 58-63.9, RED <58
 *             <52 with exactly one leaky arm flips to a YRFI candidate
 *   GATES     BLIND / THIN (1-3 starts) / COORS auto-pass; LEAK is a soft flag
 *
 * AN EARLIER VERSION OF THIS HEADER SAID THE EQUATION WAS UNPUBLISHED AND
 * UNRECOVERABLE. It was wrong, and the reason is worth keeping: the claim rested
 * on "his tier boundaries are 0.7 points apart (GREEN 64.5 vs YELLOW 63.8)",
 * which misread two GAMES' SCORES as a boundary. His bands are 4-6 points wide.
 * Believing they were sub-point made every candidate fit look hopeless and
 * stopped the search one click short of the dialog that spells it all out.
 *
 * THE ONE THING HIS DIALOG LEAVES OPEN is what the 10 phantom starts are added
 * TO. Fitted against 10 of his boards, the season start count lands RMSE 2.21
 * and the L30 count lands 6.53 — season, and his own worked examples then
 * reproduce exactly (100% over 5 starts -> 85.3, "~85"; over 1 start -> 80.0,
 * "~80"). L50 and L10 do not enter the score at all; his card calls L10
 * display-only.
 *
 * HIS LINEUP TERM IS NOT IMPLEMENTED. Only the park half of his +-3% adjustment
 * is here. The lineup half fits with a backwards sign against his boards and its
 * intercept pins to the edge of the search, i.e. it absorbs a constant offset
 * rather than measuring anything — and his card rounds SZN and L30 to whole
 * percents, which floors any board-fitted RMSE around 0.5-0.9 anyway. Leaving it
 * out costs about a point on some cards. Adding a fitted version would cost
 * honesty.
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

const K = Number(process.argv[2] || 10); // his 10 phantom league-average starts
const LG = 0.78;                         // his stated league scoreless-1st rate
const ADJ_CAP = 0.03;                    // his cap on the whole park+lineup adjustment
const TIERS = { elite: 68, green: 64, yellow: 58 };
const YRFI_FLIP = 52;
const B = 4000;

const { games } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "nrfi-leakfree-games.json"), "utf8"));
games.sort((a, b) => a.date.localeCompare(b.date) || a.pk - b.pk);

/* His windows. SZN is season-to-date; L30 is trailing TEAM GAMES. Only these two
 * carry weight — his dialog puts the blend at 60/40 and calls L10 display-only.
 * L50 and L10 are still computed because the gates and his card read them, but
 * they are scored at w:0. */
const WINDOWS = [
  { name: "SZN", tg: null, w: 0.60 },
  { name: "L50", tg: 50, w: 0 },
  { name: "L30", tg: 30, w: 0.40 }, // headline window on his card, and his gates
  { name: "L10", tg: 10, w: 0 },
];

/* Park flags, exactly the three he names and exactly +-2%, applied to the arms.
 * COL is absent on purpose: he does not dock Coors, he refuses the game (below). */
const PARK_ADJ = { 113: -0.02, 112: -0.02, 134: +0.02 }; // GABP, Wrigley, PNC
const capAdj = (a) => Math.max(-ADJ_CAP, Math.min(ADJ_CAP, a));
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

/* Blend the scoring windows, renormalising over whichever ones have data, then
 * shrink on the SEASON start count. Season, not L30 — that is the one thing his
 * dialog does not state and it is worth 4.3 RMSE points against his boards; see
 * the header. It also has to be season for his own worked examples to work,
 * since he says "a 100% arm over 5 starts" without naming any window. */
function armScore(win, parkAdj) {
  let num = 0, den = 0;
  for (const w of WINDOWS) {
    const v = win[w.name];
    if (v.r === null) continue;
    num += w.w * v.r; den += w.w;
  }
  if (!den) return null;
  const s = shrink(num / den, win.SZN.n);
  return s === null ? null : Math.max(0, Math.min(1, s + parkAdj));
}

const rows = [];
for (const g of games) {
  const adj = capAdj(PARK_ADJ[g.venue] || 0);
  // Windows read the schedule BEFORE this game is added to it, so the ruler
  // never includes the game being predicted.
  const aw = armWindows(g.ap, g.away, g.season), hw = armWindows(g.hp, g.home, g.season);
  const aS = armScore(aw, adj), hS = armScore(hw, adj);

  /* His gates, in his words. BLIND and THIN key off the L30 game count, which is
   * the count his card prints next to each arm.
   *
   * LEAK IS NOT IN HERE and used to be. His dialog separates hard flags (which
   * stop a game showing green) from the "<52 with one leaky arm flips to YRFI"
   * rule — a leaky arm is how he FINDS the other side, so auto-passing it
   * deleted his entire YRFI book from this measurement. Same error shape as
   * filtering a board on p>=threshold and reporting a confident zero. It is a
   * soft flag below, and it decides the SIDE. */
  const gates = [];
  if (aw.L30.n === 0 || hw.L30.n === 0) gates.push("BLIND");
  /* THIN is 1-3 starts, not 2-3. His card flags STL@CIN G1 THIN for "home 0% on
   * 1 starts", so a single start is thin, not merely non-blind. Written as 2-3
   * first, which left every n=1 arm ungated — and n=1 arms sit at 0% or 100% by
   * construction, so they pile into both ends of the score and were the reason
   * an unshrunk score looked like it separated. */
  const minN = Math.min(aw.L30.n, hw.L30.n);
  if (minN >= 1 && minN <= 3) gates.push("THIN");
  if (g.venue === COORS) gates.push("COORS");

  const aLeak = aw.L30.r !== null && aw.L30.r < 0.5;
  const hLeak = hw.L30.r !== null && hw.L30.r < 0.5;
  const leak = aLeak || hLeak;
  const score = aS !== null && hS !== null ? 100 * aS * hS : null;
  /* The side he would actually take. Every rate below is scored on THIS side —
   * `won` is 1 when the bet cashes, not when NRFI happens. Reporting NRFI% on a
   * YRFI play is how a book that goes 6-3 gets filed as 33%. */
  const side = score !== null && score < YRFI_FLIP && (aLeak !== hLeak) ? "YRFI" : "NRFI";
  rows.push({ date: g.date, nrfi: g.nrfi, gates, leak, side, score,
    won: side === "YRFI" ? 1 - g.nrfi : g.nrfi });

  hist.set(g.ap, (hist.get(g.ap) || []).concat({ date: g.date, season: g.season, c: g.apClean }));
  hist.set(g.hp, (hist.get(g.hp) || []).concat({ date: g.date, season: g.season, c: g.hpClean }));
  pushTeamDate(g.away, g.date);
  pushTeamDate(g.home, g.date);
}

// ---- reporting -------------------------------------------------------------
/* WIN rate on the side taken, not NRFI rate. The two differ only on the YRFI
 * flips, but that is exactly the subset the flip rule exists to create, so
 * scoring it as NRFI would grade his best idea upside-down. */
const rate = (a) => (a.length ? a.reduce((t, r) => t + r.won, 0) / a.length : 0);
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

console.log(`NRFIKING MODE on ${rows.length} games — his published equation`);
console.log(`blend ${WINDOWS.filter((w) => w.w).map((w) => w.name + ":" + w.w).join(" + ")}` +
  `, shrink ${K} phantom starts toward ${(100 * LG).toFixed(0)}% on SEASON GS` +
  `, park +-2% capped at +-${(100 * ADJ_CAP).toFixed(0)}%`);
console.log(`tiers ${TIERS.elite}/${TIERS.green}/${TIERS.yellow}, YRFI flip under ${YRFI_FLIP} with one leaky arm`);
console.log("\nHIS GATES                          n      WIN%   95% CI");
line("no gate fires (playable)", rows.filter((r) => !r.gates.length));
for (const gt of ["BLIND", "THIN", "COORS"])
  line(gt, rows.filter((r) => r.gates.includes(gt)));
line("any gate fires", rows.filter((r) => r.gates.length));

const play = rows.filter((r) => !r.gates.length && r.score !== null);
/* LEAK is soft, so leaky games are IN the playable pool. Both sides are shown:
 * the flip is a real book and burying it inside a decile would hide it. */
console.log("\nSOFT FLAG AND SIDE                 n      WIN%   95% CI");
line("leaky arm present", play.filter((r) => r.leak));
line("  of those, flipped to YRFI", play.filter((r) => r.side === "YRFI"));
line("  of those, still NRFI", play.filter((r) => r.leak && r.side === "NRFI"));
line("no leak", play.filter((r) => !r.leak));

console.log("\nHIS TIERS (soft flag caps a flagged game at YELLOW)");
console.log("tier                               n      WIN%   95% CI");
const tierOf = (r) => {
  if (r.side === "YRFI") return "YRFI";
  const t = r.score >= TIERS.elite ? "ELITE" : r.score >= TIERS.green ? "GREEN"
    : r.score >= TIERS.yellow ? "YELLOW" : "RED";
  return r.leak && (t === "ELITE" || t === "GREEN") ? "YELLOW" : t;
};
for (const t of ["ELITE", "GREEN", "YELLOW", "RED", "YRFI"])
  line(t, play.filter((r) => tierOf(r) === t));

play.sort((a, b) => b.score - a.score);
console.log("\nSCORE DECILES on playable games only (his gates already applied)");
console.log("decile                             n      WIN%   95% CI");
for (let d = 0; d < 10; d++) {
  const lo = Math.floor((d * play.length) / 10), hi = Math.floor(((d + 1) * play.length) / 10);
  const sub = play.slice(lo, hi);
  line(`${d + 1} (score ${sub[sub.length - 1].score.toFixed(1)}-${sub[0].score.toFixed(1)})`, sub);
}

/* He plays ONE game out of ~11, so the decile table is far too blunt to test him
 * — his actual selectivity is the top ~2%, and a method can be flat across
 * deciles while still having a sharp tip. This is the fair version of the test. */
console.log("\nEXTREME TOP — his real selectivity is one play per slate (~9%)");
console.log("slice                              n      WIN%   95% CI");
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
