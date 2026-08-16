// A/B the pitcher-trend de-overlap on identical rolling data, and search for the
// gate triple that holds the old sensitivity on the corrected delta.
//
// Unlike the offense side, the attenuation here is NOT a constant: szn is every
// start a pitcher has made, so the overlap ratio is (n - 10)/n and varies with
// workload — a 15-start arm read a third of its true move, a 30-start arm two
// thirds. So the gates cannot simply be divided by a fixed number; they have to
// be measured.
const { loadDeskModel } = require("./nrfi-model-load");
const { installLocalApi } = require("./nrfi-local-api");
const c = loadDeskModel();
const realFetch = global.fetch;
// Serves /api/desk/savant for real and refuses the rest loudly; see nrfi-local-api.js
const localApi = installLocalApi(c);

// Verbatim pre-fix body. Frozen witness.
function oldFactor(rolling) {
  if (!rolling) return { f: 1, note: "" };
  const l10pct = rolling.l10 && (rolling.l10.n || 0) >= 5 ? rolling.l10.pct : null;
  const l5pct  = rolling.l5  && (rolling.l5.n  || 0) >= 3 ? rolling.l5.pct  : null;
  const sznPct = rolling.szn ? rolling.szn.pct : null;
  if (sznPct == null || (l10pct == null && l5pct == null)) return { f: 1, note: "" };
  const d10 = l10pct != null ? l10pct - sznPct : null;
  const d5  = l5pct  != null ? l5pct  - sznPct : null;
  const delta = (d10 != null && d5 != null)
    ? (Math.sign(d5) === Math.sign(d10) ? (d10 + d5) / 2 : (Math.abs(d10) <= Math.abs(d5) ? d10 : d5))
    : (d10 ?? d5);
  const l10rps = rolling.l10 && rolling.l10.runsPerStart != null ? rolling.l10.runsPerStart : null;
  const sznRps = rolling.szn && rolling.szn.runsPerStart != null ? rolling.szn.runsPerStart : null;
  const rpsBoost = (l10rps != null && sznRps != null && sznRps > 0) ? (sznRps - l10rps) / sznRps * 10 : 0;
  const combined = (delta ?? 0) + rpsBoost;
  if      (combined >=  25) return { f: 0.84, c: combined };
  else if (combined >=  15) return { f: 0.90, c: combined };
  else if (combined >=   8) return { f: 0.95, c: combined };
  else if (combined <= -25) return { f: 1.16, c: combined };
  else if (combined <= -15) return { f: 1.10, c: combined };
  else if (combined <=  -8) return { f: 1.05, c: combined };
  return { f: 1, c: combined };
}

// The corrected `combined`, read straight off the SHIPPED function via the `d`
// field it now returns. An earlier cut of this script kept its own copy of the
// new formula and immediately went stale — it still showed the -124pp division
// blow-up after the fix had landed, which is exactly the trap this whole audit
// exists to catch. Never hand-mirror the code under test.
function newCombined(rolling) {
  const r = c.pitcherTrendFactor(rolling);
  return r && r.d != null ? r.d : null;
}

const seen = new Map();
const origEval = c.nrfiEvaluate;
c.nrfiEvaluate = function (ctx) {
  for (const s of ["away", "home"]) {
    const nm = ctx[s + "PP"];
    if (nm && !seen.has(nm)) seen.set(nm, ctx[s + "Rolling"]);
  }
  return origEval.apply(this, arguments);
};

const bucket = (v, g) => (v >= g[0] ? 3 : v >= g[1] ? 2 : v >= g[2] ? 1 : v <= -g[0] ? -3 : v <= -g[1] ? -2 : v <= -g[2] ? -1 : 0);

(async () => {
  await c.scanNrfi();
  const rows = [];
  for (const [nm, ro] of seen) {
    const o = oldFactor(ro), nc = newCombined(ro);
    rows.push({ nm, ro, oldC: o.c, oldF: o.f, newC: nc });
  }
  const usable = rows.filter((r) => r.newC != null && r.oldC != null);
  console.log("\npitcher                 starts  old combined  new combined  ratio");
  console.log("-".repeat(70));
  const ratios = [];
  for (const r of usable) {
    const n = r.ro.szn.n;
    const ratio = Math.abs(r.newC) > 1e-9 ? r.oldC / r.newC : null;
    if (ratio != null && Math.abs(r.newC) > 3) ratios.push(ratio);
    console.log(String(r.nm).slice(0, 22).padEnd(24) + String(n).padStart(4) +
      r.oldC.toFixed(1).padStart(13) + r.newC.toFixed(1).padStart(14) +
      (ratio == null ? "   —" : ratio.toFixed(2)).padStart(8));
  }
  const mean = ratios.reduce((s, x) => s + x, 0) / (ratios.length || 1);
  console.log("\nmean attenuation the overlap imposed: " + mean.toFixed(3) +
    "  (offense side was a flat 0.600)");
  console.log("spread " + Math.min(...ratios).toFixed(3) + " .. " + Math.max(...ratios).toFixed(3) +
    " — varies with workload, so the gates must be searched, not divided.");

  const oldDist = usable.map((r) => bucket(r.oldC, [25, 15, 8]));
  const score = (g) => {
    const nd = usable.map((r) => bucket(r.newC, g));
    let same = 0;
    for (let i = 0; i < nd.length; i++) if (nd[i] === oldDist[i]) same++;
    return { g, same, fires: nd.filter((x) => x !== 0).length };
  };
  const oldFires = oldDist.filter((x) => x !== 0).length;
  console.log("\ncandidate gates (old fired on " + oldFires + "/" + usable.length + " arms)");
  console.log("  HOT/WARM/MILD    fires   same bucket as before");
  const cands = [];
  for (const a of [30, 33, 36, 38, 40, 42, 45]) for (const b of [18, 20, 22, 23, 25, 27]) for (const d of [10, 11, 12, 13, 14, 15]) {
    if (!(a > b && b > d)) continue;
    cands.push(score([a, b, d]));
  }
  cands.sort((x, y) => (y.same - x.same) || (Math.abs(x.fires - oldFires) - Math.abs(y.fires - oldFires)));
  for (const s of cands.slice(0, 8))
    console.log("  " + s.g.join("/").padEnd(16) + String(s.fires).padStart(3) + "      " + s.same + "/" + usable.length);
})().catch((e) => { console.error(e.message); process.exit(1); });
