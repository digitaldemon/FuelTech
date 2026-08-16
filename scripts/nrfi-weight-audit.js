// Variance decomposition of the NRFI probability, measured on the live slate.
//
// A weight on paper says nothing about influence. offMult and pitMult are sums
// of (factor - 1) * weight, so a factor's ACTUAL contribution is its deviation
// from neutral times its weight — a 1.0-weighted input that never leaves 1.00
// moves nothing, and a 0.35-weighted one that swings +-0.15 moves more than it
// looks like it should. This prints, per factor: how often it is non-neutral,
// its mean absolute contribution in lambda-multiplier points, and its worst
// single swing on the slate.
// A ZERO IN THIS REPORT HAS TO MEAN "MEASURED AND NEUTRAL", NEVER "NOT MEASURED".
//
// It used to mean both, and the difference was invisible. The app fetches its
// Statcast peripherals from the relative path /api/desk/savant, and this script
// stubbed every relative URL to a rejection — so ctx.awayPeri/homePeri came back
// null, pitchSkillFactor took its `!peri` early return, and the table printed
//
//     skill    weight 1   fires 0%   share 0.0%
//
// next to eleven real measurements. Read straight, that says the dominant
// pitcher term after pitBase is dead weight. It was not dead; it was blindfolded
// by its own harness, and a report cannot be allowed to make a claim that strong
// about a factor it never let run. Savant is now served from the same fetcher
// nrfi-model-lib uses, which reaches baseballsavant directly and resolves ~750
// arms, so `skill` is genuinely exercised.
//
// What still cannot be reached gets SAID rather than scored. The umpire table
// lives behind desk auth in Postgres, so it is reported as not-measured instead
// of being folded into the share column as a zero.
const { loadDeskModel } = require("./nrfi-model-load");
const { savant } = require("./nrfi-model-lib");
const c = loadDeskModel();
const realFetch = global.fetch;
const SEASON = new Date().getFullYear();
const unreachable = [];
c.fetch = async (u, o) => {
  const url = String(u);
  if (!url.startsWith("/")) return realFetch(u, o);
  if (url.startsWith("/api/desk/savant")) {
    const s = await savant(SEASON);
    // Same shape app.jsx destructures off the route: { byId, lg }.
    return { json: async () => ({ byId: s.by, lg: s.lg }) };
  }
  unreachable.push(url);
  throw new Error("local api not available to this harness: " + url);
};

// Weights copied from offMult / pitMult. Kept beside the factor name so the
// report is in units the model actually applies, not raw factor values.
//
// Three entries used to sit here that the model no longer applies: platoon 0.2,
// form 0.10 and homePitAdv 1.0. All three were removed deliberately (see the
// notes where each factor was), but the weights survived them, so every run
// printed three "!! missing" lines above a share table whose denominator looked
// complete. That is the shape of warning nobody reads twice. A wrap target that
// does not exist is now a hard failure, and these tables list only live terms.
const OFF = { lineup: 1.0, travel: 0.6, offTrend: 0.5, homeOffAdv: 1.0, offVenue: 0.3, offKrate: 0.35 };
const PIT = { skill: 1.0, opener: 0.5, openerGame: 1.0, seasonLoad: 0.7, pitTrend: 0.30, pitVenue: 0.5 };

const log = {};
const rec = (name, w, f) => {
  if (f == null || !isFinite(f)) return;
  (log[name] = log[name] || { w, vals: [] }).vals.push(f);
};

// Factor helpers are function declarations, so they land on the sandbox context
// and can be wrapped in place.
const wrap = (fn, name, w, pick) => {
  const orig = c[fn];
  if (typeof orig !== "function") {
    // Throw, do not warn. If a factor is renamed in app.jsx this report silently
    // drops a term and still prints percentages that sum to 100.
    throw new Error(`wrap target ${fn} is not a function on the model context — ` +
      `it was renamed or removed in app.jsx, and this script's weight table is stale.`);
  }
  c[fn] = function (...a) { const r = orig.apply(this, a); rec(name, w, pick ? pick(r) : (r && r.f)); return r; };
};

wrap("teamOffenseTrendFactor",  "offTrend",    OFF.offTrend);
wrap("homeOffAdvantage",        "homeOffAdv",  OFF.homeOffAdv);
wrap("offenseVenueFactor",      "offVenue",    OFF.offVenue);
wrap("offKrateFactor",          "offKrate",    OFF.offKrate);
wrap("pitchSkillFactor",        "skill",       PIT.skill);
wrap("openerFactor",            "opener",      PIT.opener);
wrap("openerGameFactor",        "openerGame",  PIT.openerGame);
wrap("seasonLoadFactor",        "seasonLoad",  PIT.seasonLoad);
wrap("pitcherTrendFactor",      "pitTrend",    PIT.pitTrend);
wrap("pitcherVenueFactor",      "pitVenue",    PIT.pitVenue);

// lineup, travel, weather and umpire arrive on ctx rather than from a helper.
//
// `lineups` counts how many of them actually had a posted card. On a forward
// slate that is usually zero, and then lineup's 0% is a fact about the clock,
// not about the factor — it carries the largest coefficient in offMult and the
// report must not let those two readings look alike.
let lineups = 0, sides = 0;
const origEval = c.nrfiEvaluate;
c.nrfiEvaluate = function (ctx) {
  for (const s of ["away", "home"]) {
    const lu = ctx[s + "Lineup"];
    sides++; if (lu && lu.obp != null) lineups++;
    rec("lineup", OFF.lineup, lu && lu.factor);
    rec("travel", OFF.travel, ctx[s + "Travel"] && ctx[s + "Travel"].factor);
  }
  rec("weather(env)", 1.0, ctx.wx && ctx.wx.factor);
  rec("umpire(env)", 1.0, ctx.umpFactor);
  return origEval.apply(this, arguments);
};

(async () => {
  const rows = await c.scanNrfi();
  console.log("\nslate: " + (rows || []).length + " games\n");

  /* Terms whose INPUT never arrived, pulled out before anything is scored.
   *
   * These are not zeros, they are absences, and mixing them into the share
   * table understates every real factor by inflating the denominator with
   * terms that were never given a chance to move. Each is listed with the
   * reason it could not be measured here. */
  const blind = new Map();
  if (unreachable.some((u) => u.startsWith("/api/desk/umpires")))
    blind.set("umpire(env)", "table lives behind desk auth in Postgres — unreachable from a script");
  if (lineups === 0 && sides > 0)
    blind.set("lineup", `no lineup posted on any of ${sides} sides — forward slate, not an inert factor`);

  const out = [];
  for (const [name, d] of Object.entries(log)) {
    if (blind.has(name)) continue;
    const contrib = d.vals.map((f) => (f - 1) * d.w);
    const live = contrib.filter((x) => Math.abs(x) > 0.001);
    const mean = contrib.reduce((s, x) => s + Math.abs(x), 0) / (contrib.length || 1);
    const max = contrib.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0);
    out.push({ name, w: d.w, n: d.vals.length, pct: live.length / (d.vals.length || 1) * 100, mean, max });
  }
  out.sort((a, b) => b.mean - a.mean);
  console.log("factor          weight   n   fires%   mean|contrib|   worst swing");
  console.log("-".repeat(70));
  for (const o of out) {
    console.log(o.name.padEnd(15) + String(o.w).padStart(5) + String(o.n).padStart(5) +
      o.pct.toFixed(0).padStart(7) + "%" + o.mean.toFixed(4).padStart(14) +
      (o.max >= 0 ? "+" : "") + o.max.toFixed(4).padStart(14));
  }
  const total = out.reduce((s, o) => s + o.mean, 0);
  console.log("\nshare of total average movement:");
  for (const o of out) {
    const share = o.mean / total * 100;
    console.log("  " + o.name.padEnd(15) + share.toFixed(1).padStart(5) + "%  " +
      "#".repeat(Math.round(share)));
  }
  if (blind.size) {
    console.log("\nNOT MEASURED on this run — excluded from the shares above, because a" +
      "\nterm that was never given a chance to move is not a term that moves nothing:");
    for (const [name, why] of blind) console.log("  " + name.padEnd(15) + why);
  }
  // A factor that IS measured and still never leaves neutral is a real finding,
  // and it should read as one rather than being left for the eye to spot.
  const inert = out.filter((o) => o.pct === 0);
  if (inert.length) {
    console.log("\nMEASURED BUT ALWAYS NEUTRAL — these ran on every game and never moved:");
    for (const o of inert) console.log(`  ${o.name.padEnd(15)}weight ${o.w}, ${o.n} samples`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
