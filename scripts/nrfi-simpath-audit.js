// Does the probability change character when lineups post?
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
const path = require("path");

const OFFENSE_ROWS = new Set(["Offense trend (1st inn L10)", "Offense venue split", "Team K% (1st inn)"]);

(async () => {
  const c = loadDeskModel(path.join(__dirname, "..", "public", "desk", "app.js"));
  const rows = await c.scanNrfi();

  let sim = 0, lam = 0, muted = 0;
  const detail = [];
  for (const r of rows) {
    const isSim = r.method === "sim";
    if (isSim) sim++; else lam++;
    const votes = (r.checks || []).filter((k) => OFFENSE_ROWS.has(k.label) && k.lean !== "neutral");
    if (isSim && votes.length) {
      muted++;
      detail.push("  " + ((r.awayAbbr || r.away) + "@" + (r.homeAbbr || r.home)).padEnd(10) +
        "p" + (r.pNRFI * 100).toFixed(1) + "%  " +
        votes.map((v) => v.label.replace(/ \(.*/, "") + "=" + v.lean.toUpperCase()).join(", "));
      for (const v of votes) detail.push("      " + v.detail.slice(0, 110));
    }
  }

  console.log("\nSIM-PATH OFFENSE ADJUSTMENTS  (" + rows.length + " games on today's board)");
  console.log("  method = sim     (lineups posted): " + sim);
  console.log("  method = model   (lambda path):    " + lam);
  console.log("\n  games on the sim path where an offense-side check still votes,");
  console.log("  but the adjustment behind it is NOT in the probability: " + muted);
  if (detail.length) { console.log(""); for (const d of detail) console.log(d); }
  console.log("\n  On the lambda path those same rows move offense lambda by");
  console.log("  0.5/0.3/0.35 of their deviation. On the sim path they move it by zero.");
})().catch((e) => { console.error(e); process.exit(1); });
