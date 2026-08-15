// Do the offense adjustments survive the switch to the base-out sim?
//
// FIXED — this script now guards the fix rather than reporting the bug. History
// below; the assertion at the bottom is what runs.
//
//
// nrfiEvaluate has two paths. The lambda path multiplies the offense rate by
// offMult(lineup, platoon, travel, offTrend, homeAdv, offVenue, kRate). The
// base-out sim path replaces it with:
//
//   pRun = (1 - simNoRun) * pitcherCtx * travel * homeAdv * env
//
// and pitcherCtx carries only the pitcher-side adjustments. So the moment a
// lineup is posted and `method` flips to "sim", three offense adjustments stop
// affecting the number: offTrend (weight 0.5 in offMult), offVenue (0.3) and
// kRate (0.35). The comment above that block justifies dropping platoon and
// lineup -- the sim reads real batters, so those are genuinely inside it -- but
// a team's LAST TEN GAMES of first-inning scoring is not in its season rates by
// construction, which is the entire reason the trend factor exists.
//
// The checks list is built from the factors regardless of path, so those rows
// keep casting votes and keep printing "off cold (-33pp)" on the card while the
// probability behind them no longer contains it.
//
// Note also: the PROJECTED sim (pNRFI_simProj, used before lineups post)
// multiplies awayOffVenue.f/homeOffVenue.f in, and the real sim does not. Two
// code paths for the same idea that disagree with each other.
const { loadDeskModel } = require("./nrfi-model-load");
const fs = require("fs");
const path = require("path");

const OFFENSE_ROWS = new Set(["Offense trend (1st inn L10)", "Offense venue split", "Team K% (1st inn)"]);
const BUNDLE = path.join(__dirname, "..", "public", "desk", "app.js");

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "  PASS  " : "  FAIL  ") + msg); if (!cond) fail++; };

(async () => {
  // Structural guard. The defect was an omission, and an omission is invisible
  // to any test that only reads the output number — a missing 0.5-weight term
  // just looks like a slightly different probability. So assert on the shape of
  // the expression: both sim halves, and both projected-sim halves, must carry
  // the offense context alongside the home-field factor they already had.
  // Comments survive the build and this file's own history quotes the old
  // expression, so match against code only.
  const src = fs.readFileSync(BUNDLE, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const sim = src.match(/pRunTop[\s\S]{0,400}?pRunBot[^;]*;/);
  const proj = src.match(/pRT\s*=[\s\S]{0,400}?pRB\s*=[^;]*;/);
  console.log("\nSIM-PATH OFFENSE ADJUSTMENTS — structure");
  ok(!!sim && /awayOffSim/.test(sim[0]) && /homeOffSim/.test(sim[0]),
    "the base-out sim carries offTrend/offVenue/kRate on both halves");
  ok(!!proj && /awayOffSim/.test(proj[0]) && /homeOffSim/.test(proj[0]),
    "the projected sim carries the same three, by the same helper");
  ok(/offSimCtx\s*=\s*\([^)]*\)\s*=>[\s\S]{0,200}?0\.5[\s\S]{0,80}?0\.3[\s\S]{0,80}?0\.35/.test(src),
    "weights match offMult (0.5 trend / 0.3 venue / 0.35 kRate)");
  ok(!/awayOffAdv\.f\s*\*\s*env/.test(src),
    "no sim half applies home-field without the offense context beside it");

  // Behavioural read: the same rows the bug used to mute, and what they now do.
  const c = loadDeskModel(BUNDLE);
  const rows = await c.scanNrfi();
  let simN = 0, lamN = 0;
  const detail = [];
  for (const r of rows) {
    if (r.method === "sim") simN++; else lamN++;
    const votes = (r.checks || []).filter((k) => OFFENSE_ROWS.has(k.label) && k.lean !== "neutral");
    if (r.method === "sim" && votes.length)
      detail.push("    " + ((r.awayAbbr || r.away) + "@" + (r.homeAbbr || r.home)).padEnd(10) +
        "p" + (r.pNRFI * 100).toFixed(1) + "%  " +
        votes.map((v) => v.label.replace(/ \(.*/, "") + "=" + v.lean.toUpperCase()).join(", "));
  }
  console.log("\n  today's board (" + rows.length + " games)");
  console.log("    method = sim   (lineups posted): " + simN);
  console.log("    method = model (lambda path):    " + lamN);
  console.log("\n  sim-path games with a live offense-side vote — these are the ones");
  console.log("  that used to show the vote while the probability ignored it:");
  for (const d of detail) console.log(d);

  console.log(fail ? "\n" + fail + " FAILED" : "\nall structural checks pass");
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
