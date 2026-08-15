// Variance decomposition of the NRFI probability, measured on the live slate.
//
// A weight on paper says nothing about influence. offMult and pitMult are sums
// of (factor - 1) * weight, so a factor's ACTUAL contribution is its deviation
// from neutral times its weight — a 1.0-weighted input that never leaves 1.00
// moves nothing, and a 0.35-weighted one that swings +-0.15 moves more than it
// looks like it should. This prints, per factor: how often it is non-neutral,
// its mean absolute contribution in lambda-multiplier points, and its worst
// single swing on the slate.
const { loadDeskModel } = require("./nrfi-model-load");
const c = loadDeskModel();
const realFetch = global.fetch;
c.fetch = (u, o) => (String(u).startsWith("/") ? Promise.reject(new Error("local api")) : realFetch(u, o));

// Weights copied from offMult / pitMult. Kept beside the factor name so the
// report is in units the model actually applies, not raw factor values.
const OFF = { lineup: 1.0, platoon: 0.2, travel: 0.6, offTrend: 0.5, homeOffAdv: 1.0, offVenue: 0.3, offKrate: 0.35 };
const PIT = { skill: 1.0, form: 0.10, opener: 0.5, openerGame: 1.0, seasonLoad: 0.7, pitTrend: 0.30, homePitAdv: 1.0, pitVenue: 0.5 };

const log = {};
const rec = (name, w, f) => {
  if (f == null || !isFinite(f)) return;
  (log[name] = log[name] || { w, vals: [] }).vals.push(f);
};

// Factor helpers are function declarations, so they land on the sandbox context
// and can be wrapped in place.
const wrap = (fn, name, w, pick) => {
  const orig = c[name === "x" ? fn : fn];
  if (typeof orig !== "function") { console.log("!! missing " + fn); return; }
  c[fn] = function (...a) { const r = orig.apply(this, a); rec(name, w, pick ? pick(r) : (r && r.f)); return r; };
};

wrap("platoonFactor",           "platoon",     OFF.platoon);
wrap("teamOffenseTrendFactor",  "offTrend",    OFF.offTrend);
wrap("homeOffAdvantage",        "homeOffAdv",  OFF.homeOffAdv);
wrap("offenseVenueFactor",      "offVenue",    OFF.offVenue);
wrap("offKrateFactor",          "offKrate",    OFF.offKrate);
wrap("pitchSkillFactor",        "skill",       PIT.skill);
wrap("formFactor",              "form",        PIT.form);
wrap("openerFactor",            "opener",      PIT.opener);
wrap("openerGameFactor",        "openerGame",  PIT.openerGame);
wrap("seasonLoadFactor",        "seasonLoad",  PIT.seasonLoad);
wrap("pitcherTrendFactor",      "pitTrend",    PIT.pitTrend);
wrap("homePitAdvantage",        "homePitAdv",  PIT.homePitAdv);
wrap("pitcherVenueFactor",      "pitVenue",    PIT.pitVenue);

// lineup, travel, weather and umpire arrive on ctx rather than from a helper.
const origEval = c.nrfiEvaluate;
c.nrfiEvaluate = function (ctx) {
  for (const s of ["away", "home"]) {
    rec("lineup", OFF.lineup, ctx[s + "Lineup"] && ctx[s + "Lineup"].factor);
    rec("travel", OFF.travel, ctx[s + "Travel"] && ctx[s + "Travel"].factor);
  }
  rec("weather(env)", 1.0, ctx.wx && ctx.wx.factor);
  rec("umpire(env)", 1.0, ctx.umpFactor);
  return origEval.apply(this, arguments);
};

(async () => {
  const rows = await c.scanNrfi();
  console.log("\nslate: " + (rows || []).length + " games\n");
  const out = [];
  for (const [name, d] of Object.entries(log)) {
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
})().catch((e) => { console.error(e.message); process.exit(1); });
