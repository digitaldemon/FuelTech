// Regenerate the PITCHER_BT block in app.jsx from measured data.
//
//   node scripts/nrfi-pitcherbt-rebuild.js     (writes nrfi-pitcherbt-dist.json)
//   node scripts/nrfi-pitcherbt-emit.js        (splices it into app.jsx)
//
// The table used to be hand-maintained, which is why nrfi-pitcherbt-audit.js
// found it wrong by a mean 19.7pp with 29 of 53 rows in the wrong tier. Hand
// maintenance is not the kind of thing that gets better with more discipline, so
// the table is generated now and this script is the only writer.
//
// WHAT THE NUMBERS MEAN — this changed, and it matters:
//
// The old table carried each arm's RAW observed clean-1st rate, and spanned 9%
// to 83%. Almost all of that spread was sampling noise. A starter has on the
// order of 15-30 first innings on file; at the league rate of ~71% a binomial
// that size has a standard deviation over 10pp all by itself, which is most of
// the spread the table was ranking on. A beta-binomial fit puts the true spread
// in first-inning skill at roughly 5-6pp, so an arm who "kept 9% of first
// innings clean" is not a bad pitcher, he is a normal pitcher with a small
// sample and bad luck, and the table was betting on the luck.
//
// So the table now carries the POSTERIOR mean — the arm's record weighted
// n/(n+k) against league average — and the tiers are quartiles and deciles of
// that posterior. They are RELATIVE rankings, not absolute rates: "danger" now
// means bottom-decile among MLB starters, which is around 69% clean, not 20%.
// Anyone tempted to widen these bands back out should read nrfi-pitcherbt-
// rebuild.js first, which prints the reliability that forbids it.
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "nrfi-pitcherbt-dist.json");
const APP = path.join(__dirname, "..", "public", "desk", "app.jsx");
const START = "// Pitcher backtest rankings";
// The generated block now runs PAST the IIFE's "})();" — the constants and
// pbtPosterior come after it. So on a re-run the old end marker sits in the
// MIDDLE of what we are replacing, and splicing there would duplicate the tail.
// Prefer the sentinel this script writes, and fall back to "})();" only for the
// first run against a hand-written table that has no sentinel yet.
const SENTINEL = "// backtest bundle gets the constants and not just the table.";
const END = "\n})();";

const d = JSON.parse(fs.readFileSync(DIST, "utf8"));
const src = fs.readFileSync(APP, "utf8");

const i = src.indexOf(START);
if (i < 0) throw new Error("could not find the PITCHER_BT header comment in app.jsx");
// lastIndexOf, not indexOf. An earlier version of this script spliced to the
// IIFE's "})();" while emitting a block that continued past it, so each run
// appended another copy of the trailing constants. Cutting to the LAST sentinel
// absorbs those duplicates instead of preserving them — and re-running until
// the file stops changing is NOT a test that catches this, because splicing to
// the first sentinel reproduces a duplicated file exactly. The assertion after
// the write is the real check.
const s = src.lastIndexOf(SENTINEL);
const j = s >= i ? s + SENTINEL.length : src.indexOf(END, i) + END.length;
if (j < END.length) throw new Error("could not find the end of the PITCHER_BT block");

const B = d.bands;
const tierOf = (p) => p >= B.elite ? "elite" : p >= B.sharp ? "sharp"
  : p <= B.danger ? "danger" : p <= B.leaky ? "leaky" : null;

// Only the arms that actually land in a tier. The middle half of the league has
// nothing to say about a first inning, and a row that says "average" would still
// cast a consensus vote, which is worse than abstaining.
const rows = d.arms.map((a) => ({ ...a, tier: tierOf(a.post) })).filter((a) => a.tier);
rows.sort((a, b) => b.post - a.post);
if (rows.length < 40) throw new Error(`only ${rows.length} arms landed in a tier — check the bands in ${DIST}`);
// A pipe in a pitcher's name would silently truncate his row at parse time.
for (const r of rows) if (/[|\n"\\]/.test(r.name)) throw new Error(`unsafe character in pitcher name: ${r.name}`);

const byTier = (t) => rows.filter((r) => r.tier === t);
const counts = ["elite", "sharp", "leaky", "danger"].map((t) => `${t} ${byTier(t).length}`).join(", ");

// The check votes on the AVERAGE of the two starters, and an average of two
// draws is less variable than one draw — so cutting it at the single-arm
// quartiles would fire far less often than "top/bottom quarter of matchups"
// suggests. Enumerate every pair of qualified arms and take the quartiles of
// that distribution instead. An arm missing from the table is a middling arm, so
// the league mean stands in for him, and those pairs belong in the enumeration.
// Enumerate over the pool the CHECK sees, not the pool we measured. Those
// differ: the table omits the middle half of the league, and the check reads
// every omitted arm as exactly PBT_LG. Thresholding on the raw posteriors
// instead put the cutoffs at 72.2/69.9 around a mean of 70.5 — nearer on the
// YRFI side, because the posterior distribution is left-skewed — and the check
// then leaned yrfi on 32% of matchups against nrfi on 19%. A check with a
// built-in side is the same defect being fixed here, just pointing the other way.
const lg = d.leagueClean;
const effective = d.arms.map((a) => (tierOf(a.post) ? a.post : lg));
const pairAvgs = [];
for (let x = 0; x < effective.length; x++) {
  for (let y = x + 1; y < effective.length; y++) pairAvgs.push((effective[x] + effective[y]) / 2);
}
pairAvgs.sort((a, b) => a - b);
const q = (p) => pairAvgs[Math.floor((pairAvgs.length - 1) * p)];
const PBT_NRFI = q(0.75), PBT_YRFI = q(0.25);

const block = `// Pitcher backtest rankings — GENERATED, do not hand-edit.
//   node scripts/nrfi-pitcherbt-rebuild.js && node scripts/nrfi-pitcherbt-emit.js
// Source: ${d.games} games across ${d.seasons.join(" + ")}, arms with >=${d.minStarts} starts.
// Built ${d.at.slice(0, 10)}. League clean-1st rate ${d.leagueClean.toFixed(1)}%.
//
// clean = POSTERIOR clean-1st %, i.e. the arm's record regressed to league mean
// by n/(n+k) with k=${d.priorK.toFixed(0)} starts. It is NOT his raw rate. Raw rates here span
// ${d.arms[0].rate.toFixed(0)}%-${d.arms[d.arms.length - 1].rate.toFixed(0)}%, but a beta-binomial fit puts the true spread in
// first-inning skill at only ${d.priorSd.toFixed(1)}pp, so nearly all of that raw range is the
// binomial noise of a ~${d.minStarts}-30 start sample. Ranking on it would be ranking on luck.
//
// tier is therefore RELATIVE, not absolute: elite = top decile of the posterior
// (>=${B.elite.toFixed(1)}%), sharp = top quartile (>=${B.sharp.toFixed(1)}%), leaky = bottom quartile (<=${B.leaky.toFixed(1)}%),
// danger = bottom decile (<=${B.danger.toFixed(1)}%). The middle half is omitted: an average arm
// says nothing about a first inning, and a row that said so would still vote.
// n = starts evaluated. Tiers: ${counts}.
const PITCHER_BT = (() => {
  const t = {};
  // name|posterior clean %|starts|tier
  const ROWS = [
${rows.map((r) => `    "${r.name}|${r.post.toFixed(1)}|${r.starts}|${r.tier}",`).join("\n")}
  ];
  for (const row of ROWS) {
    const f = row.split("|");
    const rec = { clean: +f[1], n: +f[2], tier: f[3] };
    t[f[0].toLowerCase()] = rec;
    // Box scores and the schedule feed disagree about accents on the same
    // pitcher, so register a stripped alias rather than duplicating rows by hand
    // (the old table carried "Ranger Suárez" and "Ranger Suarez" as two entries,
    // which is a maintenance trap: they could drift apart).
    const plain = f[0].normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
    if (plain !== f[0].toLowerCase()) t[plain] = rec;
  }
  return t;
})();
// League mean clean-1st. A starter with no row is not an unknown — he is an
// ordinary starter, and the "Backtest profile" check averages him in as one
// rather than letting his partner's tier speak for the pair alone.
const PBT_LG = ${lg.toFixed(1)};
// Concentration of the fitted prior, in starts: an arm's estimate is his record
// weighted n/(n+k) against PBT_LG. k=${d.priorK.toFixed(0)} is large because first-inning skill is
// a weak, slow-moving signal — a 20-start sample is under a fifth reliable.
const PBT_K = ${d.priorK.toFixed(1)};
// Tier cutoffs on the regressed scale, for arms with no row in the table.
const PBT_ELITE = ${B.elite.toFixed(1)}, PBT_SHARP = ${B.sharp.toFixed(1)}, PBT_LEAKY = ${B.leaky.toFixed(1)}, PBT_DANGER = ${B.danger.toFixed(1)};
// Upper and lower quartiles of the two-starter average, enumerated over every
// pair of the ${d.arms.length} qualified arms. Not round numbers, and not the single-arm
// quartiles: averaging two draws narrows the distribution, so single-arm cuts
// would fire on far fewer than a quarter of matchups.
const PBT_NRFI = ${PBT_NRFI.toFixed(1)}, PBT_YRFI = ${PBT_YRFI.toFixed(1)};
const PBT_GAMES = ${d.games}, PBT_SEASONS = "${d.seasons.join(" + ")}";
// Regress any observed clean-1st rate onto the same scale the table uses, so a
// live estimate and a table row can be compared or tiered by the same cutoffs.
function pbtPosterior(pct, n) {
  if (pct == null || !(n > 0)) return null;
  return (pct * n + PBT_LG * PBT_K) / (n + PBT_K);
}
// end PITCHER_BT block — nrfi-model-lib.js slices up to this line, so the
// backtest bundle gets the constants and not just the table.`;

const next = src.slice(0, i) + block + src.slice(j);
// A duplicated block is a redeclared const, which is a SyntaxError the bundler
// may or may not surface depending on how it scopes the file — so check it here
// rather than trusting the build to notice.
for (const [what, needle] of [["sentinel", SENTINEL], ["PITCHER_BT decl", "const PITCHER_BT = (() => {"],
  ["PBT_LG decl", "\nconst PBT_LG = "], ["pbtPosterior decl", "\nfunction pbtPosterior("]]) {
  const n = next.split(needle).length - 1;
  if (n !== 1) throw new Error(`refusing to write: found ${n} copies of the ${what} (expected exactly 1)`);
}
fs.writeFileSync(APP, next);
console.log(`rewrote PITCHER_BT: ${rows.length} arms (${counts})`);
console.log(`bands  elite >=${B.elite.toFixed(1)}%  sharp >=${B.sharp.toFixed(1)}%  leaky <=${B.leaky.toFixed(1)}%  danger <=${B.danger.toFixed(1)}%`);
console.log(`prior  mean ${(d.priorMu * 100).toFixed(1)}%, k=${d.priorK.toFixed(1)} starts, talent sd ${d.priorSd.toFixed(1)}pp`);
console.log(`vote   nrfi if pair avg >=${PBT_NRFI.toFixed(1)}%, yrfi if <=${PBT_YRFI.toFixed(1)}%, league mean ${lg.toFixed(1)}%`);
console.log(`       (over ${pairAvgs.length.toLocaleString()} enumerated matchups)`);
