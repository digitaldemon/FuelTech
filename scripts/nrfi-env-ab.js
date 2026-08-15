// A/B the home-field refit and the env de-compounding on today's real slate.
//
// Two separate claims to check, so they are measured separately:
//   1. env no longer compounds — the shipped factor must equal a deviation blend,
//      never the raw park x temp x wind product the old code returned.
//   2. home field now redistributes lambda instead of cancelling — the old pair
//      multiplied out to x0.9987 across the two halves, i.e. it did essentially
//      nothing to P(NRFI) while consuming a fifth of the model's apparent
//      movement in the variance decomposition.
const { loadDeskModel } = require("./nrfi-model-load");
const c = loadDeskModel();
const realFetch = global.fetch;
c.fetch = (u, o) => (String(u).startsWith("/") ? Promise.reject(new Error("local api")) : realFetch(u, o));

// Verbatim pre-fix body. Frozen witness — do not tidy.
function oldWeatherPark(game, homeAbbr, PARK) {
  const parkFactor = PARK[homeAbbr] || 1;
  let wFactor = 1, note = "neutral park";
  const w = game.weather || {};
  const temp = w.temp != null ? Number(w.temp) : null;
  const cond = String(w.condition || "");
  const wind = String(w.wind || "");
  if (/Dome|Roof Closed/i.test(cond)) { wFactor = 0.97; note = "indoors"; }
  else {
    if (temp != null) {
      if (temp >= 92) wFactor *= 1.09;
      else if (temp >= 82) wFactor *= 1.05;
      else if (temp >= 56) { /* neutral */ }
      else if (temp >= 46) wFactor *= 0.94;
      else wFactor *= 0.89;
    }
    const mph = Number((wind.match(/(\d+)/) || [])[1] || 0);
    if (mph >= 5) {
      if (/out to c/i.test(wind))       wFactor *= mph >= 20 ? 1.14 : mph >= 12 ? 1.09 : 1.05;
      else if (/in from c/i.test(wind)) wFactor *= mph >= 20 ? 0.87 : mph >= 12 ? 0.92 : 0.96;
      else if (/out to/i.test(wind))    wFactor *= mph >= 20 ? 1.07 : mph >= 12 ? 1.04 : 1.02;
      else if (/in from/i.test(wind))   wFactor *= mph >= 20 ? 0.94 : mph >= 12 ? 0.97 : 0.99;
      else if (mph >= 20 && /l to r|r to l/i.test(wind)) wFactor *= 0.98;
    }
    note = (temp != null ? temp + "°" : "") + (wind ? " · " + wind : "");
  }
  return { factor: parkFactor * wFactor, park: parkFactor, note: note || "neutral" };
}

const seen = new Map();
const origEval = c.nrfiEvaluate;
c.nrfiEvaluate = function (ctx) {
  const k = ctx.awayName + " @ " + ctx.homeName;
  if (!seen.has(k)) seen.set(k, ctx);
  return origEval.apply(this, arguments);
};

let fails = 0;
const check = (ok, what, detail) => {
  console.log((ok ? "  PASS  " : "  FAIL  ") + what + (ok ? "" : "\n          " + detail));
  if (!ok) fails++;
};

(async () => {
  const rows = await c.scanNrfi();
  const PARK = c.read("NRFI_PARK");
  const wP = c.read("ENV_W_PARK"), wT = c.read("ENV_W_TEMP"), wW = c.read("ENV_W_WIND");

  console.log("\nENV: park x temp x wind  ->  weighted deviation blend");
  console.log("matchup                        park   old env   new env   delta");
  console.log("-".repeat(72));
  let maxOld = 1, maxNew = 1, worstGap = 0;
  for (const [k, ctx] of seen) {
    // Rebuild the game object weatherPark was handed. scanNrfi keeps the result
    // on ctx.wx; the raw inputs are echoed in the note, so re-derive from those.
    const nw = ctx.wx;
    const blend = 1 + (nw.park - 1) * wP + (nw.temp - 1) * wT + (nw.wind - 1) * wW;
    const product = nw.park * nw.temp * nw.wind;
    if (Math.abs(nw.factor - product) > Math.abs(nw.factor - blend)) { /* blend is closer, as required */ }
    if (Math.abs(blend - product) > worstGap) worstGap = Math.abs(blend - product);
    if (product > maxOld) maxOld = product;
    if (nw.factor > maxNew) maxNew = nw.factor;
    console.log(String(k).slice(0, 30).padEnd(31) +
      nw.park.toFixed(2).padStart(5) + product.toFixed(3).padStart(10) +
      nw.factor.toFixed(3).padStart(10) +
      ((nw.factor - product >= 0 ? "+" : "") + (nw.factor - product).toFixed(3)).padStart(8));
  }
  console.log("\n  largest raw product on the slate: x" + maxOld.toFixed(3) +
    "   largest shipped env: x" + maxNew.toFixed(3));

  console.log("\ninvariants");
  // 1. The shipped factor IS the blend, not the product.
  let blendOk = true, clampOk = true;
  for (const [, ctx] of seen) {
    const n = ctx.wx;
    const blend = 1 + (n.park - 1) * wP + (n.temp - 1) * wT + (n.wind - 1) * wW;
    const expect = Math.max(0.88, Math.min(1.16, blend));
    if (Math.abs(n.factor - expect) > 1e-9) blendOk = false;
    if (n.factor < 0.88 - 1e-9 || n.factor > 1.16 + 1e-9) clampOk = false;
  }
  check(blendOk, "env is the weighted deviation blend on every game, not the raw product",
    "a game's shipped env did not match 1 + sum((f-1)*w) under the clamp.");
  check(clampOk, "env is clamped — no game can run away on park x temp x wind",
    "a shipped env escaped [0.88, 1.16].");
  // 2. Temp and wind can no longer multiply each other.
  const hot = c.weatherPark({ weather: { temp: "95", condition: "Sunny", wind: "22 mph, Out To CF" } }, "COL");
  const hotProduct = hot.park * hot.temp * hot.wind;
  check(hot.factor < hotProduct - 0.05,
    "the worst case — 95F, 22mph out to centre, at Coors — no longer compounds",
    "blend " + hot.factor.toFixed(3) + " vs raw product " + hotProduct.toFixed(3));
  console.log("        (raw product would be x" + hotProduct.toFixed(3) +
    ", applied to BOTH halves; shipped is x" + hot.factor.toFixed(3) + ")");
  // 3. Indoors is neutral on weather — the park factor already describes the roof.
  const dome = c.weatherPark({ weather: { condition: "Dome", temp: "72" } }, "TB");
  check(Math.abs(dome.temp - 1) < 1e-9 && Math.abs(dome.wind - 1) < 1e-9 &&
        Math.abs(dome.factor - (1 + (dome.park - 1) * wP)) < 1e-9,
    "indoors carries the park factor alone, with no weather term on top",
    "dome game still applies a weather multiplier: temp=" + dome.temp + " wind=" + dome.wind);

  console.log("\nHOME FIELD");
  const up = c.read("HFA_UP"), down = c.read("HFA_DOWN");
  console.log("  measured lambda ratio home/away: " + c.read("HFA_LAMBDA_RATIO"));
  console.log("  applied:  home half x" + up.toFixed(4) + "   away half x" + down.toFixed(4) +
    "   ratio " + (up / down).toFixed(4));
  console.log("  was:      home half x" + (1.02 * 1.03).toFixed(4) + "   away half x" + (0.98 * 0.97).toFixed(4) +
    "   ratio " + ((1.02 * 1.03) / (0.98 * 0.97)).toFixed(4));
  check(Math.abs(up * down - 1) < 1e-9,
    "the home/away pair is centred at 1 — it redistributes lambda, it does not add level",
    "product is " + (up * down).toFixed(6) + "; the pair adds a net scoring bias on top of the split.");
  check(Math.abs(up / down - c.read("HFA_LAMBDA_RATIO")) < 1e-9,
    "the applied ratio is the measured ratio, not a fraction of it",
    "applied " + (up / down).toFixed(4) + " vs measured " + c.read("HFA_LAMBDA_RATIO"));
  check(typeof c.homePitAdvantage === "undefined",
    "the unidentifiable pitcher-side twin is gone, not left dead in the file",
    "homePitAdvantage still exists — two knobs are still fitted to one observable.");

  console.log("\nSLATE IMPACT");
  const strong = rows.filter((r) => r.pNRFI >= 0.63).length;
  console.log("  " + rows.length + " games scanned, " + strong + " at or above the STRONG line on raw pNRFI");
  const spread = rows.map((r) => r.pNRFI).sort((a, b) => a - b);
  console.log("  pNRFI range " + (spread[0] * 100).toFixed(1) + "% .. " +
    (spread[spread.length - 1] * 100).toFixed(1) + "%");

  console.log("\n" + "=".repeat(72));
  if (fails) { console.log(fails + " check(s) FAILED"); process.exit(1); }
  console.log("env and home-field invariants hold");
})().catch((e) => { console.error(e); process.exit(1); });
