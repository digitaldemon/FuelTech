/* The 74 legs of his we rank in our own bottom half — the list, one line each.
 *
 * nrfi-tout-vs-model.js reports that 22.7% of NRFIKINGKY's NRFI legs land below
 * the median of OUR ranking of the same slate, and that he runs +10.5pts over
 * band peers there. That cell is the whole "does he have signal we lack"
 * question, and it is currently 1.7se — nowhere near enough to act on. So the
 * useful thing is not another summary statistic, it is the games themselves.
 *
 * Percentile is computed exactly as the parent script does: within the day, so
 * our overall level being off cannot move it — only the ordering matters.
 *
 *   node scripts/nrfi-tout-bottom-half.js            list + contrast
 *   node scripts/nrfi-tout-bottom-half.js --csv      same rows as CSV
 *
 * CAVEAT that travels with every number here: the cached p is NOT walk-forward.
 * Pitcher first-inning splits are rewound to the scored date, but season ERA/IP,
 * team offence, top-of-order OBP and Statcast are not. His record IS
 * walk-forward. So "we ranked it low" may partly mean "we ranked it low using
 * information we would not have had", and that cuts against us, not for us.
 */
const fs = require("fs");
const path = require("path");

const cache = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-tout-vs-model.json"), "utf8"));
const slates = new Map(cache.slates);
const legsByDate = new Map(cache.byDate);
const asCsv = process.argv.includes("--csv");

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pc1 = (x) => (x * 100).toFixed(1);

// Join his legs to our score on the same game, carrying the day's slate so the
// percentile is computed against exactly what we saw that morning.
const joined = [];
for (const [date, legs] of legsByDate) {
  const slate = slates.get(date);
  if (!slate || slate.length < 4) continue;
  const byPk = new Map(slate.map((g) => [g.gamePk, g]));
  for (const leg of legs) {
    if (leg.side !== "NRFI") continue;
    const g = byPk.get(leg.gamePk);
    if (!g) continue;
    const below = slate.filter((x) => x.p < g.p).length;
    const ties = slate.filter((x) => x.p === g.p).length;
    joined.push({
      date, g, slate,
      pctl: (below + ties / 2) / slate.length,
      rank: slate.filter((x) => x.p > g.p).length + 1,
    });
  }
}

const bottom = joined.filter((j) => j.pctl < 0.5).sort((a, b) => a.pctl - b.pctl);
const top = joined.filter((j) => j.pctl >= 0.5);

if (asCsv) {
  console.log("date,game,gamePk,our_p,our_pctl,our_rank,slate_n,result,thin_away,thin_home");
  for (const j of bottom) {
    console.log([j.date, j.g.label, j.g.gamePk, j.g.p.toFixed(4), j.pctl.toFixed(3),
      j.rank + "/" + j.slate.length, j.slate.length, j.g.actual ? "NRFI (he won)" : "run (he lost)",
      j.g.thinAway ? 1 : 0, j.g.thinHome ? 1 : 0].join(","));
  }
  process.exit(0);
}

console.log("HIS LEGS THAT LAND IN OUR BOTTOM HALF — " + bottom.length + " of " + joined.length +
  " (" + pc1(bottom.length / joined.length) + "%)\n");
console.log("date        game       our p    pctl  rank    result        thin");
console.log("-".repeat(72));
for (const j of bottom) {
  console.log(
    j.date + "  " + j.g.label.padEnd(9) + "  " + pc1(j.g.p).padStart(5) + "%  " +
    pc1(j.pctl).padStart(5) + "%  " + (j.rank + "/" + j.slate.length).padEnd(6) + "  " +
    (j.g.actual ? "NRFI  he won " : "run   he lost").padEnd(13) + " " +
    [j.g.thinAway ? "away" : "", j.g.thinHome ? "home" : ""].filter(Boolean).join("+")
  );
}

/* LEGS ARE NOT GAMES, and the difference is not cosmetic here.
 *
 * He bets the same game more than once — MIA@ATL on 2026-08-04 appears four
 * times, CHC@PHI on 2026-04-15 four times. Counted as legs, one game's outcome
 * is entered four times into a 74-row sample, so a single result moves the rate
 * by 5pts and the effective sample is far smaller than the row count implies.
 * Every rate below is therefore reported BOTH ways, and the deduped one is the
 * one to quote. */
const uniq = (a) => [...new Map(a.map((j) => [j.g.gamePk, j])).values()];
const rec = (a) => {
  const w = a.filter((j) => j.g.actual).length;
  return w + "-" + (a.length - w) + " (" + pc1(w / a.length) + "%)";
};
const ub = uniq(bottom), ut = uniq(top);
console.log("\n  his record here      as legs  " + rec(bottom).padEnd(16) +
  "as distinct games  " + rec(ub) + "   [" + bottom.length + " legs, " + ub.length + " games]");
console.log("  his top-half legs    as legs  " + rec(top).padEnd(16) +
  "as distinct games  " + rec(ut) + "   [" + top.length + " legs, " + ut.length + " games]");
console.log("  the full slate       " + pc1(mean([...slates.values()].flat().map((g) => (g.actual ? 1 : 0)))) + "%");
console.log("\n  our mean p on them              " + pc1(mean(bottom.map((j) => j.g.p))) + "%");
console.log("  our mean p on his top-half legs " + pc1(mean(top.map((j) => j.g.p))) + "%");

/* THE READ, and it goes against the tentative one in the parent script.
 *
 * nrfi-tout-vs-model.js reports +10.5pts over band peers in our bottom half and
 * flags it as possible signal we lack. Deduped and in ABSOLUTE terms that
 * evaporates: he is near the slate base rate in the games we rank low, and
 * ~15pts above it in the games we rank high. He beats band peers down there
 * only because our bottom half is genuinely bad. Being ordinary in games we
 * dislike is not evidence of a signal we are missing.
 *
 * If that holds up, this is a FILTER problem, not a DIRECTION problem — the fix
 * is the verdict ladder and selection, and touching the factors would make
 * things worse. */
const base = mean([...slates.values()].flat().map((g) => (g.actual ? 1 : 0)));
const overBotDedup = mean(ub.map((j) => (j.g.actual ? 1 : 0))) - base;
const overTopDedup = mean(ut.map((j) => (j.g.actual ? 1 : 0))) - base;
console.log("\n  over the slate base rate, deduped:  bottom half " +
  (overBotDedup >= 0 ? "+" : "") + pc1(overBotDedup) + "pts   top half " +
  (overTopDedup >= 0 ? "+" : "") + pc1(overTopDedup) + "pts");
console.log("  -> " + (overBotDedup < 3
  ? "his edge lives ENTIRELY in games we already rank high. FILTER problem, not direction."
  : "he is genuinely ahead of the base rate in games we rank low — direction problem, investigate."));

/* WHICH FACTOR IS DOING THE DISAGREEING?
 *
 * Every factor is a multiplier centred near 1. If our bottom-half read of his
 * games is driven by one term, that term should sit systematically lower on
 * these legs than on the ones we agree with. This is descriptive only — 74
 * games against 252, thirty-odd factors, no multiplicity correction. It says
 * where to look next, not what is true. */
const KEYS = Object.keys(bottom[0].g.factors || {});
const rows = KEYS.map((k) => {
  const b = bottom.map((j) => j.g.factors[k]).filter(Number.isFinite);
  const t = top.map((j) => j.g.factors[k]).filter(Number.isFinite);
  if (!b.length || !t.length) return null;
  const mb = mean(b), mt = mean(t);
  // Pooled sd, for a rough standardised gap. Not a test.
  const all = b.concat(t), ma = mean(all);
  const sd = Math.sqrt(mean(all.map((x) => (x - ma) ** 2)));
  return { k, mb, mt, d: mb - mt, z: sd > 1e-9 ? (mb - mt) / sd : 0 };
}).filter(Boolean).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

console.log("\nWHERE OUR FACTORS DIFFER on his bottom-half legs vs his top-half legs");
console.log("(descriptive only: 74 vs 252 games across " + KEYS.length +
  " factors, no multiplicity correction)\n");
console.log("  factor            bottom    top     gap     gap/sd");
for (const r of rows.slice(0, 10)) {
  console.log("  " + r.k.padEnd(16) + r.mb.toFixed(4).padStart(7) + "  " +
    r.mt.toFixed(4).padStart(7) + "  " + (r.d >= 0 ? "+" : "") + r.d.toFixed(4).padStart(7) +
    "  " + (r.z >= 0 ? "+" : "") + r.z.toFixed(2));
}

// Thin arms are the cheapest explanation and deserve checking before any factor
// story: a game we rank low because a starter has almost no first-inning history
// is not a game we disagree about, it is a game we declined to have an opinion on.
const thinB = bottom.filter((j) => j.g.thinAway || j.g.thinHome).length;
const thinT = top.filter((j) => j.g.thinAway || j.g.thinHome).length;
console.log("\n  at least one thin arm:  bottom half " + thinB + "/" + bottom.length +
  " (" + pc1(thinB / bottom.length) + "%)   top half " + thinT + "/" + top.length +
  " (" + pc1(thinT / top.length) + "%)");

// How often does he go back to a game we rank low? A repeat is him disagreeing
// with us on purpose; a one-off is a slate where everything was close.
const byGame = new Map();
for (const j of bottom) {
  const t = j.g.label.split("@");
  for (const team of t) byGame.set(team, (byGame.get(team) || 0) + 1);
}
const repeat = [...byGame].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]);
if (repeat.length) {
  console.log("\n  teams appearing 4+ times in the bottom-half list:");
  console.log("    " + repeat.map(([t, n]) => t + " " + n).join("   "));
}
