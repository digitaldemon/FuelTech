// Is there still only ONE scoring path?
//
// This file used to guard a fix inside the base-out sim. nrfiEvaluate had two
// paths: the lambda path multiplied the offense rate by offMult(lineup, platoon,
// travel, offTrend, homeAdv, offVenue, kRate), and the sim path replaced that
// with pRun = (1 - simNoRun) * pitcherCtx * travel * homeAdv * env, where
// pitcherCtx carried only the pitcher-side adjustments. So the moment a lineup
// posted and `method` flipped to "sim", three offense adjustments stopped
// affecting the number — offTrend (weight 0.5 in offMult), offVenue (0.3) and
// kRate (0.35) — while the checks list, which is built from the factors
// regardless of path, kept printing "off cold (-33pp)" on the card. A vote
// displayed on a probability that does not contain it.
//
// That was fixed by threading offSimCtx into both sim halves, and this script
// guarded the fix. The sim has since been removed outright: measured over 1555
// paired games it was worth -0.00018 Brier (t -1.12) and -0.0003 AUC (t -0.16),
// and it picked the opposite side on 45 games while being right on 22 of them.
//
// So the guard has been inverted. The failure mode it protects against is no
// longer "the sim drops three factors" but "a second path comes back", because
// a second path is exactly how a factor gets to be visible on the card and
// absent from the number. If you are deliberately reintroducing one, this file
// is the thing to update — not to delete.
const { loadDeskModel } = require("./nrfi-model-load");
const fs = require("fs");
const path = require("path");

const OFFENSE_ROWS = new Set(["Offense trend (1st inn L10)", "Offense venue split", "Team K% (1st inn)"]);
const BUNDLE = path.join(__dirname, "..", "public", "desk", "app.js");

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "  PASS  " : "  FAIL  ") + msg); if (!cond) fail++; };

(async () => {
  // Code only. This file's own history quotes the old expressions, and comments
  // survive the build, so a raw substring search would match the tombstones.
  const src = fs.readFileSync(BUNDLE, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  console.log("\nONE SCORING PATH — structure");
  for (const gone of ["simHalfNoRun", "advanceBaseOut", "matchupPA", "paRates",
    "offSimCtx", "awayOffSim", "homeOffSim", "pNRFI_simProj", "NRFI_SIM_W"]) {
    ok(!new RegExp("\\b" + gone + "\\b").test(src), gone + " is not in the bundle");
  }

  // Behavioural read. `method` is what the two paths used to disagree about, so
  // it is the field that would show a new one first — a card reading anything
  // but "model" means something is scoring games another way.
  const c = loadDeskModel(BUNDLE);
  const rows = await c.scanNrfi();
  const methods = {};
  for (const r of rows) methods[r.method] = (methods[r.method] || 0) + 1;
  console.log("\n  today's board (" + rows.length + " games)");
  for (const [m, k] of Object.entries(methods)) console.log("    method = " + m + ": " + k);
  ok(rows.length === 0 || Object.keys(methods).every((m) => m === "model"),
    "every game scored through the single model path");

  // The rows the old bug muted. They are listed rather than asserted on: a
  // neutral vote is legitimate on a game with nothing to say, so a count of zero
  // is only suspicious across a whole board.
  const voted = rows.filter((r) => (r.checks || []).some((k) => OFFENSE_ROWS.has(k.label) && k.lean !== "neutral"));
  console.log("\n  games with a live offense-side vote: " + voted.length + "/" + rows.length);
  ok(rows.length === 0 || voted.length > 0,
    "the offense rows are voting somewhere on the board, not pinned neutral");

  console.log(fail ? "\n" + fail + " FAILED" : "\nall checks pass");
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
