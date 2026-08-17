/* Does the shipped NRFI_PARK table describe first innings, or full games?
 *
 *   node scripts/nrfi-park-table-check.js
 *
 * nrfi-park-rest.js already settled that PARK carries real first-inning signal:
 * over 14,009 games the observed spread across venues is 2.00pp against a 1.53pp
 * sampling floor, leaving ~1.29pp of true spread. That is the case FOR having a
 * park term, and it is not in dispute here.
 *
 * This asks the different and more dangerous question. NRFI_PARK's own comment
 * calls its entries "directional estimates compressed toward 1 for a single
 * inning" — i.e. they were derived from full-game park factors and squeezed, not
 * fit on first innings. Meanwhile the block that sets ENV_W_PARK = 1.00 asserts
 * park is "the best-established of the three" while measuring only temperature
 * and wind. So the weight rests on a claim nothing in the repo tested.
 *
 * A term can be real and still be WRONGLY SIGNED. If the shipped numbers do not
 * correlate with measured first-inning behaviour, then ENV_W_PARK = 1.00 is
 * applying a confident multiplier off a table that does not know which parks
 * suppress first-inning runs — which is worse than no park term, because it
 * moves probabilities with conviction in whatever direction the full-game
 * factor pointed.
 *
 * Residuals are taken against the same walk-forward pitcher model
 * nrfi-park-rest.js uses, so a park that happens to host good pitching is not
 * credited for it. Bootstrap clusters on GAME, because one game contributes two
 * half-innings at the same venue and they are not independent draws.
 */
const fs = require("fs");
const path = require("path");

const K = 75; // NRFI_PIT_REG, matching nrfi-leakfree.js and nrfi-park-rest.js
const B = 4000;
const games = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-leakfree-games.json"), "utf8")).games;
games.sort((a, b) => a.date.localeCompare(b.date) || a.pk - b.pk);

// Shipped table read from the working tree, never retyped — this script exists to
// judge the value that is actually shipping.
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
const parkM = src.match(/const NRFI_PARK = \{([\s\S]*?)\};/);
if (!parkM) throw new Error("NRFI_PARK not found in app.jsx — the shape changed, fix this reader");
const NRFI_PARK = eval("({" + parkM[1] + "})");
const wM = src.match(/const ENV_W_PARK = ([\d.]+)/);
const ENV_W_PARK = wM ? Number(wM[1]) : null;

/* venue id -> team abbreviation. Derived from the cache itself (the modal home
 * team at each venue) rather than fetched, so this runs offline and cannot be
 * broken by a franchise relocating after the fact. ATH/OAK/SAC and TB's
 * temporary park are exactly the cases a live lookup would get wrong. */
const ABBR = { 108: "LAA", 109: "AZ", 110: "BAL", 111: "BOS", 112: "CHC", 113: "CIN",
  114: "CLE", 115: "COL", 116: "DET", 117: "HOU", 118: "KC", 119: "LAD", 120: "WSH",
  121: "NYM", 133: "ATH", 134: "PIT", 135: "SD", 136: "SEA", 137: "SF", 138: "STL",
  139: "TB", 140: "TEX", 141: "TOR", 142: "MIN", 143: "PHI", 144: "ATL", 145: "CWS",
  146: "MIA", 147: "NYY", 158: "MIL" };
/* GROUPED BY HOME ABBREVIATION, NOT VENUE ID, because that is how the model
 * indexes: weatherPark does NRFI_PARK[homeAbbr]. Grouping by venue instead
 * splits a club across every building it has used — Toronto's 2021 Buffalo and
 * Dunedin games, Oakland -> Sacramento, Tampa's Steinbrenner Field year, plus
 * one-off neutral sites — and those fragments land at n=2..46 half-innings where
 * a whole-game bootstrap can draw zero distinct games and report a standard
 * error of 0.00, i.e. a t of 10^13. Those rows are not small-sample noise to be
 * flagged, they are an artefact of the wrong grouping, and pooling by the key
 * the model actually uses removes them rather than filtering them. */
const MIN_HALVES = 100; // below this a park cannot inform the table either way

// Walk-forward pitcher expectation, then one row per half-inning.
const lgClean = games.reduce((s, g) => s + g.hpClean + g.apClean, 0) / (2 * games.length);
const arm = new Map();
const get = (id) => arm.get(id) || { n: 0, c: 0 };
const halves = [];
for (const g of games) {
  const a = get(g.ap), h = get(g.hp);
  const ab = ABBR[g.home] || ("team" + g.home);
  halves.push({ pk: g.pk, venue: ab, pred: (h.c + lgClean * K) / (h.n + K), obs: g.hpClean });
  halves.push({ pk: g.pk, venue: ab, pred: (a.c + lgClean * K) / (a.n + K), obs: g.apClean });
  arm.set(g.hp, { n: h.n + 1, c: h.c + g.hpClean });
  arm.set(g.ap, { n: a.n + 1, c: a.c + g.apClean });
}

// Group half-innings by game so the bootstrap can resample whole games.
const byGame = new Map();
for (const h of halves) {
  if (!byGame.has(h.pk)) byGame.set(h.pk, []);
  byGame.get(h.pk).push(h);
}
const gameList = [...byGame.values()];

let s = 0x9e3779b9;
const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;

// Residual per venue, in pp of clean-first-inning rate. Negative = MORE runs
// than the pitchers alone predict, i.e. a run-friendly park.
const resid = (rows) => {
  const by = new Map();
  for (const h of rows) {
    if (!by.has(h.venue)) by.set(h.venue, { n: 0, d: 0 });
    const e = by.get(h.venue);
    e.n++; e.d += h.obs - h.pred;
  }
  return by;
};
const obsBy = resid(halves);

// Bootstrap over games, carried per venue.
const draws = new Map([...obsBy.keys()].map((v) => [v, []]));
for (let b = 0; b < B; b++) {
  const pool = [];
  for (let j = 0; j < gameList.length; j++) pool.push(...gameList[Math.floor(rnd() * gameList.length)]);
  const r = resid(pool);
  for (const [v, arr] of draws) { const e = r.get(v); if (e) arr.push(100 * e.d / e.n); }
}

const rows = [...obsBy.entries()].map(([ab, e]) => {
  const d = draws.get(ab);
  const m = 100 * e.d / e.n;
  const se = d.length > 1 ? Math.sqrt(mean(d.map((x) => (x - mean(d)) ** 2))) : null;
  return { ab, n: e.n, measured: m, se, shipped: NRFI_PARK[ab] };
}).filter((r) => r.n >= MIN_HALVES && r.se > 0)
  .sort((a, b) => a.measured - b.measured);

console.log(`${games.length} games, ${halves.length} half-innings, league clean ${(lgClean * 100).toFixed(1)}%`);
console.log(`ENV_W_PARK as shipped: ${ENV_W_PARK}   (1.00 = park factor applied at full strength)`);
console.log(`bootstrap B=${B}, resampling whole games\n`);
console.log("  venue        n   measured (pp clean)      t     shipped   implies");
for (const r of rows) {
  // The shipped table is a lambda multiplier: >1 = more runs = FEWER clean, so a
  // consistent table has shipped>1 paired with measured<0.
  const implies = r.shipped == null ? "  (not in table)"
    : r.shipped > 1 ? "more runs" : r.shipped < 1 ? "fewer runs" : "neutral";
  const agree = r.shipped == null || r.shipped === 1 ? " " :
    ((r.shipped > 1 && r.measured < 0) || (r.shipped < 1 && r.measured > 0)) ? "." : "X";
  console.log(`  ${(r.ab || "?").padEnd(5)}${String(r.n).padStart(7)}` +
    `${((r.measured >= 0 ? "+" : "") + r.measured.toFixed(2)).padStart(11)}` +
    ` +- ${r.se.toFixed(2)}` +
    `${(r.se > 0 ? (r.measured / r.se).toFixed(2) : "-").padStart(8)}` +
    `${(r.shipped == null ? "-" : r.shipped.toFixed(2)).padStart(10)}   ${implies.padEnd(11)}${agree}`);
}

/* The correlation is the verdict. If the shipped table encoded first-inning
 * behaviour, (shipped - 1) would run OPPOSITE to the measured residual, giving a
 * clearly negative r. Near zero means the table is uninformative about the thing
 * it is multiplying, and ENV_W_PARK = 1.00 is spending full conviction on it. */
const paired = rows.filter((r) => r.shipped != null);
const xs = paired.map((r) => r.shipped - 1), ys = paired.map((r) => r.measured);
const mx = mean(xs), my = mean(ys);
const cov = mean(xs.map((x, i) => (x - mx) * (ys[i] - my)));
const r = cov / (Math.sqrt(mean(xs.map((x) => (x - mx) ** 2))) * Math.sqrt(mean(ys.map((y) => (y - my) ** 2))));
// Weighted by half-innings, so a 270-half-inning park does not count as much as
// a 930-half-inning one.
const W = paired.reduce((a, p) => a + p.n, 0);
const wmx = paired.reduce((a, p) => a + p.n * (p.shipped - 1), 0) / W;
const wmy = paired.reduce((a, p) => a + p.n * p.measured, 0) / W;
const wcov = paired.reduce((a, p) => a + p.n * (p.shipped - 1 - wmx) * (p.measured - wmy), 0) / W;
const wr = wcov / (Math.sqrt(paired.reduce((a, p) => a + p.n * (p.shipped - 1 - wmx) ** 2, 0) / W) *
  Math.sqrt(paired.reduce((a, p) => a + p.n * (p.measured - wmy) ** 2, 0) / W));

console.log(`\n  '.' = shipped direction matches measurement, 'X' = shipped points the WRONG way`);
console.log(`  agree ${paired.filter((p) => (p.shipped > 1 && p.measured < 0) || (p.shipped < 1 && p.measured > 0)).length}` +
  ` / disagree ${paired.filter((p) => (p.shipped > 1 && p.measured > 0) || (p.shipped < 1 && p.measured < 0)).length}` +
  ` of ${paired.length} parks in the table`);
/* With a deliberately short table there is nothing to correlate — one or two
 * entries give a 0/0 standard deviation and printing NaN here reads as a broken
 * script rather than a table that was intentionally trimmed. The measured column
 * above is still the useful output in that case. */
if (paired.length >= 5) {
  console.log(`\n  correlation (shipped-1) vs measured residual: r = ${r.toFixed(3)}   weighted r = ${wr.toFixed(3)}`);
  console.log("  A table that described first innings would sit clearly NEGATIVE here.");
} else {
  console.log(`\n  only ${paired.length} park(s) in NRFI_PARK — too few to correlate, skipping.`);
  console.log("  Compare the measured column against what the table chose to keep.");
}

// What keeping ONE park would cost: how much of the measured spread it carries.
/* "What does a short table give up" has to be measured over every park the model
 * will actually encounter, not over the parks still listed in it — otherwise
 * trimming the table shrinks the very set used to judge the trim, and the answer
 * goes to 0/0 the moment one entry is left. rows = all measured parks. */
const rmsOver = (set) => Math.sqrt(set.reduce((a, p) => a + p.n * p.measured ** 2, 0) / set.reduce((a, p) => a + p.n, 0));
const kept = rows.filter((r) => r.shipped != null && r.shipped !== 1).map((r) => r.ab);
const dropped = rows.filter((r) => !kept.includes(r.ab));
console.log(`\n  table carries ${kept.length} non-neutral park(s): ${kept.join(", ") || "(none)"}`);
for (const ab of kept) {
  const one = rows.find((x) => x.ab === ab);
  console.log(`    ${ab}: measured ${one.measured.toFixed(2)}pp +- ${one.se.toFixed(2)} (t ${(one.measured / one.se).toFixed(2)}), n=${one.n}`);
}
if (dropped.length) {
  console.log(`  rms measured effect over all ${rows.length} parks ${rmsOver(rows).toFixed(2)}pp;` +
    ` over the ${dropped.length} left neutral ${rmsOver(dropped).toFixed(2)}pp`);
  const strong = dropped.filter((d) => Math.abs(d.measured / d.se) >= 2);
  console.log(`  of those, ${strong.length} still clear |t| >= 2: ` +
    (strong.map((d) => `${d.ab} ${d.measured.toFixed(2)}pp t ${(d.measured / d.se).toFixed(2)}`).join(", ") || "none"));
}
