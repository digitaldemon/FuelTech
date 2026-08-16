/* Do the verdict GATES earn their keep, or do they just cost volume?
 *
 * nrfiVerdict does two things. First it reads a rung off the ladder from the
 * calibrated probability alone. Then it applies gates that can demote that
 * rung: a consensus gate (no check confirms the call, or the families are
 * split) and a confidence gate (thin data, one or both starters thin). The
 * ladder has now been tested walk-forward and tuned. The gates never have been.
 *
 * THE QUESTION, framed the way the ladder work had to be reframed. It is not
 * "do gated games win less often" -- of course they might, and a rate computed
 * on the survivors is nested inside the rate computed on everything, so
 * comparing them is partly arithmetic. The question is disjoint: take the games
 * the raw ladder would PLAY and the gates DEMOTE out of the played set, and ask
 * how that band did on its own. Below break-even, the gates are removing a
 * losing leg and are worth their volume. Above it, they are discarding
 * profitable bets and should be loosened or dropped.
 *
 * HOW THE RAW RUNG IS RECOVERED, without duplicating the ladder. The obvious
 * approach -- re-read NRFI_STRONG_MIN and friends and re-implement the rung
 * logic here -- is the exact failure this repo keeps hitting: a second copy of
 * a rule that silently drifts from the first. Instead the SAME nrfiVerdict is
 * called twice per game: once with the real row, and once with a row whose gate
 * inputs are satisfied (unanimous consensus, full confidence, both starters
 * well-sampled) and whose probability is untouched. The second call cannot be
 * demoted, so whatever rung it returns is the ladder's own answer. If the gate
 * logic changes, both calls change together and this script cannot go stale.
 *
 * Volumes are CEILINGS: the value gate against market price is not
 * reconstructable from this cache, so real played counts are lower throughout.
 */
const fs = require("fs");
const path = require("path");
const { makeVerdict, modelSig, ladderSig } = require("./nrfi-model-lib");

const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");
const pc = (x) => (x == null ? "   —  " : (x * 100).toFixed(1) + "%");

if (!fs.existsSync(CACHE)) {
  console.error("no cached scores — run: node scripts/nrfi-tout-vs-model.js 318949");
  process.exit(1);
}
const cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));
if (!cache.modelSig || cache.modelSig !== modelSig) {
  console.error(`STALE CACHE: built from model ${cache.modelSig || "(unfingerprinted)"}, now ${modelSig}. ` +
    "Rebuild: node scripts/nrfi-tout-vs-model.js 318949");
  process.exit(1);
}
if (cache.pitMode !== "point-in-time") {
  console.error(`REFUSING TO RUN: cache pitMode is "${cache.pitMode}" — gates judged on leaked scores are meaningless.`);
  process.exit(1);
}

const { nrfiVerdict, applyCalibration } = makeVerdict();
/* Read the shipped seed out of app.jsx rather than restating it. makeVerdict
 * returns only functions, so a `makeVerdict().NRFI_CALIB_SEED || -0.063` idiom
 * silently always takes the fallback and goes stale the day the seed moves. */
const SEED = require("./nrfi-model-lib").NRFI_CALIB_SEED;
if (!SEED || !Number.isFinite(SEED.c)) throw new Error("could not read NRFI_CALIB_SEED from the model lib");
const CAL = { c: SEED.c, active: true };

const seen = new Set();
const games = [];
for (const [date, gs] of cache.slates) {
  for (const g of gs) {
    if (seen.has(g.gamePk)) continue;
    seen.add(g.gamePk);
    games.push({ ...g, date });
  }
}
games.sort((a, b) => a.date.localeCompare(b.date));

const PRICE = 0.8403;                   // -119, solved from the tout's graded book
const BREAKEVEN = 1 / (1 + PRICE);      // 54.3%

// The real row, and the same row with every gate input satisfied.
function rows(g) {
  const pcal = applyCalibration(g.p, CAL);
  const base = {
    pMax: Math.max(pcal, 1 - pcal) * 100,
    call: pcal >= 0.5 ? "NRFI" : "YRFI",
    market: null, awayPP: "away", homePP: "home",
  };
  const real = {
    ...base,
    aligned: g.aligned, confidence: g.confidence,
    pitProfiles: { away: g.thinAway ? { sample: 0 } : { sample: 99 },
      home: g.thinHome ? { sample: 0 } : { sample: 99 } },
  };
  // Probability identical; only the gate inputs are made non-binding.
  const ungated = {
    ...base,
    aligned: { total: 3, agree: 3 }, confidence: 1,
    pitProfiles: { away: { sample: 99 }, home: { sample: 99 } },
  };
  return { real, ungated, actual: g.actual, date: g.date };
}

const PLAYED = new Set(["STRONG", "BET"]);
const rec = [];
for (const g of games) {
  const { real, ungated, actual, date } = rows(g);
  const vr = nrfiVerdict(real);
  const vu = nrfiVerdict(ungated);
  rec.push({
    date, actual,
    side: vu.side,
    gatedPlayed: !vr.thinPass && PLAYED.has(vr.strength),
    rawPlayed: PLAYED.has(vu.strength),
    notes: vr.notes || [],
    thinPass: !!vr.thinPass,
  });
}

const score = (set) => {
  const n = set.length;
  const w = set.filter((r) => (r.side === "NRFI") === (r.actual === 1)).length;
  const rate = n ? w / n : null;
  const roi = rate == null ? null : rate * PRICE - (1 - rate);
  return { n, w, l: n - w, rate, roi, units: roi == null ? null : roi * n,
    se: n ? Math.sqrt((rate * (1 - rate)) / n) : null };
};
const line = (label, s) =>
  `  ${label.padEnd(34)}${String(s.n).padStart(5)}  ${String(s.w + "-" + s.l).padStart(8)}  ` +
  `${pc(s.rate).padStart(6)}  ${s.units == null ? "     —" : s.units.toFixed(1).padStart(6)}`;

console.log(`gate value · cache ${cache.at} · model ${modelSig} · ladder ${ladderSig} · ${cache.pitMode}`);
console.log(`${games.length} games · seed c=${SEED.c} (n=${SEED.n}, ${SEED.source}) · flat 1u at ${PRICE.toFixed(3)}; break-even ${pc(BREAKEVEN)}`);

const bothPlayed = rec.filter((r) => r.rawPlayed && r.gatedPlayed);
const demoted = rec.filter((r) => r.rawPlayed && !r.gatedPlayed);
const promoted = rec.filter((r) => !r.rawPlayed && r.gatedPlayed);

console.log("\n=============== WHAT THE GATES DO ===============");
console.log("                                        n       W-L    rate   units");
console.log(line("raw ladder would play", score(rec.filter((r) => r.rawPlayed))));
console.log(line("shipped (gates applied) plays", score(rec.filter((r) => r.gatedPlayed))));
console.log(line("  of which: played by both", score(bothPlayed)));
if (promoted.length) console.log(line("  !! gated-only (should be 0)", score(promoted)));

console.log("\n=============== THE DEMOTED BAND (disjoint) ===============");
console.log("  games the raw ladder plays and the gates remove:");
console.log(line("demoted by any gate", score(demoted)));
const d = score(demoted);
if (d.n) {
  const edge = d.rate - BREAKEVEN;
  console.log(`\n  vs break-even: ${(edge * 100 >= 0 ? "+" : "") + (edge * 100).toFixed(1)}pp` +
    `   (SE ${(d.se * 100).toFixed(1)}pp, z=${(edge / d.se).toFixed(2)})`);
  console.log(`  share of raw volume removed: ${pc(d.n / rec.filter((r) => r.rawPlayed).length)}`);
}

/* Which gate did the removing?
 *
 * ENUMERATE THE NOTES THAT ARE ACTUALLY THERE. The first version of this
 * section tested against a hand-written list of note strings copied out of
 * nrfiVerdict by eye, and reported "never fires" for four of five gates while
 * attributing only 34 of 102 demotions. Both halves of that were the script
 * failing to look: the strings it tested for are not the only ones the gate
 * emits, and a reason list that cannot see a reason will always call it dead.
 * The same mistake as checking syntax and calling it a check.
 *
 * So the labels come from the data. Anything demoted with no note at all is
 * reported as such rather than dropped, because a demotion nobody can explain
 * is the most interesting row here, not the least. */
console.log("\n=============== BY REASON ===============");
console.log("  (notes are read from the verdict, not guessed; a game can carry several)");
const byNote = new Map();
for (const r of demoted) {
  const keys = r.thinPass ? ["<thinPass: hidden from board>"] : [];
  for (const nt of r.notes) keys.push(nt);
  if (!keys.length) keys.push("<demoted with NO note — unexplained>");
  for (const k of keys) {
    if (!byNote.has(k)) byNote.set(k, []);
    byNote.get(k).push(r);
  }
}
const noteRows = [...byNote.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [label, band] of noteRows) {
  const s = score(band);
  const edge = s.rate - BREAKEVEN;
  const z = s.se ? edge / s.se : 0;
  console.log(line(label.slice(0, 34), s) +
    `   ${(edge * 100 >= 0 ? "+" : "") + (edge * 100).toFixed(1)}pp vs BE (z=${z.toFixed(2)})`);
}
const attributed = new Set();
for (const [, band] of noteRows) for (const r of band) attributed.add(r);
console.log(`  ${String(attributed.size).padStart(3)}/${demoted.length} demotions attributed` +
  (attributed.size === demoted.length ? "" : "   !! SOME DEMOTIONS UNEXPLAINED — the reason list is incomplete"));

/* RARE IS NOT DEAD — but read this column for exactly what it counts.
 *
 * The BY REASON table above only sees notes on games the raw ladder would have
 * PLAYED, so a gate that works all over the slate but almost never on a
 * high-probability game shows up there as a blank. Reading that blank as "this
 * gate never fires" is the guessed-reason-list error one level up: a table that
 * cannot see a firing will always call it dead. Two of these looked dead by
 * that reading and are not.
 *
 * WHAT `emitted` IS NOT. It is not how often the gate's condition holds. Every
 * push in nrfiVerdict sits inside a demotion branch and most are guarded by
 * `strength !== "PASS"`, so a game already at PASS satisfies the condition
 * silently and is never counted. Every number here is a FLOOR on how often the
 * underlying condition is true. Some notes are structurally confined further
 * still: "limited data" only fires at STRONG/BET, so its emitted / on-raw-play
 * / demotions columns are equal by construction and carry no information.
 *
 * WHAT IT DOES SETTLE. A gate emitting zero notes across the whole cache is
 * unreachable and can go. A gate that emits often but never on a raw-play game
 * is not dead code — it is demoting LEANs, which never reach the bet slate. It
 * costs nothing, buys nothing, and would only matter the day the ladder moves
 * down onto its territory. Only the first case is actionable. */
console.log("\n=============== FIRING RATE (all games, not just played) ===============");
console.log("  emitted = note actually attached; conditions true at PASS are silent, so these are FLOORS");
const fires = new Map();
for (const r of rec) {
  for (const nt of r.notes) {
    if (!fires.has(nt)) fires.set(nt, { all: 0, raw: 0, dem: 0 });
    const f = fires.get(nt);
    f.all++;
    if (r.rawPlayed) f.raw++;
    if (r.rawPlayed && !r.gatedPlayed) f.dem++;
  }
}
console.log("  note                              emitted   on raw-play   demotions");
for (const [nt, f] of [...fires.entries()].sort((a, b) => b[1].all - a[1].all)) {
  console.log("  " + nt.slice(0, 34).padEnd(36) + String(f.all).padStart(4) +
    String(f.raw).padStart(13) + String(f.dem).padStart(12) +
    (f.raw === 0 ? "   <- only ever demotes LEANs" : ""));
}
console.log(`  (${rec.length} games scored; a game can carry several notes)`);

/* The SE test applies in BOTH directions, or it is not a test.
 *
 * The first version demanded "read the SE" only when the demoted band looked
 * profitable, and declared the gates vindicated whenever it looked unprofitable
 * — a one-sided standard that converts a null result into whichever finding the
 * author already expected. The band has to clear its own noise before it says
 * anything at all, in either direction. */
console.log("\n=============== VERDICT ===============");
if (!d.n) {
  console.log("  The gates removed nothing. They are inert on this sample.");
} else {
  const edge = d.rate - BREAKEVEN;
  const z = edge / d.se;
  if (Math.abs(z) < 1.96) {
    console.log(`  NOT MEASURABLE: the demoted band hit ${pc(d.rate)} against a ${pc(BREAKEVEN)} break-even,`);
    console.log(`  a gap of ${(edge * 100 >= 0 ? "+" : "") + (edge * 100).toFixed(1)}pp with SE ${(d.se * 100).toFixed(1)}pp (z=${z.toFixed(2)}). That is a coin.`);
    console.log(`  On this sample the gates buy no measurable accuracy and cost ${pc(d.n / rec.filter((r) => r.rawPlayed).length)} of volume.`);
    console.log("  Do not read that as vindication OR as a reason to rip them out: n is too small to");
    console.log("  say. To settle it, the band needs to roughly quadruple — another full season.");
  } else if (edge < 0) {
    console.log(`  GATES EARN THEIR KEEP: the band they remove hit ${pc(d.rate)}, below the ${pc(BREAKEVEN)} break-even`);
    console.log(`  by more than noise (z=${z.toFixed(2)}). Removing it is a real gain, not just lost volume.`);
  } else {
    console.log(`  GATES COST MONEY: the band they remove hit ${pc(d.rate)}, ABOVE break-even by more than`);
    console.log(`  noise (z=${z.toFixed(2)}, ${d.units.toFixed(1)} units). They are discarding profitable bets.`);
  }
}
