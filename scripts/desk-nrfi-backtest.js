// NRFI backtest — runs the REAL model (sliced from app.jsx) over historical
// games against actual first-inning outcomes, then reports calibration/Brier/
// reliability and prints a calibration seed to bake into the app.
//
//   node scripts/desk-nrfi-backtest.js [days]     (default 14)
//
// PITCHER SPLITS AND TEAM OFFENCE ARE NOW POINT-IN-TIME. This header used to say
// the splits were current-season with "mild look-ahead leakage". The leakage was
// not mild, and the word did real damage — it read as a footnote while every
// number below inherited it. Measured over 558 games, SAME games in both
// columns, split source the only difference (NRFI_LEAKY=1 restores the old
// behaviour), with 1077 arms and 1114 lineups rewound off prior games and zero
// falling back to a season aggregate:
//
//                     leaky    point-in-time    base rate
//     Brier           .2383        .2436          .2495
//     AUC             .6395        .5881
//     pick-side acc   61.0%        57.1%
//     prediction sd    5.8pp        5.6pp
//
// The leak was 47% of the model's apparent skill over the base rate (.0112 ->
// .0059) and 5.1 points of AUC. Rewinding team offence on top of the pitcher
// splits cost a further 1.8pp of pick-side accuracy, all of it leak.
//
// Do NOT compare these figures against the previous draft of this table
// (.2368/.6512/62.5% leaky, .2422/.5954/58.9% clean). That was a different,
// smaller window. Only the within-run comparison is paired; across runs the
// window changes and the difference stops meaning anything. The one number
// worth carrying forward is that the old leaky pick-side accuracy, 62.5%, was
// to the decimal what nrfi-ladder-sweep.js reported for its BET rung — the
// sweep's headline was the leak reading itself back. That rung read 60.2% once
// pitI01 and teamOff were rewound, and reads 57.5% now that the starter's
// season line is rewound and regressed too.
//
// Note the prediction sd barely moves. An earlier draft claimed the leak
// manufactured a quarter of the spread; that was measured through an index that
// matched no arms at all, which nulled every starter to the league mean and
// collapsed sd for an unrelated reason. The leak inflates ACCURACY, not
// confidence.
//
// THE STARTER'S SEASON LINE IS NOW POINT-IN-TIME TOO, and two silent drifts
// between this harness and the app were fixed with it. Same 558 games again:
//
//                    pitI01+teamOff    + pitMeta & regression
//     Brier              .2436                .2449
//     AUC                .5881                .5780
//     pick-side acc      57.1%                56.3%
//
// Three separate things, all pointing the same way:
//   - pitMeta's seasonEra/ip/gs/g/allow were whole-season pulls, so the
//     starter's first inning was rewound and his overall line was not. They are
//     now summed out of the game log he was already being fetched for, which
//     costs no extra request. nrfi-rewind-test.js asserts the sum reproduces
//     MLB's own season aggregate; without that equality this is not a rewind,
//     it is a different statistic wearing the same field names.
//   - paRates was being called here with NO regression, at both the pitcher
//     allow-rate and the batter-vs-pitcher h2h site, while the app passes
//     NRFI_PA_REG_PIT and NRFI_PA_REG_H2H. An unregressed 8-PA h2h line blended
//     in at up to 65% weight is a very loud signal, and in a backtest it is a
//     loud LEAKY one. The constants were in scope the whole time and simply
//     never destructured.
//   - the "Pitcher K9 trend" check reads recentK9/seasonK9/recentIp off the
//     meta object, and this harness never supplied any of them, so the check
//     returned null on every row while firing live. It votes into the consensus
//     that decides a game's rung, so every tier volume below had been measured
//     on a model with one fewer check than the one that ships. A missing check
//     is indistinguishable from a check that abstained, which is why this sat
//     unnoticed; the rewind test now asserts the fields arrive.
//
// Cumulatively the model's measured skill over the base rate has gone .0112
// (leaky) -> .0059 -> .0046. What ships is 41% as sharp as the original harness
// claimed. Nothing about the model changed to cause that; only the honesty of
// what it was being fed.
//
// A SIDE EFFECT WORTH READING: the sim path's advantage over the lambda path is
// gone. It was Brier .2436 vs .2453 and AUC .5881 vs .5758; it is now .2450 vs
// .2449 and .5827 vs .5857 — a dead heat, with lambda a hair ahead inside
// noise. The sim is the path that consumes `allow` and the batter rates, so it
// was the path holding most of the leak. Do NOT read this as "switch to
// lambda": the blend sweep below is flat to four decimals across every w, which
// means the window cannot tell them apart, not that lambda won.
//
// THE H2H LEAK IS BOUNDED, AND THE BOUND IS ~ZERO. The batter-vs-pitcher line
// cannot be rewound — type=[vsPlayer] returns the season record including the
// game being scored, and there is no per-game log to sum. So it was measured
// instead, by ablation: NRFI_NO_H2H=1 drops the blend and leaves batters on
// their season rates, which is strictly LESS information than the app has live
// and therefore under-states rather than over-states. Same 558 games:
//
//                    h2h on (leaking)   h2h off (ablated)
//     Brier               .2449               .2449
//     AUC                 .5780               .5769
//     pick-side acc       56.3%               56.0%
//
// The truth is bracketed between those columns, and the bracket is 0.0011 of
// AUC wide. So no figure above is materially inflated by h2h.
//
// Read the other way, that is a finding about the FEATURE, not just the leak:
// the h2h blend carries up to 65% weight on a batter's rates, costs an extra
// API call per game, and buys 0.0011 AUC and 0.3pp of pick-side accuracy WHILE
// BEING ALLOWED TO CHEAT. Its honest contribution is therefore at most that,
// and plausibly negative. It has not been removed on this evidence alone —
// within-noise cuts both ways, and one 45-day window should not retire a live
// feature — but it should not be defended as load-bearing either.
//
// THE TOP-OF-ORDER OBP LEAK IS BOUNDED THE SAME WAY, AND IT SETTLES WHETHER THE
// OFFENCE REWIND IS WORTH BUILDING. topOrder asks for sitCodes=[vl]/[vr], and a
// hitting gameLog does not split by the opposing pitcher's hand, so there is no
// point-in-time vs-hand OBP to sum. NRFI_NO_LINEUP_OBP=1 forces the factor to 1
// and leaves `obp` and `batters` alone — `obp` is read live only as a null check
// (a -0.12 confidence penalty and the lineupPosted flag), so blanking it would
// move tier assignment too and the run would stop measuring the one thing it was
// set up to measure. 559 games, both runs back to back on one API snapshot:
//
//                    OBP on (leaking)   OBP off (ablated)
//     Brier               .2449               .2452
//     AUC                 .5775               .5754
//     pick-side acc       55.9%               56.2%
//
// A 0.0021 bracket, with the ablation slightly AHEAD on pick-side, and tier hit
// rates that barely move (SIM BET 59% -> 57%, STRONG 61% -> 61%) on near-
// identical volume. lineup.factor carries coefficient 1.0 in offMult, the
// largest term in it, so this was the one remaining leak with a real prior on
// mattering — and it does not. The topOrder rewind is therefore not worth
// building: the term buys about nothing while allowed to see the game it is
// predicting, and a clean version can only buy less.
//
// Both brackets sit inside the ~0.5pp of run-to-run drift documented in
// nrfi-ladder-sweep.js. Re-run the pair before re-litigating either; do not
// diff against the tables above, because the offence-side inputs move as games
// finalise.
//
// STILL LEAKING, so this is not yet a clean walk-forward: topOrder's batter OBP
// and per-PA rates, savant's Statcast, and the opsVsR/opsVsL platoon split
// inside teamOff are all whole-season pulls. Everything still leaking is now on
// the OFFENCE side; the pitcher side is clean. The two largest of those leaks —
// h2h and top-of-order OBP — are bounded above by ablation rather than removed,
// at 0.0011 and 0.0021 of AUC. What is left unbounded is per-PA batter rates
// (which the paired sim-vs-lambda comparison already shows to be a dead heat),
// Statcast, and platoon OPS.
// CLV on live picks remains the cleanest test available.
const fs = require("fs");
const path = require("path");
// The model loader and the MLB fetchers now live in nrfi-model-lib.js so that
// every analysis script scores games through one code path. See that file for
// why a second copy is worse than an import.
const { J, savant, mapLimit, buildCtx, scoreGame, C, PIT_MODE, pitStats,
  NRFI_CALIB_SEED, ABLATIONS, modelSig } = require("./nrfi-model-lib");
/* Where this run's artifact goes, and why it is not always the same file.
 *
 * An ablation run scores the same games with a term switched off and writes a
 * calibration seed fit on those numbers. Writing that to nrfi-backtest.json
 * would leave the shipped seed's file holding a seed for a model that is not
 * shipped, with nothing in the filename to say so — and the next reader has no
 * reason to doubt it. modelSig distinguishes the two inside the cache (see
 * nrfi-model-lib), but a sig only helps someone who checks it, and this file is
 * read by hand more often than by script.
 *
 * Default runs keep the exact old path, so nothing that reads
 * nrfi-backtest.json has to change.
 */
const OUT = ABLATIONS
  ? `nrfi-backtest.ablate-${ABLATIONS.replace(/[^a-z0-9]+/gi, "-")}.json`
  : "nrfi-backtest.json";
// Read from app.jsx through the model slice, never retyped here. This was
// hardcoded as `0.050` in two places while app.jsx shipped -0.048: wrong
// magnitude and wrong SIGN, so the "shipped seed applied to each path" section
// below was shifting every prediction the wrong direction and then reporting
// that the shipped seed HURT both paths. The report was measuring its own typo.
const SHIPPED_C = NRFI_CALIB_SEED.c;
const logit = (p) => Math.log(p / (1 - p)), unlogit = (x) => 1 / (1 + Math.exp(-x));

(async () => {
  const days = Number(process.argv[2] || 14);
  const se = new Date().getUTCFullYear();
  const dates = []; for (let d = 1; d <= days; d++) { const dt = new Date(Date.now() - d * 864e5); dates.push(dt.toISOString().slice(0, 10)); }
  const { by: periBy, lg } = await savant(se);
  const samples = [];
  for (const date of dates) {
    let sch; try { sch = await J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,linescore,team,lineups,weather,venue,officials`); } catch { continue; }
    const games = (sch.dates?.[0]?.games || []).filter((g) => g.status?.abstractGameState === "Final" && g.linescore?.innings?.[0]);
    const rows = await mapLimit(games, 5, async (g) => {
      const a = g.teams?.away, h = g.teams?.home;
      const ctx = await buildCtx(g, date, se, periBy);
      if (!ctx) return null;
      const ev = scoreGame(ctx, lg);
      const inn1 = g.linescore.innings[0];
      const runs = (+(inn1.away?.runs || 0)) + (+(inn1.home?.runs || 0));
      if (ev.pNRFI == null) return null;
      // gamePk alongside the readable key, because the readable key is NOT
      // unique: both ends of a doubleheader share a date and both teams. Seven
      // of them in a 30-day window, and each pair carries different starters and
      // often a different result. Anything joining two artifacts on `k` alone
      // silently pairs game 1's probability with game 2's outcome — which is
      // exactly how nrfi-backtest-ab.js first tripped, reporting a "stale
      // artifact" for two runs made ten seconds apart.
      return { pModel: ev.pNRFI, method: ev.method, id: g.gamePk,
        actual: runs === 0 ? 1 : 0, key: date + " " + a.team.abbreviation + "@" + h.team.abbreviation };
    });
    for (const r of rows) if (r) samples.push(r);
    process.stderr.write(`  ${date}: ${rows.filter(Boolean).length} games (total ${samples.length})\n`);
  }

  // Fail loudly. This file spent an unknown number of commits reporting
  // "No samples." while every single row threw ReferenceError on a factor that
  // had been added to nrfiEvaluate without a matching slice here. Silence read
  // as "the schedule was empty" instead of "the model does not load", so the
  // shipped NRFI_CALIB_SEED kept its authority long after the model it was fit
  // to had stopped existing. A backtest is allowed to find nothing; it is not
  // allowed to find nothing because it is broken.
  if (mapLimit.errs) {
    const rate = mapLimit.errs / (mapLimit.errs + samples.length);
    console.error(`\n!! ${mapLimit.errs} of ${mapLimit.errs + samples.length} games failed to evaluate (${(rate * 100).toFixed(0)}%)`);
    console.error("!! last error: " + ((mapLimit.lastErr && mapLimit.lastErr.message) || mapLimit.lastErr));
    if (mapLimit.lastErr instanceof ReferenceError) {
      console.error("!! A ReferenceError here means the model bundle is missing a slice.");
      console.error("!! Run: node scripts/nrfi-slice-gap.js   (lists app.jsx decls the bundle never defines)");
    }
    if (rate > 0.2) { console.error("!! >20% failure — refusing to report numbers off a partial model.\n"); process.exitCode = 1; return; }
  }
  const n = samples.length;
  if (!n) { console.log("No samples."); return; }
  // Say which split source produced every number below. A backtest that does not
  // declare this is not reporting a result: the two modes differ by more Brier
  // than most of the effects these scripts exist to measure.
  const ps = pitStats();
  console.log(`\nSPLITS: ${PIT_MODE}` +
    `\n  pitcher 1st-inn  rewound ${ps.pit}, no prior starts ${ps.miss}, season-aggregate ${ps.api}` +
    `\n  team offence     rewound ${ps.off.pit}, no prior games ${ps.off.miss}, season-aggregate ${ps.off.api}` +
    `\n  starter szn line rewound ${ps.meta.pit}, no prior starts ${ps.meta.miss}, season-aggregate ${ps.meta.api}` +
    `\n  batter-vs-pitcher h2h  ${ps.h2h}` +
    `\n  top-of-order OBP       ${ps.obp}` +
    `\n  STILL WHOLE-SEASON: lineup per-PA rates, Statcast, platoon OPS.`);
  if (PIT_MODE === "leaky") console.log("  !! NRFI_LEAKY=1 — season-to-date splits contain the scored game. Control only.");
  else if (ps.miss > ps.pit) console.log("  !! more arms had no prior starts than were rewound — early-window sample, read with care.");
  const cl = (x) => C(x, 1e-6, 1 - 1e-6);

  // AUC via the rank identity (Mann-Whitney U). Brier and log-loss both mix
  // discrimination with calibration, so a path can look bad purely because its
  // level is off by a constant. AUC is invariant to any monotone recentring,
  // which is exactly the question here: does the sim path KNOW more, or is it
  // merely shifted? Ties split, so a constant predictor scores 0.500.
  function auc(rows, get) {
    const pos = rows.filter((r) => r.actual === 1).map(get);
    const neg = rows.filter((r) => r.actual === 0).map(get);
    if (!pos.length || !neg.length) return null;
    const all = rows.map(get).slice().sort((a, b) => a - b);
    const rank = new Map();
    for (let i = 0; i < all.length;) {
      let j = i; while (j + 1 < all.length && all[j + 1] === all[i]) j++;
      const r = (i + j) / 2 + 1;
      rank.set(all[i], r); i = j + 1;
    }
    const sumPos = pos.reduce((a, v) => a + rank.get(v), 0);
    return (sumPos - pos.length * (pos.length + 1) / 2) / (pos.length * neg.length);
  }

  function metrics(rows, get) {
    const m = rows.length;
    const actualRate = rows.filter((r) => r.actual).length / m;
    const meanPred = rows.reduce((a, r) => a + get(r), 0) / m;
    const brier = rows.reduce((a, r) => a + (get(r) - r.actual) ** 2, 0) / m;
    const logloss = -rows.reduce((a, r) => a + (r.actual ? Math.log(cl(get(r))) : Math.log(cl(1 - get(r)))), 0) / m;
    const picks = rows.filter((r) => Math.abs(get(r) - 0.5) >= 0.03);
    const pickAcc = picks.length ? picks.filter((r) => (get(r) >= 0.5) === (r.actual === 1)).length / picks.length : 0;
    const shrink = Math.min(1, m / 100);
    // Solve for the shift the same way the LIVE path does, rather than
    // differencing logits of means.
    //
    // c is applied per game, in logit space, to each prediction. The difference
    // lg(actual) - lg(meanPred) only equals that if logit were linear, and it is
    // not: it is concave above 0.5 and convex below, so the shortcut always
    // overshoots toward the middle — by ~0.27pp on a realistic spread of desk
    // picks and ~0.91pp on a wide one. nrfiCalibration in app.jsx was moved to a
    // Newton solve for exactly this reason, and leaving the SEED on the old
    // shortcut meant the two halves of the same calibration were derived
    // differently: the seed a game inherits on day one disagreed with the number
    // the live fit would give it on day two, with no model change in between.
    // Same construction on both sides, so the handover is continuous.
    const solveShift = (preds, target) => {
      let c0 = 0;
      for (let i = 0; i < 60; i++) {
        let mm = 0, d = 0;
        for (const p of preds) { const q = unlogit(logit(cl(p)) + c0); mm += q; d += q * (1 - q); }
        mm /= preds.length; d /= preds.length;
        if (!(d > 1e-9)) break;          // fully saturated: no shift moves the mean
        const step = (target - mm) / d;
        c0 += step;
        if (Math.abs(step) < 1e-10) break;
      }
      return Number.isFinite(c0) ? c0 : 0;
    };
    const c = C(solveShift(rows.map(get), cl(actualRate)) * shrink, -0.6, 0.6);
    // Brier after the shift this path's own data implies. If a path's Brier is
    // bad only because it is off-level, recentring fixes it and the gap closes;
    // if the gap survives recentring, the path genuinely discriminates worse.
    const brierCal = rows.reduce((a, r) => a + (unlogit(logit(cl(get(r))) + c) - r.actual) ** 2, 0) / m;
    return { m, actualRate, meanPred, brier, brierCal, logloss, pickAcc, nPicks: picks.length,
      c, auc: auc(rows, get), brierBase: actualRate * (1 - actualRate),
      spread: Math.sqrt(rows.reduce((a, r) => a + (get(r) - meanPred) ** 2, 0) / m) };
  }

  const unlogit = (x) => 1 / (1 + Math.exp(-x));
  const pc = (x) => (x * 100).toFixed(1) + "%";
  function show(title, s) {
    console.log("\n--- " + title + " ---");
    console.log(`  games            ${s.m}`);
    console.log(`  actual NRFI      ${pc(s.actualRate)}`);
    console.log(`  mean prediction  ${pc(s.meanPred)}   bias ${((s.meanPred - s.actualRate) * 100).toFixed(1)} pts`);
    console.log(`  prediction sd    ${(s.spread * 100).toFixed(1)} pts`);
    console.log(`  Brier            ${s.brier.toFixed(4)}   (base-rate ${s.brierBase.toFixed(4)})`);
    console.log(`  Brier recentred  ${s.brierCal.toFixed(4)}   (after this path's own shift c=${s.c.toFixed(3)})`);
    console.log(`  log-loss         ${s.logloss.toFixed(4)}`);
    console.log(`  AUC              ${s.auc == null ? "n/a" : s.auc.toFixed(4)}`);
    console.log(`  pick-side acc    ${pc(s.pickAcc)}  on ${s.nPicks} off-the-fence`);
    console.log(`  implied seed c   ${s.c.toFixed(3)}`);
  }
  function reliability(rows, get) {
    const buckets = {};
    for (const r of rows) { const b = Math.floor(get(r) * 20) / 20; (buckets[b] = buckets[b] || []).push(r.actual); }
    Object.keys(buckets).map(Number).sort((a, b) => a - b).forEach((b) => {
      const arr = buckets[b], rate = arr.reduce((x, y) => x + y, 0) / arr.length;
      console.log(`  ${(b * 100).toFixed(0)}-${(b * 100 + 5).toFixed(0)}%  n=${String(arr.length).padStart(3)}  actual ${(rate * 100).toFixed(0)}%`);
    });
  }

  const P = (r) => r.pModel;

  /* THIS REPORT USED TO HAVE TWO OF EVERYTHING. Every game was scored twice —
   * once through the base-out sim, once through the lambda path with `batters`
   * nulled — and the paired head-to-head, the per-path ladder, the per-path seed
   * fit and an 11-step blend sweep all lived here. The sim is gone (see the
   * tombstone in nrfi-model-lib.js and public/desk/app.jsx), so there is one
   * column now. What killed it, on 1555 paired games out of this artifact:
   *   Brier  blend .24832  vs  lambda .24850   (diff -0.00018, t -1.12)
   *   AUC    blend .5700   vs  lambda .5703    (diff -0.0003,  t -0.16)
   *   side flips 45 games; the sim was right on 22 of them.
   * The blend sweep is not merely unnecessary now, it was never informative:
   * it was flat to four decimals across every w in every window it ever ran. */
  console.log("\n================ NRFI BACKTEST ================");
  console.log(`window: last ${days} days of ${se}   games scored: ${n}`);

  console.log("\n============ AS SHIPPED ============");
  show("shipped", metrics(samples, P));
  console.log("\n  reliability:"); reliability(samples, P);

  // ---- the two things a user actually notices ----
  // "more accurate" is Brier/AUC above. "more common picks" is this: the ladder
  // only fires above 52/55/57/63, so a model that compresses toward 50 produces
  // fewer playable games even when its accuracy is unchanged. Report volume and
  // hit-rate together, because either alone is easy to move in a useless way.
  const LADDER = [["LEAN 52+", 0.52], ["BET 55+", 0.55], ["STRONG 57+", 0.57], ["STRONGEST 63+", 0.63]];
  function ladder(rows, get, label) {
    console.log("\n  " + label);
    for (const [name, thr] of LADDER) {
      const nr = rows.filter((r) => get(r) >= thr);
      const yr = rows.filter((r) => 1 - get(r) >= thr);
      const hit = (a, side) => a.length ? (a.filter((r) => r.actual === side).length / a.length * 100).toFixed(0) + "%" : "  —";
      console.log(`    ${name.padEnd(14)} NRFI ${String(nr.length).padStart(3)} games @ ${hit(nr, 1).padStart(4)}` +
        `   YRFI ${String(yr.length).padStart(3)} @ ${hit(yr, 0).padStart(4)}` +
        `   total ${String(nr.length + yr.length).padStart(3)}`);
    }
  }
  console.log("\n============ PLAYABLE VOLUME AND HIT RATE BY TIER ============");
  ladder(samples, P, "as shipped:");

  /* What the SHIPPED seed does to this window. NRFI_CALIB_SEED is one constant
   * fit on one past window and applied to everything, so the useful question is
   * whether it still lands the mean where the games actually landed. It used to
   * be asked separately of the sim and lambda columns, on the theory that two
   * paths with different biases cannot share one shift — which was a real
   * concern while there were two paths. */
  console.log("\n============ THE SHIPPED SEED, APPLIED TO THIS WINDOW ============");
  {
    const raw = metrics(samples, P);
    const shifted = samples.map((r) => ({ actual: r.actual, p: unlogit(logit(cl(P(r))) + SHIPPED_C) }));
    const bShift = shifted.reduce((a, r) => a + (r.p - r.actual) ** 2, 0) / shifted.length;
    const meanShift = shifted.reduce((a, r) => a + r.p, 0) / shifted.length;
    console.log(`  this window's own fit c=${raw.c.toFixed(3)}, shipped c=${SHIPPED_C.toFixed(3)}`);
    console.log(`  under shipped c: mean ${pc(meanShift)} (actual ${pc(raw.actualRate)}, ` +
      `bias ${((meanShift - raw.actualRate) * 100).toFixed(1)} pts), ` +
      `Brier ${bShift.toFixed(4)} vs ${raw.brier.toFixed(4)} raw -> ${bShift < raw.brier ? "helped" : "HURT"}`);
  }

  /* Is an intercept-only calibration enough?
   *
   * The shipped calibration is a pure shift: it moves every prediction the same
   * distance in logit space, so it can fix the LEVEL and nothing else. If the
   * model is also over-confident — predicting 65% on games that go 58% — that is
   * a SLOPE defect, and no value of c repairs it. A shift applied to an
   * over-confident model just moves the over-confidence somewhere else.
   *
   * So fit the full two-parameter Platt map, sigmoid(a*logit(p) + b), by
   * Newton-Raphson on the log-likelihood, and read `a`. a≈1 means the spread is
   * honest and the shift is the right tool. a<1 means predictions are too
   * extreme and the ladder's thresholds are being crossed by games that have not
   * earned it — which is a betting problem, not a cosmetic one, because the
   * thresholds are absolute.
   *
   * Reported, not applied. Switching the live calibration to two parameters is a
   * change to what gets bet, and it needs its own out-of-sample test before it
   * ships; `a` is fit on the same games it is evaluated on here, so it is an
   * upper bound on how much slope correction would help.
   */
  function plattFit(rows, get) {
    let a = 1, b = 0;
    for (let it = 0; it < 100; it++) {
      let g1 = 0, g2 = 0, h11 = 0, h12 = 0, h22 = 0;
      for (const r of rows) {
        const x = logit(cl(get(r))), q = unlogit(a * x + b), w = q * (1 - q), e = r.actual - q;
        g1 += e * x; g2 += e;
        h11 += w * x * x; h12 += w * x; h22 += w;
      }
      const det = h11 * h22 - h12 * h12;
      if (!(Math.abs(det) > 1e-12)) break;
      const da = (g1 * h22 - g2 * h12) / det, db = (g2 * h11 - g1 * h12) / det;
      a += da; b += db;
      if (Math.abs(da) < 1e-10 && Math.abs(db) < 1e-10) break;
    }
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    // Standard error on the slope, so "a is below 1" can be told apart from
    // "a wandered below 1 on 200 games", which on this sample size it usually is.
    let h11 = 0, h12 = 0, h22 = 0;
    for (const r of rows) {
      const x = logit(cl(get(r))), q = unlogit(a * x + b), w = q * (1 - q);
      h11 += w * x * x; h12 += w * x; h22 += w;
    }
    const det = h11 * h22 - h12 * h12;
    const seA = det > 0 ? Math.sqrt(h22 / det) : null;
    const brier = rows.reduce((s, r) => s + (unlogit(a * logit(cl(get(r))) + b) - r.actual) ** 2, 0) / rows.length;
    return { a, b, seA, brier };
  }
  const shipped = metrics(samples, P);
  const platt = plattFit(samples, P);
  console.log("\n============ IS A SHIFT ENOUGH? (slope check) ============");
  if (!platt) console.log("  Platt fit did not converge — no slope reading.");
  else {
    const z = platt.seA ? (platt.a - 1) / platt.seA : null;
    console.log(`  intercept-only   c=${shipped.c.toFixed(3)}   Brier ${shipped.brierCal.toFixed(4)}`);
    console.log(`  full Platt       a=${platt.a.toFixed(3)}${platt.seA ? " +/- " + platt.seA.toFixed(3) : ""}` +
      ` b=${platt.b.toFixed(3)}   Brier ${platt.brier.toFixed(4)}`);
    console.log(`  slope vs 1       ${z == null ? "n/a" : (z >= 0 ? "+" : "") + z.toFixed(2) + " SE"}` +
      `   Brier gained by the slope ${(shipped.brierCal - platt.brier).toFixed(5)}`);
    if (z != null && Math.abs(z) < 2) {
      console.log("  -> slope is within noise of 1. The shift is the right tool; a second");
      console.log("     parameter would be fitting this sample, not a defect.");
    } else if (platt.a < 1) {
      console.log("  -> OVER-CONFIDENT: predictions are too extreme, and an intercept-only");
      console.log("     calibration cannot fix it. Games are crossing absolute ladder");
      console.log("     thresholds on spread they have not earned. Needs its own");
      console.log("     out-of-sample test before the live calibration changes.");
    } else {
      console.log("  -> UNDER-CONFIDENT: predictions are too timid. The model is leaving");
      console.log("     edge on the table rather than manufacturing it.");
    }
  }

  const seed = { c: Math.round(shipped.c * 1000) / 1000, n, active: n >= 25 };
  console.log("\ncalibration seed for the SHIPPED mix (NRFI_CALIB_SEED):");
  console.log("  " + JSON.stringify(seed));
  console.log("  This is an IN-SAMPLE fit and will always look good on its own window.");
  console.log("  Settle it out of sample with scripts/nrfi-calib-walk.js before shipping it.");
  fs.writeFileSync(path.join(__dirname, OUT), JSON.stringify({
    ...seed, at: new Date().toISOString(), days, season: se,
    // modelSig travels with the rows, so a reader can tell whether these scores
    // came from the model that ships. Without it this file is a page of numbers
    // with no way to date them against the code — which is the same reason the
    // tout cache carries one, and that guard is what stopped nrfi-calib-fit.js
    // from fitting a live constant on scores from a model two commits old.
    modelSig, pitMode: PIT_MODE, pitStats: ps, ablations: ABLATIONS || null,
    shipped, platt,
    // The per-game rows the seed was fit on. Without them the seed is a number
    // with a provenance story attached, and every re-derivation (a slope check,
    // a reliability curve, a bucketed fit) needs another 20-minute API walk to
    // ask a question of data that was already in hand.
    //
    // Artifacts written before the sim was removed also carry an `l` column (the
    // lambda path on the same game) and a `paired` section. Readers that want
    // those must handle their absence rather than assume a stale file.
    rows: samples.map((s) => ({ id: s.id, k: s.key, p: +s.pModel.toFixed(4), a: s.actual, m: s.method })),
  }, null, 2));
  console.log("  (written to scripts/" + OUT + ")" +
    (ABLATIONS ? "  -- ABLATED RUN (" + ABLATIONS + "), not a shipped seed" : ""));
})();
