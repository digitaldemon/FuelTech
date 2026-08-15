// Show what the withdrawn Platt seed did to the board, run through the shipped
// gate chain. Kept as the worked example behind the comment on NRFI_CALIB_SEED.
//
// CAVEAT on the inputs: these raw pNRFI values are approximations produced by
// the simplified λ-model, not by the live nrfiEvaluate. They illustrate the
// mechanism — they are not the exact numbers those games carried on the board.
const { loadDeskModel } = require("./nrfi-model-load");
const c = loadDeskModel();
const { applyCalibration, nrfiBlend, nrfiVerdict } = c;

const RESTORED = c.read("NRFI_CALIB_SEED");                 // shipping now
const WITHDRAWN = { c: -0.7396, slope: 1.243, active: true }; // 6cdf405, Aug 15 00:12

// The withdrawn seed's directional form, reproduced here because the shipped
// applyCalibration no longer implements it.
function applyWithdrawn(pNRFI) {
  const lg = (p) => Math.log(p / (1 - p)), ul = (x) => 1 / (1 + Math.exp(-x));
  const cl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const isNRFI = pNRFI >= 0.5, pDir = isNRFI ? pNRFI : 1 - pNRFI;
  const d = cl(ul(WITHDRAWN.slope * lg(cl(pDir, 0.5001, 0.98)) + WITHDRAWN.c), 0.5, 0.98);
  return isNRFI ? d : 1 - d;
}

const GAMES = [
  { g: "NYY@TOR", raw: 0.486, mkt: 57.5 },
  { g: "BAL@TB",  raw: 0.662, mkt: 54.5 },
  { g: "BOS@PIT", raw: 0.585, mkt: 53.5 },
  { g: "mid-confidence", raw: 0.60, mkt: 52.0 },
  { g: "slight lean",    raw: 0.56, mkt: 50.0 },
];

for (const [name, cal] of [
  ["RESTORED seed " + JSON.stringify(RESTORED), (p) => applyCalibration(p, Object.assign({}, RESTORED, { active: true }))],
  ["WITHDRAWN Platt seed (slope 1.243, c -0.7396, 0.5 floor)", applyWithdrawn],
]) {
  console.log("\n" + "=".repeat(76) + "\n" + name + "\n" + "=".repeat(76));
  console.log("game               raw    -> cal    -> pFinal  call  edgeRaw  verdict");
  for (const G of GAMES) {
    const pcal = cal(G.raw);
    const pFinal = nrfiBlend(pcal, G.mkt);
    const call = pFinal >= 0.5 ? "NRFI" : "YRFI";
    const mktSide = call === "NRFI" ? G.mkt : 100 - G.mkt;
    const v = nrfiVerdict({
      pMax: Math.max(pFinal, 1 - pFinal) * 100, call,
      aligned: { agree: 3, total: 3, rows: 18 }, confidence: 0.85,
      pitProfiles: { away: { sample: 20 }, home: { sample: 20 } }, awayPP: "A", homePP: "B",
      market: { marketSide: mktSide,
        edgeRaw: (call === "NRFI" ? pcal : 1 - pcal) * 100 - mktSide,
        edge: (call === "NRFI" ? pFinal : 1 - pFinal) * 100 - mktSide },
    });
    const why = v.blurb.match(/\(([^)]*)\)\s*$/);
    console.log(G.g.padEnd(18) + (G.raw * 100).toFixed(1).padStart(5) + "  -> " +
      (pcal * 100).toFixed(1).padStart(5) + "  -> " + (pFinal * 100).toFixed(1).padStart(5) +
      "  " + call.padEnd(5) + ((call === "NRFI" ? pcal : 1 - pcal) * 100 - mktSide).toFixed(1).padStart(7) +
      "  " + v.strength.padEnd(7) + " " + (why ? why[1] : ""));
  }
}

console.log("\nThe 0.5 floor is what did the damage: under ~64.5% raw the calibration");
console.log("returned exactly 50.0, so the model had no opinion, pFinal collapsed onto");
console.log("the market, edgeRaw went negative, and `edge < 1.5 -> PASS` blanked the");
console.log("card. That gate outranks the ladder, so the LEANs went with the BETs.");
