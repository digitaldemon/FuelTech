// How much should a starter's own first-inning run rate be trusted?
//
//   node scripts/nrfi-pitreg-fit.js [replicates]
//
// NRFI_PIT_REG = 12 (app.jsx:5239) is the regression weight in
//
//     nrfiRegress(rate, sample, reg) = (rate*sample + 0.52*reg) / (sample + reg)
//
// which sets the pitcher's baseline lambda at app.jsx:6688-6689. It is not a
// display knob: it feeds the probability that prices the wager. At reg = 12 a
// pitcher with 20 starts keeps 20/32 = 63% of his own observed rate.
//
// That number was never measured. The reason to doubt it: the same data says a
// starter's clean-first-inning SHARE has a beta-binomial concentration of ~88
// starts (scripts/nrfi-pitcherbt-rebuild.js), i.e. a 20-start sample is only
// ~19% reliable. If the run RATE behaves anything like the clean share, keeping
// 63% of it is trusting the arm four times harder than the evidence supports.
//
// Those are not the same statistic, though — a rate over dispersed counts can
// carry more signal per start than a bit does, so the clean-share k is a reason
// to test, not an answer. This is the test.
//
// METHOD. Split each arm's starts at random into halves A and B. Predict every
// held-out start in B with the shrunk estimate from A, and score squared error
// against the actual run count. Sweep reg; the minimum is the weight that
// genuinely predicts out of sample. Repeat over many random splits, because a
// single split of ~17 starts is noise.
//
// WHAT THIS TEST IS AND IS NOT. Splitting within a career measures "how much of
// this arm's observed rate is repeatable" — which is exactly the question
// nrfiRegress asks. It does NOT measure drift: the live model predicts forward
// from season-to-date, so if an arm's true rate moves over time the honest reg
// is HEAVIER than what a random within-arm split reports. Read the answer as a
// lower bound on how much to regress.
//
// SO IT ALSO RUNS WALK-FORWARD, which is the live setting exactly: order an
// arm's starts by gamePk (which is monotone in date — the largest gap in any
// arm's sequence is the season boundary) and predict each start from only the
// ones before it. That has no leakage of any kind and it does see drift.
//
// The walk-forward number is the one to trust, and the reason it matters here is
// that the ladder backtest CANNOT adjudicate this constant. scanNrfi reads
// season-to-date pitcher splits that were never rewound, so the rate feeding
// nrfiRegress on a past date already contains that date's result: an arm shelled
// in the 1st that afternoon looks worse in the line the model reads. Trusting
// that rate harder mines the leak, so a leaky backtest will always prefer a
// LIGHTER reg regardless of what predicts real games. Held-out error on raw
// outcomes is the only clean evidence available, which is why it decides.
const fs = require("fs");
const path = require("path");

const STARTS = path.join(__dirname, "nrfi-pitcherbt-starts.json");
const APP = path.join(__dirname, "..", "public", "desk", "app.jsx");
const REPS = Number(process.argv[2] || 200);

if (!fs.existsSync(STARTS)) {
  console.error("no per-start data — run: node scripts/nrfi-pitcherbt-rebuild.js");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(STARTS, "utf8"));
const src = fs.readFileSync(APP, "utf8");
const num = (name) => {
  const m = src.match(new RegExp("const " + name + " = (-?[\\d.]+)"));
  if (!m) throw new Error("could not read " + name + " from app.jsx");
  return Number(m[1]);
};
// Read the live constants rather than restating them: a test that hardcodes the
// value it is checking stops being a check the moment someone edits app.jsx.
const LG = num("NRFI_LG_LAMBDA");
const SHIPPED = num("NRFI_PIT_REG");

// Both halves have to be non-empty for a held-out score to exist at all.
const arms = data.arms.filter((a) => a.log.length >= 8);
const allRuns = arms.flatMap((a) => a.log.map((x) => x.runs));
const obsMean = allRuns.reduce((s, x) => s + x, 0) / allRuns.length;

console.log(`out-of-sample fit for NRFI_PIT_REG over ${arms.length} starters, ` +
  `${allRuns.length} starts (${data.seasons.join(" + ")})`);
console.log(`scanned ${data.at}`);
console.log(`shrink target NRFI_LG_LAMBDA = ${LG}; observed mean is ${obsMean.toFixed(3)} runs/start`);
console.log(`shipped NRFI_PIT_REG = ${SHIPPED}\n`);

const GRID = [];
for (let r = 0; r <= 40; r += 1) GRID.push(r);
for (let r = 45; r <= 300; r += 5) GRID.push(r);

// One replicate = one random half-split of every arm, scored across the whole
// grid. Returns total held-out squared error per reg, plus the per-arm terms so
// the bootstrap below can resample arms rather than starts (arms are the unit of
// independence here — two starts by the same pitcher are not independent).
function replicate() {
  const perArm = arms.map((a) => {
    const idx = a.log.map((x, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const half = Math.floor(idx.length / 2);
    const A = idx.slice(0, half).map((i) => a.log[i].runs);
    const B = idx.slice(half).map((i) => a.log[i].runs);
    const sumA = A.reduce((s, x) => s + x, 0);
    return GRID.map((reg) => {
      const est = (sumA + LG * reg) / (A.length + reg);
      let sse = 0;
      for (const y of B) sse += (est - y) * (est - y);
      return sse;
    });
  });
  return perArm;
}

const totals = new Array(GRID.length).fill(0);
let heldOut = 0;
const armSums = arms.map(() => new Array(GRID.length).fill(0));
for (let rep = 0; rep < REPS; rep++) {
  const perArm = replicate();
  for (let i = 0; i < perArm.length; i++) {
    for (let g = 0; g < GRID.length; g++) { totals[g] += perArm[i][g]; armSums[i][g] += perArm[i][g]; }
  }
}
for (const a of arms) heldOut += (a.log.length - Math.floor(a.log.length / 2)) * REPS;

let bi = 0;
for (let g = 1; g < GRID.length; g++) if (totals[g] < totals[bi]) bi = g;
const mse = (g) => totals[g] / heldOut;

// Bootstrap over ARMS. The curve is very flat near its minimum — squared error
// on individual start counts is mostly irreducible — so a point estimate here
// would be over-read exactly the way the old pitcher table was. Print the band.
const BOOT = 1000;
const bestRegs = [];
for (let b = 0; b < BOOT; b++) {
  const acc = new Array(GRID.length).fill(0);
  for (let i = 0; i < arms.length; i++) {
    const pick = armSums[(Math.random() * arms.length) | 0];
    for (let g = 0; g < GRID.length; g++) acc[g] += pick[g];
  }
  let m = 0;
  for (let g = 1; g < GRID.length; g++) if (acc[g] < acc[m]) m = g;
  bestRegs.push(GRID[m]);
}
bestRegs.sort((a, b) => a - b);
const bLo = bestRegs[Math.floor(BOOT * 0.025)], bHi = bestRegs[Math.floor(BOOT * 0.975)];

console.log("=================== HELD-OUT ERROR BY REGRESSION WEIGHT ===================");
console.log("    reg      held-out MSE     vs shipped");
const si = GRID.indexOf(SHIPPED);
const show = [0, 4, 8, 12, 16, 20, 25, 30, 40, 60, 80, 100, 150, 200, 300].filter((r) => GRID.includes(r));
for (const r of show) {
  const g = GRID.indexOf(r);
  const d = mse(g) - mse(si);
  console.log(`  ${String(r).padStart(5)}      ${mse(g).toFixed(6)}     ${(d >= 0 ? "+" : "") + d.toFixed(6)}${g === bi ? "   <== best" : ""}${r === SHIPPED ? "   (shipped)" : ""}`);
}
console.log(`\n  best reg on ${REPS} random half-splits: ${GRID[bi]}`);
console.log(`  bootstrap 95% CI over arms:  [${bLo}, ${bHi}]  (${BOOT} resamples)`);
const inside = SHIPPED >= bLo && SHIPPED <= bHi;
console.log(`  => shipped ${SHIPPED} is ${inside ? "INSIDE" : "OUTSIDE"} that interval.`);

// The MSE difference is the wrong unit for a betting decision. Translate it: how
// far does the pitcher baseline actually move between the two weights, for an
// arm at a realistic sample and a realistic distance from league average?
// ---------------------------------------------------------------------------
// WALK-FORWARD. Same sweep, but each start is predicted from only its
// predecessors, so this measures what the live model actually does.
//
// MIN_PRIOR exists because the first start of a career is predicted by the
// league mean under every reg, which contributes identical error to every grid
// point and only flattens the curve. Starting at 3 keeps the comparison about
// starts where the weight can actually differ.
const MIN_PRIOR = 3;
const wfArm = arms.map((a) => {
  const seq = a.log.slice().sort((x, y) => x.pk - y.pk).map((x) => x.runs);
  const acc = new Array(GRID.length).fill(0);
  let cnt = 0, run = 0;
  for (let i = 0; i < seq.length; i++) {
    if (i >= MIN_PRIOR) {
      cnt++;
      for (let g = 0; g < GRID.length; g++) {
        const est = (run + LG * GRID[g]) / (i + GRID[g]);
        acc[g] += (est - seq[i]) * (est - seq[i]);
      }
    }
    run += seq[i];
  }
  return { acc, cnt };
});
const wfTot = new Array(GRID.length).fill(0);
let wfN = 0;
for (const w of wfArm) { wfN += w.cnt; for (let g = 0; g < GRID.length; g++) wfTot[g] += w.acc[g]; }
let wbi = 0;
for (let g = 1; g < GRID.length; g++) if (wfTot[g] < wfTot[wbi]) wbi = g;

const wfBest = [];
for (let b = 0; b < BOOT; b++) {
  const acc = new Array(GRID.length).fill(0);
  for (let i = 0; i < wfArm.length; i++) {
    const pick = wfArm[(Math.random() * wfArm.length) | 0].acc;
    for (let g = 0; g < GRID.length; g++) acc[g] += pick[g];
  }
  let m = 0;
  for (let g = 1; g < GRID.length; g++) if (acc[g] < acc[m]) m = g;
  wfBest.push(GRID[m]);
}
wfBest.sort((a, b) => a - b);
const wLo = wfBest[Math.floor(BOOT * 0.025)], wHi = wfBest[Math.floor(BOOT * 0.975)];

console.log(`\n=================== WALK-FORWARD (${wfN} predicted starts, ${MIN_PRIOR}+ priors) ===================`);
console.log("    reg      held-out MSE     vs shipped");
const wsi = GRID.indexOf(SHIPPED);
for (const r of show) {
  const g = GRID.indexOf(r);
  const d = wfTot[g] / wfN - wfTot[wsi] / wfN;
  console.log(`  ${String(r).padStart(5)}      ${(wfTot[g] / wfN).toFixed(6)}     ${(d >= 0 ? "+" : "") + d.toFixed(6)}${g === wbi ? "   <== best" : ""}${r === SHIPPED ? "   (shipped)" : ""}`);
}
console.log(`\n  best reg predicting forward: ${GRID[wbi]}`);
console.log(`  bootstrap 95% CI over arms:  [${wLo}, ${wHi}]`);
console.log(`  => shipped ${SHIPPED} is ${SHIPPED >= wLo && SHIPPED <= wHi ? "INSIDE" : "OUTSIDE"} that interval.`);
console.log(`  This is the live setting with no leakage. It is the number to trust.`);

// ---------------------------------------------------------------------------
// THE LEAK, REPRODUCED ON PURPOSE.
//
// The claim above — that a leaky backtest structurally prefers a lighter reg —
// should not be taken on argument when it can be demonstrated. So run the same
// walk-forward sweep with one change: include the start being predicted in its
// own history, which is exactly what scanNrfi does when it reads a season-to-date
// split that was never rewound to the scored date.
//
// If the leaky curve's optimum collapses toward the old value while the clean
// curve sits at 75, then the ladder backtest's preference for a light reg is the
// leak talking, and the constant should be set from the clean curve.
const leakTot = new Array(GRID.length).fill(0);
let leakN = 0;
for (const a of arms) {
  const seq = a.log.slice().sort((x, y) => x.pk - y.pk).map((x) => x.runs);
  let run = 0;
  for (let i = 0; i < seq.length; i++) {
    run += seq[i];                       // today's result is already in the line
    if (i < MIN_PRIOR) continue;
    leakN++;
    for (let g = 0; g < GRID.length; g++) {
      const est = (run + LG * GRID[g]) / (i + 1 + GRID[g]);
      leakTot[g] += (est - seq[i]) * (est - seq[i]);
    }
  }
}
let lbi = 0;
for (let g = 1; g < GRID.length; g++) if (leakTot[g] < leakTot[lbi]) lbi = g;
console.log(`\n=================== SAME TEST, LEAK LEFT IN (${leakN} starts) ===================`);
console.log("    reg     clean MSE     leaky MSE");
for (const r of show) {
  const g = GRID.indexOf(r);
  console.log(`  ${String(r).padStart(5)}     ${(wfTot[g] / wfN).toFixed(6)}     ${(leakTot[g] / leakN).toFixed(6)}${g === lbi ? "   <== leaky best" : ""}${g === wbi ? "   <== clean best" : ""}`);
}
console.log(`\n  clean optimum ${GRID[wbi]}   vs   leaky optimum ${GRID[lbi]}`);
console.log("  The leak pulls the apparent best weight down, because a rate that already");
console.log("  contains today's result is worth trusting more than one that does not.");
console.log("  That is why nrfi-ladder-sweep.js cannot settle this constant: its cached");
console.log("  inputs carry the same contamination, so it rewards mining it.");

console.log("\n=================== WHAT THE CHANGE WOULD DO TO A BASELINE ===================");
const shrink = (rate, sample, reg) => (rate * sample + LG * reg) / (sample + reg);
console.log(`  A starter ${(0.30).toFixed(2)} runs/start below league (a genuinely good first-inning arm):`);
console.log("    starts     reg=" + SHIPPED + "        reg=" + GRID[bi] + "        difference");
for (const nS of [10, 15, 20, 25, 30]) {
  const a = shrink(LG - 0.30, nS, SHIPPED), b = shrink(LG - 0.30, nS, GRID[bi]);
  console.log(`    ${String(nS).padStart(6)}     ${a.toFixed(3)}       ${b.toFixed(3)}       ${(b - a >= 0 ? "+" : "") + (b - a).toFixed(3)} runs`);
}
console.log("\n  Both starters in a game contribute, so the effect on the game total is roughly");
console.log("  double the per-arm difference, and P(NRFI) moves by about that much in lambda.");
