// Does our model see what NRFIKINGKY sees?
//
//   node scripts/nrfi-tout-vs-model.js [sellerId] [maxDates]
//
// He grades out 205-120 (63.1%) on first-inning legs with a CLV t-stat of 7.6,
// so the edge is real and worth understanding. But "be more like him" is two
// completely different code changes depending on WHY he wins, and the two are
// easy to confuse:
//
//   DIRECTION problem — we look at his games and estimate the wrong number.
//     Then the fix is signal: some factor he has and we don't.
//   FILTER problem — we estimate the same number he does, but our verdict
//     ladder does not fire on it, or fires on twenty other games too.
//     Then the fix is thresholds and selection, and touching the model
//     would make things worse.
//
// The test that separates them is not "do we agree with his picks" — a model
// that says NRFI on everything agrees with him constantly and knows nothing.
// It is where his picks land in OUR ranking of the SAME slate. If his games sit
// in our top decile, we already see them. If they sit at random, he has signal
// we lack.
//
// Scoring is done through scripts/nrfi-model-lib.js, the same loader the
// backtest uses, so this measures the shipped model rather than a copy of it.
const fs = require("fs");
const path = require("path");
const { J, savant, mapLimit, buildCtx, scoreBothPaths, makeVerdict, modelSig, PIT_MODE, pitStats } = require("./nrfi-model-lib");
const { gradeSeller } = require("./nrfi-tout-grade");
const { nrfiThinArm: thinArm } = makeVerdict();

const pc = (x) => (x * 100).toFixed(1) + "%";
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");

(async () => {
  const id = process.argv[2] || "318949";
  const args = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const maxDates = Number(process.argv[3] || 0) || Infinity;
  const se = new Date().getUTCFullYear();
  // A full-season pass is ~1300 games and ~20 minutes of MLB API calls. The
  // scoring is deterministic given the same stats, so cache it and let the
  // analysis below be re-cut cheaply. Re-run without --cached whenever the
  // model changes; the cached scores are from whatever app.jsx said that day.
  const useCache = args.includes("--cached") && fs.existsSync(CACHE);

  let dates, slates, byDate;
  if (useCache) {
    const c = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    /* ENFORCE the fingerprint, do not merely record it.
     *
     * This wrote modelSig into the cache from the start and never read it back,
     * which is a guard in name only: --cached would re-cut an old model's scores
     * under a new model's banner and print conclusions about code that never
     * produced them. The comment above ("re-run whenever the model changes") was
     * doing the enforcing, and a comment cannot.
     *
     * Found live: extending modelSig to cover buildCtx moved the sig from
     * 956697bbc201 to e85504eb719e, and this path would have gone on serving the
     * old cache without a word. --stale is available for the case where the
     * mismatch is understood and the analysis is about something else, because a
     * guard with no escape hatch gets deleted rather than respected. */
    if (c.modelSig && c.modelSig !== modelSig) {
      const msg = `cache was built by model ${c.modelSig}, this is ${modelSig}`;
      if (!args.includes("--stale")) {
        console.error(`\nSTALE CACHE: ${msg}.`);
        console.error("Its scores came from different code, so every number below would describe");
        console.error("a model that is not the one in your working tree.");
        console.error("  rebuild:            node scripts/nrfi-tout-vs-model.js " + id);
        console.error("  or accept the risk: node scripts/nrfi-tout-vs-model.js " + id + " --cached --stale");
        process.exit(1);
      }
      process.stderr.write(`!! --stale: ${msg}. Numbers below describe the OLD model.\n`);
    }
    process.stderr.write(`loaded cached scores from ${c.at} (model ${c.simW == null ? "?" : "NRFI_SIM_W=" + c.simW}, sig ${c.modelSig || "none recorded"})\n`);
    dates = c.dates; slates = new Map(c.slates); byDate = new Map(c.byDate);
  } else {
    ({ dates, slates, byDate } = await collect(id, maxDates, se));
  }

  // Join his picks to our score for the same gamePk.
  const joined = [];
  for (const date of dates) {
    const slate = slates.get(date) || [];
    const idx = new Map(slate.map((s) => [s.gamePk, s]));
    for (const x of byDate.get(date) || []) {
      const mine = x.gamePk != null ? idx.get(x.gamePk) : null;
      if (!mine) continue;
      // gamePk is carried through so the band comparison below can take his own
      // legs OUT of the slate baseline. Leaving them in makes the baseline
      // partly a measurement of him, which understates his edge — conservative,
      // but conservative in a way that would hide the finding.
      joined.push({ date, gamePk: x.gamePk, side: x.side, actual: mine.actual, p: mine.p, label: mine.label, slate });
    }
  }
  report(dates, slates, joined);
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });

async function collect(id, maxDates, se) {
  process.stderr.write("grading the seller's book...\n");
  const { graded, pageErr } = await gradeSeller(id, true);
  const ok = graded.filter((x) => x.a.ok && x.a.day);
  process.stderr.write(`  ${ok.length} legs resolved to a final game\n`);

  /* Stop here rather than "successfully" caching nothing.
   *
   * An empty book is not a small book. If the fetch failed there is no
   * information in this run at all, and every downstream number would be
   * computed over zero rows — which prints as "nothing to compare" rather than
   * as an error, and leaves an empty cache file behind that looks valid to the
   * next reader. The cache on disk is the only copy of ~95 scored dates that
   * take a long time to rebuild, so the bar for replacing it is that this run
   * actually has something. */
  if (!ok.length) {
    const why = pageErr
      ? `the seller feed failed (${pageErr})`
      : "the seller's settled book came back empty";
    throw new Error(
      `${why}, so this run resolved 0 legs.\n` +
      "Refusing to write the cache: an empty result would replace the existing scored\n" +
      "dates with nothing, and that is not recoverable from this script. Retry when\n" +
      "JuiceReel is answering; the current cache is left untouched.");
  }

  // Group his picks by the game's official date, because the percentile test is
  // "against the slate he chose from", and the slate is a day.
  const byDate = new Map();
  for (const x of ok) {
    const d = x.a.day;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push({ side: x.p.side, gamePk: x.a.gamePk });
  }
  const dates = [...byDate.keys()].sort().reverse().slice(0, maxDates);
  process.stderr.write(`scoring full slates for ${dates.length} dates...\n`);

  const { by: periBy, lg } = await savant(se);
  const slates = new Map();   // date -> [{gamePk, p, actual, label}]
  let scored = 0, failed = 0;
  for (const date of dates) {
    let sch;
    try { sch = await J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,linescore,team,lineups,weather,venue,officials`); } catch { continue; }
    const games = (sch.dates?.[0]?.games || []).filter((g) => g.status?.abstractGameState === "Final" && g.linescore?.innings?.[0]);
    const rows = await mapLimit(games, 5, async (g) => {
      const ctx = await buildCtx(g, date, se, periBy);
      if (!ctx) return null;
      const { ev } = scoreBothPaths(ctx, lg);
      if (ev.pNRFI == null) return null;
      const inn1 = g.linescore.innings[0];
      const runs = (+(inn1.away?.runs || 0)) + (+(inn1.home?.runs || 0));
      // Cache the verdict gates alongside the probability. nrfiVerdict downgrades
      // on check consensus, confidence and thin arms, so a threshold sweep that
      // sees only `p` would promise volume the real board never shows. Thin-arm
      // state is stored as booleans rather than the whole pitProfiles object,
      // which is the only part of it nrfiVerdict reads.
      /* Per-factor capture, which is the point of this rebuild.
       *
       * nrfi-tout-profile.js could only compare his picks to their band peers on
       * the four summaries stored here (p, consensus, confidence, thin arms),
       * found them identical on all four while he beat those peers by 17.3 pts,
       * and ended by prescribing a re-score that records the INPUTS. These are
       * the shipped values straight off the evaluator, not a harness recompute.
       *
       * Rounded to 4 places: the gated factors take a handful of discrete values
       * (0.84, 0.90, 0.95, 1.0, ...) and the continuous ones are lambda
       * multipliers where the 5th decimal is far below anything a comparison of
       * a few hundred legs can resolve. Full precision would roughly double a
       * file that is read whole on every analysis pass. */
      const r4 = (o) => { const out = {}; for (const k in o) out[k] = Math.round(o[k] * 1e4) / 1e4; return out; };
      return { gamePk: g.gamePk, p: ev.pNRFI, actual: runs === 0 ? 1 : 0,
        label: `${g.teams.away.team.abbreviation}@${g.teams.home.team.abbreviation}`,
        aligned: ev.aligned || null, confidence: ev.confidence == null ? 1 : ev.confidence,
        factors: ev.factors ? r4(ev.factors) : null,
        thinAway: thinArm(ev.pitProfiles && ev.pitProfiles.away),
        thinHome: thinArm(ev.pitProfiles && ev.pitProfiles.home) };
    });
    const keep = rows.filter(Boolean);
    failed += rows.length - keep.length;
    scored += keep.length;
    slates.set(date, keep);
    process.stderr.write(`  ${date}: ${keep.length}/${games.length} scored (total ${scored})\n`);
  }
  if (mapLimit.errs) {
    const rate = mapLimit.errs / (mapLimit.errs + scored);
    console.error(`\n!! ${mapLimit.errs} games threw while scoring (${pc(rate)})`);
    console.error("!! last: " + ((mapLimit.lastErr && mapLimit.lastErr.message) || mapLimit.lastErr));
    if (rate > 0.2) { console.error("!! >20% — refusing to report off a partial model.\n"); process.exitCode = 1; throw new Error("partial model"); }
  }
  const simW = (require("fs").readFileSync(require("path").join(__dirname, "..", "public", "desk", "app.jsx"), "utf8")
    .match(/const NRFI_SIM_W = ([\d.]+);/) || [])[1] || null;
  // Record WHICH pitcher-split source scored these games. modelSig fingerprints
  // the model's constants, so it caught the rewind only because that landed with
  // other changes — a cache rebuilt under NRFI_LEAKY=1 hashes identically to a
  // clean one and would have printed leaked hit rates with nothing to show for
  // it. The mode is a property of the run, not of the model, so it has to be
  // written down separately.
  /* A rebuild may not quietly shrink the cache.
   *
   * The empty-book guard above catches a total feed failure. This catches the
   * partial one, which is worse because it still looks like a successful run:
   * if JuiceReel serves two pages and then 500s, we score a handful of dates,
   * overwrite 95 with 12, and every band statistic downstream silently loses
   * most of its power while continuing to print confident-looking numbers.
   * Losing dates is sometimes legitimate (a smaller --maxDates, a seller who
   * deleted history), so this is overridable — but it has to be said out loud. */
  const prevDates = (() => {
    try { return (JSON.parse(fs.readFileSync(CACHE, "utf8")).dates || []).length; } catch { return 0; }
  })();
  if (prevDates && dates.length < prevDates * 0.9 && !process.argv.includes("--shrink")) {
    throw new Error(
      `this run scored ${dates.length} dates but the cache on disk holds ${prevDates}.\n` +
      "Refusing to overwrite: a rebuild that loses more than 10% of its dates is far more\n" +
      "often a truncated feed than a real change, and the numbers it produces still look\n" +
      "plausible. If the shrink is intended (smaller maxDates, seller pruned history):\n" +
      `  node scripts/nrfi-tout-vs-model.js ${id} ${maxDates} --shrink`);
  }
  /* The factors are the reason this rebuild exists, so a run that did not
   * capture them must not quietly produce a cache that looks complete.
   * ev.factors is a field on nrfiEvaluate's return; if it is renamed or dropped,
   * `ev.factors ? ... : null` above stores null on every game and the profile
   * downstream reports "not recorded on enough games" for every input — which
   * reads as a finding about his picks rather than as a broken capture. */
  {
    const all = [...slates.values()].flat();
    const withF = all.filter((r) => r.factors && Object.keys(r.factors).length >= 20).length;
    if (all.length && withF < all.length * 0.9) {
      throw new Error(
        `only ${withF} of ${all.length} scored games carry a factor block.\n` +
        "This rebuild exists to capture per-factor values; a cache without them is the old\n" +
        "cache with a new timestamp, and the profile that reads it would report every input\n" +
        "as 'not recorded' rather than as missing. Check that nrfiEvaluate still returns\n" +
        "`factors` before re-running.");
    }
  }
  fs.writeFileSync(CACHE, JSON.stringify({ at: new Date().toISOString(), season: se, simW, modelSig,
    pitMode: PIT_MODE, pitStats: pitStats(),
    dates, slates: [...slates], byDate: [...byDate] }));
  process.stderr.write(`  cached to ${CACHE}\n`);
  return { dates, slates, byDate };
}

function report(dates, slates, joined) {
  console.log(`\njoined ${joined.length} of his legs to a model score on the same game`);
  if (!joined.length) { console.log("nothing to compare"); return; }

  const nrfiPicks = joined.filter((j) => j.side === "NRFI");

  // ---- 1. Do we agree on direction? ----
  console.log("\n=========== DIRECTION: what does our model say on HIS games? ===========");
  const agree = nrfiPicks.filter((j) => j.p >= 0.5).length;
  console.log(`  his NRFI legs joined      ${nrfiPicks.length}`);
  console.log(`  our model also says NRFI  ${agree} (${pc(agree / nrfiPicks.length)})`);
  console.log(`  our mean p(NRFI)          ${pc(mean(nrfiPicks.map((j) => j.p)))}`);
  console.log(`  actual NRFI rate on them  ${pc(mean(nrfiPicks.map((j) => j.actual)))}`);
  const allGames = dates.flatMap((d) => slates.get(d) || []);
  console.log(`  ...vs the full slate      ${pc(mean(allGames.map((g) => g.actual)))} on ${allGames.length} games`);
  console.log("\n  If the actual rate on his games clearly beats the slate, his selection is");
  console.log("  doing real work. If our mean p does NOT rise to match, we are not seeing it.");

  // ---- 2. Where do his picks land in OUR ranking of the same slate? ----
  // This is the question. Percentile is computed within the day, so it is
  // immune to our overall level being off — only the ordering matters.
  console.log("\n=========== SELECTION: his picks' percentile in OUR ranking ===========");
  const pctls = [];
  for (const j of nrfiPicks) {
    if (j.slate.length < 4) continue;
    const below = j.slate.filter((g) => g.p < j.p).length;
    const ties = j.slate.filter((g) => g.p === j.p).length;
    pctls.push((below + ties / 2) / j.slate.length);
  }
  const top = (t) => pctls.filter((v) => v >= t).length;
  console.log(`  legs with a usable slate  ${pctls.length}`);
  console.log(`  mean percentile           ${pc(mean(pctls))}   (50% = we rank his picks at random)`);
  console.log(`  in our top 25% that day   ${top(0.75)} (${pc(top(0.75) / pctls.length)})   [random would be 25%]`);
  console.log(`  in our top 10% that day   ${top(0.90)} (${pc(top(0.90) / pctls.length)})   [random would be 10%]`);
  console.log(`  in our BOTTOM half        ${pctls.filter((v) => v < 0.5).length} (${pc(pctls.filter((v) => v < 0.5).length / pctls.length)})`);
  // Distribution, because a mean of 0.6 can be "mildly agrees on everything" or
  // "strongly agrees on half and actively disagrees on the rest", and those two
  // want opposite fixes.
  console.log("\n  percentile distribution:");
  for (let b = 0; b < 10; b++) {
    const n = pctls.filter((v) => v >= b / 10 && v < (b + 1) / 10 + (b === 9 ? 1 : 0)).length;
    console.log(`    ${String(b * 10).padStart(3)}-${String(b * 10 + 10).padStart(3)}%  ${"#".repeat(Math.round(n / Math.max(1, pctls.length) * 60)).padEnd(24)} ${n}`);
  }

  /* ---- 2b. Does his edge survive INSIDE our ranking? ----
   *
   * Section 2 says his picks average the 64th percentile of our ranking, and
   * the old READING took that as proof of a pure filter problem. It is not
   * sufficient, and the reason is a confound the percentile number cannot see:
   * games we rank high DO go NRFI more often than games we rank low. That is
   * our ordering working. So a tout who did nothing but sample from the top of
   * OUR board would post a percentile above 50 and a hit rate above the slate
   * base rate, and both numbers would be measuring us, not him.
   *
   * The question that separates the two diagnoses is what he hits WITHIN a
   * band, against the other games sitting in that same band:
   *
   *   edge only where we already rank high  -> FILTER. Our ordering is right,
   *     we just do not convert the top of it into played verdicts. Fix the
   *     ladder and the daily count; touching the model makes it worse.
   *   edge across every band, including our BOTTOM half -> he is separating
   *     games we consider interchangeable. That is SIGNAL we do not have, and
   *     no threshold change can manufacture it.
   *
   * 23.9% of his legs land in our bottom half, so that cell is populated
   * enough to answer rather than shrug at. */
  console.log("\n=========== HIS EDGE WITHIN EACH BAND OF OUR OWN RANKING ===========");
  const pctlIn = (p, s) => {
    const below = s.filter((g) => g.p < p).length;
    const ties = s.filter((g) => g.p === p).length;
    return (below + ties / 2) / s.length;
  };
  const hisKeys = new Set(nrfiPicks.map((j) => j.date + ":" + j.gamePk));
  const slateBand = [];
  for (const date of dates) {
    const s = slates.get(date) || [];
    if (s.length < 4) continue;
    for (const g of s) {
      if (hisKeys.has(date + ":" + g.gamePk)) continue;   // his legs are the comparison, not the baseline
      slateBand.push({ pctl: pctlIn(g.p, s), actual: g.actual ? 1 : 0 });
    }
  }
  const hisBand = nrfiPicks.filter((j) => j.slate.length >= 4)
    .map((j) => ({ pctl: pctlIn(j.p, j.slate), actual: j.actual ? 1 : 0 }));
  const seOf = (p, n) => (n ? Math.sqrt(p * (1 - p) / n) : 0);
  const band = (rs, lo, hi) => rs.filter((r) => r.pctl >= lo && (hi >= 1 ? r.pctl <= 1 : r.pctl < hi));
  console.log("  our band        his picks        everything else       his edge");
  for (let b = 0; b < 5; b++) {
    const lo = b / 5, hi = (b + 1) / 5;
    const H = band(hisBand, lo, hi), S = band(slateBand, lo, hi);
    const hp = H.length ? mean(H.map((r) => r.actual)) : null;
    const sp = S.length ? mean(S.map((r) => r.actual)) : null;
    let tail = "";
    if (hp != null && sp != null) {
      const d = hp - sp;
      const sd = Math.sqrt(seOf(hp, H.length) ** 2 + seOf(sp, S.length) ** 2);
      tail = ((d >= 0 ? "+" : "") + (d * 100).toFixed(1) + " pts").padStart(9) +
        (sd > 0 && Math.abs(d) > 2 * sd ? "  * 2se" : "");
    }
    console.log(`  ${String(b * 20).padStart(3)}-${String(b * 20 + 20).padStart(3)}%   ` +
      `${(hp == null ? "—" : pc(hp)).padStart(7)} on ${String(H.length).padStart(3)}   ` +
      `${(sp == null ? "—" : pc(sp)).padStart(7)} on ${String(S.length).padStart(4)}   ` + tail);
  }
  const edgeIn = (lo, hi) => {
    const H = band(hisBand, lo, hi), S = band(slateBand, lo, hi);
    if (!H.length || !S.length) return null;
    const hp = mean(H.map((r) => r.actual)), sp = mean(S.map((r) => r.actual));
    const sd = Math.sqrt(seOf(hp, H.length) ** 2 + seOf(sp, S.length) ** 2);
    return { d: hp - sp, n: H.length, sd, z: sd > 0 ? (hp - sp) / sd : 0 };
  };
  const botE = edgeIn(0, 0.5), topE = edgeIn(0.5, 1);
  const fmtE = (e) => e ? `${(e.d >= 0 ? "+" : "")}${(e.d * 100).toFixed(1)} pts on ${e.n} of his legs` +
    `   (${e.z.toFixed(1)} se${Math.abs(e.z) > 2 ? ", significant" : ", NOT significant"})` : "—";
  console.log("\n  our bottom half   " + fmtE(botE));
  console.log("  our top half      " + fmtE(topE));
  /* The verdict below turns on the bottom-half cell, so it has to clear a
   * significance bar and not just a magnitude one. An earlier draft branched on
   * "+5 pts or more" alone: with 78 legs the standard error on that cell is
   * ~5.6 pts, so a threshold of 5 would have fired on pure noise about a third
   * of the time, and it would have fired hardest exactly when the sample was
   * smallest. Requiring 2se costs nothing when the effect is real and refuses
   * to overturn a working diagnosis when it is not. */
  if (botE && topE) {
    // The bottom half is the diagnostic cell. Our ranking says those games are
    // ordinary; if he still beats their peers there, the separation is his.
    if (botE.d > 0.05 && Math.abs(botE.z) > 2) {
      console.log("\n  -> He has SIGNAL WE LACK. In games our model ranks in its own bottom half —");
      console.log("     games we consider unremarkable — his picks still beat their band peers by");
      console.log(`     ${(botE.d * 100).toFixed(1)} pts. No ladder threshold can reach those; they are below our own`);
      console.log("     ordering. This is a MODEL question, not a selection one.");
    } else if (botE.d > 0.05) {
      console.log("\n  -> INCONCLUSIVE, and say so rather than picking the flattering reading. He is");
      console.log(`     ${(botE.d * 100).toFixed(1)} pts ahead of band peers in our bottom half, which points at signal we`);
      console.log(`     lack, but on ${botE.n} legs that is only ${botE.z.toFixed(1)}se and would not survive a rerun.`);
      console.log("     Collect more of his bottom-half legs before rebuilding anything around it.");
    } else {
      console.log("\n  -> His edge is CONCENTRATED WHERE WE ALREADY RANK HIGH. In our bottom half he");
      console.log(`     is ${(botE.d * 100).toFixed(1)} pts against band peers, i.e. no better than the games around him.`);
      console.log("     So he is not seeing anything we cannot; he is selecting from the same top");
      console.log("     of the board we compute and then actually playing it. FILTER problem —");
      console.log("     the lever is the ladder and the daily count, not the weights.");
    }
  }

  // ---- 3. Would our own top pick have done as well? ----
  // The honest head-to-head: on the days he played, take OUR highest-p game and
  // see how it lands. If our top pick matches his hit rate, the model is fine
  // and the gap is that we never told you to bet it.
  console.log("\n=========== HEAD-TO-HEAD on the days he played ===========");
  for (const k of [1, 2, 3]) {
    let w = 0, l = 0;
    for (const date of dates) {
      const slate = (slates.get(date) || []).slice().sort((a, b) => b.p - a.p).slice(0, k);
      for (const g of slate) { if (g.actual) w++; else l++; }
    }
    const n = w + l;
    console.log(`  our top-${k} NRFI per day     ${w}-${l}  (${n ? pc(w / n) : "—"} on ${n})`);
  }
  const hisW = nrfiPicks.filter((j) => j.actual).length;
  console.log(`  his NRFI legs, same days   ${hisW}-${nrfiPicks.length - hisW}  (${pc(hisW / nrfiPicks.length)} on ${nrfiPicks.length})`);
  console.log(`  every game, same days      ${pc(mean(allGames.map((g) => g.actual)))} on ${allGames.length}`);

  // ---- 3b. Is our top-N number real, or is it hindsight? ----
  // Our scores use CURRENT-SEASON splits, so scoring an April game uses stats
  // that did not exist in April. His picks had no such luxury — they were made
  // live. That makes any head-to-head above unfair in our favour, and the size
  // of the unfairness is not knowable directly.
  //
  // But it IS testable by month. Full-season stats applied to an April game are
  // almost entirely hindsight; applied to an August game they are mostly
  // information that genuinely existed by then. So if our top-1 edge is large
  // in April and collapses by August, the edge is leakage. If it holds roughly
  // flat, leakage is not what is producing it.
  console.log("\n=========== TOP-1 BY MONTH (NOT a leakage check) ===========");
  console.log("This used to claim that a flat month-over-month edge rules out look-ahead.");
  console.log("It does not, and the claim is withdrawn. The test is confounded in both");
  console.log("directions at once: contamination FALLS through a season (a scored game is");
  console.log("1/n of its own season-to-date line — ~1/3 in April, ~1/25 by September) while");
  console.log("genuine skill RISES as starts accumulate and the priors regress less. The");
  console.log("monthly edge is their sum, so reading it as evidence about either component");
  console.log("is invalid. It is printed because it is a real seasonality profile, and so");
  console.log("the next person to think of this finds the result instead of rerunning it.");
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))].sort();
  const monthRows = [];
  for (const m of months) {
    const ds = dates.filter((d) => d.startsWith(m));
    let w = 0, l = 0, base = [], hw = 0, hn = 0;
    for (const date of ds) {
      const slate = (slates.get(date) || []).slice().sort((a, b) => b.p - a.p);
      if (slate.length) { if (slate[0].actual) w++; else l++; }
      base.push(...slate.map((g) => g.actual));
      for (const j of joined.filter((x) => x.date === date && x.side === "NRFI")) { hn++; if (j.actual) hw++; }
    }
    const n = w + l;
    if (!n) continue;
    const row = { m, n, top1: w / n, base: mean(base), his: hn ? hw / hn : null, hn };
    monthRows.push(row);
    console.log(`  ${m}   top-1 ${String(w).padStart(2)}-${String(l).padStart(2)} = ${pc(row.top1).padStart(6)}` +
      `   slate ${pc(row.base).padStart(6)}   edge ${((row.top1 - row.base) * 100).toFixed(1).padStart(5)} pts` +
      `   | his ${row.his == null ? "  —  " : pc(row.his).padStart(6)} on ${String(row.hn).padStart(3)}`);
  }
  if (monthRows.length >= 4) {
    const half = Math.floor(monthRows.length / 2);
    const early = monthRows.slice(0, half), late = monthRows.slice(-half);
    const eE = mean(early.map((r) => r.top1 - r.base)), lE = mean(late.map((r) => r.top1 - r.base));
    console.log(`\n  early-season edge ${(eE * 100).toFixed(1)} pts   late-season edge ${(lE * 100).toFixed(1)} pts`);
    console.log(`  splits source: ${PIT_MODE}` + (PIT_MODE === "point-in-time"
      ? " — pitcher 1st-inning lines are rewound to the scored date."
      : " — !! NRFI_LEAKY=1, these scores contain the games being scored."));
    console.log("  Other inputs are NOT rewound (pitMeta season ERA/IP, team offence,");
    console.log("  top-of-order OBP, Statcast), so residual look-ahead remains. The test that");
    console.log("  DOES settle leakage is the toggle A/B in nrfi-pitreg-fit.js: a clean fit has");
    console.log("  an interior optimum, a leaky one is minimised at zero regression with error");
    console.log("  rising monotonically in the weight — a curve that rewards trusting an input");
    console.log("  more the further you go is measuring how much of the answer it was handed.");
    console.log("  And this is still NOT a walk-forward test, while his record IS. Live CLV on");
    console.log("  our own picks is the only clean comparison; this only sizes the gap.");
  }

  // ---- 4. Verdict ----
  console.log("\n=========== READING ===========");
  const mp = mean(pctls), edge = mean(nrfiPicks.map((j) => j.actual)) - mean(allGames.map((g) => g.actual));
  console.log(`  his games beat the slate base rate by ${(edge * 100).toFixed(1)} pts`);
  console.log(`  our ranking puts them at the ${(mp * 100).toFixed(0)}th percentile on average`);
  // Two independent facts, reported independently. An if/else chain here hid
  // one behind the other — a small edge printed "it's all price" and never
  // mentioned that we were ranking his games in the top quartile, which is the
  // finding that decides what to change.
  if (edge <= 0.02) {
    console.log("\n  -> SELECTION EDGE IS SMALL on these joined legs: his games barely beat");
    console.log("     the slate base rate, so most of his return is price rather than which");
    console.log("     games he picks. Line shopping is the lever, not the model.");
  }
  /* The filter-vs-direction call is made in section 2b, NOT here.
   *
   * This block used to decide it from mean percentile alone: >=0.62 printed
   * "FILTER problem ... changing weights would be chasing a number that is
   * already right." Mean percentile cannot support that. It is high both when a
   * tout has no independent signal and merely samples the top of our board, and
   * when he has plenty and happens to agree with us often — and those two want
   * opposite fixes, which is the whole distinction this file exists to draw.
   *
   * Measured on 326 legs at mean percentile 64.5%, which this rule called a
   * settled FILTER problem: his edge over band peers is +16.9 pts in our top
   * half AND +12.9 pts (2.2se) in our BOTTOM half. An edge inside the half our
   * own ordering calls unremarkable cannot be reached by any threshold, so the
   * old verdict was not merely imprecise, it pointed at the wrong lever. Two
   * sections of one script printing opposite conclusions is how a stale reading
   * survives, so this one now defers instead of competing. */
  if (botE && topE) {
    console.log(`  within our own ranking he beats band peers by ${(topE.d * 100).toFixed(1)} pts in our top half`);
    console.log(`  and ${(botE.d * 100).toFixed(1)} pts (${botE.z.toFixed(1)}se) in our bottom half`);
    console.log("\n  -> see HIS EDGE WITHIN EACH BAND above for the filter-vs-direction call.");
    console.log("     Mean percentile alone cannot make it and no longer tries.");
  } else {
    console.log("\n  -> not enough joined legs to place his picks inside our own ranking;");
    console.log("     the filter-vs-direction question is unanswered on this sample.");
  }
}
