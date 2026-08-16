// The real NRFI model, loaded out of app.jsx, plus the data fetchers needed to
// build the context it expects. Extracted from desk-nrfi-backtest.js so that
// anything wanting to score a historical game scores it through THIS path.
//
// The alternative — each analysis script carrying its own copy of the slice
// list and its own ctx builder — fails silently. Two builders that agree today
// drift the first time a factor is added to nrfiEvaluate, and the scripts keep
// printing numbers the whole time. desk-nrfi-backtest.js already lost an
// unknown number of commits to exactly that failure mode, in the smaller form
// of a slice list that stopped matching the model.
const fs = require("fs");
const path = require("path");
/* Line endings are normalised HERE, at the read, not at the hash.
 *
 * They used to be normalised inside sha(), which was enough while the only
 * consumer was a hash. It stopped being enough the moment comment stripping
 * (below) needed byte offsets: babel reports offsets into the text IT parsed,
 * so the text being parsed and the text being sliced have to be the same
 * bytes. Normalising once at the read makes every offset in this file mean the
 * same thing. LF vs CRLF is invisible to the eval in makeVerdict either way. */
const readSrc = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const src = readSrc(path.join(__dirname, "..", "public", "desk", "app.jsx"));
function slice(a, b) {
  const i = src.indexOf(a); if (i < 0) throw new Error("start marker not found: " + a);
  const j = src.indexOf(b, i); if (j < 0) throw new Error("end marker not found after: " + a);
  return src.slice(i, j + b.length);
}
/* Comment-blanked twin of a source file, for fingerprinting only.
 *
 * WHY: modelSig hashed raw slice text, so it hashed prose. Measured, not
 * assumed — the bundle at 89bb97f vs 3ba5f22 hashed to 7b2ae5916044 vs
 * 65ce303d42db, but with comments removed both came to 2bf2de1d343f. The
 * entire difference was a comment I had just written. Raw bundle 79,862 bytes,
 * 46,485 with prose removed: 42% of what the guard was watching could not
 * change a single cached number. A pure documentation commit invalidated a
 * 95-slate cache and cost a multi-hour rebuild, and a guard expensive enough
 * to route around is a guard that gets routed around.
 *
 * HOW, and why not a regex: a hand-rolled stripper has to get strings,
 * template literals, regex literals and division-vs-regex ambiguity right, and
 * when it gets one wrong it eats code — which is UNDER-fingerprinting, the
 * failure that is silent and wrong rather than loud and slow. So the ranges
 * come from babel's own parse of the whole file. @babel/standalone is already
 * a dependency (it is what desk-build.js runs on), so this adds nothing to
 * package.json.
 *
 * The twin is the SAME LENGTH as the original — comment bytes are overwritten
 * with a sentinel rather than deleted, and newlines inside block comments are
 * left alone. That is what lets every existing indexOf offset keep working:
 * markers are located in `src` and the identical range is read out of
 * `srcBlank`. The length assertion below is not decoration; if it ever fails,
 * every slice is silently reading the wrong bytes. */
/* A sentinel, not a space, and built at runtime so no raw NUL byte ever sits
 * in this file — one does make grep call the whole file binary.
 *
 * It has to be distinguishable from ordinary whitespace because sigText()
 * below drops lines that are nothing BUT removed comment. Blanking to spaces
 * would leave a whitespace-only line behind for every comment line, so
 * REFLOWING a paragraph — three lines becoming four — would still move the
 * fingerprint, which is most of what this change exists to stop. A line that
 * holds a sentinel is by construction a line that held a comment, so it
 * cannot be the interior of a template literal, which is the one place where
 * dropping a whitespace-only line would change what the code means. */
const BLANK = String.fromCharCode(0);
const blankComments = (txt, what) => {
  const parser = require("@babel/standalone").packages.parser;
  let ast;
  try {
    ast = parser.parse(txt, { sourceType: "unambiguous", plugins: ["jsx"] });
  } catch (e) {
    throw new Error("modelSig cannot strip comments from " + what + ": babel failed to parse it (" +
      e.message + "). Fix the syntax; do not fall back to hashing raw text, because " +
      "a silent fallback turns every later prose edit back into a cache rebuild.");
  }
  const cs = ast.comments || [];
  if (!cs.length) {
    throw new Error("modelSig found zero comments in " + what + " — this file is heavily commented, " +
      "so zero means the parse returned something other than what was read, not that the prose is gone.");
  }
  const out = txt.split("");
  for (const c of cs) {
    for (let k = c.start; k < c.end; k++) if (out[k] !== "\n") out[k] = BLANK;
  }
  const blanked = out.join("");
  if (blanked.length !== txt.length) throw new Error("comment blanking changed the length of " + what);
  return blanked;
};
const srcBlank = blankComments(src, "app.jsx");
// Same markers, same offsets, prose removed.
function sliceBlank(a, b) {
  const i = src.indexOf(a); if (i < 0) throw new Error("start marker not found: " + a);
  const j = src.indexOf(b, i); if (j < 0) throw new Error("end marker not found after: " + a);
  return srcBlank.slice(i, j + b.length);
}
/* Marker for a numeric const declaration, matched by NAME rather than by value.
 *
 * The slice markers below are deliberately literal so that a rename in app.jsx
 * fails loudly instead of silently scoring a stale model. But for declarations
 * that exist precisely to be TUNED, a literal marker also fails on the tuning
 * itself: raising NRFI_BET_MIN from 55 to 57 on 2026-08-15 broke all nine
 * analysis scripts at once, including the ones whose job is to check whether
 * such a change was right. A guard that fires on the correct action as loudly
 * as on the incorrect one stops carrying information.
 *
 * So match the shape and the names, and let the numbers move. A rename or a
 * restructure still throws; a retune does not. */
function declMarker(...names) {
  const re = new RegExp("const\\s+" +
    names.map((n) => n + "\\s*=\\s*-?[\\d.]+").join(",\\s*") + "\\s*;");
  const m = src.match(re);
  if (!m) {
    throw new Error("declaration not found in app.jsx for: " + names.join(", ") +
      " — these constants were renamed, reordered or restructured, and this slice " +
      "list is stale. Fix the list; do not delete the entry.");
  }
  return m[0];
}
// Pull the real model math out of app.jsx.
const MODEL_SLICES = [
  ["const NRFI_SIM_W = 0.20;", "const nClamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));"],
  ["function nrfiRegress(", "\n}"],
  ["function halfNoRun(", "\n}"],
  ["function pitchSkillFactor(", "\n}"],
  ["function openerGameFactor(", "\n}"],
  ["function openerFactor(", "\n}"],
  ["function seasonLoadFactor(", "\n}"],
  // These nine went into nrfiEvaluate after the last time the backtest was run,
  // and nothing caught it: mapLimit swallowed the ReferenceError per row, every
  // row came back null, and the script printed "No samples." A backtest that
  // reports nothing looks like a backtest with no data, not a broken one. See
  // the guard in desk-nrfi-backtest.js, and scripts/nrfi-slice-gap.js, which
  // diffs this list against app.jsx's top-level declarations.
  ["function pitcherTrendFactor(", "\n}"],
  ["function teamOffenseTrendFactor(", "\n}"],
  ["function offenseVenueFactor(", "\n}"],
  ["function offKrateFactor(", "\n}"],
  ["function trendBaseline(", "\n}"],
  ["const HFA_LAMBDA_RATIO = 1.245;", "HFA_DOWN = 1 / Math.sqrt(HFA_LAMBDA_RATIO);"],
  ["function homeOffAdvantage(", "\n}"],
  ["const NRFI_LEAK_MIN = 1.5;", ";"],
  ["function nrfiLeaks(", "\n}"],
  // Through the sentinel, not the IIFE's "})();": the PBT_* cutoffs and
  // pbtPosterior sit after the table, and nrfiEvaluate reads them.
  ["const PITCHER_BT = (() => {", "// backtest bundle gets the constants and not just the table."],
  ["function pitcherVenueFactor(", "\n}"],
  ["const OPENER_REG_IP = 12;", ";"],
  ["const I01_LG = {", "};"],
  ["const CHECK_FAMILIES = [", "\n];"],
  ["function checkFamily(", "\n}"],
  ["function pitcherI01Profile(", "\n}"],
  ["function pitcherBT(", "\n}"],
  ["const NRFI_TEMP_REF = 73.7;", "const ENV_W_WIND = 1.00;"],
  ["function weatherPark(", "\n}"],
  ["const rate2 = (o)", ";"],
  ["const awayPit0 = (o)", ";"],
  ["const NRFI_LG_PA = (() => {", "const NRFI_PA_REG_H2H = 50;"],
  // The shipped calibration seed, read rather than retyped. desk-nrfi-backtest
  // had it hardcoded in two places as +0.050 — wrong magnitude AND wrong sign
  // against the -0.048 in app.jsx — so its "shipped seed applied to each path"
  // section was shifting predictions the wrong way and reporting HURT for both
  // paths on that basis. Exactly the drift the header of this file warns about,
  // caught only because the fitted c moved and the printed comparison stopped
  // making sense.
  ["const NRFI_CALIB_SEED = {", "};"],
  ["function paRates(", "\n}"],
  ["function matchupPA(", "\n}"],
  ["function advanceBaseOut(", "\n}"],
  ["function simHalfNoRun(", "\n}"],
  ["function nrfiEvaluate(", "\n}"],
];
const model = MODEL_SLICES.map(([a, b]) => slice(a, b)).join("\n");
// The regression constants come out with the rest of the model, not as literals
// here. They were in scope all along (the NRFI_LG_PA slice above ends on the
// NRFI_PA_REG_H2H declaration) but were never destructured, so both fetchers
// below called paRates with `reg` undefined and got raw rates back. The app
// passes NRFI_PA_REG_PIT for a starter's allow-rates and NRFI_PA_REG_H2H for
// batter-vs-pitcher histories, so the backtest was scoring UNregressed inputs
// against a model that ships regressed ones — measuring a model that does not
// exist, and flattering it, because an unregressed 12-batter h2h line is a much
// louder signal than the shipped one.
const { nrfiEvaluate, weatherPark, paRates, NRFI_LG_TOP3_OBP,
  NRFI_PA_REG_PIT, NRFI_PA_REG_H2H, NRFI_CALIB_SEED } = eval('"use strict";\n' + model +
  "\n;({ nrfiEvaluate, weatherPark, paRates, NRFI_LG_TOP3_OBP," +
  " NRFI_PA_REG_PIT, NRFI_PA_REG_H2H, NRFI_CALIB_SEED })");
if (!Number.isFinite(NRFI_CALIB_SEED?.c)) {
  throw new Error("NRFI_CALIB_SEED did not come through the slice: " + JSON.stringify(NRFI_CALIB_SEED));
}
for (const [n, v] of [["NRFI_PA_REG_PIT", NRFI_PA_REG_PIT], ["NRFI_PA_REG_H2H", NRFI_PA_REG_H2H]]) {
  if (!(v > 0)) throw new Error(n + " did not come through the slice: " + v);
}
/* No matching guard for the four FUNCTIONS beside them, deliberately.
 *
 * I wrote one, on the assumption that a name the bundle never defines just
 * destructures to undefined and fails later at "paRates is not a function" —
 * the same shape as nrfi-platoon-audit.js's standing "c.platoonFactor is not a
 * function". Measured instead of assumed, by commenting one slice line out of
 * MODEL_SLICES and loading this file in a fresh process:
 *
 *   function paRates(       -> ReferenceError: Cannot access 'paRates' before initialization
 *   function weatherPark(   -> ReferenceError: Cannot access 'weatherPark' before initialization
 *   function simHalfNoRun(  -> LOADED CLEAN, nothing fired
 *
 * The eval ends in a shorthand object literal, so a destructured name that the
 * bundle stopped defining is a bare reference to the const in TDZ right here,
 * and it throws at load already. A guard after that line cannot run. Adding
 * one would have been a check that never fires, defended by a paragraph that
 * was wrong — worse than no check, because the next reader believes it.
 *
 * The constants above are different and do still need theirs: they arrive
 * DEFINED but wrong when a slice cuts short, which no ReferenceError catches.
 *
 * simHalfNoRun is the case with no guard at all here: it is used inside the
 * bundle and never destructured, so dropping it loads clean and would throw at
 * whichever call site ran first. That one belongs to nrfi-slice-gap.js, which
 * looks for names the bundle references without defining — verified, it
 * reports "simHalfNoRun 4x in model" and exits 1. Run it after touching the
 * slice lists; this file cannot see that class and should not pretend to. */

// ---- data (Node fetchers; faithful to the app's getJson logic) ----
const J = async (u) => { const r = await fetch(u, { headers: { accept: "application/json" } }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };
const parseIp = (ip) => { const m = String(ip == null ? "0" : ip).split("."); return Number(m[0] || 0) + (m[1] === "1" ? 1 / 3 : m[1] === "2" ? 2 / 3 : 0); };
// MLB sends "-.--" for a pitcher with no recorded innings and "INF" for one who
// has allowed runs without retiring anybody. Number() maps both to NaN, and NaN
// is not null, so every `x != null` guard downstream passes it through — which
// is how a NaN ERA reached openerFactor and came out as a NaN multiplier on the
// lambda. These are absences of a reading, not readings, so they become null.
// Mirrors numOrNull in app.jsx; both fetch paths must agree or the backtest
// stops measuring the app.
const numOrNull = (v) => { if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const cache = new Map();
const memo = (k, fn) => cache.has(k) ? cache.get(k) : cache.set(k, fn()).get(k);

/* ---- POINT-IN-TIME PITCHER SPLITS ----
 *
 * THE LEAK THIS FIXES. The call below asks the API for a starter's first-inning
 * line for a whole SEASON. Scoring a game from May with it hands the model a
 * rate that already contains that game's own result, plus every start after it.
 * An arm shelled in the 1st that afternoon reads worse in the line the model
 * sees, so the model "predicts" a run it was told about.
 *
 * It is not a small effect and it is not hypothetical. nrfi-pitreg-fit.js
 * toggles exactly this field and finds the optimal regression weight collapse
 * from 75 (clean, interior minimum) to 0 (leaky, minimum at the boundary with
 * MSE rising monotonically in the weight). A curve that rewards trusting an
 * input more the further you go is not measuring prediction; it is measuring how
 * much of the answer you let through. Everything downstream inherited it —
 * nrfi-ladder-sweep.js reported the BET rung at 62.5% against a 49.9% base rate,
 * which is the leak, not a model.
 *
 * THE FIX. nrfi-leakfree-games.json carries, per game, the two starters' MLB ids
 * and the runs each allowed in the 1st, with a date and a season. That is a
 * dated log per arm, so the season-to-date line can be rebuilt from starts
 * STRICTLY BEFORE the scored date — precisely what the live model sees at pick
 * time. 14,009 games across six seasons.
 *
 * The first attempt built this from nrfi-pitcherbt-starts.json instead, and it
 * is worth recording why that failed. That file has no pitcher id — its `arms`
 * is a plain ARRAY of {name, log}. Keying an index by the array position and
 * then looking arms up by MLB person id silently matched nothing: every arm
 * returned null, every starter fell back to the league mean, and the run still
 * produced a full set of plausible numbers with a BETTER-looking Brier, because
 * a model with no pitcher information is also a model with no leak. It was
 * caught only by a counter that printed "rewound 0". Resolving ids by
 * intersecting each arm's opponents was tried next and left 80+ arms ambiguous.
 * Both were fixes layered on a file that lacks the key; the run counts were
 * already sitting in leakfree's scan and being discarded, so the fix was to
 * stop discarding them.
 *
 * THE COUNTERS BELOW ARE LOAD-BEARING. A join that matches nothing looks exactly
 * like a clean run.
 *
 * REWOUND SO FAR: pitI01 (first done, because it is the one measured to leak and
 * it feeds pitBase at full weight — the dominant term), teamOff's first-inning
 * rate, and pitMeta's seasonEra/ip/gs/g/allow.
 *
 * STILL LEAKING: topOrder's batter OBP and per-PA rates, the batter-vs-pitcher
 * h2h lines, savant's Statcast, and teamOff's opsVsR/opsVsL — all whole-season
 * pulls, all on the offence side. Do not read a clean result here as a clean
 * harness; read it as "the pitcher side is clean".
 *
 * BOUNDED RATHER THAN REWOUND: the two biggest of those. Neither has an honest
 * point-in-time version — there is no per-game log for a vs-pitcher line, and a
 * hitting gameLog does not split by the opposing pitcher's hand — so each has an
 * ablation toggle instead, and running the backtest both ways brackets the
 * truth. NRFI_NO_H2H=1 costs 0.0011 of AUC; NRFI_NO_LINEUP_OBP=1 costs 0.0021.
 * Both are inside the run-to-run drift, so both rewinds were measured not to be
 * worth building rather than skipped. Details at each toggle below.
 *
 * NO SILENT FALLBACK. An arm missing from the index returns null, so nrfiRegress
 * sends it to the league mean. Falling back to the API would quietly restore the
 * leak for exactly the arms the index cannot vouch for, and the numbers would
 * still look like numbers. Misses are counted and the harness reports them.
 */
const PIT_MODE = process.env.NRFI_LEAKY === "1" ? "leaky" : "point-in-time";
// Recorded, not just applied. The whole reason the split leak survived so long
// is that a leaky cache and a clean one were byte-indistinguishable on their
// metadata, so any artifact written by a run has to carry the mode that
// produced it or the next reader inherits the same trap.
const H2H_MODE = process.env.NRFI_NO_H2H === "1" ? "off (ablation)" : "season (leaks)";
/* The top-of-order OBP factor, ablatable for the same reason h2h is.
 *
 * A hitting gameLog does not split by the opposing pitcher's hand, and topOrder
 * asks for sitCodes=[vl]/[vr], so there is no per-game log to sum into a
 * point-in-time vs-hand OBP. Same shape of problem as h2h: no honest rewind
 * exists, so bound it instead of guessing.
 *
 * This ablates the FACTOR only and deliberately leaves `obp` and `batters`
 * alone. `obp` is read at two places in app.jsx purely as a null check — a
 * -0.12 confidence penalty and the lineupPosted flag — so blanking it would
 * move confidence and tier assignment as well, and the run would no longer be
 * measuring the one thing it set out to measure. `batters` is already ablated
 * independently by the lambda path in scoreBothPaths.
 *
 * Worth bounding rather than assuming: lineup.factor carries coefficient 1.0 in
 * offMult, the largest in that expression, so unlike h2h it is a priori
 * load-bearing.
 *
 * MEASURED, 559 games, the two runs back to back so they share an API snapshot:
 *
 *              Brier    AUC     pick-side
 *   with OBP   .2449   .5775    55.9%
 *   ablated    .2452   .5754    56.2%
 *
 * The bracket is 0.0021 of AUC wide, and the ablation is very slightly BETTER
 * on pick-side accuracy. Tier hit rates barely move (SIM BET 59% -> 57%, STRONG
 * 61% -> 61%) on near-identical volume. Two conclusions, and the second is the
 * useful one:
 *
 *   1. The remaining top-of-order leak cannot be materially inflating the
 *      shipped numbers. 0.0021 AUC is inside the ~0.5pp of run-to-run drift
 *      that nrfi-ladder-sweep.js documents.
 *   2. THE topOrder REWIND IS NOT WORTH BUILDING. The largest coefficient in
 *      offMult buys about nothing while being allowed to see the game it is
 *      predicting; a clean version of it can only buy less. That would have
 *      been hours of work against handedness splits a hitting gameLog cannot
 *      reconstruct, to chase an effect this bracket says is not there.
 *
 * Same verdict h2h got, arrived at the same way. Do not re-litigate either
 * without re-running the pair — and re-run the pair, do not compare against the
 * numbers above, because the offence-side inputs drift as games finalise.
 */
const OBP_MODE = process.env.NRFI_NO_LINEUP_OBP === "1" ? "factor forced to 1 (ablation)" : "season (leaks)";
/* The four rolling windows, ablatable — and this one exists to settle a debt.
 *
 * pitcherTrendFactor (0.30), pitcherVenueFactor (0.50), teamOffenseTrendFactor
 * (0.50), offenseVenueFactor (0.30) and offKrateFactor (0.35) were pinned
 * neutral in every harness run this project has ever done, because buildCtx did
 * not set the keys they read (see the block above pitcherRolling). They are live
 * now. What has never happened is a BACKTEST of them: the backtest could not
 * compute them, so the "weights tuned from a 4,015-game backtest" provenance at
 * app.jsx:6954 cannot cover any of the five.
 *
 * NRFI_NO_ROLLING=1 reproduces the old behaviour exactly — the keys go missing
 * rather than being blanked downstream — so an A/B against a default run is a
 * measurement of what the five factors are worth, on the same games, in the same
 * API snapshot. Restoring the defect on purpose is the only way to price it.
 */
const ROLL_MODE = process.env.NRFI_NO_ROLLING === "1" ? "off (ablation)" : "on";
/* NRFI_ENV_W — how much credit the model gives the run ENVIRONMENT.
 *
 * This exists to price one specific, measured difference between our board and
 * NRFIKINGKY's. Matched on our own p (same date, |dp| <= 0.02, so the composite
 * probability is held fixed), his NRFI legs sit on BETTER PITCHING and in
 * LIVELIER RUN ENVIRONMENTS than the games we score identically:
 *
 *     awayPitBase  -0.0107 (t -3.84)     env  +0.0198 (t +3.91)
 *     homePitBase  -0.0174 (t -5.37)     homeOpen -0.0281 (t -4.41)
 *
 * Both signs verified empirically against our own p rather than read off the
 * code: pitBase correlates -0.463 with p(NRFI) and env -0.522, so a LOWER
 * pitBase and a HIGHER env both mean what the sentence above says. An earlier
 * write-up of this called it "short run environment", which had env backwards;
 * the tilt would have been built pointing the wrong way.
 *
 * Read together: our model will take a depressed park or a cold night as
 * evidence for NRFI. He will not — he wants the arms to be doing the work, and
 * he is happy to buy NRFI in a bandbox if the pitching justifies it. Scaling
 * env's deviation from neutral is exactly that preference, expressed as one
 * number: 1.0 ships today, 0.0 would ignore weather and park entirely.
 *
 * Driven through ctx.wx rather than through app.jsx because env enters as
 * `1 + (ctx.wx.factor - 1)` in BOTH scoring paths, so scaling the deviation here
 * is identical to scaling the weight there — and it means this can be measured
 * without a single change to the shipped model. If it earns its place, it moves
 * into app.jsx as a named constant; until then the board is untouched.
 *
 * VERDICT 2026-08-16: MEASURED AND REJECTED. ENV_W stays at 1.0. Paired run,
 * same 1556 games over 120 days, env the only difference:
 *
 *                    ENV_W=1 (shipped)   ENV_W=0
 *     Brier               .2485            .2503   (base rate .2500)
 *     Brier recentred     .2461            .2477
 *     AUC                 .5708            .5519
 *     prediction sd       5.1 pp           4.4 pp
 *     pick-side acc       53.3%            53.6%
 *
 * Turning env off costs 1.9 points of AUC and pushes Brier past the base rate —
 * an env-free model is worse than predicting 50% on every game. Pick-side
 * accuracy ticks up 0.3pp on 10 fewer off-the-fence games, which is noise and is
 * the only column that favours the cut.
 *
 * THE REASON THIS WAS NEARLY SHIPPED ANYWAY IS THE INTERESTING PART, and it is a
 * trap the next person will meet again. Scored against HIS board instead of
 * against outcomes, ENV_W=0 looks like a clear win: nrfi-tout-vs-model.js moves
 * his legs' mean percentile in our ranking from 64.9 to 66.9, his share of our
 * top decile from 21.1% to 26.8%, and our side agreement from 93.4% to 94.9%.
 * Every selection metric improves. They improve because dropping env makes our
 * ranking MORE LIKE HIS — and he is not the outcome. Agreement with a good
 * tout is not accuracy, and where the two disagree the outcome wins. Measure
 * ablations on Brier and AUC; use the tout comparison to generate hypotheses,
 * never to settle them. */
const ENV_W = process.env.NRFI_ENV_W == null ? 1 : Number(process.env.NRFI_ENV_W);
if (!Number.isFinite(ENV_W) || ENV_W < 0 || ENV_W > 2)
  throw new Error("NRFI_ENV_W must be a number in [0,2], got " + JSON.stringify(process.env.NRFI_ENV_W));
pitI01.stats = { pit: 0, miss: 0, api: 0 };
let lfGames = null;
function leakfreeGames() {
  if (lfGames) return lfGames;
  const gf = path.join(__dirname, "nrfi-leakfree-games.json");
  if (!fs.existsSync(gf)) {
    throw new Error("point-in-time splits need nrfi-leakfree-games.json — run " +
      "node scripts/nrfi-leakfree.js --refresh, or set NRFI_LEAKY=1 to score " +
      "with the season-to-date leak left in");
  }
  const games = JSON.parse(fs.readFileSync(gf, "utf8")).games;
  if (!games.length || games[0].hpRuns == null) {
    throw new Error("nrfi-leakfree-games.json predates the hpRuns/apRuns fields — " +
      "re-run node scripts/nrfi-leakfree.js --refresh");
  }
  return (lfGames = games);
}
// Both indexes walk the same per-game log, so they share one prefix scan: sum
// the runs on every entry for this season strictly before `asOf`. The log is
// date-sorted, so the first non-prior entry ends it.
function priorRuns(log, se, asOf) {
  let runs = 0, n = 0;
  for (const e of log) {
    if (e.season !== se) continue;
    if (!(e.date < asOf)) break;
    runs += e.runs; n++;
  }
  return { runs, n };
}
const byDateAsc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
let pitIndex = null;
function pitcherIndex() {
  if (pitIndex) return pitIndex;
  const games = leakfreeGames();
  pitIndex = new Map();
  const push = (id, date, season, runs, isHome) => {
    if (id == null) return;
    const k = String(id);
    let a = pitIndex.get(k); if (!a) pitIndex.set(k, a = []);
    a.push({ date, season, runs, isHome });
  };
  for (const g of games) {
    // hpRuns is what the HOME starter allowed (the away side batted), and
    // apRuns what the AWAY starter allowed. Crossing these silently inverts
    // every arm in the model, so it is spelled out rather than inferred.
    // `isHome` is which park the ARM was working in, which is the split
    // pitcherVenueFactor reads — it is a property of the start, not of the run
    // total, so it comes straight off which slot the id filled.
    push(g.hp, g.date, g.season, g.hpRuns, true);
    push(g.ap, g.date, g.season, g.apRuns, false);
  }
  // Sorted by date so the prefix scan is a walk-forward rather than a filter
  // over an arbitrary order, which is what lets the scan stop at the first
  // non-prior start instead of reading the whole log.
  for (const log of pitIndex.values()) log.sort(byDateAsc);
  return pitIndex;
}
/* Point-in-time TEAM first-inning offence, out of the same cache.
 *
 * The pitcher index reads the log as "runs this arm ALLOWED". The same two
 * numbers read the other way are "runs this lineup SCORED": the away side bats
 * against the home starter, so hpRuns is the AWAY team's first inning, and
 * apRuns is the HOME team's. That is the entire mapping, and getting it
 * backwards would invert every offence in the model while still producing a
 * plausible-looking rate, so it is spelled out rather than inferred.
 *
 * Only `rate` and `sample` are rewound. opsVsR/opsVsL stay whole-season: the
 * cache has no handedness and no OPS, and inventing a substitute estimator
 * would confound "rewound" with "measured a different way" in any A/B — the
 * same reason pitI01's ERA is scaled rather than recomputed. So the offence
 * term is now clean and the platoon adjustment on top of it is not.
 */
let teamIndex = null;
function teamOffIndex() {
  if (teamIndex) return teamIndex;
  teamIndex = new Map();
  const push = (id, date, season, runs, isHome) => {
    if (id == null) return;
    const k = String(id);
    let a = teamIndex.get(k); if (!a) teamIndex.set(k, a = []);
    a.push({ date, season, runs, isHome });
  };
  for (const g of leakfreeGames()) {
    // Here `isHome` is which park the LINEUP batted in — the away club scored
    // hpRuns off the home starter, so that row is a road game for them.
    push(g.away, g.date, g.season, g.hpRuns, false);
    push(g.home, g.date, g.season, g.apRuns, true);
  }
  for (const log of teamIndex.values()) log.sort(byDateAsc);
  return teamIndex;
}
const pitI01Api = (id, se) => memo("p" + id + se, async () => {
  try { const d = await J(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=statSplits&group=pitching&sitCodes=i01&season=${se}`);
    const s = d.stats?.[0]?.splits?.[0]?.stat; if (!s || !s.gamesPlayed) return null;
    return { rate: (+s.runs || 0) / s.gamesPlayed, sample: s.gamesPlayed, era: numOrNull(s.era) }; } catch { return null; }
});
function pitI01(id, se, asOf) {
  if (id == null) return Promise.resolve(null);
  if (PIT_MODE === "leaky" || !asOf) { pitI01.stats.api++; return pitI01Api(id, se); }
  const log = pitcherIndex().get(String(id));
  if (!log) { pitI01.stats.miss++; return Promise.resolve(null); }
  const { runs, n } = priorRuns(log, se, asOf);
  if (!n) { pitI01.stats.miss++; return Promise.resolve(null); }
  pitI01.stats.pit++;
  /* First-inning ERA, rewound by the same ratio as the rate.
   *
   * The log carries runs, not earned runs or first-inning IP, so a point-in-time
   * ERA cannot be computed directly. Substituting a different estimator (say
   * rate*9) would confound "rewound" with "measured a new way" in any A/B, so
   * instead the season ERA is scaled by how far the point-in-time rate sits from
   * the season rate. Identical construction, moved backwards in time.
   *
   * This is a partial fix and it is honest about which part: the season ERA it
   * scales is still a whole-season number. It feeds openerFactor at weight 0.5
   * inside a [0.9, 1.12] clamp, so the residue is second-order next to the rate,
   * which drives pitBase directly. Returning null instead would silence
   * openerFactor entirely and that is a bigger distortion than the leak it
   * removes. */
  const full = log.filter((e) => e.season === se);
  const fullRate = full.length ? full.reduce((s, e) => s + e.runs, 0) / full.length : null;
  const rate = runs / n;
  return pitI01Api(id, se).then((api) => ({
    rate, sample: n,
    era: api && api.era != null && fullRate ? api.era * (rate / fullRate) : (api ? api.era : null),
  })).catch(() => ({ rate, sample: n, era: null }));
}
const teamOffApi = (id, se) => memo("t" + id + se, async () => {
  try { const d = await J(`https://statsapi.mlb.com/api/v1/teams/${id}/stats?stats=statSplits&group=hitting&sitCodes=i01,vr,vl&season=${se}`);
    const sp = d.stats?.[0]?.splits || []; const f = (re) => sp.find((x) => re.test(x.split?.description || ""))?.stat;
    const i01 = f(/first inning/i), vr = f(/right/i), vl = f(/left/i); if (!i01 || !i01.gamesPlayed) return null;
    /* kRate/kSample come off the SAME i01 split already in hand, and their
     * absence here was silent: offKrateFactor reads `off.kRate` and returns a
     * flat {f:1} when it is null, so every harness run priced team first-inning
     * K% at exactly neutral on every game while the board — which reads them in
     * teamOffenseSplits — had it firing on 37% of the slate at weight 0.35.
     * Not a missing feed, a missing pair of field reads on a response we were
     * already paying for. Whole-season, like opsVsR/opsVsL beside them and for
     * the same reason: the leakfree cache carries runs, not strikeouts, so
     * there is nothing to rewind them against. See the note on teamOff. */
    const pa = +(i01.plateAppearances || 0);
    return { rate: (+i01.runs || 0) / i01.gamesPlayed, sample: i01.gamesPlayed,
      opsVsR: vr?.ops != null ? +vr.ops : null, opsVsL: vl?.ops != null ? +vl.ops : null,
      kRate: pa > 0 ? (+i01.strikeOuts || 0) / pa : null, kSample: pa }; } catch { return null; }
});
teamOff.stats = { pit: 0, miss: 0, api: 0 };
function teamOff(id, se, asOf) {
  if (id == null) return Promise.resolve(null);
  if (PIT_MODE === "leaky" || !asOf) { teamOff.stats.api++; return teamOffApi(id, se); }
  const log = teamOffIndex().get(String(id));
  if (!log) { teamOff.stats.miss++; return Promise.resolve(null); }
  const { runs, n } = priorRuns(log, se, asOf);
  if (!n) { teamOff.stats.miss++; return Promise.resolve(null); }
  teamOff.stats.pit++;
  // Same no-silent-fallback rule as pitI01: a team the index cannot vouch for
  // returns null and gets regressed to the league mean, rather than quietly
  // getting the season-to-date number back. The platoon OPS still comes from
  // the season call — see teamOffIndex for why it is not rewound with it.
  return teamOffApi(id, se).then((api) => ({
    rate: runs / n, sample: n,
    opsVsR: api ? api.opsVsR : null, opsVsL: api ? api.opsVsL : null,
    kRate: api ? api.kRate : null, kSample: api ? api.kSample : null,
  })).catch(() => ({ rate: runs / n, sample: n, opsVsR: null, opsVsL: null, kRate: null, kSample: null }));
}
/* ---- the rolling windows, which the harness did not have at all ----
 *
 * THE DEFECT THESE CLOSE. nrfiEvaluate reads ctx.awayRolling / ctx.homeRolling
 * and ctx.awayOffRolling / ctx.homeOffRolling. The live board fills all four in
 * scanNrfi (pitcherRollingNRFI and teamOffenseRolling). buildCtx never did — it
 * returned a context without those keys, so `if (!rolling) return {f: 1}` fired
 * at the top of all four factor functions on every game a harness ever scored:
 *
 *   pitcherTrendFactor       weight 0.30 in pitMult and the sim context
 *   pitcherVenueFactor       weight 0.50 in pitMult and the sim context
 *   teamOffenseTrendFactor   weight 0.50 in offMult and offSimCtx
 *   offenseVenueFactor       weight 0.30 in offMult and offSimCtx
 *
 * It was invisible because "neutral" is a perfectly ordinary value for a
 * factor: nothing errored, nothing was missing from any output, and a game
 * whose trend factor is 1.000 looks exactly like an arm with no recent form.
 * The same failure the umpire term had, in the other direction — there the
 * harness pinned a factor the board computed, here it pinned four. On the
 * board's own slate they fire on 47%/7%/43%/40% of games and carry 9.4% of all
 * factor movement (scripts/nrfi-weight-audit.js), so every backtest Brier,
 * every calibration fit and the whole NRFIKINGKY band table were computed on a
 * model the board does not ship.
 *
 * Confidence was hit too, and more bluntly: nrfiEvaluate docks 0.04 per side
 * for a missing rolling window, so EVERY cached confidence was 0.08 low — and
 * confidence is one of the two features nrfi-tout-profile.js compares his picks
 * against their peers on.
 *
 * REWOUND, which is where these deliberately differ from the board. The app
 * reads a starter's whole-season game log because on a live board every start
 * in it has already happened. Scoring a game from May with September's starts
 * in the L10 is look-ahead, so these take only games strictly before `asOf`,
 * the same rule pitI01 and teamOff already follow. On a same-day board the two
 * definitions coincide exactly; they part only when scoring the past, which is
 * the only time it matters.
 *
 * Built off the leakfree cache rather than a fresh fetch. The board pulls a
 * game log plus a linescore per start — for a 95-date backtest that is tens of
 * thousands of requests, which is how this stayed unimplemented. Every number
 * these windows need is already in nrfi-leakfree-games.json, indexed above.
 * One divergence follows from that and is stated rather than papered over: the
 * cache is regular season only, so an early-April team window sees fewer games
 * than the board's 35-day schedule query, which would also catch spring
 * training. That errs toward too little data, not too much.
 */
const rollPct = (arr) => (arr.length ? Math.round(arr.filter(Boolean).length / arr.length * 100) : null);
const roll2 = (x) => Math.round(x * 100) / 100;
// The board rounds pct to a whole number and runsPerStart/avgRuns to two
// places. Reproduced exactly, not approximated: pitcherVenueFactor compares
// `venue.pct - szn.pct` against integer 10/20 cutoffs, so carrying an unrounded
// percentage here would move games across those gates in one direction only.
function pitcherRolling(id, se, asOf) {
  if (id == null) return null;
  const log = pitcherIndex().get(String(id));
  if (!log) return null;
  const prior = [];
  for (const e of log) {
    if (e.season !== se) continue;
    if (!(e.date < asOf)) break;      // date-sorted, so the first non-prior ends it
    prior.push({ clean: e.runs === 0, runs: e.runs, home: e.isHome });
  }
  if (!prior.length) return null;
  const cleans = prior.map((v) => v.clean);
  const rps = (arr) => (arr.length ? roll2(arr.reduce((s, v) => s + v.runs, 0) / arr.length) : null);
  const win = (arr) => ({ pct: rollPct(arr.map((v) => v.clean)), n: arr.length, runsPerStart: rps(arr) });
  // >= 5 to activate a venue split, matching the board. pitcherVenueFactor then
  // asks for >= 8 of its own; both gates are kept so the shapes match on games
  // that pass one and not the other.
  const split = (subset) => (subset.length >= 5 ? win(subset) : null);
  const last = (n) => prior.slice(-n);
  return {
    szn: win(prior),
    l30: win(last(30)),
    l10: win(last(10)),
    l5: win(last(5)),
    home: split(prior.filter((v) => v.home)),
    road: split(prior.filter((v) => !v.home)),
    streak: cleans.slice(-5),
    lastClean: cleans.length ? cleans[cleans.length - 1] : null,
  };
}
const ROLL_OFF_DAYS = 35, ROLL_OFF_MAX = 25;
function teamOffRolling(teamId, asOf) {
  if (teamId == null) return null;
  const log = teamOffIndex().get(String(teamId));
  if (!log) return null;
  // Same window the board uses: the last 35 days of games strictly before the
  // scored date, capped at 25. Deliberately NOT season-filtered, because the
  // board's schedule query is not either — the offseason gap makes the two
  // equivalent everywhere except a window that would have to reach back through
  // it, and there the 35-day bound has already closed.
  const from = new Date(new Date(asOf + "T12:00:00Z").getTime() - ROLL_OFF_DAYS * 86400000)
    .toISOString().slice(0, 10);
  const items = log.filter((e) => e.date >= from && e.date < asOf).slice(-ROLL_OFF_MAX)
    .map((e) => ({ scored: e.runs > 0, runs: e.runs, isHome: e.isHome }));
  // The board requires 5 games before it builds the object at all, and returns
  // null otherwise. A 3-game window is not a trend and must not read as one.
  if (items.length < 5) return null;
  const rate = (arr) => (arr.length >= 3 ? arr.filter((v) => v.scored).length / arr.length : null);
  const avg = (arr) => (arr.length >= 3 ? roll2(arr.reduce((s, v) => s + v.runs, 0) / arr.length) : null);
  const win = (arr) => ({ rate: rate(arr), n: arr.length, avgRuns: avg(arr) });
  const venSplit = (arr) => (arr.length >= 6 ? win(arr) : null);
  const last = (n) => items.slice(-n);
  return {
    szn: win(items),
    l20: win(last(20)),
    l10: win(last(10)),
    l5: win(last(5)),
    home: venSplit(items.filter((v) => v.isHome)),
    road: venSplit(items.filter((v) => !v.isHome)),
  };
}

/* Point-in-time starter season line, summed out of the game log.
 *
 * nrfiEvaluate reads seasonEra, ip, g and allow off this object — openerFactor
 * and seasonLoadFactor take the first two, pitcherI01Profile the era, and the
 * base-out sim takes `allow` as the pitcher's per-PA event distribution. All
 * four came from the `type=[season]` payload, which is the pitcher's WHOLE
 * season including the start being predicted, and for an April game including
 * every start through September. Rewinding pitI01 while leaving these whole
 * meant the pitcher's first inning was point-in-time and his overall line was
 * not, which is the harder leak to spot precisely because the loud one next to
 * it had been fixed.
 *
 * The rewind costs no extra request: the game log is already fetched here (it
 * was only being used for `form`), and every field above is a sum over it. So
 * this filters the log to starts strictly before `asOf` and re-derives the line
 * from the per-game rows. Regular season only — the log carries spring and
 * postseason rows under other gameTypes, and the season aggregate does not
 * count them, so including them would make the sum disagree with the API for a
 * reason that has nothing to do with the rewind.
 *
 * nrfi-rewind-test.js asserts the sum reproduces the API season aggregate when
 * asOf is past the last start. That equality is the whole warrant for this
 * function: it is the difference between "rewound" and "computed a different
 * statistic and called it rewound".
 *
 * `form` is left on the object for shape parity and is NOT rewound, because
 * nrfiEvaluate does not read it — the L3-FIP factor was withdrawn on
 * measurement (see the REMOVED note in app.jsx). If it is ever restored it must
 * be rewound first: `.slice(-3)` of a full-season log is the last three starts
 * of SEPTEMBER no matter which game is being scored.
 */
const GLOG_REG = (sp) => (sp || []).filter((x) => (x.gameType || "R") === "R");
function sumPitLog(rows) {
  const n0 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const acc = { earnedRuns: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
    baseOnBalls: 0, hitByPitch: 0, battersFaced: 0, strikeOuts: 0 };
  let ipOuts = 0, gs = 0, g = 0;
  for (const r of rows) {
    const s = r.stat || {};
    for (const k of Object.keys(acc)) acc[k] += n0(s[k]);
    ipOuts += Math.round(parseIp(s.inningsPitched) * 3);
    gs += n0(s.gamesStarted); g += n0(s.gamesPlayed);
  }
  const ip = ipOuts / 3;
  return { gs, g, ip, seasonK9: ip > 0 ? acc.strikeOuts * 9 / ip : null,
    // A pitcher with appearances but no outs recorded has an undefined ERA, not
    // an infinite one — same call MLB's own "INF" sentinel forces, and null is
    // what the guards downstream are written against.
    seasonEra: ip > 0 ? acc.earnedRuns * 9 / ip : null,
    allow: acc.battersFaced > 0 ? paRates(acc, acc.battersFaced, NRFI_PA_REG_PIT) : null };
}
/* The L3 K/9 window, which nrfiEvaluate's "Pitcher K9 trend" check VOTES on.
 *
 * This was the drift that mattered most in this file. That check reads
 * recentK9, seasonK9 and recentIp off the meta object; the lib's pitMeta never
 * returned any of them, so `m.recentK9 == null` sent it to null on every
 * backtest row and the check simply was not there. It fires live, it feeds the
 * consensus, and the consensus gates which rung a game lands on — so every tier
 * volume and hit rate in the backtest was measured on a model with one fewer
 * check than the one that ships. Not a wrong number: a different model.
 *
 * Starts only, matching app.jsx — a relief appearance is not a data point about
 * a starter's stuff, and mixing one in drags the window. Point-in-time falls out
 * of the same filter: the last three starts BEFORE asOf, not the last three of
 * the season.
 */
function recentK9Window(startsBefore) {
  const last = startsBefore.slice(-3);
  let k = 0, ip = 0;
  for (const r of last) { k += Number(r.stat?.strikeOuts) || 0; ip += parseIp(r.stat?.inningsPitched); }
  return ip > 0 ? { recentK9: k * 9 / ip, recentIp: ip } : { recentK9: null, recentIp: null };
}
const pitMeta = (id, se, asOf) => id == null ? Promise.resolve({ hand: null, form: null, seasonEra: null, gs: null, g: null, ip: null, allow: null, id: null, recentK9: null, seasonK9: null, recentIp: null }) : memo("m" + id + se + (PIT_MODE === "leaky" || !asOf ? "" : ":" + asOf), async () => {
  let hand = null, form = null, seasonEra = null, gs = null, g = null, ip = null, allow = null;
  let recentK9 = null, seasonK9 = null, recentIp = null;
  try { const [p, gl] = await Promise.all([
      J(`https://statsapi.mlb.com/api/v1/people/${id}?hydrate=stats(group=[pitching],type=[season],season=${se})`),
      J(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=gameLog&group=pitching&season=${se}`)]);
    const pp = p.people?.[0]; hand = pp?.pitchHand?.code || null;
    const splits = GLOG_REG(gl.stats?.[0]?.splits);
    const isStart = (x) => Number(x.stat?.gamesStarted) === 1;
    if (PIT_MODE === "leaky" || !asOf) {
      pitMeta.stats.api++;
      const s = pp?.stats?.[0]?.splits?.[0]?.stat;
      if (s) {
        seasonEra = numOrNull(s.era); gs = numOrNull(s.gamesStarted); g = numOrNull(s.gamesPlayed);
        ip = s.inningsPitched != null ? parseIp(s.inningsPitched) : null;
        allow = paRates(s, s.battersFaced, NRFI_PA_REG_PIT);
        const k = Number(s.strikeOuts) || 0; if (ip > 0) seasonK9 = k * 9 / ip;
      }
      ({ recentK9, recentIp } = recentK9Window(splits.filter(isStart)));
    } else {
      const prior = splits.filter((x) => x.date && x.date < asOf);
      if (!prior.length) {
        // Same no-silent-fallback rule as pitI01 and teamOff: a debut start has
        // no prior line, and handing back the season one would be the leak this
        // function exists to remove. Nulls let the model regress him to the
        // league prior, which is what "no information" is supposed to look like.
        pitMeta.stats.miss++;
      } else {
        pitMeta.stats.pit++;
        ({ gs, g, ip, seasonEra, seasonK9, allow } = sumPitLog(prior));
        ({ recentK9, recentIp } = recentK9Window(prior.filter(isStart)));
      }
    }
    const last = splits.slice(-3); if (last.length) { let er = 0, lip = 0; last.forEach((x) => { er += +(x.stat?.earnedRuns || 0); lip += parseIp(x.stat?.inningsPitched); }); if (lip > 0) form = er * 9 / lip; }
  } catch { /* nulls */ }
  return { hand, form, seasonEra, gs, g, ip, allow, id, recentK9, seasonK9, recentIp };
});
// After the declaration, not before it: pitMeta is a const arrow, and a const is
// hoisted without being initialised, so touching it above throws on load.
pitMeta.stats = { pit: 0, miss: 0, api: 0 };
// Read from app.jsx, never redeclared here. A script that carries its own copy
// of a model constant stops measuring the model the moment the two drift, and
// the drift is silent — the numbers still look like numbers.
const LG_OBP = NRFI_LG_TOP3_OBP, C = (x, a, b) => Math.max(a, Math.min(b, x));
if (!(LG_OBP > 0.2 && LG_OBP < 0.5)) throw new Error("NRFI_LG_TOP3_OBP did not come through the slice: " + LG_OBP);
const topOrder = async (players, se, oppHand, oppPitcherId) => {
  const ids = (players || []).slice(0, 5).map((p) => p?.id).filter(Boolean);
  if (ids.length < 3) return { factor: 1, obp: null, note: "lineup n/a", batters: null };
  const sit = oppHand === "L" ? "vl" : oppHand === "R" ? "vr" : null;
  return memo("o" + ids.join(",") + (sit || "") + (oppPitcherId || "") + se, async () => {
    try { const type = sit ? `type=[statSplits],sitCodes=[${sit}]` : "type=[season]";
      const d = await J(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(",")}&hydrate=stats(group=[hitting],${type},season=${se})`);
      const by = {}; (d.people || []).forEach((p) => { const s = p.stats?.[0]?.splits?.[0]?.stat; if (s) by[p.id] = { obp: s.obp != null ? +s.obp : null, rates: paRates(s, s.plateAppearances) }; });
      const w = [0.5, 0.3, 0.2]; let num = 0, den = 0; ids.slice(0, 3).forEach((id, i) => { const o = by[id] && by[id].obp; if (o != null) { num += o * w[i]; den += w[i]; } });
      let batters = ids.map((id) => (by[id] && by[id].rates) || null);
      /* The h2h line CANNOT be rewound, and this is how its leak gets bounded.
       *
       * type=[vsPlayer] returns this batter's record against this pitcher over
       * the whole season — including the plate appearances in the game being
       * scored. Unlike pitI01, teamOff and pitMeta there is no per-game log to
       * sum, so there is no honest point-in-time version to build.
       *
       * What is available is an ablation. NRFI_NO_H2H=1 drops the blend and
       * leaves the batter on his season rates, which is strictly LESS
       * information than the app has live, so it under-states the model rather
       * than over-stating it. Running the backtest both ways brackets the
       * truth: the clean number is at least the no-h2h number, and at most the
       * with-h2h one. A bracket you can state is worth more than a single
       * figure you cannot defend.
       */
      if (oppPitcherId && batters.some(Boolean) && process.env.NRFI_NO_H2H !== "1") {
        try {
          const h2hD = await J(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(",")}&hydrate=stats(group=[hitting],type=[vsPlayer],opposingPlayerId=${oppPitcherId},season=${se})`);
          const h2h = {}; (h2hD.people || []).forEach((p) => { const s = p.stats?.[0]?.splits?.[0]?.stat; const pa = s ? Number(s.plateAppearances || s.atBats || 0) : 0; if (s && pa >= 5) h2h[p.id] = { pa, rates: paRates(s, pa, NRFI_PA_REG_H2H) }; });
          batters = batters.map((b, i) => { const h = h2h[ids[i]]; if (!b || !h || !h.rates) return b; const wH = Math.min(0.65, h.pa / 20); const keys = ["out","bb","s1","s2","s3","hr"]; const bl = {}; for (const k of keys) bl[k] = b[k]*(1-wH) + h.rates[k]*wH; return bl; });
        } catch { /* H2H unavailable */ }
      }
      const hasB = batters.some(Boolean);
      if (den > 0) { const obp = num / den; const ablate = process.env.NRFI_NO_LINEUP_OBP === "1";
        return { factor: ablate ? 1 : C(obp / LG_OBP, 0.82, 1.24), obp, batters: hasB ? batters : null, note: "1-3 OBP " + obp.toFixed(3) }; }
      if (hasB) return { factor: 1, obp: null, batters, note: "lineup posted" };
    } catch { /* neutral */ } return { factor: 1, obp: null, note: "lineup n/a", batters: null };
  });
};
const travelRest = async (teamId, todayStr, venueId) => {
  if (teamId == null) return { factor: 1, note: "" };
  return memo("v" + teamId + todayStr, async () => {
    try { const d0 = new Date(todayStr + "T12:00:00Z"); const start = new Date(d0.getTime() - 3 * 864e5).toISOString().slice(0, 10);
      const d = await J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${start}&endDate=${todayStr}&hydrate=venue`);
      const gs = []; (d.dates || []).forEach((dt) => (dt.games || []).forEach((g) => gs.push({ date: dt.date, g })));
      const prev = gs.filter((x) => x.date < todayStr).sort((a, b) => a.date.localeCompare(b.date)).pop();
      if (prev) { const rest = Math.round((d0 - new Date(prev.date + "T12:00:00Z")) / 864e5); const traveled = prev.g.venue?.id && venueId && prev.g.venue.id !== venueId;
        // 0.98 and 1.03 were guesses and both pointed the WRONG WAY; app.jsx set
        // them to 1.00 in f738a33 and this copy never followed, so every backtest
        // since has scored a model the desk does not ship. Measured in
        // scripts/nrfi-travel-fit.js, walk-forward, bootstrapped by date:
        // played-yesterday -1.11pp (t -1.64, MDE 1.35pp) and 3+ days rest +5.17pp
        // (t 2.47, MDE 4.18pp) — positive is the NRFI direction, so a rested team
        // scores LESS in the first while 1.03 was pushing it toward more offence.
        // Only the b2b+travel arm keeps a non-neutral constant, and it keeps 0.93
        // because it is the one arm the app still ships non-neutral.
        if (rest <= 1 && traveled) return { factor: 0.93, note: "b2b+travel" }; if (rest <= 1) return { factor: 1, note: "b2b" }; if (rest >= 3) return { factor: 1, note: rest + "d rest" }; }
    } catch { /* neutral */ } return { factor: 1, note: "" };
  });
};
async function savant(se) {
  return memo("sav" + se, async () => {
    try { const sel = "k_percent,bb_percent,barrel_batted_rate,groundballs_percent,whiff_percent,f_strike_percent";
      const r = await fetch(`https://baseballsavant.mlb.com/leaderboard/custom?year=${se}&type=pitcher&min=1&selections=${sel}&csv=true`, { headers: { "user-agent": "cd/2" } });
      const csv = await r.text(); const by = {}; const acc = { k: 0, bb: 0, barrel: 0, gb: 0, whiff: 0, fstrike: 0 }; let n = 0;
      for (const line of csv.split(/\r?\n/).slice(1)) { const m = line.match(/^".*?",(\d+),\d{4},([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+)/); if (!m) continue;
        const row = { k: +m[2], bb: +m[3], barrel: +m[4], gb: +m[5], whiff: +m[6], fstrike: +m[7] }; if (!Number.isFinite(row.k)) continue; by[m[1]] = row; for (const key of Object.keys(acc)) acc[key] += row[key]; n++; }
      const lg = n ? { k: acc.k / n, bb: acc.bb / n, barrel: acc.barrel / n, gb: acc.gb / n, whiff: acc.whiff / n, fstrike: acc.fstrike / n } : { k: 22, bb: 8, barrel: 7.5, gb: 44, whiff: 24.5, fstrike: 60 };
      return { by, lg };
    } catch { return { by: {}, lg: { k: 22, bb: 8, barrel: 7.5, gb: 44, whiff: 24.5, fstrike: 60 } }; }
  });
}
async function mapLimit(items, limit, fn) {
  const out = []; let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const idx = i++; try { out[idx] = await fn(items[idx]); } catch (e) { mapLimit.errs = (mapLimit.errs || 0) + 1; mapLimit.lastErr = e; if (process.env.BTDEBUG) console.error("ROW ERR: " + ((e && e.stack) || e)); out[idx] = null; } } });
  await workers.reduce((p) => p, Promise.resolve()); await Promise.all(workers); return out;
}

// Build the context nrfiEvaluate expects for one scheduled game. `g` must come
// from a schedule call hydrated with probablePitcher, linescore, team, lineups,
// weather, venue and officials — anything less and the factors quietly go
// neutral, which reads as a confident model rather than a starved one.
async function buildCtx(g, date, se, peri) {
  const a = g.teams?.away, h = g.teams?.home, ap = a?.probablePitcher, hp = h?.probablePitcher;
  if (!ap?.id || !hp?.id) return null;
  const lu = g.lineups || {};
  const [awayPit, homePit, awayMeta, homeMeta, awayOff, homeOff, awayTravel, homeTravel] = await Promise.all([
    // `date` is what rewinds the splits: pitI01, pitMeta and teamOff count only
    // games before it. topOrder still takes season aggregates.
    pitI01(ap.id, se, date), pitI01(hp.id, se, date), pitMeta(ap.id, se, date), pitMeta(hp.id, se, date),
    teamOff(a.team.id, se, date), teamOff(h.team.id, se, date), travelRest(a.team.id, date, g.venue?.id), travelRest(h.team.id, date, g.venue?.id)]);
  const [awayLineup, homeLineup] = await Promise.all([topOrder(lu.awayPlayers, se, homeMeta.hand, homeMeta.id), topOrder(lu.homePlayers, se, awayMeta.hand, awayMeta.id)]);
  /* The four rolling windows. Synchronous — they read the leakfree index that
   * pitI01 and teamOff already load, so they add no requests to a run.
   *
   * These were simply absent from this object, which meant four factors and two
   * checks were pinned neutral in every harness while the board computed them.
   * See the block above pitcherRolling for what that cost. */
  const roll = ROLL_MODE === "on";
  const awayRolling = roll ? pitcherRolling(ap.id, se, date) : null;
  const homeRolling = roll ? pitcherRolling(hp.id, se, date) : null;
  const awayOffRolling = roll ? teamOffRolling(a.team.id, date) : null;
  const homeOffRolling = roll ? teamOffRolling(h.team.id, date) : null;
  /* kRate goes with them, and the reason is that the ablation has to reproduce
   * the DEFECT, not a tidy subset of it. offKrateFactor was dead in every
   * harness for a different cause — teamOffApi never read plateAppearances or
   * strikeOuts off a response it had already fetched — but it was dead in the
   * same runs, so an A/B that revived it would be pricing four factors against a
   * baseline that never existed. offKrateFactor opens with `off.kRate == null`,
   * so nulling the field takes the same branch the harness used to take.
   *
   * Copied rather than mutated: teamOff memoizes by team+season, so writing to
   * the object would edit a shared entry other games in the run also hold. It
   * happens to be harmless here because the whole run wants the same value, but
   * that is an argument about this call site rather than about the code, and it
   * stops being true the moment anything ablates per-game. */
  const awayOffX = !roll && awayOff ? { ...awayOff, kRate: null } : awayOff;
  const homeOffX = !roll && homeOff ? { ...homeOff, kRate: null } : homeOff;
    // ENV_W applied at the one place env is born. At 1 this returns the object
  // untouched, so the default path is byte-identical to before this existed.
  const envTilt = (wx) => (ENV_W === 1 || !wx || !Number.isFinite(wx.factor)
    ? wx
    : { ...wx, factor: 1 + (wx.factor - 1) * ENV_W });
  // No umpire fields. The ABS challenge system retired that term in app.jsx, so
  // there is nothing here for them to feed. This also closes a standing gap
  // between harness and board: buildCtx used to hardcode umpFactor to 1 while
  // the live scan read a real per-umpire runFactor, which meant every backtest
  // number described a model the board did not ship. Both are now umpire-free,
  // and for the first time they agree on this input.
  return { awayName: a.team.name, homeName: h.team.name, awayPP: ap.fullName, homePP: hp.fullName,
    // pitProfiles carries these through to callers as `pid`. Absent here they
    // came out undefined, which is harmless today only because nothing the
    // harness runs joins on them — nrfiThinArm reads apps/seasonIp/sample. Free
    // to supply, so supply them rather than leave a hole shaped like a join key.
    awayPPId: ap.id, homePPId: hp.id,
    awayOff: awayOffX, homeOff: homeOffX,
    awayPit, homePit, awayMeta, homeMeta, awayLineup, homeLineup, awayTravel, homeTravel,
    awayRolling, homeRolling, awayOffRolling, homeOffRolling,
    // MLB's own designation, the same field scanNrfi passes. dayGameShift is 0
    // so this moves no probability today, but the "Day game" check reads it and
    // votes, and a harness that always reported night was casting that vote one
    // way on every game in the environment family.
    dayNight: g.dayNight || null,
    // Copied, not mutated: weatherPark may hand back a memoised park entry, and
    // scaling a shared object in place would tilt every later game in the run by
    // a compounding amount. Same trap the rolling ablation documents above.
    wx: envTilt(weatherPark(g, h.team.abbreviation)),
    awayPeri: peri[ap.id] || null, homePeri: peri[hp.id] || null };
}

// Score both paths on the SAME game. nrfiEvaluate takes the base-out sim
// whenever posted batters and pitcher allow-rates are both on file; nulling
// `batters` is the only thing that stands the sim down, and it leaves
// lineup.factor intact, so the fallback is the real lambda path rather than a
// lineup-blind strawman.
function scoreBothPaths(ctx, lg) {
  const full = { ...ctx, lg };
  const ev = nrfiEvaluate(full);
  const noB = (l) => ({ ...l, batters: null });
  const evLam = nrfiEvaluate({ ...full, awayLineup: noB(full.awayLineup), homeLineup: noB(full.homeLineup) });
  if (evLam.method !== "model") throw new Error("suppressing batters did not stand the sim down: " + evLam.method);
  return { ev, evLam };
}

// The verdict half of the pipeline, loaded separately so the ladder thresholds
// can be substituted. `pNRFI` is only the first step: nrfiVerdict then applies a
// consensus gate, a confidence gate and thin-arm penalties, any of which can
// drop a game two rungs. Sweeping thresholds against the raw probability would
// therefore promise volume the real board never produces.
//
// `overrides` replaces the ladder constants by name, e.g. {NRFI_BET_MIN: 53}.
// Substitution is on the literal declaration in app.jsx, so a rename here fails
// loudly rather than silently sweeping the shipped numbers.
/* Third element is the FINGERPRINT SCOPE, and the distinction is load-bearing.
 *
 * A cache like nrfi-tout-vs-model.json stores what the MODEL produced — pNRFI,
 * aligned, confidence, and the two thin-arm flags — and nothing the ladder
 * decided; consumers apply the ladder and the calibration themselves at read
 * time. Verified, not assumed: ev.pNRFI is raw at app.jsx:7067 and every
 * applyCalibration call site (8523, 8689, 9413) is downstream of the cache.
 *
 * So folding the ladder constants into modelSig over-fingerprints. Raising
 * NRFI_BET_MIN invalidated a 1282-game cache whose contents provably could not
 * have changed, forcing a multi-hour rebuild to answer a question about the
 * ladder — and a guard expensive enough to route around is a guard that gets
 * routed around. Meanwhile the direction that actually matters, a change to the
 * scoring model itself, still invalidates.
 *
 * "cache"  — text that can change the numbers a harness stores. Anything
 *            ambiguous belongs here; under-fingerprinting fails silently and
 *            over-fingerprinting only costs time.
 * "ladder" — text that only INTERPRETS stored numbers. Safe to change without
 *            rebuilding, reported separately so a run still says which ladder
 *            produced its verdicts.
 *
 * Order below is the original evaluation order and must stay that way; the
 * scopes are for hashing only. */
const VERDICT_SLICES = [
  ["const nClamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));", ";", "cache"],
  [declMarker("NRFI_STRONG_MIN", "NRFI_BET_MIN", "NRFI_LEAN_MIN"), ";", "ladder"],
  [declMarker("NRFI_TIER_STRONG"), ";", "ladder"],
  // These feed nrfiThinArm, whose output IS cached as thinAway/thinHome.
  [declMarker("NRFI_THIN_STARTS", "NRFI_RELIEF_APPS", "NRFI_RELIEF_IP"), ";", "cache"],
  ["function nrfiThinArm(", "\n}", "cache"],
  ["function nrfiReliefBacked(", "\n}", "ladder"],
  ["function nrfiTier(", "\n}", "ladder"],
  ["function applyCalibration(", "\n}", "ladder"],
  ["function nrfiVerdict(", "\n}", "ladder"],
];
function makeVerdict(overrides) {
  let bundle = VERDICT_SLICES.map(([a, b]) => slice(a, b)).join("\n");
  for (const [k, v] of Object.entries(overrides || {})) {
    const re = new RegExp("(\\b" + k + "\\s*=\\s*)(\\d+(?:\\.\\d+)?)");
    if (!re.test(bundle)) throw new Error(`cannot override ${k}: no literal assignment found in the verdict bundle`);
    bundle = bundle.replace(re, "$1" + v);
  }
  // Ends in a shorthand object literal, so a name VERDICT_SLICES stopped
  // covering throws here at eval rather than returning undefined — measured:
  // repointing the nrfiTier entry gives "ReferenceError: nrfiTier is not
  // defined". A typeof check after this line would never fire. See the note on
  // the model bundle above for the one gap neither eval can see.
  return eval('"use strict";\n' + bundle + "\n;({ nrfiVerdict, nrfiTier, applyCalibration, nrfiThinArm })");
}

// Fingerprint of the actual model math, for pinning cached model output.
// NRFI_SIM_W alone was not enough: rebuilding PITCHER_BT and its vote cutoffs
// changed every cached `aligned` value while leaving NRFI_SIM_W untouched, so a
// cache built before that change would still have passed the guard and reported
// consensus numbers from a model that no longer exists. This covers every line
// that is actually sliced, so any of them moving invalidates the cache.
//
// It also has to cover THIS file's fetchers, not just app.jsx's math. Rewinding
// teamOff to point-in-time changed what every cached score was computed from
// while touching no sliced line in app.jsx, so the fingerprint would not have
// moved and the sweep cache built minutes earlier would still have passed the
// guard — reporting hit rates from inputs the model no longer uses. A model is
// its math AND the data it is handed; a fingerprint over half of that is a
// fingerprint that lets the other half change in silence.
/* This region ends at VERDICT_SLICES, and it used to end at buildCtx — which
 * left the single most score-determining function in this file outside the
 * fingerprint.
 *
 * The paragraph above says a model is its math AND the data it is handed, and
 * cites rewinding teamOff as the change that moved every cached number without
 * moving a sliced line in app.jsx. buildCtx is where that handing-over
 * happens: it picks which fetchers run, passes `date` to rewind pitI01/pitMeta
 * /teamOff (and pointedly does NOT pass it to topOrder), chooses the arguments
 * topOrder splits on. Measured: the old end
 * marker cut the region at byte 41085 of 53081, so buildCtx and scoreBothPaths
 * — 12KB including every one of those decisions — were excluded. Editing any
 * of it changed every score a cache held while modelSig sat still, and a stale
 * cache that still passes its own guard is the exact silent failure this
 * fingerprint exists to prevent.
 *
 * It stops BEFORE the VERDICT_SLICES literal on purpose. That array carries the
 * ladder markers, and folding them in here would put ladder-only edits back
 * into modelSig — the over-fingerprinting that the scope tags were added to
 * stop. Comments in the enclosed range are blanked, so the prose between the
 * two markers costs nothing. */
const dataSlice = (() => {
  const self = readSrc(__filename);
  const a = self.indexOf("// ---- data (Node fetchers");
  const b = self.indexOf("const VERDICT_SLICES = [");
  if (a < 0 || b < 0 || b <= a) throw new Error("could not slice the fetcher section for modelSig");
  // Blanked twin of THIS file, same offsets — see blankComments. This section
  // is 52% prose, so hashing it raw made every note written here a rebuild.
  const region = blankComments(self, "nrfi-model-lib.js").slice(a, b);
  /* Name the things that must be inside, rather than trusting the markers.
   * Both bounds are ordinary source text that a refactor can move or rename,
   * and a region that silently shrinks back past buildCtx would restore the
   * hole without failing anything. Under-fingerprinting is the failure that
   * cannot be noticed from the outside, so it gets checked from the inside. */
  for (const must of ["async function buildCtx(", "function scoreBothPaths(", "const topOrder =", "const travelRest =",
    // The rolling builders decide four factors and two checks. They were not
    // covered before because they did not exist; a cache scored with them and a
    // cache scored without them must not share a fingerprint.
    "function pitcherRolling(", "function teamOffRolling("]) {
    if (!region.includes(must)) {
      throw new Error("modelSig's data region no longer contains " + JSON.stringify(must) + ". " +
        "Something moved the markers and the fingerprint has stopped covering code that decides " +
        "every cached score. Fix the bounds; do not delete this check.");
    }
  }
  return region;
})();
const sigOf = (tag) => VERDICT_SLICES.filter((s) => s[2] === tag)
  .map(([a, b]) => sliceBlank(a, b)).join("\n");
/* What actually gets hashed: code, with the prose and the layout taken out.
 *
 * Line endings first. These inputs are read off disk, and git on Windows
 * rewrites LF to CRLF on checkout (core.autocrlf), so the same commit hashed
 * differently on a Windows clone than on CI and a plain `git checkout` could
 * invalidate a 1282-game cache without a byte of logic having changed. Found
 * the hard way: a refactor that provably left the model text byte-identical
 * still moved the sig, and the entire difference was 459 carriage returns
 * inside dataSlice. That normalisation now happens at the read (readSrc), so
 * the repeat here is only for safety on any string that skipped it.
 *
 * Then the comment residue. Comment bytes have already been overwritten with
 * BLANK sentinels by blankComments; this is where they actually leave:
 *   - a line that is only sentinels and whitespace was a whole-line comment,
 *     so it goes entirely, which is what makes reflowing a paragraph free;
 *   - a run of sentinels mid-line was a trailing or inline comment, so it
 *     collapses to one space, which keeps `a/*c*\/b` from becoming `ab`;
 *   - leading and trailing whitespace goes, so re-indenting is free too.
 * Newlines between surviving lines are kept, because ASI is real and
 * `return\n5` does not mean `return 5`.
 *
 * A fingerprint that reports a change nobody made is the same failure as one
 * that misses a change somebody did. It just costs rebuilds instead of
 * correctness, and rebuilds are what make people delete the guard. */
const sigText = (s) => String(s).replace(/\r\n/g, "\n").split("\n")
  .map((l) => l.replace(new RegExp(BLANK + "+", "g"), " ").trim())
  .filter((l) => l !== "")
  .join("\n");
const sha = (s) => require("crypto").createHash("sha1")
  .update(sigText(s)).digest("hex").slice(0, 12);
// Same slices as `model`, prose removed. `model` itself stays raw because it
// is eval'd for the real constants; only the fingerprint reads the twin.
const modelBlank = MODEL_SLICES.map(([a, b]) => sliceBlank(a, b)).join("\n");
/* Proof, at load time, that the stripping is doing something and not eating
 * code. Cheap enough to run always, and it is the only thing standing between
 * "comments are excluded" and "comments are excluded, probably".
 *
 * The direction matters: if this stripper ever swallowed real code the guard
 * would go quiet about changes that do matter, which is the silent failure.
 * So assert both halves — that prose actually left, and that every identifier
 * the model is made of is still present to be hashed. */
(() => {
  const raw = MODEL_SLICES.map(([a, b]) => slice(a, b)).join("\n");
  const cut = raw.length - modelBlank.replace(new RegExp(BLANK, "g"), "").length;
  if (cut <= 0) {
    throw new Error("modelSig comment stripping removed nothing from the model bundle — " +
      "blankComments is not reaching these slices, and the fingerprint is back to hashing prose.");
  }
  const names = ["nrfiEvaluate", "PITCHER_BT", "NRFI_SIM_W", "weatherPark", "pitcherI01Profile"];
  const missing = names.filter((n) => !modelBlank.includes(n));
  if (missing.length) {
    throw new Error("modelSig comment stripping removed CODE, not just comments — " +
      missing.join(", ") + " vanished from the stripped bundle. This under-fingerprints, " +
      "which fails silently. Do not relax this check.");
  }
})();
/* The ablation switches belong in the fingerprint, and their absence was a trap.
 *
 * modelSig answers "what produced the cached numbers, and is this cache stale?"
 * An ablation run produces DIFFERENT numbers from the same source text, so
 * before this it wrote a cache whose sig was byte-identical to a normal run's.
 * Any later reader — nrfi-tout-profile, the residual fit, the band tables —
 * would accept it as current. That is the same failure the mode strings were
 * introduced to prevent ("a leaky cache and a clean one were byte-
 * indistinguishable on their metadata"), left half-finished: the modes were
 * recorded in the OUTPUT but never in the identity of the numbers.
 *
 * Non-default modes only, so a default run's sig is unchanged and every cache
 * already on disk stays valid. Verified: with no env vars set, ABLATIONS is ""
 * and the sha input is byte-identical to what it was before this block existed.
 */
const ABLATIONS = [
  PIT_MODE === "leaky" ? "leaky" : null,
  H2H_MODE.includes("ablation") ? "no-h2h" : null,
  OBP_MODE.includes("ablation") ? "no-lineup-obp" : null,
  ROLL_MODE.includes("ablation") ? "no-rolling" : null,
  // A tilt is not an ablation, but it has the identical cache hazard: it changes
  // every score while leaving the model text alone, so without it in the sig a
  // tilted run would be served the untilted model's cached numbers and report a
  // perfect null. Formatted so 0.5 and 0.50 hash the same.
  ENV_W !== 1 ? "env-w-" + String(Number(ENV_W)) : null,
].filter(Boolean).join(",");
// What produced the cached numbers. A cache carrying a different one is stale.
const modelSig = sha(modelBlank + sigOf("cache") + dataSlice + (ABLATIONS ? "|ablate:" + ABLATIONS : ""));
// What interprets them. Report it; never gate a cache on it.
const ladderSig = sha(sigOf("ladder"));

module.exports = { nrfiEvaluate, weatherPark, paRates, NRFI_LG_TOP3_OBP, makeVerdict,
  J, parseIp, memo, pitI01, teamOff, pitMeta, topOrder, travelRest, savant, mapLimit,
  buildCtx, scoreBothPaths, C, modelSig, ladderSig,
  // The slice lists themselves, so a checker never has to regex them back out
  // of this file's source. nrfi-slice-gap.js did exactly that and broke the
  // moment VERDICT_SLICES grew a third element — a drift detector taken out by
  // the drift it exists to detect. Importing them cannot go stale.
  MODEL_SLICES, VERDICT_SLICES,
  // PIT_MODE and the counters are exported so a harness can PRINT which split
  // source it ran on. A backtest that does not say whether it rewound its inputs
  // is not reporting a result, and the difference between the two modes here is
  // larger than most of the effects these scripts are built to measure.
  PIT_MODE, H2H_MODE, OBP_MODE, ROLL_MODE, ABLATIONS,
  pitStats: () => ({ ...pitI01.stats, off: { ...teamOff.stats }, meta: { ...pitMeta.stats }, h2h: H2H_MODE, obp: OBP_MODE }),
  sumPitLog, GLOG_REG, NRFI_CALIB_SEED, NRFI_PA_REG_PIT, NRFI_PA_REG_H2H };
