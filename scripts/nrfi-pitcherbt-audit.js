// Is PITCHER_BT still true?
//
//   node scripts/nrfi-pitcherbt-audit.js
//
// Read-only: it changes nothing, it just tells you what to fix. To fix it:
//   node scripts/nrfi-pitcherbt-rebuild.js && node scripts/nrfi-pitcherbt-emit.js
//
// The table is generated now, so this is no longer hunting hand-editing errors
// — it is asking whether the generated table has aged, and independently
// checking the generator. That independence is the point and is worth the
// duplicated work: the rebuild derives every arm from one feed/live call per
// game, while this walks each pitcher's game log and pulls the linescore per
// start. Two different endpoints, two different join keys. When the rebuild had
// a half-inning attribution bug, this is the shape of check that would catch it.
//
// It reads ONE season against a table built from two, so a modest gap is normal
// and expected; a large or one-sided one is not.
//
// The first version of this script only compared the table's `n` against the
// starts on file — i.e. it could tell you a row was stale but never whether it
// was WRONG. That is the whole question, so it now derives each pitcher's real
// clean rate. There is no MLB endpoint for "share of first innings with no run
// allowed": the i01 split gives aggregate runs and games, which yields runs per
// game, not the clean SHARE. So it is rebuilt from the game log — every start,
// its linescore, did the opposing side score in the 1st.
//
// Semantics, deliberately: "clean" is scored as the opposing team scoring zero
// in the first inning, not as zero earned runs charged to this pitcher. Those
// differ when a starter is pulled mid-inning. The team-level version is the
// right one here because the market being modelled is runs in the first inning,
// not the pitcher's line.
const fs = require("fs");
const path = require("path");
const { J, mapLimit } = require("./nrfi-model-lib");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");

const i = src.indexOf("const PITCHER_BT = (() => {");
const j = src.indexOf("\n})();", i);
if (i < 0 || j < 0) throw new Error("PITCHER_BT not found — did it move?");
// Stop at the closing "})()" and NOT the semicolon after it — including the ";"
// builds "...})();)" and throws. This is why the audit had never actually run.
const table = eval(src.slice(i, j + "\n})()".length).replace("const PITCHER_BT =", "(") + ")");
if (!table || typeof table !== "object" || Object.keys(table).length < 20) {
  throw new Error("PITCHER_BT parsed to " + Object.keys(table || {}).length + " entries — the table shape changed");
}

const se = new Date().getUTCFullYear();

// The table stores a REGRESSED posterior now, not a raw rate, and its bands are
// quantiles of that posterior rather than absolute percentages. Both facts have
// to be read out of app.jsx rather than hardcoded here — an earlier version of
// this file carried the old absolute bands as literals, and once the table was
// regenerated it would have compared a posterior against a raw rate under the
// wrong cutoffs and reported the whole table as broken. Read the constants the
// app actually uses, and fail loudly if they are not there to read.
const num = (name) => {
  const m = src.match(new RegExp("const " + name + " = (-?[\\d.]+)")) ||
    src.match(new RegExp("\\b" + name + " = (-?[\\d.]+)"));
  if (!m) throw new Error(`could not read ${name} from app.jsx — regenerate with nrfi-pitcherbt-emit.js`);
  return Number(m[1]);
};
const PBT_LG = num("PBT_LG"), PBT_K = num("PBT_K");
const B = { elite: num("PBT_ELITE"), sharp: num("PBT_SHARP"), leaky: num("PBT_LEAKY"), danger: num("PBT_DANGER") };
// Same shrinkage the app applies, so a freshly measured arm and a stored row are
// on one scale and the difference between them means something.
const posterior = (pct, n) => (pct * n + PBT_LG * PBT_K) / (n + PBT_K);
// The table carries only the tails; the middle half is deliberately omitted,
// because a middling starter has nothing to say about a first inning. So an arm
// who drifts into the middle has not changed tier, he has stopped qualifying,
// and the fix is to drop the row rather than edit the number.
const tierFor = (post) => post >= B.elite ? "elite" : post >= B.sharp ? "sharp"
  : post <= B.danger ? "danger" : post <= B.leaky ? "leaky" : "(middling — drop)";

// Both starters in a game are usually in the table, so cache on gamePk.
const lsCache = new Map();
const linescore = (pk) => lsCache.has(pk) ? lsCache.get(pk) : lsCache.set(pk,
  J(`https://statsapi.mlb.com/api/v1/game/${pk}/linescore`).catch(() => null)).get(pk);

// SELF-CHECK. This audit is only worth running if its own numbers are right, and
// the first version of it produced a confident, entirely wrong-looking answer
// (+19pp drift, every weak arm turning elite) that could just as easily have
// been an attribution bug as a stale table. So each pitcher is checked against
// an independent MLB aggregate before his row is believed.
//
// The constraint: MLB's i01 split reports total runs allowed in first innings.
// A first inning that is not clean contains at least one run, so the number of
// dirty innings can never exceed total runs. dirty > runs is therefore proof
// that the half-inning attribution is backwards, and the row is discarded.
// (The converse case — runs=0 forcing 100% clean — is what confirmed the
// mapping was right: an inverted read would have shown those arms near 70%.)
function consistency(dirty, i01runs) {
  if (i01runs == null) return null;
  return dirty <= i01runs ? null : `dirty=${dirty} > i01 runs=${i01runs}`;
}

async function realRate(name) {
  const d = await J(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&sportIds=1`);
  const p = (d.people || []).find((x) => x.primaryPosition?.code === "1") || (d.people || [])[0];
  if (!p) return { why: "no such player" };
  const [gl, i01] = await Promise.all([
    J(`https://statsapi.mlb.com/api/v1/people/${p.id}/stats?stats=gameLog&group=pitching&season=${se}&gameType=R`),
    J(`https://statsapi.mlb.com/api/v1/people/${p.id}/stats?stats=statSplits&group=pitching&sitCodes=i01&season=${se}`).catch(() => null),
  ]);
  const i01runs = (() => { const st = i01?.stats?.[0]?.splits?.[0]?.stat; return st ? +st.runs || 0 : null; })();
  // Relief appearances must not count: the table is about first innings, and a
  // reliever's first inning of work is not the game's first inning.
  const starts = (gl.stats?.[0]?.splits || []).filter((s) => +(s.stat?.gamesStarted || 0) >= 1);
  if (!starts.length) return { why: "no starts on file" };

  let clean = 0, scored = 0, unknown = 0;
  for (const s of starts) {
    const pk = s.game?.gamePk;
    const ls = pk == null ? null : await linescore(pk);
    const first = ls?.innings?.[0];
    if (!first) { unknown++; continue; }
    // He defends the half-inning the OTHER side bats in.
    const runs = s.isHome ? first.away?.runs : first.home?.runs;
    if (runs == null) { unknown++; continue; }
    if (+runs === 0) clean++; else scored++;
  }
  const n = clean + scored;
  if (!n) return { why: "no scoreable first innings" };
  const bad = consistency(scored, i01runs);
  if (bad) return { why: "FAILED self-check (" + bad + ")" };
  const raw = (clean * 100) / n;
  // `clean` is the number the table can be compared against, so it is the
  // posterior. `raw` is kept alongside it because the gap between them is the
  // regression doing its job, and printing only the shrunk value would hide it.
  return { id: p.id, n, raw, clean: posterior(raw, n), unknown, i01runs, dirty: scored };
}

(async () => {
  const names = Object.keys(table);
  console.log(`PITCHER_BT holds ${names.length} entries (some are accent/no-accent duplicates of one pitcher).`);
  console.log(`Rebuilding actual ${se} clean-1st rates from game logs + linescores...\n`);

  let done = 0;
  const rows = await mapLimit(names, 6, async (key) => {
    let live = null;
    try { live = await realRate(key); } catch (e) { live = { why: "lookup failed: " + e.message }; }
    if (++done % 25 === 0) process.stderr.write(`  ${done}/${names.length}\n`);
    return { key, t: table[key], live };
  });

  const found = rows.filter((r) => r.live && r.live.n);
  const missing = rows.filter((r) => !r.live || !r.live.n);

  // Rate drift is the finding. Sample drift only matters because it causes it.
  //
  // Both columns are posteriors, so the threshold for "worth printing" is much
  // tighter than it would be on raw rates: regression compresses the whole
  // league into roughly 12 points, and a 2pp move is a real tier change rather
  // than a rounding wobble. The table is also built from two seasons while this
  // check reads one, so a small gap is expected and only a persistent, one-sided
  // one is evidence of anything.
  const DRIFT_MIN = 2;
  console.log(`=== RATE DRIFT (table posterior vs ${se}-only posterior, worst first) ===`);
  console.log("  pitcher                  table       live      delta   tier");
  let wrongTier = 0, big = 0;
  for (const r of found.sort((a, b) => Math.abs(b.live.clean - b.t.clean) - Math.abs(a.live.clean - a.t.clean))) {
    const d = r.live.clean - r.t.clean;
    if (Math.abs(d) < DRIFT_MIN) continue;
    big++;
    const nt = tierFor(r.live.clean);
    const moved = nt !== r.t.tier;
    if (moved) wrongTier++;
    console.log(`  ${r.key.padEnd(24)} ${r.t.clean.toFixed(1).padStart(4)}%(${String(r.t.n).padStart(2)})  ` +
      `${r.live.clean.toFixed(1).padStart(4)}%(${String(r.live.n).padStart(2)})  ${(d >= 0 ? "+" : "") + d.toFixed(1).padStart(4)}pp   ` +
      `${moved ? r.t.tier + " -> " + nt + "  <-- TIER CHANGES" : r.t.tier}`);
  }
  if (!big) console.log(`  none off by more than ${DRIFT_MIN} points`);

  // The table spans two seasons and this check reads one, so its n is EXPECTED
  // to be the larger of the two. Only a live count exceeding the stored one
  // means the table missed starts it should already have had.
  console.log(`\n=== SAMPLE DRIFT (${se} starts the table never saw) ===`);
  let stale = 0;
  for (const r of found.sort((a, b) => (b.live.n - b.t.n) - (a.live.n - a.t.n))) {
    const d = r.live.n - r.t.n;
    if (d >= 3) { stale++; console.log(`  ${r.key.padEnd(24)} table n=${String(r.t.n).padStart(2)}  live ${String(r.live.n).padStart(2)}  (+${d})`); }
  }
  if (!stale) console.log("  none — every row already covers at least this season's starts");

  console.log(`\n=== NOT RESOLVED (${missing.length}) ===`);
  for (const r of missing) console.log(`  ${r.key.padEnd(24)} table says ${r.t.clean}% (${r.t.n}gs, ${r.t.tier}) — ${r.live?.why || "unknown"}`);

  const failed = rows.filter((r) => r.live && /FAILED self-check/.test(r.live.why || ""));
  console.log(`\n=== SELF-CHECK (dirty first innings vs MLB's own i01 runs) ===`);
  console.log(`  ${found.length} rows passed, ${failed.length} failed and were discarded.`);
  if (failed.length) for (const r of failed) console.log(`  ${r.key.padEnd(24)} ${r.live.why}`);
  else console.log("  No row claims more scoreless-inning failures than MLB says runs were allowed,");
  console.log("  which is what rules out a backwards half-inning attribution.");

  // A mean signed error near zero would be aging: arms drift both ways and it
  // washes out. A large one-sided error is not aging, it is method — so split it
  // by the tier the row was filed under, which is the thing that would differ if
  // the top and bottom of the table were built from different sources.
  console.log("\n=== DRIFT BY TIER (is the whole table wrong, or half of it?) ===");
  for (const tier of ["elite", "sharp", "leaky", "danger"]) {
    const g = found.filter((r) => r.t.tier === tier);
    if (!g.length) continue;
    const signed = g.reduce((a, r) => a + (r.live.clean - r.t.clean), 0) / g.length;
    const abs = g.reduce((a, r) => a + Math.abs(r.live.clean - r.t.clean), 0) / g.length;
    const moved = g.filter((r) => tierFor(r.live.clean) !== r.t.tier).length;
    console.log(`  ${tier.padEnd(7)} ${String(g.length).padStart(2)} rows   signed ${(signed >= 0 ? "+" : "") + signed.toFixed(1).padStart(5)}pp   ` +
      `abs ${abs.toFixed(1).padStart(4)}pp   ${moved}/${g.length} change tier`);
  }

  const mae = found.reduce((a, r) => a + Math.abs(r.live.clean - r.t.clean), 0) / Math.max(1, found.length);
  const bias = found.reduce((a, r) => a + (r.live.clean - r.t.clean), 0) / Math.max(1, found.length);
  console.log(`\nsummary: ${found.length} resolved, ${missing.length} unresolved.`);
  console.log(`  mean absolute error ${mae.toFixed(1)}pp, mean signed ${(bias >= 0 ? "+" : "") + bias.toFixed(1)}pp ` +
    `(${bias < 0 ? "table flatters these arms" : "table understates these arms"}).`);
  console.log(`  ${big} rows off by >${DRIFT_MIN}pp, of which ${wrongTier} change tier.`);
  // Scale for reading the number above: on the regressed scale the entire league
  // spans roughly 12 points, so a mean absolute error over ~3pp is not drift, it
  // is a disagreement between the two methods and one of them is wrong.
  console.log(`  For scale, the tier bands are ${B.danger}/${B.leaky}/${B.sharp}/${B.elite} — the whole league fits in ~12 points,`);
  console.log("  so an MAE above ~3pp means the generator and this check disagree, not that the table aged.");
  console.log("\nPITCHER_BT only feeds the `checks` array (app.jsx:7089), never pNRFI, so");
  console.log("staleness cannot bias the probability — it biases the displayed reasoning");
  console.log("and the family-consensus vote that gates the verdict.");
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
