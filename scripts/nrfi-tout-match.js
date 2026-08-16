// Do OUR picks match NRFIKINGKY's — and are we right when they do?
//
//   node scripts/nrfi-tout-match.js [baseline-cache] [variant-cache]
//   node scripts/nrfi-tout-match.js nrfi-tout-vs-model.json nrfi-tout-vs-model.env-w-0.5.json
//
// This is the question the desk owner keeps asking, and it is NOT the question
// Brier answers. A model can improve its Brier while agreeing with him less, and
// a model can agree with him more while losing money. So this reports both, side
// by side, and refuses to collapse them into one score.
//
// WHY AGREEMENT IS NOT THE GOAL ON ITS OWN. Copying a tout's picks is only worth
// doing if the tout is right, and "he is right" is a claim with a standard error
// on it. He grades 208-121 (63.2%) on 329 first-inning legs, which is real, so
// agreement here is worth chasing — but the moment a tilt raises agreement while
// lowering our own hit rate on our own picks, it is copying his LABELS and not
// his REASONING, and that is the failure this table exists to catch.
//
// THE ASYMMETRY THAT MAKES RECALL THE HONEST METRIC. He posts a handful of legs
// a night out of a full slate. Our board scores every game. So "what fraction of
// our picks are his" is mostly a statement about how many picks we make, and can
// be gamed to 100% by picking less. "What fraction of HIS legs do we also like"
// cannot be gamed that way without also picking nearly everything, which the
// volume column makes visible. Read recall against volume, never alone.

const fs = require("fs");
const path = require("path");

const BAR = 1.96;
const load = (arg) => {
  const p = path.isAbsolute(arg) ? arg : path.join(__dirname, arg);
  if (!fs.existsSync(p)) { console.error("no such cache: " + p); process.exit(2); }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!j.slates || !j.byDate) { console.error(p + " is not a tout-vs-model cache"); process.exit(2); }
  return { name: path.basename(p), j };
};

const A = load(process.argv[2] || "nrfi-tout-vs-model.json");
const Bv = process.argv[3] ? load(process.argv[3]) : null;

// His NRFI legs, keyed the way the profile script keys them.
const hisOf = (j) => {
  const s = new Set();
  for (const [date, picks] of j.byDate)
    for (const x of picks) if (x.side === "NRFI" && x.gamePk != null) s.add(date + ":" + x.gamePk);
  return s;
};

// Our scored games, with his flag attached.
const gamesOf = (j) => {
  const his = hisOf(j);
  const out = [];
  for (const [date, gs] of j.slates)
    for (const g of gs) {
      if (!Number.isFinite(g.p)) continue;
      out.push({ date, gamePk: g.gamePk, p: g.p, y: g.actual, his: his.has(date + ":" + g.gamePk) });
    }
  // Dedupe on gamePk, keeping the first — the cache can repeat a game across
  // slate entries and a doubled leg would double-count in every rate below.
  return [...new Map(out.map((r) => [r.gamePk, r])).values()];
};

const pct = (x) => (100 * x).toFixed(1) + "%";
const wilsonHalf = (p, n) => (n ? BAR * Math.sqrt((p * (1 - p)) / n) : 0);

function report(tag, j) {
  const rows = gamesOf(j);
  const his = rows.filter((r) => r.his);
  const graded = rows.filter((r) => r.y === 0 || r.y === 1);
  const hisGraded = graded.filter((r) => r.his);

  console.log(`\n================ ${tag} ================`);
  console.log(`  model ${j.modelSig}   ${rows.length} games scored, ${his.length} of them his NRFI legs`);
  if (!his.length) { console.log("  no tout legs joined — nothing to compare"); return null; }

  // What our board thinks of the games he picked.
  const meanHis = his.reduce((s, r) => s + r.p, 0) / his.length;
  const meanRest = rows.filter((r) => !r.his).reduce((s, r, _, a) => s + r.p / a.length, 0);
  console.log(`  our mean p on HIS legs      ${pct(meanHis)}`);
  console.log(`  our mean p on everything else ${pct(meanRest)}`);

  const hisHit = hisGraded.filter((r) => r.y === 1).length / (hisGraded.length || 1);
  console.log(`  his legs actually landed    ${pct(hisHit)} on ${hisGraded.length} graded`);

  // The table. At each threshold: how much do we bet, how much of his book do we
  // cover, and are we right.
  console.log("\n   our NRFI gate     our vol   recall of his   our hit rate      his legs we take");
  const out = {};
  for (const th of [0.50, 0.52, 0.55, 0.57, 0.60]) {
    const ours = graded.filter((r) => r.p >= th);
    const overlap = ours.filter((r) => r.his);
    const recall = hisGraded.length ? overlap.length / hisGraded.length : 0;
    const hit = ours.length ? ours.filter((r) => r.y === 1).length / ours.length : 0;
    const h = wilsonHalf(hit, ours.length);
    console.log(`   p >= ${th.toFixed(2)}       ${String(ours.length).padStart(6)}   ${pct(recall).padStart(13)}   ` +
      `${(pct(hit) + " +/-" + (100 * h).toFixed(1)).padStart(16)}   ${String(overlap.length).padStart(6)}/${hisGraded.length}`);
    out[th] = { vol: ours.length, recall, hit, h, overlap: overlap.length };
  }
  console.log(`\n   for reference, HIS OWN legs hit ${pct(hisHit)} +/-${(100 * wilsonHalf(hisHit, hisGraded.length)).toFixed(1)}`);
  return { rows, hisGraded, out, hisHit };
}

const ra = report(A.name, A.j);
const rb = Bv ? report(Bv.name, Bv.j) : null;

if (ra && rb) {
  console.log("\n================ BASELINE vs VARIANT ================");
  // Paired on gamePk: the two caches score the same games, so every difference
  // below is the model and not the sample. Anything unmatched is reported rather
  // than dropped quietly.
  const mb = new Map(rb.rows.map((r) => [r.gamePk, r]));
  const pair = ra.rows.filter((r) => mb.has(r.gamePk)).map((r) => ({ a: r, b: mb.get(r.gamePk) }));
  console.log(`  paired on ${pair.length} games (baseline had ${ra.rows.length}, variant ${rb.rows.length})`);
  if (pair.length < 0.98 * Math.max(ra.rows.length, rb.rows.length)) {
    console.log("  WARNING: the two caches do not cover the same book; read the deltas with that in mind.");
  }

  const dp = pair.map((x) => x.b.p - x.a.p);
  const moved = dp.filter((d) => Math.abs(d) > 1e-9).length;
  console.log(`  p moved on ${moved}/${pair.length} games, mean |dp| ${(100 * dp.reduce((s, d) => s + Math.abs(d), 0) / dp.length).toFixed(3)} pts`);
  if (!moved) {
    console.log("  the two caches are identical game for game — the variant did not reach the model.");
    process.exit(1);
  }

  // Did the tilt move HIS legs up relative to everything else? That is the
  // mechanism a "pick more like him" change has to work through: not a uniform
  // shift, which changes nothing about ordering, but a RELATIVE lift on his book.
  const hisPairs = pair.filter((x) => x.a.his), restPairs = pair.filter((x) => !x.a.his);
  const mHis = hisPairs.reduce((s, x) => s + (x.b.p - x.a.p), 0) / (hisPairs.length || 1);
  const mRest = restPairs.reduce((s, x) => s + (x.b.p - x.a.p), 0) / (restPairs.length || 1);
  console.log(`\n  mean dp on HIS legs        ${(100 * mHis >= 0 ? "+" : "") + (100 * mHis).toFixed(3)} pts`);
  console.log(`  mean dp on everything else ${(100 * mRest >= 0 ? "+" : "") + (100 * mRest).toFixed(3)} pts`);
  console.log(`  RELATIVE lift on his book  ${(100 * (mHis - mRest) >= 0 ? "+" : "") + (100 * (mHis - mRest)).toFixed(3)} pts`);
  console.log("  A uniform shift moves both columns equally and changes no ordering. Only the");
  console.log("  relative lift can make our board agree with him more.");

  console.log("\n   gate      recall base -> var        our hit base -> var        vol base -> var");
  for (const th of [0.50, 0.52, 0.55, 0.57, 0.60]) {
    const a = ra.out[th], b = rb.out[th];
    const dR = b.recall - a.recall, dH = b.hit - a.hit;
    console.log(`   ${th.toFixed(2)}    ${pct(a.recall).padStart(6)} -> ${pct(b.recall).padStart(6)}  ${((dR >= 0 ? "+" : "") + (100 * dR).toFixed(1)).padStart(6)}    ` +
      `${pct(a.hit).padStart(6)} -> ${pct(b.hit).padStart(6)}  ${((dH >= 0 ? "+" : "") + (100 * dH).toFixed(1)).padStart(6)}    ` +
      `${String(a.vol).padStart(5)} -> ${String(b.vol).padStart(5)}`);
  }
  console.log("\n  READ IT THIS WAY. Recall up AND hit rate flat-or-up at similar volume is the");
  console.log("  only pattern that means the tilt learned something from him. Recall up with hit");
  console.log("  rate down means it copied his labels, not his reasoning. Both up with volume up");
  console.log("  means it just bets more, which the base rate would also do.");
}
