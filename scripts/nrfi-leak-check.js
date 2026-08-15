// The grade score was refactored from a running total into a list of signed
// term contributions so nrfiLeaks could name the driver behind a LEAKY/BLEEDS
// badge. That is exactly the shape of edit that silently moved the bet ladder
// ten points, so the equality is asserted here rather than assumed: the old
// inline arithmetic is reproduced verbatim and compared against the shipped
// profile over randomised inputs.
const { loadDeskModel } = require("./nrfi-model-load");
const c = loadDeskModel();
const { pitcherI01Profile } = c;
const I01_LG = c.read("I01_LG");

const cl = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Verbatim copy of the pre-refactor score body (pitcherI01Profile, before the
// terms array). Do not "tidy" this — its whole value is being a frozen witness.
function legacyScore(pit, peri, rolling) {
  let score = 50;
  if (pit.rate  != null) score += cl((I01_LG.rate - pit.rate)   / I01_LG.rate,  -1,  1) * 25;
  if (pit.whip  != null) score += cl((I01_LG.whip - pit.whip)   / I01_LG.whip,  -1,  1) * 15;
  if (pit.k9    != null) score += cl((pit.k9   - I01_LG.k9)     / I01_LG.k9,    -1,  1) * 10;
  if (pit.bb9   != null) score += cl((I01_LG.bb9 - pit.bb9)     / I01_LG.bb9,   -1,  1) * 10;
  if (pit.hr9   != null) score += cl((I01_LG.hr9 - pit.hr9)     / I01_LG.hr9,  -0.5, 0.5) * 5;
  if (peri && peri.fstrike != null) score += cl((peri.fstrike - 60) / 60, -1, 1) * 8;
  if (peri && peri.whiff   != null) score += cl((peri.whiff - 24.5) / 24.5, -1, 1) * 7;
  if (rolling && rolling.l30 && rolling.l30.pct != null && (rolling.l30.n || 0) >= 10)
    score += cl((rolling.l30.pct - 60) / 40, -1, 1) * 10;
  if (rolling && rolling.l30 && rolling.l30.runsPerStart != null && (rolling.l30.n || 0) >= 10)
    score += cl((I01_LG.rate - rolling.l30.runsPerStart) / I01_LG.rate, -1, 1) * 5;
  score = cl(Math.round(score), 0, 100);
  if ((pit.sample || 0) < 6) score = Math.min(score, 62);
  return score;
}

let seed = 20260815;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const maybe = (v) => (rnd() < 0.15 ? null : v);

let fails = 0, checked = 0;
const bad = (m) => { fails++; console.log("  FAIL  " + m); };

for (let i = 0; i < 4000; i++) {
  const pit = {
    sample: Math.floor(rnd() * 34),
    rate: maybe(rnd() * 2.2), whip: maybe(rnd() * 3.2),
    k9: maybe(rnd() * 16), bb9: maybe(rnd() * 9), hr9: maybe(rnd() * 3.5),
    era: maybe(rnd() * 9),
  };
  if (!pit.sample) continue;           // profile short-circuits with no starts
  const peri = rnd() < 0.4 ? null : { fstrike: maybe(rnd() * 100), whiff: maybe(rnd() * 45) };
  const n30 = Math.floor(rnd() * 22);
  const rolling = rnd() < 0.3 ? null
    : { l30: { pct: maybe(rnd() * 100), n: n30, runsPerStart: maybe(rnd() * 2.4) } };

  const got = pitcherI01Profile(pit, null, rolling, peri);
  const want = legacyScore(pit, peri, rolling);
  checked++;
  if (got.score !== want) bad("score drifted: got " + got.score + " want " + want + " on " + JSON.stringify(pit));

  // Every leak must be a real term, negative, and ordered worst-first.
  const leaks = got.leaks || [];
  for (const lk of leaks) {
    if (!(lk.cost <= -1.5)) bad("leak below the 1.5pt floor: " + JSON.stringify(lk));
    if (!lk.why || !lk.detail) bad("leak missing prose: " + JSON.stringify(lk));
  }
  // Worst-first means cost ascends (more negative = worse), so a LATER entry
  // being smaller is the violation. The first cut of this asserted the opposite
  // and flagged every correctly-ordered list.
  for (let j = 1; j < leaks.length; j++)
    if (leaks[j].cost < leaks[j - 1].cost) bad("leaks not sorted worst-first: " + JSON.stringify(leaks));
  // rate restates the badge rather than explaining it — it may only appear when
  // no mechanism cleared the floor.
  if (leaks.length > 1 && leaks.some((l) => l.key === "rate"))
    bad("rate reported alongside mechanisms: " + JSON.stringify(leaks));
}

console.log("grade refactor equivalence\n  " + (fails ? "" : "PASS  ") +
  checked + " randomised profiles: score identical to the pre-refactor formula");

// A pitcher can only be badged LEAKY/BLEEDS by being below average somewhere, so
// the badge must never appear with nothing to blame. This is the user-visible
// contract: no red flag without a stated reason.
const bleeders = [
  { label: "wild — walks everyone",   pit: { sample: 14, rate: 0.95, whip: 1.9, k9: 6.0, bb9: 7.2, hr9: 1.0 } },
  { label: "batting practice",        pit: { sample: 20, rate: 1.30, whip: 1.7, k9: 7.0, bb9: 3.0, hr9: 3.0 } },
  { label: "hittable, decent control",pit: { sample: 18, rate: 1.10, whip: 1.8, k9: 5.0, bb9: 2.4, hr9: 1.2 } },
];
for (const b of bleeders) {
  const pr = pitcherI01Profile(b.pit, null, null, null);
  const top = (pr.leaks || [])[0];
  if (!top) bad("badge-worthy arm (" + b.label + ", clean " + pr.cleanPct + "%) has no leak to show");
  else console.log("  PASS  " + b.label.padEnd(26) + "grade " + pr.grade.padEnd(2) +
    " -> leak: " + top.why + " (" + top.cost + ")");
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nleak reporting holds");
process.exit(fails ? 1 : 0);
