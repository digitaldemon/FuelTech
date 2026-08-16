// NRFI backtest — runs the REAL model (sliced from app.jsx) over historical
// games against actual first-inning outcomes, then reports calibration/Brier/
// reliability and prints a calibration seed to bake into the app.
//
//   node scripts/desk-nrfi-backtest.js [days]     (default 14)
//
// PITCHER SPLITS ARE NOW POINT-IN-TIME. This header used to say the splits were
// current-season with "mild look-ahead leakage". The leakage was not mild, and
// the word did real damage — it read as a footnote while every number below
// inherited it. Measured on one 407-game window, same games, split source the
// only difference (NRFI_LEAKY=1 restores the old behaviour), 96.6% of arms
// rewound off prior starts:
//
//                     leaky    point-in-time    base rate
//     Brier           .2368        .2422          .2491
//     AUC             .6512        .5954
//     pick-side acc   62.5%        58.9%
//     prediction sd    5.6pp        5.5pp
//
// The leak was 44% of the model's apparent skill over the base rate (.0123 ->
// .0069) and 5.6 points of AUC. And that 62.5% is, to the decimal, the BET rung
// nrfi-ladder-sweep.js has been reporting — so the sweep's headline was the
// leak reading itself back.
//
// Note the prediction sd barely moves. An earlier draft of this table claimed
// the leak manufactured a quarter of the spread; that was measured through an
// index that matched no arms at all, which nulled every starter to the league
// mean and collapsed sd for an unrelated reason. The leak inflates ACCURACY,
// not confidence.
//
// STILL LEAKING, so this is not yet a clean walk-forward: pitMeta's
// seasonEra/ip/allow, teamOff, topOrder's batter OBP and savant's Statcast are
// all whole-season pulls. pitI01 was rewound first because it is the term
// measured to leak (nrfi-pitreg-fit.js) and it feeds pitBase at full weight.
// CLV on live picks remains the cleanest test available.
const fs = require("fs");
const path = require("path");
// The model loader and the MLB fetchers now live in nrfi-model-lib.js so that
// every analysis script scores games through one code path. See that file for
// why a second copy is worse than an import.
const { J, savant, mapLimit, buildCtx, scoreBothPaths, C, PIT_MODE, pitStats } = require("./nrfi-model-lib");
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
      // Comparing the two paths on a paired subset is the point: a sim-vs-lambda
      // split across DIFFERENT games would confound the path with "lineups posted
      // early enough to scrape", which is itself a selection on day games,
      // marquee matchups, and well-run clubhouses.
      const { ev, evLam } = scoreBothPaths(ctx, lg);
      const inn1 = g.linescore.innings[0];
      const runs = (+(inn1.away?.runs || 0)) + (+(inn1.home?.runs || 0));
      if (ev.pNRFI == null || evLam.pNRFI == null) return null;
      return { pModel: ev.pNRFI, pLam: evLam.pNRFI, method: ev.method,
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
  console.log(`\nPITCHER SPLITS: ${PIT_MODE}` +
    `   (rewound ${ps.pit}, no prior starts ${ps.miss}, season-aggregate ${ps.api})`);
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
    const c = C((logit(cl(actualRate)) - logit(cl(meanPred))) * shrink, -0.6, 0.6);
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

  const simRows = samples.filter((s) => s.method !== "model"); // "blend" today, "sim" historically
  const P = (r) => r.pModel, L = (r) => r.pLam;

  console.log("\n================ NRFI BACKTEST — BOTH PATHS ================");
  console.log(`window: last ${days} days of ${se}   games scored: ${n}`);
  console.log(`sim path fired on ${simRows.length}/${n} (${pc(simRows.length / n)}) — the rest had no posted lineup`);

  console.log("\n============ AS SHIPPED (whatever path the app took) ============");
  show("shipped", metrics(samples, P));

  console.log("\n============ PAIRED HEAD-TO-HEAD (sim-eligible games only) ============");
  console.log("Same games, same inputs, only the path differs. This is the comparison");
  console.log("that means something; everything else is confounded by lineup availability.");
  if (simRows.length < 25) {
    console.log(`\n  !! only ${simRows.length} sim-eligible games — too thin to conclude. Run more days.`);
  }
  if (simRows.length) {
    const sSim = metrics(simRows, P), sLam = metrics(simRows, L);
    show("SIM path", sSim);
    show("LAMBDA path (same games)", sLam);
    const dB = sSim.brier - sLam.brier, dA = (sSim.auc || 0) - (sLam.auc || 0);
    console.log("\n  verdict on the pair:");
    console.log(`    Brier   sim ${sSim.brier.toFixed(4)} vs lambda ${sLam.brier.toFixed(4)}   -> ${dB < 0 ? "SIM better" : "LAMBDA better"} by ${Math.abs(dB).toFixed(4)}`);
    console.log(`    AUC     sim ${(sSim.auc || 0).toFixed(4)} vs lambda ${(sLam.auc || 0).toFixed(4)}   -> ${dA > 0 ? "SIM better" : "LAMBDA better"} by ${Math.abs(dA).toFixed(4)}`);
    console.log(`    seed c  sim ${sSim.c.toFixed(3)} vs lambda ${sLam.c.toFixed(3)}   (shipped NRFI_CALIB_SEED.c = 0.050)`);
    const near = (x) => Math.abs(x - 0.05);
    console.log(`    -> the shipped seed sits closer to the ${near(sSim.c) < near(sLam.c) ? "SIM" : "LAMBDA"} path's own fit`);
    const disagree = simRows.filter((r) => (P(r) >= 0.5) !== (L(r) >= 0.5));
    console.log(`\n    the two paths pick different sides on ${disagree.length}/${simRows.length} games`);
    if (disagree.length) {
      const simWins = disagree.filter((r) => (P(r) >= 0.5) === (r.actual === 1)).length;
      console.log(`    on those, sim was right ${simWins}/${disagree.length}, lambda ${disagree.length - simWins}/${disagree.length}`);
    }
    const md = simRows.reduce((a, r) => a + Math.abs(P(r) - L(r)), 0) / simRows.length;
    console.log(`    mean |sim - lambda| = ${(md * 100).toFixed(2)} pts`);
    console.log("\n  reliability, SIM path:"); reliability(simRows, P);
    console.log("\n  reliability, LAMBDA path (same games):"); reliability(simRows, L);
  }

  // ---- the two things a user actually notices ----
  // "more accurate" is Brier/AUC above. "more common picks" is this: the ladder
  // only fires above 52/55/57/63, so a path that compresses toward 50 produces
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
  if (simRows.length) {
    console.log("\n============ PLAYABLE VOLUME AND HIT RATE BY TIER ============");
    console.log("Same games. If one path shows fewer playable games at similar hit rates,");
    console.log("that is the 'fewer picks' complaint, and it is a spread problem, not a skill one.");
    ladder(simRows, P, "SIM path:");
    ladder(simRows, L, "LAMBDA path (same games):");

    // What the SHIPPED seed does to each path. NRFI_CALIB_SEED is a single
    // constant applied regardless of which path produced the number, so if the
    // two paths need different shifts, one of them is being actively mis-set.
    const SHIPPED_C = 0.050;
    console.log("\n============ THE SHIPPED SEED, APPLIED TO EACH PATH ============");
    console.log(`NRFI_CALIB_SEED.c = ${SHIPPED_C.toFixed(3)} is applied to both paths indiscriminately.`);
    for (const [name, get] of [["SIM", P], ["LAMBDA", L]]) {
      const raw = metrics(simRows, get);
      const shifted = simRows.map((r) => ({ actual: r.actual, p: unlogit(logit(cl(get(r))) + SHIPPED_C) }));
      const bShift = shifted.reduce((a, r) => a + (r.p - r.actual) ** 2, 0) / shifted.length;
      const meanShift = shifted.reduce((a, r) => a + r.p, 0) / shifted.length;
      console.log(`  ${name.padEnd(7)} own fit c=${raw.c.toFixed(3)}  |  under shipped c: mean ${pc(meanShift)} ` +
        `(actual ${pc(raw.actualRate)}, bias ${((meanShift - raw.actualRate) * 100).toFixed(1)} pts), ` +
        `Brier ${bShift.toFixed(4)} vs ${raw.brier.toFixed(4)} raw -> ${bShift < raw.brier ? "helped" : "HURT"}`);
    }
  }

  // ---- what mix of the two paths is actually best? ----
  // The app currently sets w=1.00 (sim wins outright the moment lineups post).
  // That was never measured. Sweep the blend in logit space -- averaging
  // probabilities directly would drag every blend toward 0.5 and make the
  // midpoint look good for the wrong reason. Report Brier, AUC and playable
  // volume together, because a mix that wins Brier by compressing toward the
  // base rate has bought accuracy with the picks you actually wanted.
  if (simRows.length) {
    console.log("\n============ BLEND SWEEP: w*sim + (1-w)*lambda, in logit space ============");
    console.log("  w      Brier     AUC      pick-acc   BET55+ vol   mean pred");
    let best = null;
    for (let w = 0; w <= 1.0001; w += 0.1) {
      const get = (r) => unlogit(w * logit(cl(P(r))) + (1 - w) * logit(cl(L(r))));
      const m = metrics(simRows, get);
      const vol = simRows.filter((r) => get(r) >= 0.55 || 1 - get(r) >= 0.55).length;
      const flag = Math.abs(w - 1) < 1e-6 ? "  <- shipped" : "";
      console.log(`  ${w.toFixed(1)}  ${m.brier.toFixed(4)}  ${(m.auc || 0).toFixed(4)}   ${pc(m.pickAcc).padStart(6)}` +
        `     ${String(vol).padStart(3)}       ${pc(m.meanPred)}${flag}`);
      if (!best || m.brier < best.brier) best = { w, brier: m.brier, auc: m.auc, vol };
    }
    console.log(`\n  best Brier at w=${best.w.toFixed(1)} (${best.brier.toFixed(4)}, AUC ${best.auc.toFixed(4)}, ${best.vol} playable at BET55+)`);
    console.log("  NOTE: this is an in-sample optimum over one 30-day window. Treat a");
    console.log("  shallow minimum as 'anything in this range is fine', not as a precise w.");
  }

  console.log("\n============ LAMBDA PATH OVER EVERY GAME ============");
  show("lambda, full window", metrics(samples, L));
  console.log("\n  reliability:"); reliability(samples, L);

  const shipped = metrics(samples, P);
  const seed = { c: Math.round(shipped.c * 1000) / 1000, n, active: n >= 25 };
  console.log("\ncalibration seed for the SHIPPED mix (NRFI_CALIB_SEED):");
  console.log("  " + JSON.stringify(seed));
  console.log("  NOTE: this is a blended fit over two paths with different biases.");
  console.log("  If the paired section shows their implied c's far apart, one seed");
  console.log("  cannot serve both and the seed should be made path-aware.");
  fs.writeFileSync(path.join(__dirname, "nrfi-backtest.json"), JSON.stringify({
    ...seed, at: new Date().toISOString(), days, season: se,
    shipped, lambdaAll: metrics(samples, L),
    paired: simRows.length ? { sim: metrics(simRows, P), lambda: metrics(simRows, L) } : null,
  }, null, 2));
  console.log("  (written to scripts/nrfi-backtest.json)");
})();
