/* Why did the model land where it did on ONE game?
 *
 * Attribution by ablation on the real context, not by reading the source. The
 * factor stack inside nrfiEvaluate is multiplicative, capped, blended across two
 * paths and then calibrated, so no single line of it "is" the answer — the only
 * honest way to say which input carried a call is to neutralise that input and
 * see how far the probability moves. Everything here goes through the same
 * public entry the board uses; nothing reaches inside the model.
 *
 * Read the output as: "with this input replaced by its league-average /
 * neutral value, the number would have been X instead." A term that moves the
 * call across 50% is the term the call rests on. Terms that move it by tenths
 * are decoration, however much source code stands behind them.
 *
 *   node scripts/nrfi-why.js AZ@ATL [YYYY-MM-DD]
 */
const path = require("path");
const { J, savant, buildCtx, scoreBothPaths, makeVerdict, modelSig, PIT_MODE } =
  require(path.join(__dirname, "nrfi-model-lib.js"));
const { nrfiVerdict, applyCalibration } = makeVerdict();

const WANT = (process.argv[2] || "").split(",").filter(Boolean);
const DATE = process.argv[3] || new Date().toISOString().slice(0, 10);
if (!WANT.length) { console.error("usage: node scripts/nrfi-why.js AWY@HOM [YYYY-MM-DD]"); process.exit(1); }

// A deep-enough clone that an ablation cannot leak into the next one. Dates and
// nulls survive; nothing in a ctx is a class instance or a cycle.
const clone = (o) => JSON.parse(JSON.stringify(o));

/* Each ablation names an input and says what "neutral" means for it.
 *
 * Neutral is NOT zero. It is the value the model would use if it had never been
 * told anything about this game — league average for a rate, 1.0 for a
 * multiplier — because the question is what the information added, not what
 * deleting the term would do to the arithmetic. nrfiRegress returns
 * NRFI_LG_LAMBDA on a null rate, which is exactly that, so nulling a rate is
 * the right neutral for the rate terms. */
const ABLATIONS = [
  ["both starters' 1st-inn record", (c) => { for (const s of ["away", "home"]) if (c[s + "Pit"]) { c[s + "Pit"].rate = null; c[s + "Pit"].sample = 0; } }],
  ["  away starter only", (c) => { if (c.awayPit) { c.awayPit.rate = null; c.awayPit.sample = 0; } }],
  ["  home starter only", (c) => { if (c.homePit) { c.homePit.rate = null; c.homePit.sample = 0; } }],
  ["both offences' 1st-inn record", (c) => { for (const s of ["away", "home"]) if (c[s + "Off"]) { c[s + "Off"].rate = null; c[s + "Off"].sample = 0; } }],
  ["posted lineups (OBP vs hand)", (c) => { for (const s of ["away", "home"]) if (c[s + "Lineup"]) { c[s + "Lineup"].factor = 1; c[s + "Lineup"].obp = null; } }],
  ["pitcher peripherals (savant)", (c) => { c.awayPeri = null; c.homePeri = null; }],
  ["pitcher rolling form", (c) => { c.awayRolling = null; c.homeRolling = null; }],
  ["team offence rolling form", (c) => { c.awayOffRolling = null; c.homeOffRolling = null; }],
  ["park + weather (env)", (c) => { if (c.wx) c.wx.factor = 1; }],
  ["travel / rest", (c) => { for (const s of ["away", "home"]) if (c[s + "Travel"]) c[s + "Travel"].factor = 1; }],
  ["opener / season load meta", (c) => { for (const s of ["away", "home"]) if (c[s + "Meta"]) { c[s + "Meta"].gs = null; c[s + "Meta"].ip = null; c[s + "Meta"].seasonEra = null; } }],
];

(async () => {
  const se = Number(DATE.slice(0, 4));
  const { by: periBy, lg } = await savant(se);
  const sch = await J("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + DATE +
    "&hydrate=probablePitcher,linescore,team,lineups,weather,venue,officials");
  const games = sch.dates?.[0]?.games || [];
  const seen = [];
  for (const g of games) {
    const key = g.teams.away.team.abbreviation + "@" + g.teams.home.team.abbreviation;
    seen.push(key);
    if (!WANT.includes(key)) continue;

    const ctx = await buildCtx(g, DATE, se, periBy);
    const base = scoreBothPaths(ctx, lg).ev;
    const baseCal = applyCalibration(base.pNRFI);
    const call = (p) => (p >= 0.5 ? "NRFI" : "YRFI");

    console.log("=".repeat(74));
    console.log(key + "   " + DATE + "   model " + modelSig + "   PIT_MODE=" + PIT_MODE);
    console.log("  " + (ctx.awayPP || "?") + " (" + (ctx.awayName || "away") + ")  vs  " +
      (ctx.homePP || "?") + " (" + (ctx.homeName || "home") + ")");
    console.log("  AS CALLED: " + (baseCal * 100).toFixed(1) + "%  " + call(baseCal) +
      "   (raw " + (base.pNRFI * 100).toFixed(1) + "%, method " + base.method + ")");

    console.log("\n  input neutralised                    would be    swing   flips call?");
    const rows = [];
    for (const [name, mut] of ABLATIONS) {
      const c = clone(ctx);
      mut(c);
      let p;
      try { p = applyCalibration(scoreBothPaths(c, lg).ev.pNRFI); }
      catch (e) { console.log("    " + name.padEnd(34) + "  ERROR " + e.message); continue; }
      rows.push([name, p, p - baseCal]);
    }
    // Biggest mover first: the reader wants the driver, not the declaration order.
    rows.sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
    for (const [name, p, d] of rows) {
      const flips = call(p) !== call(baseCal);
      console.log("    " + name.padEnd(34) + (p * 100).toFixed(1).padStart(6) + "%  " +
        (d >= 0 ? "+" : "") + (d * 100).toFixed(2).padStart(6) + "pp  " +
        (flips ? "YES -> " + call(p) : ""));
    }

    // Everything at once. If this does not land near 50% the model has a
    // baseline that is not league-average, which would itself be the finding.
    const all = clone(ctx);
    for (const [, mut] of ABLATIONS) mut(all);
    let allP = null;
    try { allP = applyCalibration(scoreBothPaths(all, lg).ev.pNRFI); } catch { /* some paths need lineups */ }
    if (allP != null) console.log("    " + "ALL OF THE ABOVE".padEnd(34) +
      (allP * 100).toFixed(1).padStart(6) + "%  " + "(sanity: should sit near the league base rate)");

    const v = nrfiVerdict({
      pMax: Math.max(baseCal, 1 - baseCal) * 100, call: call(baseCal), market: null,
      awayPP: ctx.awayPP, homePP: ctx.homePP, aligned: base.aligned, confidence: base.confidence,
      pitProfiles: { away: base.awayProfile || ctx.awayPit, home: base.homeProfile || ctx.homePit },
    });
    console.log("\n  verdict " + v.strength + "   notes: " + JSON.stringify(v.notes));
  }
  const missing = WANT.filter((w) => !seen.includes(w));
  if (missing.length) console.error("\nnot on the " + DATE + " slate: " + missing.join(", ") +
    "\non the slate: " + seen.join(" "));
})().catch((e) => { console.error(e); process.exit(1); });
