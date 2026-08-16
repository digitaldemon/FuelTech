// A/B the L10 offense-trend fix on identical inputs.
//
// The shipped bundle's teamOffenseRolling supplies the windows; the OLD factor
// body is reproduced verbatim below and run against the same rolling objects as
// the new one. Same data, both code paths — the only difference measured is the
// code, which is the only way to tell a fix from live-data drift.
const { loadDeskModel } = require("./nrfi-model-load");
const { installLocalApi } = require("./nrfi-local-api");
const c = loadDeskModel();
const realFetch = global.fetch;
// Serves /api/desk/savant for real and refuses the rest loudly; see nrfi-local-api.js
const localApi = installLocalApi(c);

// Verbatim pre-fix body. Frozen witness — do not tidy.
function oldFactor(rolling) {
  if (!rolling) return { f: 1, note: "" };
  const l10 = rolling.l10 && (rolling.l10.n || 0) >= 5 ? rolling.l10.rate : null;
  const l5  = rolling.l5  && (rolling.l5.n  || 0) >= 3 ? rolling.l5.rate  : null;
  const szn = rolling.szn && rolling.szn.rate != null ? rolling.szn.rate : null;
  if ((l10 == null && l5 == null) || szn == null || szn <= 0) return { f: 1, note: "" };
  const d10 = l10 != null ? l10 - szn : null;
  const d5  = l5  != null ? l5  - szn : null;
  const delta = (d10 != null && d5 != null)
    ? (Math.sign(d5) === Math.sign(d10) ? (d10 + d5) / 2 : (Math.abs(d10) <= Math.abs(d5) ? d10 : d5))
    : (d10 ?? d5);
  const l10rg = rolling.l10 && rolling.l10.avgRuns != null ? rolling.l10.avgRuns : null;
  const sznRg = rolling.szn && rolling.szn.avgRuns != null ? rolling.szn.avgRuns : null;
  const rgBoost = (l10rg != null && sznRg != null && sznRg > 0) ? (l10rg - sznRg) / sznRg * 0.12 : 0;
  const combined = delta + rgBoost;
  const pp = Math.round((d10 ?? d5 ?? 0) * 100);
  if      (combined >=  0.20) return { f: 1.08, note: "off L10 hot (+" + pp + "pp vs SZN)" };
  else if (combined >=  0.12) return { f: 1.04, note: "off L10 warm (+" + pp + "pp)" };
  else if (combined <= -0.20) return { f: 0.93, note: "off L10 cold (" + pp + "pp vs SZN)" };
  else if (combined <= -0.12) return { f: 0.97, note: "off L10 cooling (" + pp + "pp)" };
  return { f: 1, note: "" };
}

const seen = new Map();
const origEval = c.nrfiEvaluate;
c.nrfiEvaluate = function (ctx) {
  for (const s of ["away", "home"]) {
    const nm = ctx[s + "Name"];
    if (nm && !seen.has(nm)) seen.set(nm, ctx[s + "OffRolling"]);
  }
  return origEval.apply(this, arguments);
};

(async () => {
  await c.scanNrfi();
  console.log("\nteam                    old            new           moved?");
  console.log("-".repeat(78));
  let moved = 0, oldFires = 0, newFires = 0, attenuation = [];
  for (const [nm, ro] of seen) {
    const o = oldFactor(ro), n = c.teamOffenseTrendFactor(ro);
    if (o.f !== 1) oldFires++;
    if (n.f !== 1) newFires++;
    const diff = o.f !== n.f;
    if (diff) moved++;
    // Recover the attenuation ratio the overlap imposed, where both are measurable.
    if (ro && ro.szn && ro.l10 && ro.szn.rate != null && ro.l10.rate != null && (ro.szn.n - ro.l10.n) >= 5) {
      const prior = (ro.szn.rate * ro.szn.n - ro.l10.rate * ro.l10.n) / (ro.szn.n - ro.l10.n);
      const dTrue = ro.l10.rate - prior, dOld = ro.l10.rate - ro.szn.rate;
      if (Math.abs(dTrue) > 1e-9) attenuation.push(dOld / dTrue);
    }
    console.log(String(nm).slice(0, 21).padEnd(22) +
      o.f.toFixed(2) + "  " + (o.note || "-").slice(0, 12).padEnd(13) +
      n.f.toFixed(2) + "  " + (n.note || "-").slice(0, 22).padEnd(23) +
      (diff ? "MOVED" : ""));
  }
  const mean = attenuation.reduce((s, x) => s + x, 0) / (attenuation.length || 1);
  const spread = Math.max(...attenuation.map((x) => Math.abs(x - mean)));
  console.log("\nfires: old " + oldFires + "/" + seen.size + "   new " + newFires + "/" + seen.size +
    "   factor changed on " + moved + " team(s)");
  console.log("measured attenuation (old delta / true delta) over " + attenuation.length +
    " teams: mean " + mean.toFixed(4) + ", max deviation " + spread.toFixed(6));
  console.log("predicted from window arithmetic (15 prior of 25): " + (15 / 25).toFixed(4));
})().catch((e) => { console.error(e.message); process.exit(1); });
