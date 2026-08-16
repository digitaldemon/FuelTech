// Why does the L10 first-inning offense trend so rarely fire?
// Prints, per team on today's slate, the raw windows teamOffenseRolling built
// and the delta teamOffenseTrendFactor computes from them.
const { loadDeskModel } = require("./nrfi-model-load");
const { installLocalApi } = require("./nrfi-local-api");
const c = loadDeskModel();
const realFetch = global.fetch;
// Serves /api/desk/savant for real and refuses the rest loudly; see nrfi-local-api.js
const localApi = installLocalApi(c);

const seen = new Map();
const origEval = c.nrfiEvaluate;
c.nrfiEvaluate = function (ctx) {
  for (const s of ["away", "home"]) {
    const ro = ctx[s + "OffRolling"];
    const nm = ctx[s + "Name"] || s;
    if (!seen.has(nm)) seen.set(nm, ro);
  }
  return origEval.apply(this, arguments);
};

const pc = (v) => (v == null ? "  —" : (v * 100).toFixed(0).padStart(3));

(async () => {
  await c.scanNrfi();
  console.log("\nteam                 szn.n  szn   L20   L10    L5   d10     d5   -> factor  note");
  console.log("-".repeat(96));
  let nullRolling = 0, fired = 0, total = 0;
  const overlaps = [];
  for (const [nm, ro] of seen) {
    total++;
    if (!ro) { nullRolling++; console.log(String(nm).padEnd(20) + "  ROLLING NULL"); continue; }
    const f = c.teamOffenseTrendFactor(ro);
    if (f.f !== 1) fired++;
    const szn = ro.szn && ro.szn.rate, l10 = ro.l10 && ro.l10.rate, l5 = ro.l5 && ro.l5.rate;
    const d10 = l10 != null && szn != null ? l10 - szn : null;
    const d5 = l5 != null && szn != null ? l5 - szn : null;
    overlaps.push({ sznN: ro.szn.n, l10N: ro.l10.n });
    console.log(String(nm).padEnd(20) + String(ro.szn.n).padStart(5) + "  " +
      pc(szn) + "%  " + pc(ro.l20 && ro.l20.rate) + "%  " + pc(l10) + "%  " + pc(l5) + "%  " +
      (d10 == null ? "   —" : (d10 >= 0 ? "+" : "") + (d10 * 100).toFixed(0)).padStart(5) +
      (d5 == null ? "    —" : (d5 >= 0 ? "+" : "") + (d5 * 100).toFixed(0)).padStart(7) +
      "  -> " + f.f.toFixed(2) + "  " + (f.note || ""));
  }
  const avgSzn = overlaps.reduce((s, o) => s + o.sznN, 0) / (overlaps.length || 1);
  const avgL10 = overlaps.reduce((s, o) => s + o.l10N, 0) / (overlaps.length || 1);
  console.log("\n" + fired + "/" + total + " teams moved the factor off 1.00" +
    (nullRolling ? "  (" + nullRolling + " had no rolling data at all)" : ""));
  console.log("\nWINDOW OVERLAP");
  console.log("  mean 'szn' window: " + avgSzn.toFixed(1) + " games   mean L10 window: " + avgL10.toFixed(1) + " games");
  console.log("  L10 is " + (avgL10 / avgSzn * 100).toFixed(0) + "% of the baseline it is measured against.");
  console.log("  A shared sample shrinks the delta toward zero: the recent games are");
  console.log("  sitting on BOTH sides of the subtraction, so a genuinely hot streak");
  console.log("  reads as only part of a streak. Gate is +-12pp on that shrunken delta.");
  // What the delta would be against the games OUTSIDE the L10 window.
  console.log("\nSAME TEAMS, BASELINE = games 11..N ONLY (no overlap)");
  let wouldFire = 0;
  for (const [nm, ro] of seen) {
    if (!ro || !ro.szn || ro.szn.rate == null || !ro.l10 || ro.l10.rate == null) continue;
    const n = ro.szn.n, nl = ro.l10.n;
    if (n - nl < 3) { console.log("  " + String(nm).padEnd(20) + "prior window too short (" + (n - nl) + " games)"); continue; }
    // rate_prior = (rate_szn*n - rate_l10*nl) / (n - nl)
    const prior = (ro.szn.rate * n - ro.l10.rate * nl) / (n - nl);
    const d = ro.l10.rate - prior;
    if (Math.abs(d) >= 0.12) wouldFire++;
    console.log("  " + String(nm).padEnd(20) + "L10 " + pc(ro.l10.rate) + "%  vs prior " + pc(prior) +
      "%   delta " + ((d >= 0 ? "+" : "") + (d * 100).toFixed(0)).padStart(4) + "pp" +
      (Math.abs(d) >= 0.12 ? "   <- clears the 12pp gate" : ""));
  }
  console.log("\n  " + wouldFire + " teams would clear the gate against a non-overlapping baseline.");
})().catch((e) => { console.error(e.message); process.exit(1); });
