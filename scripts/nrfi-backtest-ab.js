// Did that term earn its place? A PAIRED comparison of two backtest artifacts.
//
//   node scripts/nrfi-backtest-ab.js <baseline.json> <variant.json>
//   node scripts/nrfi-backtest-ab.js nrfi-backtest.json nrfi-backtest.ablate-no-rolling.json
//
// WHY THIS EXISTS. desk-nrfi-backtest.js prints Brier to four decimals for one
// model at a time. Running it twice and subtracting the printed numbers is the
// wrong test twice over:
//
//   1. It is UNPAIRED. Two runs over the same 409 games are not two independent
//      samples — they are the same outcomes scored twice. The variance of the
//      DIFFERENCE is far smaller than the variance of either Brier, so an
//      unpaired eyeball both wastes power and gives no se at all.
//   2. It has no stop condition. "0.2437 vs 0.2436, so the ablation is better"
//      is a reading of the fourth decimal with nothing attached that could ever
//      have said "too close to call."
//
// A null here is the LIKELY outcome and it is a legitimate one — but only if it
// arrives with a minimum detectable effect. "We could not tell these apart" and
// "these are the same" are different claims, and only the first is ever earned
// by 409 games.
//
// CLUSTERING. Resampling is by DATE, not by game. A slate shares weather, parks,
// umpires, and one fetch of our own data; treating 15 games off one schedule
// call as 15 independent draws understates every se on this page. Fewer, larger
// clusters is the conservative direction.
//
// THE SHARPEST CUT is at the bottom: on games where the two models pick
// DIFFERENT sides, which one is right? Everything else is diluted by the games
// where both models say the same thing and the term under test changed nothing
// that mattered.

const fs = require("fs");
const path = require("path");

const B = 4000; // bootstrap resamples
const BAR = 1.96;

// Deterministic RNG. A bootstrap that reports a different number every run
// invites re-running until the answer is agreeable, and there would be no trace
// in the output that it happened.
let _s = 0x2f6e2b1 >>> 0;
const rnd = () => {
  _s ^= _s << 13; _s >>>= 0;
  _s ^= _s >>> 17;
  _s ^= _s << 5; _s >>>= 0;
  return _s / 4294967296;
};

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

// AUC by rank sum, with midranks so ties between a win and a loss score 0.5
// rather than silently favouring whichever order the array happened to be in.
function auc(rows) {
  const xs = rows.slice().sort((a, b) => a.p - b.p);
  const ranks = new Array(xs.length);
  for (let i = 0; i < xs.length;) {
    let j = i;
    while (j + 1 < xs.length && xs[j + 1].p === xs[i].p) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = r;
    i = j + 1;
  }
  let sPos = 0, nPos = 0;
  for (let i = 0; i < xs.length; i++) if (xs[i].y === 1) { sPos += ranks[i]; nPos++; }
  const nNeg = xs.length - nPos;
  if (!nPos || !nNeg) return null;
  return (sPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

// Known-answer self-test. Every guard in this file is worth exactly as much as
// the evidence that it fails when it should, so this runs before any data does.
(function selfTest() {
  const perfect = [{ p: 0.9, y: 1 }, { p: 0.8, y: 1 }, { p: 0.2, y: 0 }, { p: 0.1, y: 0 }];
  if (Math.abs(auc(perfect) - 1) > 1e-12) throw new Error("auc() is wrong: perfect separation did not score 1, got " + auc(perfect));
  const reversed = perfect.map((r) => ({ p: 1 - r.p, y: r.y }));
  if (Math.abs(auc(reversed) - 0) > 1e-12) throw new Error("auc() is wrong: perfectly inverted did not score 0, got " + auc(reversed));
  const allTied = [{ p: 0.5, y: 1 }, { p: 0.5, y: 0 }, { p: 0.5, y: 1 }, { p: 0.5, y: 0 }];
  if (Math.abs(auc(allTied) - 0.5) > 1e-12) throw new Error("auc() midranks are wrong: a fully tied column did not score 0.5, got " + auc(allTied));
  if (auc([{ p: 0.6, y: 1 }, { p: 0.4, y: 1 }]) !== null) throw new Error("auc() must refuse a one-class column, it returned a number");
})();

const load = (arg) => {
  const p = path.isAbsolute(arg) ? arg : path.join(__dirname, arg);
  if (!fs.existsSync(p)) { console.error("no such artifact: " + p); process.exit(2); }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(j.rows) || !j.rows.length) {
    console.error(p + " has no per-game rows. Re-run desk-nrfi-backtest.js; a summary alone cannot be paired.");
    process.exit(2);
  }
  return { file: path.basename(p), j };
};

const A = load(process.argv[2] || "nrfi-backtest.json");
const Bv = load(process.argv[3] || "nrfi-backtest.ablate-no-rolling.json");

console.log("PAIRED BACKTEST A/B");
console.log("  baseline " + A.file + "   ablations: " + (A.j.ablations || "none") + "   n=" + A.j.rows.length + "   run " + (A.j.at || "?"));
console.log("  variant  " + Bv.file + "   ablations: " + (Bv.j.ablations || "none") + "   n=" + Bv.j.rows.length + "   run " + (Bv.j.at || "?"));

if ((A.j.ablations || null) === (Bv.j.ablations || null)) {
  console.log("\nSTOP: both artifacts report the same ablation set (" + (A.j.ablations || "none") + ").");
  console.log("These are two runs of the SAME model, so any difference is cache state or");
  console.log("upstream data drift, not the term under test. That is worth knowing, but it");
  console.log("is not an A/B — re-run one side with the toggle actually set.");
  process.exit(1);
}

// Join on gamePk, not on the readable key. `date AWY@HOM` collides on
// doubleheaders — seven times in a 30-day window — and a Map keyed on it keeps
// only the nightcap, so game 1's probability gets paired with game 2's outcome.
// That is not a loud failure: both rows are real, both probabilities are real,
// and the only symptom is a handful of games where the recorded outcome does not
// match the model that produced it. Older artifacts predate `id`; they can still
// be paired, but only if the readable key happens to be unique in both, and that
// is checked rather than hoped.
const keyOf = (r) => (r.id != null ? "pk" + r.id : r.k);
for (const [tag, src] of [["baseline", A], ["variant", Bv]]) {
  const seen = new Set(), dup = new Set();
  for (const r of src.j.rows) { const k = keyOf(r); if (seen.has(k)) dup.add(k); seen.add(k); }
  if (dup.size) {
    console.error("\nSTOP: " + dup.size + " duplicate game keys in the " + tag + " artifact, e.g. " + [...dup].slice(0, 3).join(", "));
    console.error("This artifact predates gamePk and its games are not uniquely identified");
    console.error("(doubleheaders share date and both teams). Re-run desk-nrfi-backtest.js to");
    console.error("regenerate it with `id`; pairing on the readable key would mismatch them.");
    process.exit(1);
  }
}

const mapB = new Map(Bv.j.rows.map((r) => [keyOf(r), r]));
const pair = [], onlyA = [];
for (const r of A.j.rows) {
  const q = mapB.get(keyOf(r));
  if (!q) { onlyA.push(r.k); continue; }
  // With a unique join this can only mean the two runs saw different linescores,
  // i.e. one artifact was written before the game went final.
  if (q.a !== r.a) { console.error("STOP: outcome disagreement on " + r.k + " (" + r.a + " vs " + q.a + "). One artifact was written before this game was final."); process.exit(1); }
  pair.push({ k: r.k, date: r.k.slice(0, 10), y: r.a, pa: r.p, pb: q.p });
}
const seenA = new Set(A.j.rows.map(keyOf));
const onlyB = Bv.j.rows.filter((r) => !seenA.has(keyOf(r))).map((r) => r.k);

if (onlyA.length || onlyB.length) {
  console.log("\nunmatched rows: " + onlyA.length + " only in baseline, " + onlyB.length + " only in variant");
  const worst = Math.max(onlyA.length / A.j.rows.length, onlyB.length / Bv.j.rows.length);
  if (worst > 0.02) {
    console.log("STOP: more than 2% of one book is unmatched. The two runs covered different");
    console.log("games, so a paired difference would be charging the term for the sample.");
    process.exit(1);
  }
}
if (pair.length < 100) { console.log("\nSTOP: only " + pair.length + " paired games. Not enough to say anything either way."); process.exit(1); }

const dates = [...new Set(pair.map((r) => r.date))];
const byDate = new Map(dates.map((d) => [d, pair.filter((r) => r.date === d)]));
console.log("\npaired on " + pair.length + " games across " + dates.length + " dates (resampling clusters by date)");

// ---- how far apart are the two models at all? ----
const dp = pair.map((r) => r.pa - r.pb);
const moved = dp.filter((d) => Math.abs(d) > 1e-9).length;
const flips = pair.filter((r) => (r.pa > 0.5) !== (r.pb > 0.5));
console.log("\nSEPARATION");
console.log("  games whose p moved at all   " + moved + "/" + pair.length + " (" + ((100 * moved) / pair.length).toFixed(1) + "%)");
console.log("  mean |dp|                    " + (100 * mean(dp.map(Math.abs))).toFixed(3) + " pts");
console.log("  max  |dp|                    " + (100 * Math.max(...dp.map(Math.abs))).toFixed(3) + " pts");
console.log("  games where the SIDE flips   " + flips.length);
if (!moved) {
  console.log("\nSTOP: the two artifacts are identical game for game. The toggle did not reach");
  console.log("the model — check that the ablation env var is spelled the way the lib reads it,");
  console.log("and that modelSig moved so the cache did not serve the other model's scores.");
  process.exit(1);
}

// ---- paired Brier and paired AUC, one cluster bootstrap for both ----
const brier = (rows, f) => mean(rows.map((r) => Math.pow(f(r) - r.y, 2)));
const obsBrier = { a: brier(pair, (r) => r.pa), b: brier(pair, (r) => r.pb) };
const obsAuc = { a: auc(pair.map((r) => ({ p: r.pa, y: r.y }))), b: auc(pair.map((r) => ({ p: r.pb, y: r.y }))) };
const obsDB = obsBrier.a - obsBrier.b;
const obsDA = obsAuc.a - obsAuc.b;

const bsB = [], bsA = [];
for (let b = 0; b < B; b++) {
  const s = [];
  for (let i = 0; i < dates.length; i++) s.push(...byDate.get(dates[Math.floor(rnd() * dates.length)]));
  bsB.push(brier(s, (r) => r.pa) - brier(s, (r) => r.pb));
  const aa = auc(s.map((r) => ({ p: r.pa, y: r.y }))), ab = auc(s.map((r) => ({ p: r.pb, y: r.y })));
  if (aa != null && ab != null) bsA.push(aa - ab);
}
const seOf = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((v) => (v - m) * (v - m)))); };
const seB = seOf(bsB), seA = seOf(bsA);

const verdict = (d, se, unit, dp2) => {
  const t = se ? d / se : 0;
  const mde = BAR * se;
  const sign = d < 0 ? "baseline better" : d > 0 ? "VARIANT better" : "identical";
  console.log("    observed  " + (d >= 0 ? "+" : "") + d.toFixed(dp2) + " " + unit + "   se " + se.toFixed(dp2) + "   t " + (t >= 0 ? "+" : "") + t.toFixed(2));
  console.log("    " + (Math.abs(t) >= BAR
    ? "-> " + sign + ", clears " + BAR + "se"
    : "-> TOO CLOSE TO CALL. Smallest gap this test could have resolved: " + mde.toFixed(dp2) + " " + unit + "."));
  return Math.abs(t) >= BAR;
};

console.log("\nBRIER (lower is better; negative d = baseline better)");
console.log("    baseline " + obsBrier.a.toFixed(5) + "   variant " + obsBrier.b.toFixed(5));
verdict(obsDB, seB, "Brier", 5);

console.log("\nAUC (higher is better; positive d = baseline better)");
console.log("    baseline " + obsAuc.a.toFixed(4) + "   variant " + obsAuc.b.toFixed(4));
verdict(obsDA, seA, "AUC", 4);

// ---- the sharpest cut: only the games the two models disagree about ----
// Everywhere both models pick the same side, the term under test changed
// nothing that could show up in a win/loss column, and those games are pure
// dilution. On the flips the two models make opposite, falsifiable claims.
console.log("\nHEAD-TO-HEAD ON SIDE FLIPS");
if (flips.length < 10) {
  console.log("    only " + flips.length + " flips — the two models almost never make opposite claims,");
  console.log("    so this cut cannot decide anything. That is itself the finding: whatever");
  console.log("    the term does, it does not reach the bet.");
} else {
  const aRight = flips.filter((r) => ((r.pa > 0.5) ? 1 : 0) === r.y).length;
  const p = aRight / flips.length;
  const se = Math.sqrt(0.25 / flips.length); // se under the null p=0.5
  const z = (p - 0.5) / se;
  console.log("    " + flips.length + " games where the two pick opposite sides");
  console.log("    baseline right on " + aRight + "/" + flips.length + " (" + (100 * p).toFixed(1) + "%)   z vs coin " + (z >= 0 ? "+" : "") + z.toFixed(2));
  console.log("    " + (Math.abs(z) >= BAR
    ? "-> " + (z > 0 ? "baseline" : "variant") + " wins the disagreements"
    : "-> a coin. To clear " + BAR + "se on " + flips.length + " flips it would have taken " +
      Math.ceil(flips.length * (0.5 + BAR * se)) + "/" + flips.length + "."));
}

console.log("\nREAD THIS BEFORE QUOTING ANY NUMBER ABOVE: one 30-day window, in-sample for");
console.log("neither model but out-of-sample for neither either — both were built by people");
console.log("who have seen this season. A term that cannot be separated from off here is not");
console.log("thereby worthless; it is unmeasured at this sample size.");
