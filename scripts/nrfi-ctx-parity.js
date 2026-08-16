// Does the harness feed the model everything the board feeds it?
//
//   node scripts/nrfi-ctx-parity.js [date ...]
//
// WHY THIS EXISTS. nrfiEvaluate reads its inputs off a `ctx` object. The board
// builds that object in scanNrfi; every harness builds it in buildCtx. Nothing
// required the two to agree, and for four factors they did not:
//
//   pitcherTrendFactor(ctx.awayRolling)          weight 0.30
//   pitcherVenueFactor(ctx.awayRolling, ...)     weight 0.50
//   teamOffenseTrendFactor(ctx.awayOffRolling)   weight 0.50
//   offenseVenueFactor(ctx.awayOffRolling, ...)  weight 0.30
//
// buildCtx never set those two keys. Every one of those functions opens with
// `if (!rolling) return { f: 1 }`, so all four returned dead neutral on every
// game any harness ever scored — backtests, calibration fits, the whole tout
// comparison — while the board had them firing on 40-47% of a slate. The same
// omission also docked 0.08 off every cached confidence, which is one of the
// two features the tout profile compares his picks against their peers on.
//
// THE REASON IT SURVIVED so long is the reason it needs a dedicated check:
// nothing was missing and nothing errored. A factor of exactly 1.000 is a
// perfectly ordinary value — it is what an arm with no recent form scores — so
// the output of a starved model is indistinguishable by eye from the output of
// a well-fed one. This is the recurring failure in this codebase: an ABSENCE
// RENDERS AS A NEUTRAL VALUE and therefore reads as "measured, and it came out
// to nothing" rather than as "never looked".
//
// So there are two checks here, and the second is the one that would have
// caught it:
//
//   PART 1 (static)    every ctx.X the model reads is a key buildCtx sets.
//   PART 2 (empirical) no factor is constant across an entire multi-day slate.
//
// Part 1 alone is not enough: a key can be present and still be filled with
// something the factor never accepts. Part 2 alone is not enough either, since
// a genuinely rare factor can sit at zero on a small sample — which is exactly
// why it runs over several dates and reports the count rather than asserting on
// one slate.
const { J, savant, buildCtx, scoreBothPaths, MODEL_SLICES, modelSig } = require("./nrfi-model-lib");
const fs = require("fs");
const path = require("path");

const dates = process.argv.slice(2).filter((a) => /^\d{4}-\d\d-\d\d$/.test(a));
if (!dates.length) {
  // Several dates, because part 2 is a claim about a factor never firing and a
  // single 15-game slate cannot support one for a factor that fires at 7%.
  const d = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  dates.push(d(1), d(2), d(3), d(4));
}

let failures = 0;
const check = (ok, name, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) { failures++; if (detail) console.log("        " + String(detail).replace(/\n/g, "\n        ")); }
};

/* Comment handling, and the direction of its error is deliberate.
 *
 * Block comments and whole-line // comments are stripped; a trailing comment
 * after code on the same line is NOT. Measured need: app.jsx documents the
 * removed umpire term with the words `ctx.umpFactor || 1` inside a /* *\/
 * block, and an unstripped scan reports ctx.umpFactor as a missing input —
 * a phantom gap in code that was correctly deleted.
 *
 * The line-comment rule is restricted to whole lines on purpose. Stripping from
 * a bare "//" anywhere would cut every line containing a URL at the "https://",
 * hiding any real ctx reference that followed it — an under-detection, which is
 * the failure this whole file exists to prevent. A trailing comment that slips
 * through can only produce a false alarm, and a false alarm gets investigated.
 */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

const appSrc = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8").replace(/\r\n/g, "\n");
const bundle = MODEL_SLICES.map(([a, b]) => {
  const i = appSrc.indexOf(a);
  if (i < 0) throw new Error("slice start not found, MODEL_SLICES is stale: " + a);
  const j = appSrc.indexOf(b, i + a.length);
  if (j < 0) throw new Error("slice end not found, MODEL_SLICES is stale: " + b);
  return appSrc.slice(i, j + b.length);
}).join("\n");

const read = new Set();
{
  const re = /\bctx\.([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(stripComments(bundle)))) read.add(m[1]);
}

/* Keys the model reads that buildCtx legitimately does not set.
 *
 * Every entry needs a reason, and the reason has to be that the absence is
 * DESIGNED rather than merely old. This list is the whole escape valve, so it
 * is the thing to be suspicious of: adding a name here silences a real check.
 * The four rolling keys were never on it — they were not excused, they were
 * simply never noticed.
 */
const EXCUSED = {
  lg: "supplied by scoreBothPaths, which wraps buildCtx's object before evaluating",
  awayBestLineup: "projected-sim input with a documented synthetic fallback; pNRFI_simProj is not the headline number",
  homeBestLineup: "projected-sim input with a documented synthetic fallback; pNRFI_simProj is not the headline number",
};

/* Factors that are SUPPOSED to be the same on every game.
 *
 * Same warning as EXCUSED above: this list is how a dead factor gets to look
 * healthy, so an entry must say why constancy is correct — not merely that it
 * was observed. A term belongs here only if it is a pure function of something
 * other than game data. Anything that reads a feed does not.
 */
const CONSTANT_BY_DESIGN = {
  awayOffAdv: "homeOffAdvantage(false) — a pure function of the home/away boolean, not of any feed",
  homeOffAdv: "homeOffAdvantage(true) — likewise; the pair is asserted separately below",
};

(async () => {
  console.log(`model ${modelSig}\ndates ${dates.join(", ")}\n`);
  const se = Number(dates[0].slice(0, 4));
  const { by: periBy, lg } = await savant(se);

  const rows = [];
  let ctxSample = null;
  for (const date of dates) {
    let sch;
    try { sch = await J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,linescore,team,lineups,weather,venue,officials`); }
    catch (e) { console.error(`  ${date}: schedule fetch failed — ${e.message}`); continue; }
    for (const g of sch.dates?.[0]?.games || []) {
      const ctx = await buildCtx(g, date, se, periBy);
      if (!ctx) continue;
      if (!ctxSample) ctxSample = ctx;
      const { ev } = scoreBothPaths(ctx, lg);
      if (ev.factors) rows.push(ev.factors);
    }
  }

  /* Refuse to report on an empty sample rather than passing vacuously.
   *
   * Both checks below are "nothing was wrong" assertions over `rows`. With no
   * rows they both pass, and a green run with zero games scored looks exactly
   * like a green run with sixty — the same shape of false comfort the missing
   * factors themselves had. */
  if (rows.length < 20 || !ctxSample) {
    console.error(`\nONLY ${rows.length} GAMES SCORED — refusing to report.`);
    console.error("Both checks here are assertions that nothing is missing, and over an empty");
    console.error("sample they pass without testing anything. Fix the feed, then re-run.");
    process.exit(1);
  }
  console.log(`scored ${rows.length} games\n`);

  console.log("PART 1 — every ctx key the model reads is one buildCtx sets");
  const have = new Set(Object.keys(ctxSample));
  const missing = [...read].filter((n) => !have.has(n)).sort();
  const unexcused = missing.filter((n) => !(n in EXCUSED));
  check(unexcused.length === 0, `all ${read.size} ctx inputs are supplied (or excused)`,
    unexcused.length ? "buildCtx never sets these, so whatever reads them takes its absent branch\n" +
      "on every game a harness scores:\n" + unexcused.map((n) => "  ctx." + n).join("\n") +
      "\nIf an absence is genuinely intended, add it to EXCUSED with the reason." : null);
  for (const n of missing.filter((n) => n in EXCUSED)) console.log(`        excused: ctx.${n} — ${EXCUSED[n]}`);

  /* An excuse that no longer describes anything real is worse than no excuse:
   * it is a name the next reader trusts. If a key on the list has since started
   * being supplied, the entry has done its job and should go. */
  const stale = Object.keys(EXCUSED).filter((n) => have.has(n) || !read.has(n));
  check(stale.length === 0, "no stale entries in the EXCUSED list",
    stale.length ? stale.map((n) => `  ${n} — ${have.has(n) ? "buildCtx supplies this now" : "the model no longer reads it"}`).join("\n") +
      "\nRemove these; an excuse for a problem that no longer exists still silences the check." : null);

  console.log("\nPART 2 — no factor is pinned to a single value across the whole sample");
  const keys = Object.keys(rows[0]);
  const dead = [];
  console.log("  factor              distinct   fires%   (fires = differs from 1.000)");
  for (const k of keys) {
    const vals = rows.map((r) => r[k]).filter((v) => Number.isFinite(v));
    const distinct = new Set(vals.map((v) => v.toFixed(6))).size;
    const fires = vals.filter((v) => v !== 1).length;
    // Bases and composed multipliers are continuous and never sit at 1, so the
    // "fires" column is meaningless for them; only the gated factors can pin.
    const gated = distinct <= 12;
    console.log(`  ${k.padEnd(20)}${String(distinct).padStart(6)}${String(Math.round(fires / vals.length * 100) + "%").padStart(9)}` +
      (distinct === 1 ? "   <== PINNED" : ""));
    if (distinct === 1 && gated && !(k in CONSTANT_BY_DESIGN)) dead.push(k);
  }
  check(dead.length === 0, "every data-driven factor takes more than one value",
    dead.length ? "These returned the identical value on all " + rows.length + " games. A factor that\n" +
      "cannot vary is not contributing — most likely its input is missing from ctx and it\n" +
      "is taking its neutral branch, which looks like a measurement and is not one:\n" +
      dead.map((k) => "  " + k).join("\n") : null);

  /* The home-field term is constant on purpose, so "does it vary" is the wrong
   * question to ask of it — but it still has a way to die silently, and that is
   * what gets asserted instead. homeOffAdvantage is a pure function of a
   * boolean: it returns HFA_UP to the home side and HFA_DOWN to the away side.
   * If the two ever came back equal, or equal to 1, the entire measured
   * first-inning home split would be switched off while every game still
   * carried a confident-looking factor value. That is precisely the failure
   * mode of the four rolling factors, minus the varying — so it is checked
   * directly rather than waved through by the exemption above. */
  const offAdvA = new Set(rows.map((r) => r.awayOffAdv)), offAdvH = new Set(rows.map((r) => r.homeOffAdv));
  const a1 = [...offAdvA][0], h1 = [...offAdvH][0];
  check(offAdvA.size === 1 && offAdvH.size === 1 && a1 !== h1 && a1 !== 1 && h1 !== 1,
    "the home-field split is applied and is not neutral",
    `away ${a1} / home ${h1} — these must be two different non-1 constants (HFA_DOWN and HFA_UP).`);

  console.log("\n" + "=".repeat(72));
  if (failures) { console.log(`${failures} check(s) FAILED`); process.exit(1); }
  console.log("harness and model agree on every input the model reads");
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
