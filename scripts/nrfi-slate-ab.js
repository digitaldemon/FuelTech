// Old bundle vs shipped bundle, same live slate, FULL ladder.
//
// "The bets and leans disappeared" is a claim about the verdict LADDER, and the
// ladder is mostly not the model. Raw pNRFI goes through the calibration, then
// gets blended toward the de-vig Kalshi price, and then has to clear a value
// gate against that same price -- edge >= 1.5pp, with extra gates on short
// juice and thin data. So a lambda-factor edit and a two-cent market tick both
// surface as "the pick is gone", and comparing raw pNRFI cannot tell them
// apart. This runs both bundles end to end against ONE shared market snapshot,
// which is what makes the remaining difference attributable to the code.
//
// Usage: node scripts/nrfi-slate-ab.js [path-to-old-bundle]
//   git show <sha>:public/desk/app.js > .ab-before.js
const path = require("path");
const { loadDeskModel } = require("./nrfi-model-load");

const BUNDLES = [["before", process.argv[2] || path.join(__dirname, "..", ".ab-before.js")],
                 ["shipped", path.join(__dirname, "..", "public", "desk", "app.js")]];

function attach(c) {
  const realFetch = global.fetch;
  c.fetch = (u, o) => (String(u).startsWith("/") ? Promise.reject(new Error("local api")) : realFetch(u, o));
  return c;
}

// Mirrors the enriched() block on the board: calibrate -> blend to market ->
// call/pMax -> value gate -> verdict. The sandbox has no stored record, so the
// live half of the calibration blend is absent and the seed is used alone --
// which is what a fresh browser does before its first graded pick anyway.
function ladder(c, r, mk) {
  const seed = c.read("NRFI_CALIB_SEED");
  const pcal = c.applyCalibration(r.pNRFI, { c: seed.c, active: true });
  const pFinal = c.nrfiBlend(pcal, mk ? mk.marketNRFI : null);
  const call = pFinal >= 0.5 ? "NRFI" : "YRFI";
  const pMax = Math.max(pFinal, 1 - pFinal) * 100;
  const mktSide = mk ? (call === "NRFI" ? mk.marketNRFI : 100 - mk.marketNRFI) : null;
  const market = mk ? {
    marketSide: mktSide,
    edge: (call === "NRFI" ? pFinal : 1 - pFinal) * 100 - mktSide,
    edgeRaw: (call === "NRFI" ? pcal : 1 - pcal) * 100 - mktSide,
    started: false,
  } : null;
  return { pcal, pFinal, call, pMax, market, v: c.nrfiVerdict({ ...r, pMax, call, market }) };
}

(async () => {
  const runs = {};
  let rfi = null;
  for (const [tag, file] of BUNDLES) {
    const c = attach(loadDeskModel(file));
    const rows = await c.scanNrfi();
    // One market snapshot, shared, so a price tick between the two scans cannot
    // masquerade as a model change.
    if (!rfi) rfi = await c.fetchKalshiRFI();
    runs[tag] = { c, rows: new Map(rows.map((r) => [(r.awayAbbr || r.away) + "@" + (r.homeAbbr || r.home), r])) };
  }
  const a = runs.before, b = runs.shipped;
  const keys = [...b.rows.keys()];
  console.log("\nmarket: " + (rfi || []).length + " open Kalshi RFI contracts");
  console.log("(a market leaves status=open at first pitch, so started games show no edge)");

  console.log("\nFULL LADDER, SAME SLATE + SAME MARKET  (" + keys.length + " games)");
  console.log("matchup       mkt   before                    shipped");
  console.log("-".repeat(80));
  const tally = { before: {}, shipped: {} };
  let moved = 0, sa = 0, sb = 0, n = 0;
  for (const k of keys) {
    const ra = a.rows.get(k), rb = b.rows.get(k);
    if (!ra || !rb) { console.log(k.padEnd(13) + "(missing from one run)"); continue; }
    const mk = b.c.matchRFI(rb, rfi);
    const la = ladder(a.c, ra, mk), lb = ladder(b.c, rb, mk);
    tally.before[la.v.strength] = (tally.before[la.v.strength] || 0) + 1;
    tally.shipped[lb.v.strength] = (tally.shipped[lb.v.strength] || 0) + 1;
    sa += ra.pNRFI; sb += rb.pNRFI; n++;
    const chg = la.v.strength !== lb.v.strength || la.call !== lb.call;
    if (chg) moved++;
    const fmt = (l) => (l.v.strength + " " + l.call + " " + l.pMax.toFixed(1) + "%" +
      (l.market ? " e" + (l.market.edgeRaw >= 0 ? "+" : "") + l.market.edgeRaw.toFixed(1) : " e--")).padEnd(26);
    console.log(k.padEnd(13) + (mk ? Math.round(mk.marketNRFI) + "%" : "--").padStart(4) + "  " +
      fmt(la) + fmt(lb) + (chg ? "<- CHANGED" : ""));
  }
  console.log("\n  mean raw pNRFI  before " + (sa / n * 100).toFixed(2) + "%   shipped " +
    (sb / n * 100).toFixed(2) + "%   shift " +
    ((sb - sa) / n >= 0 ? "+" : "") + ((sb - sa) / n * 100).toFixed(2) + "pp");
  console.log("  before:  " + JSON.stringify(tally.before));
  console.log("  shipped: " + JSON.stringify(tally.shipped));
  console.log("  VERDICTS CHANGED BY THE CODE: " + moved + " of " + n);

  /* ---- what is actually keeping picks off the board ---- */
  console.log("\nWHY THE SHIPPED BOARD IS NOT BETTING  (reasons taken from the verdict itself)");
  const why = {};
  for (const k of keys) {
    const rb = b.rows.get(k);
    if (!rb) continue;
    const l = ladder(b.c, rb, b.c.matchRFI(rb, rfi));
    if (l.v.strength !== "PASS") continue;
    const m = l.v.blurb.match(/market efficient|juice too short|thin data|under way|signals split|no check confirms/);
    why[m ? m[0] : "below the 52% lean line"] = (why[m ? m[0] : "below the 52% lean line"] || 0) + 1;
  }
  for (const [k, v] of Object.entries(why).sort((x, y) => y[1] - x[1]))
    console.log("  " + String(v).padStart(2) + "  " + k);
  console.log("\n  A PASS on 'market efficient' is the desk agreeing with the price.");
  console.log("  That is the gate doing its job, not the model losing signal.");
})().catch((e) => { console.error(e); process.exit(1); });
