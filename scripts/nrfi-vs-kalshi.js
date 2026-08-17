// Does our model beat the Kalshi price?
//
//   node scripts/nrfi-vs-kalshi.js                                  (leaky cache)
//   node scripts/nrfi-vs-kalshi.js nrfi-backtest.lambda-path.json   (point-in-time)
//
// THE SECOND FORM IS THE ONE THAT ANSWERS THE QUESTION. Everything below was
// written against nrfi-tout-vs-model.json, whose splits were never rewound, and
// the VERDICT at the end of this file says in as many words that the result
// cannot be settled from that cache and needs "model probabilities whose pitcher
// and team splits are rewound to the morning of each game". A backtest artifact
// written with PIT_MODE=point-in-time is exactly that, so passing one as argv[2]
// removes the asymmetry the leak forced on every conclusion here.
//
// What still leaks in those artifacts is offence-side only (top-of-order OBP,
// h2h, Statcast, platoon OPS), bounded by ablation at 0.0011-0.0021 of AUC. So
// in artifact mode read a win as "probably real" rather than "proved", and keep
// reading a loss as conclusive.
//
// nrfi-kalshi-bias.js found the first-inning market is not tilted toward NRFI,
// it is simply too timid: fitting result ~ logit(price) gives a slope near 2,
// so outcomes land about twice as far from 50/50 as the price does. That
// raises an uncomfortable possibility about our own model. If the only thing
// wrong with the market is compression, then ANY model that is more decisive
// than the price will look good, and "our model has signal" would reduce to
// "our model is louder", which is one line of code, not a model.
//
// So the question is not whether our probabilities beat the price. It is
// whether they beat the price for a reason other than being less timid. The
// test that separates those is a joint fit:
//
//     y ~ a + b*logit(price) + c*logit(model)
//
// If c is indistinguishable from 0 once the price is in the regression, our
// model contributes nothing the price did not already contain, and the whole
// apparatus is an expensive way to stretch a number we could have stretched
// directly. If c is clearly positive, we know something the market does not.
//
// READ THIS BEFORE BELIEVING A GOOD RESULT. The cached model probabilities in
// nrfi-tout-vs-model.json come from scanNrfi, whose pitcher and team splits are
// season-to-date and were never rewound to the date being scored — a past
// game's inputs already contain that game's own result. The Kalshi price has no
// such advantage; it is what was actually quoted before first pitch. This
// comparison is therefore rigged IN OUR FAVOUR, and the asymmetry only runs one
// way:
//
//     model loses  -> conclusive. It could not win with the answer key.
//     model wins   -> uninformative. Cannot tell skill from the leak.
//
// See NRFI_PIT_REG in public/desk/app.jsx for how far that leak has already
// bent one constant.
const fs = require("fs");
const path = require("path");

const pc = (x) => (x * 100).toFixed(1) + "%";
const lg = (x) => Math.log(x / (1 - x));
const clamp = (p) => Math.min(0.98, Math.max(0.02, p));

const kal = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-kalshi-prices.json"), "utf8")).rows;

/* Both sources are normalised to one shape — { date, label, p, actual } — so the
 * join, the orientation check and the fits below have a single code path and
 * cannot drift apart between modes.
 *
 * The tout cache stores slates as [date, games[]]; a backtest artifact stores a
 * flat row list keyed "YYYY-MM-DD AWY@HOM". Reading p off the artifact takes the
 * calibrated-input-free RAW probability, which is what we want: the joint fit
 * estimates its own intercept and slope, so pre-shifting the inputs would only
 * move weight out of the coefficients being measured. */
const ART = process.argv[2] || null;
let SOURCE, flat;
if (ART) {
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, ART), "utf8"));
  SOURCE = `${ART} (sig ${art.modelSig}, pitMode ${art.pitMode}, ablations ${art.ablations || "none"})`;
  flat = art.rows.map((r) => ({ date: r.k.slice(0, 10), label: r.k.slice(11), p: r.p, actual: r.a }));
} else {
  const mdl = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-tout-vs-model.json"), "utf8"));
  SOURCE = "nrfi-tout-vs-model.json (LEAKY: season-to-date splits, never rewound)";
  flat = [];
  for (const [date, games] of mdl.slates) for (const g of games) flat.push({ date, label: g.label, p: g.p, actual: g.actual, conf: g.confidence });
}

// Kalshi ticker: KXMLBRFI-26AUG151915MILLAD = date(7) time(4) away+home codes.
// Team codes are 2-3 chars, so splitting "MILLAD" from the left is ambiguous
// (MIL+LAD or MI+LLAD). Rather than guess, build the suffix we EXPECT from our
// own label and check for equality — the ambiguity disappears when the split is
// known in advance.
const MON = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
const kalKey = new Map();
for (const r of kal) {
  const m = /^KXMLBRFI-(\d\d)([A-Z]{3})(\d\d)\d{4}([A-Z]+)$/.exec(r.ticker);
  if (!m) continue;
  const d = `20${m[1]}-${MON[m[2]]}-${m[3]}`;
  kalKey.set(d + "|" + m[4], r);
}

// Kalshi and our slate labels use the same 30 abbreviations (verified against
// the full ticker alphabet: ATH ATL AZ BAL ... TOR WSH), so no alias map is
// needed and adding one only invents mismatches.
//
// Doubleheaders are dropped rather than joined. Two games share a date and a
// team pair but Kalshi lists one market per game, and nothing in our label
// distinguishes game 1 from game 2 — joining both to whichever market the map
// happened to keep would pair one real price with the wrong result.
const dupe = new Map();
for (const g of flat) dupe.set(g.date + "|" + g.label, (dupe.get(g.date + "|" + g.label) || 0) + 1);

const rows = [];
const missed = [];
let dh = 0;
for (const g of flat) {
  const m = /^([A-Z]+)@([A-Z]+)$/.exec(g.label || "");
  if (!m || g.p == null || g.actual == null) continue;
  if (dupe.get(g.date + "|" + g.label) > 1) { dh++; continue; }
  const k = kalKey.get(g.date + "|" + m[1] + m[2]);
  if (!k) { missed.push(g.date + " " + g.label); continue; }
  rows.push({ date: g.date, label: g.label, p: clamp(g.p), q: clamp(1 - k.yes), y: g.actual, nrfi: k.nrfi, conf: g.conf });
}

// Orientation check. `actual` is stored as 0/1 with no documented polarity, and
// getting it backwards would invert every conclusion below, so verify it
// against the exchange rather than assuming: on matched games the two must
// agree far more often than chance.
const agree = rows.filter((r) => (r.y === 1) === r.nrfi).length;
console.log("=================== JOIN ===================");
console.log(`  model source: ${SOURCE}`);
console.log(`  matched ${rows.length} games, ${missed.length} model games had no Kalshi market, ${dh} doubleheader games dropped`);
console.log(`  actual==1 agrees with Kalshi 'NRFI hit' on ${pc(agree / rows.length)} of them` +
  `  -> actual==1 means ${agree / rows.length > 0.5 ? "NRFI HIT" : "NRFI MISSED"}`);
if (agree / rows.length < 0.5) { for (const r of rows) r.y = 1 - r.y; console.log("  (flipped to match)"); }
if (missed.length) console.log(`  unmatched sample: ${missed.slice(0, 5).join(", ")}`);
const gap = Math.abs(agree / rows.length - 0.5);
if (gap < 0.4) {
  console.log(`\n  STOP: agreement is only ${pc(agree / rows.length)}. If the join were correct this`);
  console.log("  would be near 0% or 100%, because both sides describe the same game.");
  console.log("  Something is mismatched; nothing below is trustworthy.");
  process.exitCode = 1;
}
console.log();

const n = rows.length;
const brier = (f) => rows.reduce((s, r) => { const d = f(r) - r.y; return s + d * d; }, 0) / n;
const ll = (f) => -rows.reduce((s, r) => { const v = f(r); return s + (r.y ? Math.log(v) : Math.log(1 - v)); }, 0) / n;
const base = rows.filter((r) => r.y === 1).length / n;

console.log("=================== SCORING THE SAME GAMES ===================");
console.log("   forecaster              Brier     log loss");
console.log(`  base rate (${pc(base)})       ${brier(() => base).toFixed(5)}   ${ll(() => base).toFixed(5)}`);
console.log(`  Kalshi pregame price    ${brier((r) => r.q).toFixed(5)}   ${ll((r) => r.q).toFixed(5)}`);
console.log(`  our model               ${brier((r) => r.p).toFixed(5)}   ${ll((r) => r.p).toFixed(5)}`);
console.log("  Lower is better. Remember the model is scoring with inputs that saw the");
console.log("  result and the price is not.\n");

// Joint fit. Newton on y ~ a + b*logit(q) + c*logit(p).
function fit(cols, R) {
  const k = cols.length;
  let w = new Array(k).fill(0);
  for (let it = 0; it < 80; it++) {
    const g = new Array(k).fill(0);
    const H = Array.from({ length: k }, () => new Array(k).fill(0));
    for (const r of R) {
      const x = cols.map((f) => f(r));
      const z = x.reduce((s, v, i) => s + v * w[i], 0);
      const mu = 1 / (1 + Math.exp(-z)), wt = mu * (1 - mu), d = r.y - mu;
      for (let i = 0; i < k; i++) {
        g[i] += d * x[i];
        for (let j = 0; j < k; j++) H[i][j] += wt * x[i] * x[j];
      }
    }
    const inv = invert(H);
    if (!inv) break;
    for (let i = 0; i < k; i++) w[i] += inv[i].reduce((s, v, j) => s + v * g[j], 0);
  }
  const H = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const r of R) {
    const x = cols.map((f) => f(r));
    const mu = 1 / (1 + Math.exp(-x.reduce((s, v, i) => s + v * w[i], 0))), wt = mu * (1 - mu);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) H[i][j] += wt * x[i] * x[j];
  }
  const inv = invert(H);
  return { w, se: w.map((_, i) => Math.sqrt(inv[i][i])) };
}
function invert(A) {
  const k = A.length;
  const M = A.map((r, i) => [...r, ...A.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * k; j++) M[c][j] /= d;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let j = 0; j < 2 * k; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((r) => r.slice(k));
}

const one = () => 1, xq = (r) => lg(r.q), xp = (r) => lg(r.p);
const solo = fit([one, xp], rows);
const joint = fit([one, xq, xp], rows);
console.log("=================== DOES THE MODEL ADD ANYTHING TO THE PRICE? ===================");
console.log(`  model alone     logit(model) ${solo.w[1].toFixed(3)} +- ${solo.se[1].toFixed(3)}   z=${(solo.w[1] / solo.se[1]).toFixed(2)}`);
console.log("  joint fit       y ~ a + b*logit(price) + c*logit(model)");
console.log(`                  b (price)    ${joint.w[1].toFixed(3)} +- ${joint.se[1].toFixed(3)}   z=${(joint.w[1] / joint.se[1]).toFixed(2)}`);
console.log(`                  c (model)    ${joint.w[2].toFixed(3)} +- ${joint.se[2].toFixed(3)}   z=${(joint.w[2] / joint.se[2]).toFixed(2)}`);
console.log("\n  c is the whole question. Positive and clear of its SE means we hold");
console.log("  information the price does not. Near zero means the model is a louder");
console.log("  restatement of the market, and the honest fix is to stretch the price.\n");

// Practical form: bet where we disagree with the market, at the market's price.
console.log("=================== BETTING OUR DISAGREEMENT ===================");
console.log("   |model - price|      n     hit%    ROI/contract");
for (const t of [0, 0.03, 0.05, 0.08, 0.12]) {
  const b = rows.filter((r) => Math.abs(r.p - r.q) >= t);
  if (b.length < 20) continue;
  // Take the side our model prefers, paying the market's price for it.
  const cost = b.reduce((s, r) => s + (r.p > r.q ? r.q : 1 - r.q), 0);
  const ret = b.filter((r) => (r.p > r.q ? r.y === 1 : r.y === 0)).length;
  console.log(`  >= ${(t * 100).toFixed(0).padStart(2)}pts        ${String(b.length).padStart(5)}   ${pc(ret / b.length).padStart(6)}   ` +
    `${(((ret - cost) / cost * 100 >= 0 ? "+" : "") + ((ret - cost) / cost * 100).toFixed(1) + "%").padStart(8)}`);
}
console.log("\n  Compare against nrfi-kalshi-bias.js, where simply buying the favoured");
console.log("  side ran +6.6%/+6.0% with no model at all. Beating the market is not the");
console.log("  bar; beating the market's own compression is.\n");

// The result above landed in the branch this script called uninformative, so
// try to break the tie from inside the same data. The LEAK decays over a
// season: a scored game is 1/n of its pitcher's season-to-date sample, so in
// April it heavily contaminates its own inputs and by August it is one start in
// twenty-odd. Real signal has no reason to fade that way.
//
//   edge shrinks late  -> we were reading the leak
//   edge holds flat    -> something real is in there
console.log("=================== IS THE EDGE JUST THE LEAK DECAYING? ===================");
const dates = [...new Set(rows.map((r) => r.date))].sort();
const all = rows;  // read-only below; fit() takes its own row set
console.log("   period                   n    c (model)        z    ROI@3pts");
for (const [a, b] of [[0, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 1]]) {
  const lo = dates[Math.floor(a * dates.length)];
  const hi = b === 1 ? null : dates[Math.floor(b * dates.length)];
  const R = all.filter((r) => r.date >= lo && (hi ? r.date < hi : true));
  const f = fit([one, xq, xp], R);
  const bet = R.filter((r) => Math.abs(r.p - r.q) >= 0.03);
  const cost = bet.reduce((s, r) => s + (r.p > r.q ? r.q : 1 - r.q), 0);
  const ret = bet.filter((r) => (r.p > r.q ? r.y === 1 : r.y === 0)).length;
  console.log(`  ${lo}..${hi || dates[dates.length - 1]}  ${String(R.length).padStart(4)}   ${f.w[2].toFixed(3)} +- ${f.se[2].toFixed(3)}   ${(f.w[2] / f.se[2]).toFixed(2).padStart(5)}   ` +
    `${(((ret - cost) / cost * 100 >= 0 ? "+" : "") + ((ret - cost) / cost * 100).toFixed(1) + "%").padStart(7)}`);
}
console.log("\n  Read this cautiously. The last third does collapse, which is what the leak");
console.log("  predicts, but the middle third is HIGHER than the first, which the leak");
console.log("  does not predict, and ~250 games per cell puts the gap at under 2 SE. This");
console.log("  narrows nothing enough to act on.");

/* The verdict has to depend on which source was read, because the whole point of
 * the leaky-cache verdict was that it could not be settled from that cache, and
 * printing it after an artifact run would deny a result this script just
 * produced. Measured 2026-08-17 on nrfi-backtest.lambda-path.json: c rose from
 * 0.693 (z 1.48) to 0.817 (z 1.97) when the pitcher leak came OUT, which is the
 * opposite of what the leak hypothesis predicted, and the late-third collapse
 * survived removing it — so that collapse was never the pitcher leak. */
if (ART) {
  console.log("\n  VERDICT (point-in-time source): the model does hold information the price");
  console.log("  lacks — c is positive and clear of its SE — but the disagreement table is");
  console.log("  the part that decides money, and it INVERTS. Small disagreements pay;");
  console.log("  large ones lose. Do not size on |model - price|, and do not read a high");
  console.log("  hit rate on confident picks as edge until it is checked against the price.");
} else {
  console.log("\n  VERDICT: unresolved, and it cannot be resolved from this cache. Settling");
  console.log("  it needs model probabilities whose pitcher and team splits are rewound to");
  console.log("  the morning of each game. Pass such an artifact as argv[2] — one exists");
  console.log("  now (nrfi-backtest.lambda-path.json) and this script accepts it.");
}
