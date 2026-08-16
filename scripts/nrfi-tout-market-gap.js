// What does NRFIKINGKY see in the games OUR model ranks last?
//
//   node scripts/nrfi-tout-market-gap.js
//
// nrfi-tout-vs-model.js established the gap: across 326 of his first-inning
// legs he beats the other games in the same band of our ranking by +16.9 pts in
// our top half and +12.9 pts (2.2se) in our BOTTOM half. The bottom-half cell is
// the one that matters, because no ladder threshold can reach games our own
// ordering has already put below its median. Something separates those games
// and it is not us.
//
// This file tests the cheapest candidate first: PRICE. If the market had those
// games priced as likely NRFI while our model ranked them low, then the missing
// signal is not exotic, it is the line — and app.jsx already carries nrfiBlend
// for exactly that. If instead the market agreed with US and he beat both, then
// he is working off something neither the model nor the exchange has, and no
// amount of blending will find it.
//
// The two outcomes point at completely different work, which is why this runs
// before anything gets tuned.
//
// INPUTS, and their limits. Kalshi coverage starts 2026-06-10, while the tout
// cache runs the full season, so the joined sample is smaller than 326 and is
// drawn from the back half of the year. Prices are the pregame candlestick from
// nrfi-kalshi-bias.js (these markets close mid-first-inning, so "pregame" is
// ~35-50 min out). Doubleheaders are dropped: two games share a date and team
// pair, Kalshi lists one market per game, and nothing in our label says which.
const fs = require("fs");
const path = require("path");

const kal = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-kalshi-prices.json"), "utf8")).rows;
const mdl = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-tout-vs-model.json"), "utf8"));

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const pc = (x) => (x * 100).toFixed(1) + "%";
const seOf = (p, n) => (n ? Math.sqrt(p * (1 - p) / n) : 0);

// Same ticker parse as nrfi-vs-kalshi.js: KXMLBRFI-26AUG151915MILLAD is
// date(7) time(4) away+home codes. The team split is ambiguous from the left
// (MIL+LAD or MI+LLAD), so build the suffix we EXPECT from our own label and
// compare for equality instead of guessing.
const MON = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
const kalKey = new Map();
for (const r of kal) {
  const m = /^KXMLBRFI-(\d\d)([A-Z]{3})(\d\d)\d{4}([A-Z]+)$/.exec(r.ticker);
  if (!m) continue;
  kalKey.set(`20${m[1]}-${MON[m[2]]}-${m[3]}|${m[4]}`, r);
}

const slates = new Map(mdl.slates);
const byDate = new Map(mdl.byDate);

const dupe = new Map();
for (const [date, games] of mdl.slates) {
  for (const g of games) dupe.set(date + "|" + g.label, (dupe.get(date + "|" + g.label) || 0) + 1);
}

// His NRFI legs, keyed the same way the slate is.
const hisKeys = new Set();
for (const [date, picks] of byDate) {
  for (const x of picks) if (x.side === "NRFI" && x.gamePk != null) hisKeys.add(date + ":" + x.gamePk);
}

/* Percentile is computed WITHIN the day, against the same slate he chose from.
 * Doing it globally would confound "we rank this game low" with "this whole
 * slate scored low", and only the first is a statement about the game. */
const rows = [];
let noPrice = 0, dh = 0;
for (const [date, games] of mdl.slates) {
  const usable = games.filter((g) => g.p != null && g.actual != null);
  if (usable.length < 4) continue;
  for (const g of usable) {
    const m = /^([A-Z]+)@([A-Z]+)$/.exec(g.label || "");
    if (!m) continue;
    if (dupe.get(date + "|" + g.label) > 1) { dh++; continue; }
    const k = kalKey.get(date + "|" + m[1] + m[2]);
    if (!k) { noPrice++; continue; }
    const below = usable.filter((x) => x.p < g.p).length;
    const ties = usable.filter((x) => x.p === g.p).length;
    rows.push({
      date, label: g.label,
      p: g.p,                       // our model's P(NRFI)
      q: 1 - k.yes,                 // market-implied P(NRFI); the ticker asks "First Inning Run?"
      y: g.actual ? 1 : 0,
      nrfi: k.nrfi,
      pctl: (below + ties / 2) / usable.length,
      his: hisKeys.has(date + ":" + g.gamePk),
    });
  }
}

/* Orientation check, not decoration. `actual` is stored 0/1 with no documented
 * polarity and Kalshi's `nrfi` is independent of it; getting it backwards would
 * invert every conclusion in this file while still printing plausible numbers.
 * They must agree far more often than chance on the joined games. */
const agree = rows.filter((r) => (r.y === 1) === r.nrfi).length;
console.log("=================== JOIN ===================");
console.log(`  joined games        ${rows.length}   (dropped: ${noPrice} unpriced, ${dh} doubleheader)`);
console.log(`  his legs joined     ${rows.filter((r) => r.his).length}`);
console.log(`  polarity check      our 'actual' agrees with Kalshi settlement ${agree}/${rows.length} (${pc(agree / rows.length)})`);
if (rows.length && agree / rows.length < 0.95) {
  console.error("\nPOLARITY MISMATCH. Our actual and the exchange's settlement disagree on more");
  console.error("than 5% of joined games, so one of the two is being read backwards and every");
  console.error("number below would be inverted. Fix the join before reading this.");
  process.exit(1);
}
if (rows.filter((r) => r.his).length < 30) {
  console.error("\nToo few of his legs survived the join to say anything. Widen the Kalshi cache");
  console.error("(scripts/nrfi-kalshi-bias.js) before drawing a conclusion from this.");
  process.exit(1);
}

/* THE TEST. In each band of our own ranking, does the MARKET rate his picks
 * higher than it rates their band peers?
 *
 * Our p is roughly constant within a band by construction, so it cannot explain
 * anything there. The market price is free to vary, and if it tracks his
 * selection inside a band then the price is carrying the information we are
 * missing. */
console.log("\n============ IN EACH BAND OF OUR RANKING: WHAT DID THE MARKET THINK? ============");
console.log("  our band     n(his)  our p    market q on his   market q on peers   gap      his actual");
const band = (lo, hi) => rows.filter((r) => r.pctl >= lo && (hi >= 1 ? r.pctl <= 1 : r.pctl < hi));
for (let b = 0; b < 5; b++) {
  const B = band(b / 5, (b + 1) / 5);
  const H = B.filter((r) => r.his), P = B.filter((r) => !r.his);
  if (!H.length || !P.length) { console.log(`  ${String(b * 20).padStart(3)}-${String(b * 20 + 20).padStart(3)}%      ${String(H.length).padStart(3)}   (too thin to compare)`); continue; }
  const qh = mean(H.map((r) => r.q)), qp = mean(P.map((r) => r.q));
  console.log(`  ${String(b * 20).padStart(3)}-${String(b * 20 + 20).padStart(3)}%      ${String(H.length).padStart(3)}   ` +
    `${pc(mean(H.map((r) => r.p))).padStart(6)}   ${pc(qh).padStart(9)}         ${pc(qp).padStart(9)}       ` +
    `${((qh - qp) >= 0 ? "+" : "") + ((qh - qp) * 100).toFixed(1)}pts   ${pc(mean(H.map((r) => r.y))).padStart(6)}`);
}

const halves = [["our bottom half", 0, 0.5], ["our top half", 0.5, 1]];
console.log("\n============ THE BOTTOM-HALF CELL (where no threshold can reach) ============");
for (const [name, lo, hi] of halves) {
  const B = band(lo, hi);
  const H = B.filter((r) => r.his), P = B.filter((r) => !r.his);
  if (H.length < 10 || !P.length) { console.log(`  ${name}: only ${H.length} of his legs joined — too thin.`); continue; }
  const qh = mean(H.map((r) => r.q)), qp = mean(P.map((r) => r.q));
  const yh = mean(H.map((r) => r.y)), yp = mean(P.map((r) => r.y));
  const sd = Math.sqrt(seOf(yh, H.length) ** 2 + seOf(yp, P.length) ** 2);
  console.log(`\n  ${name}  (${H.length} of his legs vs ${P.length} peers)`);
  console.log(`    our model says      his ${pc(mean(H.map((r) => r.p)))}   peers ${pc(mean(P.map((r) => r.p)))}`);
  console.log(`    the market says     his ${pc(qh)}   peers ${pc(qp)}   -> market separates them by ${((qh - qp) * 100).toFixed(1)} pts`);
  console.log(`    what happened       his ${pc(yh)}   peers ${pc(yp)}   -> he beat them by ${((yh - yp) * 100).toFixed(1)} pts (${sd ? ((yh - yp) / sd).toFixed(1) : "?"} se)`);
}

/* READING.
 *
 * The bottom half is the diagnostic cell, and the market's separation there is
 * the whole question. Deliberately NOT an if/else on hit rate: the actual-result
 * column in a cell this size is the noisiest number on the page, while the
 * price column is an average of continuous values and settles far faster. Judge
 * the mechanism on the price, then check the result agrees. */
const BOT = band(0, 0.5);
const bh = BOT.filter((r) => r.his), bp = BOT.filter((r) => !r.his);
console.log("\n=================== READING ===================");
if (bh.length >= 10 && bp.length) {
  const sep = mean(bh.map((r) => r.q)) - mean(bp.map((r) => r.q));
  const ourSep = mean(bh.map((r) => r.p)) - mean(bp.map((r) => r.p));
  console.log(`  inside our bottom half, the market rated his picks ${(sep * 100).toFixed(1)} pts higher than their peers,`);
  console.log(`  while our model rated them ${(ourSep * 100).toFixed(1)} pts ${Math.abs(ourSep) < 0.005 ? "apart — i.e. it could not tell them apart at all" : "apart"}.`);
  if (sep > 0.03) {
    console.log("\n  -> THE MISSING SIGNAL IS LARGELY PRICE. The exchange separates the games our");
    console.log("     model cannot, in the exact cell where he beats us. This is the tractable");
    console.log("     version of the gap: app.jsx already has nrfiBlend, so the change is to");
    console.log("     weight the market into the ranking rather than to invent a new factor.");
    console.log("     Validate any such change against the run-to-run noise floor first");
    console.log("     (scripts/nrfi-cache-noise.js: ~7 plays of slate churn on a 379-play union).");
  } else if (sep < -0.03) {
    console.log("\n  -> The market rated his bottom-half picks LOWER than their peers, and he won");
    console.log("     anyway. That is not a signal we can buy off the screen; treat it as");
    console.log("     unexplained and do NOT tune toward it on this sample.");
  } else {
    console.log("\n  -> PRICE DOES NOT EXPLAIN IT. The market could not separate his bottom-half");
    console.log("     picks from their peers either, so blending the line in will not close the");
    console.log("     gap. Whatever he is using, neither our model nor the exchange prices it.");
    console.log("     Note before hunting for it: buildCtx hardcodes umpFactor to 1, so the");
    console.log("     backtest above scores a model WITHOUT the umpire term the live board");
    console.log("     applies. That is a gap between harness and board, not an unused input —");
    console.log("     the umpire table is hand-populated behind desk auth and a script cannot");
    console.log("     reach it (see nrfi-local-api.js). Treat these numbers as the model minus");
    console.log("     one live factor.");
  }
} else {
  console.log("  not enough of his legs joined in the bottom half to read this.");
}
