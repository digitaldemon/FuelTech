// Is PITCHER_BT still true? The table is hand-maintained (see the "v5: revised"
// comments) and holds each starter's clean-1st-inning rate as a literal. Those
// literals age every start, and nothing in the build checks them, so a pitcher
// who has since fallen apart keeps voting "elite" until someone notices by hand.
//
//   node scripts/nrfi-pitcherbt-audit.js
//
// Read-only: it changes nothing, it just tells you what to fix.
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
// The table's own section headers: ELITE >=70, SHARP 65-69, LEAKY 30-35,
// DANGER <30. Note the deliberate gap at 36-64 — the table only carries arms at
// the extremes, because a middling starter has nothing to say. So a pitcher who
// drifts into that band has not changed tier, he has stopped qualifying, and the
// fix is to delete the row rather than edit the number.
const tierFor = (clean) => clean >= 70 ? "elite" : clean >= 65 ? "sharp"
  : clean >= 36 ? "(middling — drop)" : clean >= 30 ? "leaky" : "danger";

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
  return { id: p.id, n, clean: (clean * 100) / n, unknown, i01runs, dirty: scored };
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
  console.log("=== RATE DRIFT (table clean% vs actual, worst first) ===");
  console.log("  pitcher                  table      actual     delta   tier");
  let wrongTier = 0, big = 0;
  for (const r of found.sort((a, b) => Math.abs(b.live.clean - b.t.clean) - Math.abs(a.live.clean - a.t.clean))) {
    const d = r.live.clean - r.t.clean;
    if (Math.abs(d) < 5) continue;
    big++;
    const nt = tierFor(r.live.clean);
    const moved = nt !== r.t.tier;
    if (moved) wrongTier++;
    console.log(`  ${r.key.padEnd(24)} ${String(r.t.clean).padStart(3)}%(${String(r.t.n).padStart(2)})  ` +
      `${r.live.clean.toFixed(0).padStart(3)}%(${String(r.live.n).padStart(2)})  ${(d >= 0 ? "+" : "") + d.toFixed(0).padStart(3)}pp   ` +
      `${moved ? r.t.tier + " -> " + nt + "  <-- TIER CHANGES" : r.t.tier}`);
  }
  if (!big) console.log("  none off by more than 5 points");

  console.log("\n=== SAMPLE DRIFT (starts the table never saw) ===");
  let stale = 0;
  for (const r of found.sort((a, b) => (b.live.n - b.t.n) - (a.live.n - a.t.n))) {
    const d = r.live.n - r.t.n;
    if (d >= 3) { stale++; console.log(`  ${r.key.padEnd(24)} table n=${String(r.t.n).padStart(2)}  actual ${String(r.live.n).padStart(2)}  (+${d})`); }
  }
  if (!stale) console.log("  none more than 2 starts behind");

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
  console.log(`  ${big} rows off by >5pp, of which ${wrongTier} change tier.`);
  console.log("\nPITCHER_BT only feeds the `checks` array (app.jsx:7089), never pNRFI, so");
  console.log("staleness cannot bias the probability — it biases the displayed reasoning");
  console.log("and the family-consensus vote that gates the verdict.");
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
