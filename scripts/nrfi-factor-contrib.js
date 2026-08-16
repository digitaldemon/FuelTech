// What is each factor actually worth on the shipped board?
//
// "This factor doesn't matter" is usually an argument from the weight, and the
// weight is not the contribution. A 0.7-weight term on a factor that sits at
// 1.00 all season contributes nothing; a 0.3-weight term on a factor that swings
// 0.85-1.15 moves real money. The only honest way to rank them is to turn each
// one off and re-run the whole board.
//
// So: for every factor, zero its weight EVERYWHERE it appears -- the lambda path
// (offMult/pitMult), the base-out sim (homeCtx/awayCtx/offSimCtx) and the
// projected sim -- rebuild the model in a VM, rescan the slate, and record how
// far the probability and the verdict moved.
//
// Every patch is checked for a match. A replacement that silently hits nothing
// would report its factor as inert when in truth it was never switched off,
// which is the one failure mode that would make this whole script lie.
const fs = require("fs");
const path = require("path");
const { loadDeskModel } = require("./nrfi-model-load");

const BUNDLE = path.join(__dirname, "..", "public", "desk", "app.js");
const SRC = fs.readFileSync(BUNDLE, "utf8");

// factor -> the weighted terms to zero. Each entry is the exact substring in the
// bundle and what it becomes. Listed per path so a factor that is priced in one
// path and forgotten in another shows up as a partial patch rather than passing.
const FACTORS = {
  // ---- offense side ----
  // platoon (0.010pp) and starter L3 form (0.178pp) were removed from the model
  // outright — see the notes where their factors were in app.jsx. Their entries
  // are gone from this table rather than kept at zero, because the match guard
  // below would (correctly) throw on a pattern that no longer exists.
  lineup:    [["(lineup.factor-1)*1.0", "(lineup.factor-1)*0"]],
  offTrend:  [["(offTrend.f-1)*0.5", "(offTrend.f-1)*0"],
              ["(trend.f-1)*0.5", "(trend.f-1)*0"]],                    // offSimCtx
  homeAdv:   [["(homeAdv.f-1)*1.0", "(homeAdv.f-1)*0"],
              ["awayOffAdv.f*awayOffSim", "1*awayOffSim"],
              ["homeOffAdv.f*homeOffSim", "1*homeOffSim"]],
  // one string, two sites: offMult and offSimCtx share the literal, so a single
  // replacement switches the factor off on both paths
  offVenue:  [["(venue.f-1)*0.3", "(venue.f-1)*0"]],
  kRate:     [["(kRate.f-1)*0.35", "(kRate.f-1)*0"]],
  // Only the sim multiplications. `ctx.awayTravel.factor*` also appears twice in
  // the Travel & rest check's lean expression, and blanking that would change
  // the row's VOTE as well as the math — two different effects landing in one
  // number. The vote is measured separately below.
  travel:    [["(travel.factor-1)*0.6", "(travel.factor-1)*0"],
              ["homeCtx*ctx.awayTravel.factor*", "homeCtx*"],
              ["awayCtx*ctx.homeTravel.factor*", "awayCtx*"],
              ["hPC*ctx.awayTravel.factor*", "hPC*"],
              ["aPC*ctx.homeTravel.factor*", "aPC*"]],
  // ---- pitcher side ----
  skill:     [["(skill.f-1)*1.0", "(skill.f-1)*0"]],
  opener:    [["(opener.f-1)*0.5", "(opener.f-1)*0"],
              ["(homeOpen.f-1)*0.5", "(homeOpen.f-1)*0"],
              ["(awayOpen.f-1)*0.5", "(awayOpen.f-1)*0"]],
  openerGame:[["(openG.f-1)*1.0", "(openG.f-1)*0"],
              ["(homeOpenG.f-1)*1.0", "(homeOpenG.f-1)*0"],
              ["(awayOpenG.f-1)*1.0", "(awayOpenG.f-1)*0"]],
  seasonLoad:[["(load.f-1)*0.7", "(load.f-1)*0"],
              ["(homeLoad.f-1)*0.7", "(homeLoad.f-1)*0"],
              ["(awayLoad.f-1)*0.7", "(awayLoad.f-1)*0"]],
  pitTrend:  [["(trend.f-1)*0.30", "(trend.f-1)*0"],
              ["(homeTrend.f-1)*0.30", "(homeTrend.f-1)*0"],
              ["(awayTrend.f-1)*0.30", "(awayTrend.f-1)*0"]],
  pitVenue:  [["(venue.f-1)*0.5", "(venue.f-1)*0"],
              ["(homeVenue.f-1)*0.5", "(homeVenue.f-1)*0"],
              ["(awayVenue.f-1)*0.5", "(awayVenue.f-1)*0"]],
  // No `umpire` entry. The ABS challenge system retired that term, so there is
  // no expression left to switch off — and patch() throws when a pattern never
  // matches, which is what would happen if this were merely left here. That
  // throw is the feature: an ablation that silently blanks nothing would report
  // 0.000pp and read as "the umpire barely mattered" rather than "the umpire is
  // gone", and those are different claims.
  // ---- environment ----
  // `weather` is the whole env term, which is park AND temperature AND wind. It
  // reported 2.197pp and got read as "weather is the biggest factor in the
  // model" — but most of that is the park factor, which is the best-established
  // input here and carries weight 1.00 by design. Reporting the three together
  // misattributes a well-founded term to a speculative one, so they are also
  // split out below. These three patch the weights inside weatherPark, so they
  // blank the "Weather & park" check's vote along with the math; `weather`
  // patches only the env expression and leaves the vote standing.
  weather:   [["(ctx.wx.factor-1)", "(1-1)"]],
  envPark:   [["(parkFactor-1)*ENV_W_PARK", "(parkFactor-1)*0"]],
  envTemp:   [["(tFactor-1)*ENV_W_TEMP", "(tFactor-1)*0"]],
  envWind:   [["(wFactor-1)*ENV_W_WIND", "(wFactor-1)*0"]],
};

function patch(name) {
  let out = SRC, hits = 0;
  for (const [from, to] of FACTORS[name]) {
    const n = out.split(from).length - 1;
    if (n === 0) throw new Error(name + ": pattern never matched, so it was never switched off -> " + from);
    out = out.split(from).join(to);
    hits += n;
  }
  return { src: out, hits };
}

function ladder(c, r) {
  const seed = c.read("NRFI_CALIB_SEED");
  const pcal = c.applyCalibration(r.pNRFI, { c: seed.c, active: true });
  const call = pcal >= 0.5 ? "NRFI" : "YRFI";
  const pMax = Math.max(pcal, 1 - pcal) * 100;
  return { call, pMax, v: c.nrfiVerdict({ ...r, pMax, call, market: null }) };
}

const key = (r) => (r.awayAbbr || r.away) + "@" + (r.homeAbbr || r.home);

(async () => {
  const tmp = path.join(__dirname, "..", ".factor-tmp.js");
  const base = new Map();
  {
    const c = loadDeskModel(BUNDLE);
    for (const r of await c.scanNrfi()) base.set(key(r), { p: r.pNRFI, l: ladder(c, r), m: r.method });
  }
  const simN = [...base.values()].filter((x) => x.m === "sim").length;
  console.log("\nFACTOR CONTRIBUTION — shipped board, " + base.size + " games (" +
    simN + " on the sim path, " + (base.size - simN) + " on lambda)");
  console.log("each factor switched off everywhere it appears, board re-scanned\n");

  const results = [];
  for (const name of Object.keys(FACTORS)) {
    const { src, hits } = patch(name);
    fs.writeFileSync(tmp, src);
    const c = loadDeskModel(tmp);
    let sum = 0, max = 0, moved = 0, n = 0, dirMoved = 0;
    const movers = [];
    for (const r of await c.scanNrfi()) {
      const b = base.get(key(r));
      if (!b) continue;
      const d = Math.abs(r.pNRFI - b.p) * 100;
      sum += d; max = Math.max(max, d); n++;
      const l = ladder(c, r);
      if (l.v.strength !== b.l.v.strength) { moved++; movers.push(key(r) + " " + b.l.v.strength + "->" + l.v.strength); }
      if (l.call !== b.l.call) dirMoved++;
    }
    results.push({ name, hits, mean: sum / n, max, moved, dirMoved, movers });
  }
  fs.unlinkSync(tmp);

  results.sort((a, b) => a.mean - b.mean);
  console.log("factor        patches   mean |dp|    max |dp|   verdicts   calls");
  console.log("-".repeat(70));
  for (const r of results)
    console.log("  " + r.name.padEnd(12) + String(r.hits).padStart(4) + "   " +
      (r.mean.toFixed(3) + "pp").padStart(10) + "  " + (r.max.toFixed(2) + "pp").padStart(9) +
      "   " + String(r.moved).padStart(6) + "   " + String(r.dirMoved).padStart(5) +
      (r.mean < 0.10 && r.moved === 0 ? "   <- inert" : ""));

  console.log("\nverdict changes caused by switching a factor off:");
  for (const r of results) if (r.movers.length) console.log("  " + r.name + ": " + r.movers.join(", "));

  console.log("\nread this as: mean |dp| is what the factor is worth on an average game.");
  console.log("A factor with mean < 0.1pp and zero verdict changes is not doing work --");
  console.log("the 1.5pp edge gate cannot even see it. Max |dp| matters too: a factor");
  console.log("that is usually silent but occasionally worth 3pp is a real signal with");
  console.log("a narrow trigger, not an inert one.");
})().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
