// What should the travel & rest constants actually be?
//
//   node scripts/nrfi-travel-fit.js
//
// travelRest() in app.jsx hands back one of four hand-chosen numbers — 0.93 for
// a team that played yesterday in another park, 0.98 for one that played
// yesterday at home, 1.00 for two days off, 1.03 for three or more. None of them
// was ever fitted. This reads all four off six seasons instead.
//
// WHY THIS RUNS AT ALL, given the memory note saying rest and travel are dead.
// nrfi-park-rest.js reports team REST at 0.00pp implied true spread, and that is
// where the "dead end" came from. But it reports TRAVEL at 0.52pp and travel-on-
// no-rest at 0.30pp, both flagged as signal, and both leaning the way the model
// already assumes: a team that changed parks overnight scores LESS in the first.
// Rest is dead. Travel is not, and the two got filed together.
//
// A 2-group variance decomposition is not a significance test though. With two
// groups the observed variance is just (half the gap) squared, so "true spread
// 0.30pp" is one number with no error bar, computed on half-innings that are not
// independent — a slate shares weather, parks and one fetch of our feeds. So the
// contrast here is bootstrapped by DATE, and the minimum detectable effect is
// printed next to it. A gap that does not clear its own MDE is unmeasured, and
// the constant that depends on it should be 1.00 rather than a guess.
//
// THE FACTOR IS NOT THE EFFECT. travelRest's number does not reach the model
// intact: offMult applies it at weight 0.6, so 0.93 moves offence by 4.2%, not
// 7%. Fitting the raw residual and pasting it into travelRest would ship 60% of
// the measured effect. Everything below is converted through that weight, and
// the weight is read out of app.jsx rather than typed here, so this stops
// agreeing with the model the moment someone retunes offMult.

const fs = require("fs");
const path = require("path");

const K = 75;                 // same shrinkage the walk-forward arm model uses
const B = 4000;               // bootstrap resamples
const SEED = 20260816;

const games = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-leakfree-games.json"), "utf8")).games;
games.sort((a, b) => a.date.localeCompare(b.date) || a.pk - b.pk);
const dayNum = (d) => Math.round(Date.parse(d + "T00:00:00Z") / 86400000);

/* The offMult weight, read from source. If this throws, offMult changed shape
 * and the conversion below is no longer valid — better to stop than to print
 * numbers calibrated against a weight that is not there any more. */
function travelWeight() {
  const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
  const m = src.match(/\(travel\.factor - 1\) \* ([\d.]+)/);
  if (!m) throw new Error("could not find the travel weight in offMult — did offMult change?");
  return Number(m[1]);
}

// --- rebuild the walk-forward halves, identically to nrfi-park-rest.js -------
const lgClean = games.reduce((s, g) => s + g.hpClean + g.apClean, 0) / (2 * games.length);
const arm = new Map();
const get = (id) => arm.get(id) || { n: 0, c: 0 };
const halves = [];
for (const g of games) {
  const a = get(g.ap), h = get(g.hp);
  halves.push({ ...g, side: "home", pred: (h.c + lgClean * K) / (h.n + K), obs: g.hpClean });
  halves.push({ ...g, side: "away", pred: (a.c + lgClean * K) / (a.n + K), obs: g.apClean });
  arm.set(g.ap, { n: a.n + 1, c: a.c + g.apClean });
  arm.set(g.hp, { n: h.n + 1, c: h.c + g.hpClean });
}

// The batting team is the one opposite the arm's side.
{
  const lastGame = new Map();
  const byPk = new Map();
  for (const x of halves) {
    if (!byPk.has(x.pk)) byPk.set(x.pk, {});
    byPk.get(x.pk)[x.side] = x;
  }
  for (const g of games) {
    const d = dayNum(g.date);
    for (const [team, side] of [[g.away, "home"], [g.home, "away"]]) {
      const h = (byPk.get(g.pk) || {})[side];
      const prev = lastGame.get(team);
      if (h && prev) { h.tRest = d - prev.day; h.travel = prev.venue !== g.venue ? 1 : 0; }
    }
    lastGame.set(g.away, { day: d, venue: g.venue });
    lastGame.set(g.home, { day: d, venue: g.venue });
  }
}

/* The four states travelRest() actually distinguishes, in its own words. Any
 * half that predates its team's first logged game has no prior and is dropped —
 * travelRest returns neutral there too, so excluding them matches the model. */
function state(r) {
  if (r.tRest == null) return null;
  if (r.tRest <= 1 && r.travel) return "played yesterday + traveled";
  if (r.tRest <= 1) return "played yesterday";
  if (r.tRest >= 3) return "3+ days rest";
  return "2d rest";
}
const SHIPPED = {
  "played yesterday + traveled": 0.93,
  "played yesterday": 0.98,
  "2d rest": 1.00,
  "3+ days rest": 1.03,
};

const rows = halves.filter((r) => state(r) != null).map((r) => ({
  date: r.date, s: state(r), resid: r.obs - r.pred, pred: r.pred,
}));

// --- date-clustered bootstrap ----------------------------------------------
let seed = SEED;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

const dates = [...new Set(rows.map((r) => r.date))];
const byDate = new Map(dates.map((d) => [d, []]));
for (const r of rows) byDate.get(r.date).push(r);

// Residual mean per state, and the contrast of each state against everything
// else. Both arms move together under a resample, which is the point: the
// league's residual level wanders slate to slate and the contrast should not.
function stats(sample) {
  const g = new Map();
  for (const r of sample) {
    if (!g.has(r.s)) g.set(r.s, []);
    g.get(r.s).push(r.resid);
  }
  const out = new Map();
  for (const [k, v] of g) {
    const rest = sample.filter((r) => r.s !== k).map((r) => r.resid);
    out.set(k, { n: v.length, m: mean(v), gap: mean(v) - mean(rest) });
  }
  return out;
}

const point = stats(rows);
const boot = new Map([...point.keys()].map((k) => [k, []]));
for (let b = 0; b < B; b++) {
  const s = [];
  for (let i = 0; i < dates.length; i++) s.push(...byDate.get(dates[(rnd() * dates.length) | 0]));
  const st = stats(s);
  for (const [k, arr] of boot) { const v = st.get(k); if (v) arr.push(v.gap); }
}

const W = travelWeight();
const baseRun = 1 - mean(rows.map((r) => r.pred));   // P(run) the arm model expects

console.log("=".repeat(74));
console.log(`TRAVEL & REST, refit — ${rows.length} half-innings, ${dates.length} slates`);
console.log(`offMult applies travel at weight ${W}; expected P(run in 1st) = ${(100 * baseRun).toFixed(1)}%`);
console.log("=".repeat(74));
console.log("\n  gap = this state's residual clean rate minus every other state's.");
console.log("  POSITIVE gap = cleaner than the rest of the league = fewer first-inning");
console.log("  runs = the NRFI direction. MDE is the smallest gap this sample could");
console.log("  have resolved at 2 SE; anything under it is unmeasured, not refuted.\n");

const fitted = new Map();
for (const [k, v] of point) {
  const se = sd(boot.get(k));
  const mde = 2 * se;
  const t = v.gap / se;
  const real = Math.abs(v.gap) > mde;
  // The measured multiplier on P(run), then de-weighted so that after offMult
  // multiplies by W the model moves by exactly the measured amount.
  const runMult = (baseRun - v.gap) / baseRun;
  const raw = 1 + (runMult - 1) / W;
  fitted.set(k, real ? Math.round(raw * 1000) / 1000 : 1);
  console.log(`  ${k.padEnd(29)} n=${String(v.n).padStart(6)}`);
  console.log(`    gap ${(v.gap * 100 >= 0 ? "+" : "") + (v.gap * 100).toFixed(2)}pp   ` +
    `SE ${(se * 100).toFixed(2)}pp   t ${t.toFixed(2)}   MDE ${(mde * 100).toFixed(2)}pp`);
  console.log(`    shipped ${SHIPPED[k].toFixed(2)}   ` +
    (real ? `fitted ${fitted.get(k).toFixed(3)}   <- clears its MDE`
          : `fitted 1.000   <- under its own MDE, so the honest constant is neutral`));
  console.log("");
}

console.log("-".repeat(74));
console.log("EFFECT AS THE MODEL SEES IT (after the offMult weight):\n");
for (const [k, v] of point) {
  const shipEff = 1 + (SHIPPED[k] - 1) * W;
  const fitEff = 1 + (fitted.get(k) - 1) * W;
  console.log(`  ${k.padEnd(29)} shipped ${shipEff.toFixed(3)}   fitted ${fitEff.toFixed(3)}` +
    (Math.abs(shipEff - fitEff) < 0.004 ? "   (already right)" : ""));
}

console.log("\n" + "-".repeat(74));
console.log("Read the signs before changing anything. A state whose shipped constant");
console.log("is below 1.00 is being told it suppresses first-inning offence; if its");
console.log("measured gap is NEGATIVE it is in fact the run-friendlier state and the");
console.log("model has that arm backwards, which is worse than having it at neutral.");
