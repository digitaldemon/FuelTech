// Do the pitcher/offense adjustment factors carry independent information, or
// are several of them re-slicing the SAME first-inning sample that the base rate
// already consumed?
//
// pitBase is the pitcher's regressed 1st-inning run rate over ~15-25 innings.
// opener (1st-inn ERA vs season ERA), pitTrend (L10 vs SZN 1st-inn clean%) and
// pitVenue (home/road 1st-inn split) are all computed from subsets of those very
// same innings. The deviation-blend in pitMult stops them compounding
// multiplicatively, but they still ADD, so correlated slices stack a coherent
// push onto a number already built from that data. Same question on the offense
// side for offTrend / offVenue / offKrate against offBase.
//
// Correlation here is diagnostic, not proof: |r| near 0 means a factor is
// genuinely adding something, |r| that is large and consistently signed means
// the model is paying twice for one fact.
const { loadDeskModel } = require("./nrfi-model-load");
const { installLocalApi } = require("./nrfi-local-api");
const c = loadDeskModel();
const realFetch = global.fetch;
// Serves /api/desk/savant for real and refuses the rest loudly; see nrfi-local-api.js
const localApi = installLocalApi(c);

let bucket = null;
const push = (name, f) => { if (bucket && f != null && isFinite(f)) (bucket[name] = bucket[name] || []).push(f); };
const wrap = (fn, name) => {
  const orig = c[fn];
  if (typeof orig !== "function") { console.log("!! missing " + fn); return; }
  c[fn] = function () { const r = orig.apply(this, arguments); push(name, r && r.f); return r; };
};
for (const [fn, nm] of [
  ["pitchSkillFactor", "skill"], ["formFactor", "form"], ["openerFactor", "opener"],
  ["openerGameFactor", "openerGame"], ["seasonLoadFactor", "seasonLoad"],
  ["pitcherTrendFactor", "pitTrend"], ["pitcherVenueFactor", "pitVenue"],
  ["teamOffenseTrendFactor", "offTrend"], ["offenseVenueFactor", "offVenue"],
  ["offKrateFactor", "offKrate"], ["platoonFactor", "platoon"],
]) wrap(fn, nm);

const NRFI_PIT_REG = c.read("NRFI_PIT_REG"), NRFI_OFF_REG = c.read("NRFI_OFF_REG");
const rows = [];
const origEval = c.nrfiEvaluate;
c.nrfiEvaluate = function (ctx) {
  bucket = {};
  const r = origEval.apply(this, arguments);
  const b = bucket; bucket = null;
  // Factor helpers run away-side first, then home-side, so index 0/1 pairs with
  // the away/home base rates computed the same way nrfiEvaluate computes them.
  const base = (p, reg) => c.nrfiRegress(p && p.rate, (p && p.sample) || 0, reg);
  for (const [i, side] of [[0, "away"], [1, "home"]]) {
    rows.push({
      pitBase: base(ctx[side + "Pit"], NRFI_PIT_REG),
      offBase: base(ctx[side + "Off"], NRFI_OFF_REG),
      f: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v[i]])),
    });
  }
  return r;
};

const corr = (xs, ys) => {
  const n = xs.length; if (n < 4) return null;
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  if (sxx < 1e-12 || syy < 1e-12) return null;   // one side is constant
  return sxy / Math.sqrt(sxx * syy);
};

(async () => {
  await c.scanNrfi();
  console.log("\n" + rows.length + " pitcher/offense sides observed\n");
  const report = (title, baseKey, names, note) => {
    console.log(title);
    console.log("  factor        n    r vs " + baseKey + "   reading");
    for (const nm of names) {
      const pairs = rows.filter((r) => r.f[nm] != null && isFinite(r[baseKey]));
      const r = corr(pairs.map((p) => p[baseKey]), pairs.map((p) => p.f[nm]));
      const rd = r == null ? "constant / too few"
        : Math.abs(r) >= 0.5 ? "STRONG overlap — re-slicing the base sample"
        : Math.abs(r) >= 0.3 ? "moderate overlap"
        : "independent";
      console.log("  " + nm.padEnd(13) + String(pairs.length).padStart(3) + "  " +
        (r == null ? "   n/a" : (r >= 0 ? "+" : "") + r.toFixed(3)).padStart(8) + "   " + rd);
    }
    console.log("  " + note + "\n");
  };
  report("PITCHER side — base is the regressed 1st-inning run rate", "pitBase",
    ["opener", "pitTrend", "pitVenue", "form", "skill", "openerGame", "seasonLoad"],
    "opener/pitTrend/pitVenue are computed from the same innings as pitBase.");
  report("OFFENSE side — base is the regressed team 1st-inning run rate", "offBase",
    ["offTrend", "offVenue", "offKrate", "platoon"],
    "offTrend/offVenue are computed from the same innings as offBase.");
})().catch((e) => { console.error(e.message); process.exit(1); });
