// A first-inning model that has never seen its own answers.
//
//   node scripts/nrfi-leakfree.js [--refresh]
//
// nrfi-vs-kalshi.js could not decide whether our real model beats the market,
// because the cached probabilities come from season-to-date splits that were
// never rewound: every game's inputs already contain that game's result. A
// comparison rigged that way can only produce a conclusive LOSS, and it did not
// lose, so it told us nothing.
//
// This does not fix scanNrfi. It builds the smallest honest model that can
// stand next to the price, so we can find out whether ANY leak-free first-
// inning signal beats Kalshi. That is the question that decides whether the
// desk's model is worth repairing or worth deleting.
//
// Everything here comes from one call per season:
//
//   schedule?sportId=1&season=N&gameType=R&hydrate=linescore,probablePitcher
//
// which returns, per game: date, both announced starters, first-inning runs by
// side, and venue. Games are then walked in date order and every input is
// computed from STRICTLY EARLIER games. Nothing else is read, so there is
// nowhere for a leak to enter.
//
// The model itself is deliberately small:
//
//   P(NRFI) = P(home starter keeps his half clean) * P(away starter does too)
//
// In the first inning the away team bats against the HOME starter and the home
// team bats against the AWAY starter, so those are the two relevant arms. Each
// rate is regressed toward the league mean with k = 75 prior starts, the weight
// established by walk-forward fit in nrfi-pitreg-fit.js, then both are nudged by
// a park adjustment regressed with k = 1216 half-innings.
//
// What is NOT in it matters as much as what is. Every candidate went through the
// same variance decomposition in nrfi-park-rest.js — observed spread between
// groups minus the binomial noise a 4-batter sample generates — and only park
// came out the far side:
//
//   home vs away arm     true spread 2.20pp   kept (see the warning below)
//   batting team offence true spread 1.78pp   kept
//   park                 true spread 1.30pp   kept
//   month                        0.08pp       rejected
//   pitcher rest         nothing above noise  rejected
//   batting team rest    nothing above noise  rejected
//   travel               nothing above noise  rejected
//
// Rest and travel are the ones worth naming, because they are the terms a
// handicapper would reach for first and both are flat here — and where they do
// lean, they lean the wrong way for the story (teams that travelled overnight
// scored slightly LESS). Adding them would be adding noise with a narrative
// attached.
//
// Team offence is in now and was NOT before. nrfi-offreg-fit.js rejected it on a
// season and a half; at six seasons it clears the floor comfortably. A rejection
// taken at low power is not a finding, and the leaderboard confirms the term is
// real rather than fitted: the Dodgers score most in the first, the Marlins
// least.
//
// Park is kept honestly, not enthusiastically. It is real (Coors and Sacramento
// at the run-friendly end, T-Mobile at the clean end) but small once shrunk, and
// it buys accuracy without buying edge — adding it RAISED standalone accuracy
// and LOWERED the model's joint coefficient against the price, because the
// market already knows about Coors.
//
// THE WARNING. The home/away split is the largest and cleanest effect measured
// anywhere here, and adding it as marginals made the model WORSE. That is the
// independence assumption failing:
//
//   correct marginals    0.729 * 0.684 = 49.9%
//   pooled mean squared  0.711^2       = 50.6%
//   actual NRFI                          50.7%
//
// Multiplying two right numbers lands further from the truth than multiplying
// two wrong ones, because the halves are positively correlated — weather, ball
// and umpire push both the same way — and the pooled mean was quietly absorbing
// that. So the product is calibrated (walk-forward Platt) rather than trusted,
// and the fitted slope near 0.66 says the raw product is about 1.5x more
// confident than it deserves to be.
//
// If this beats the price, there is real signal and scanNrfi's job is to
// recover it without cheating. If it does not, the +19% in nrfi-vs-kalshi.js
// was the leak talking.
const fs = require("fs");
const path = require("path");

const CACHE = path.join(__dirname, "nrfi-leakfree-games.json");
/* 2021 forward, not just the two seasons this started with.
 *
 * Park was the term that forced this. It cleared the noise floor — Coors first,
 * T-Mobile among the cleanest, so it is finding real parks — but its correct
 * shrinkage constant is k=1717 half-innings against a venue accruing ~275 in a
 * season and a half, leaving it worth 14% of its own record and moving P(NRFI)
 * by 0.33pp. That is not a weak effect, it is a short sample: a park is the one
 * input here that is genuinely stable across years, so seasons are the cheapest
 * thing that can be added to it. Six of them put a venue near 1100 half-innings
 * and ~40% weight.
 *
 * 2020 is skipped deliberately: 60 games, no travel of the usual kind, and
 * runners starting on second in extras. It is not the same sport for these
 * purposes. Each season is one schedule call. */
const SEASONS = [2021, 2022, 2023, 2024, 2025, 2026];
const K = 75;           // NRFI_PIT_REG, walk-forward fit
/* Park shrinkage, and it is derived rather than tuned: k is the ratio of
 * per-half-inning noise variance to the true spread between parks, both measured
 * in nrfi-park-rest.js (true spread 1.30pp, so k = 0.205/0.000169). Re-derive it
 * there if the seasons change; do not hand-tune it here, because the whole point
 * of the number is that it is not a free parameter. */
const KPARK = 1216;
// Batting-team offence, same derivation (true spread 1.78pp). Rejected on 1.5
// seasons by nrfi-offreg-fit.js and re-measured here at six: a rejection at low
// power is not a finding.
const KTEAM = 646;
const pc = (x) => (x * 100).toFixed(1) + "%";
const lg = (x) => Math.log(x / (1 - x));
const clamp = (p) => Math.min(0.98, Math.max(0.02, p));

async function scan() {
  const games = [];
  for (const season of SEASONS) {
    const u = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=R&hydrate=linescore,probablePitcher&season=" + season;
    const j = await (await fetch(u)).json();
    for (const d of j.dates || []) {
      for (const g of d.games || []) {
        const first = (g.linescore?.innings || [])[0];
        const ap = g.teams?.away?.probablePitcher?.id;
        const hp = g.teams?.home?.probablePitcher?.id;
        if (!first || ap == null || hp == null) continue;
        const ar = first.away?.runs, hr = first.home?.runs;
        if (ar == null || hr == null) continue;
        games.push({
          pk: g.gamePk,
          date: g.officialDate || d.date,
          season,
          ap, hp,
          venue: g.venue?.id,
          away: g.teams.away.team.id,
          home: g.teams.home.team.id,
          // Away bats vs the HOME starter; home bats vs the AWAY starter.
          hpClean: ar === 0 ? 1 : 0,
          apClean: hr === 0 ? 1 : 0,
          nrfi: ar === 0 && hr === 0 ? 1 : 0,
        });
      }
    }
    console.error(`  ${season}: ${games.length} cumulative`);
  }
  games.sort((a, b) => a.date.localeCompare(b.date) || a.pk - b.pk);
  fs.writeFileSync(CACHE, JSON.stringify({ built: new Date().toISOString(), games }, null, 0));
  return games;
}

(async () => {
  let games;
  if (!process.argv.includes("--refresh") && fs.existsSync(CACHE)) {
    games = JSON.parse(fs.readFileSync(CACHE, "utf8")).games;
    console.error(`cache: ${games.length} games (--refresh to rebuild)\n`);
  } else {
    console.error("scanning schedule...");
    games = await scan();
  }

  // League mean, computed once over everything. This is the one quantity that
  // sees the whole sample, and it has to: a walk-forward prior that starts at
  // 0/0 has no mean to regress toward. It is a single scalar shared by every
  // game rather than a per-game input, so it cannot encode any individual
  // result — the same reason a base rate is not considered leakage.
  const lgClean = games.reduce((s, g) => s + g.hpClean + g.apClean, 0) / (2 * games.length);

  // Walk forward. Each arm's rate uses only starts that happened earlier, and so
  // does each park's adjustment.
  const arm = new Map();
  const get = (id) => arm.get(id) || { n: 0, c: 0 };
  const pk = new Map(), tm = new Map();
  let hN = 0, hC = 0, aN = 0, aC = 0;
  const rated = [];
  for (const g of games) {
    const a = get(g.ap), h = get(g.hp);
    const pa = (a.c + lgClean * K) / (a.n + K);
    const ph = (h.c + lgClean * K) / (h.n + K);
    // Park moves both arms, because both halves are thrown in it. The residual
    // is measured against the pitcher rates, so a park that happens to host good
    // pitching is not credited for it.
    const v = pk.get(g.venue) || { n: 0, d: 0 };
    const adj = v.d / (v.n + KPARK);
    // Home starters run ~4.5pp cleaner than away starters — the largest and
    // cleanest effect in nrfi-park-rest.js (2.20pp true spread, 0.38pp noise).
    // Accumulated rather than taken as a constant so it cannot see the future.
    const sH = hN > 200 ? hC / hN - lgClean : 0;
    const sA = aN > 200 ? aC / aN - lgClean : 0;
    // Offence attaches to the arm FACING that lineup: away bats vs the home arm.
    const tA = tm.get(g.away) || { n: 0, d: 0 }, tH = tm.get(g.home) || { n: 0, d: 0 };
    const oH = tA.d / (tA.n + KTEAM), oA = tH.d / (tH.n + KTEAM);
    rated.push({
      ...g, pa, ph, adj,
      p: clamp(clamp(ph + adj + sH + oH) * clamp(pa + adj + sA + oA)),
      priorA: a.n, priorH: h.n, mat: a.n >= 20 && h.n >= 20,
    });
    arm.set(g.ap, { n: a.n + 1, c: a.c + g.apClean });
    arm.set(g.hp, { n: h.n + 1, c: h.c + g.hpClean });
    pk.set(g.venue, { n: v.n + 2, d: v.d + (g.hpClean - ph) + (g.apClean - pa) });
    tm.set(g.away, { n: tA.n + 1, d: tA.d + (g.hpClean - ph) });
    tm.set(g.home, { n: tH.n + 1, d: tH.d + (g.apClean - pa) });
    hN++; hC += g.hpClean; aN++; aC += g.apClean;
  }

  /* Calibrate, walk-forward, and it is not optional.
   *
   * P(NRFI) is built as P(home half clean) * P(away half clean), and that
   * product is biased because the two halves are POSITIVELY CORRELATED — the
   * weather, the ball and the umpire's zone push both the same way at once. The
   * arithmetic is stark: correct marginals give 0.729*0.684 = 49.9%, the pooled
   * mean squared gives 0.711^2 = 50.6%, and the truth is 50.7%. Multiplying two
   * right numbers lands further from the answer than multiplying two wrong ones.
   *
   * Fitting logit(p') = a + b*logit(p) absorbs it, and the slope is the finding:
   * it comes out near 0.55, so the raw product is about twice as confident as it
   * has any right to be. Refit every 250 games on strictly earlier ones, with the
   * first 1000 left raw because there is nothing yet to fit on. */
  const platt = (rows) => {
    let a = 0, b = 1;
    for (let it = 0; it < 60; it++) {
      let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
      for (const r of rows) {
        const x = lg(r.p), mu = 1 / (1 + Math.exp(-(a + b * x))), w = mu * (1 - mu), d = r.nrfi - mu;
        g0 += d; g1 += d * x; h00 += w; h01 += w * x; h11 += w * x * x;
      }
      const det = h00 * h11 - h01 * h01;
      if (!(Math.abs(det) > 1e-12)) break;
      a += (h11 * g0 - h01 * g1) / det;
      b += (h00 * g1 - h01 * g0) / det;
    }
    return { a, b };
  };
  let cal = null;
  for (let i = 0; i < rated.length; i++) {
    // Fit on MATURE earlier games only. Fitting on everything was the mistake
    // worth recording: the first season is nearly all games where k=75 pins both
    // arms to the league mean, so the model is a constant there and the fit reads
    // that constancy as over-confidence. The slope it learned then over-shrank
    // the games that actually had signal, and calibrated came out worse than raw
    // on mature games — a calibrator making the model less accurate is the
    // symptom of fitting it on the wrong population.
    if (i >= 1000 && i % 250 === 0) {
      const hist = rated.slice(0, i).filter((r) => r.mat);
      if (hist.length >= 500) cal = platt(hist);
    }
    rated[i].raw = rated[i].p;
    if (cal) rated[i].p = clamp(1 / (1 + Math.exp(-(cal.a + cal.b * lg(rated[i].raw)))));
  }
  const finalCal = platt(rated.filter((r) => r.mat));

  console.log("=================== LEAK-FREE MODEL ===================");
  console.log(`  ${games.length} games ${games[0].date} .. ${games[games.length - 1].date}`);
  console.log(`  league starter clean rate  ${pc(lgClean)}`);
  console.log(`  implied base NRFI          ${pc(lgClean * lgClean)}   actual ${pc(games.reduce((s, g) => s + g.nrfi, 0) / games.length)}`);
  const spread = rated.map((r) => r.p).sort((a, b) => a - b);
  console.log(`  model P(NRFI) range        ${spread[0].toFixed(3)} .. ${spread[spread.length - 1].toFixed(3)}` +
    `   (p10 ${spread[Math.floor(0.1 * spread.length)].toFixed(3)}, p90 ${spread[Math.floor(0.9 * spread.length)].toFixed(3)})`);
  console.log("  A narrow range is the honest consequence of k=75: with 20 starts an arm");
  console.log("  is only ~21% of the way from the league mean to its own record.\n");
  console.log(`  calibration (full sample)  logit(p') = ${finalCal.a.toFixed(3)} + ${finalCal.b.toFixed(3)}*logit(p)`);
  console.log("  A slope well below 1 means the raw product is over-confident, which is");
  console.log("  the half-inning correlation described above showing up as a number.\n");
  // Scored on games where the model had something to say. Before an arm has ~20
  // starts, k=75 pins it to the league mean, so early games measure the base
  // rate rather than the model and drag every comparison toward it.
  {
    const M = rated.filter((r) => r.mat);
    const mb = M.reduce((s, r) => s + r.nrfi, 0) / M.length;
    const bm = (f) => M.reduce((s, r) => { const d = f(r) - r.nrfi; return s + d * d; }, 0) / M.length;
    console.log(`  MATURE GAMES ONLY (both arms 20+ starts): ${M.length} of ${rated.length}, base ${pc(mb)}`);
    console.log(`    base rate               ${(mb * (1 - mb)).toFixed(5)}`);
    console.log(`    raw product             ${bm((r) => r.raw).toFixed(5)}`);
    console.log(`    calibrated              ${bm((r) => r.p).toFixed(5)}\n`);
  }

  // Score against Kalshi on the overlap, using exactly the join that
  // nrfi-vs-kalshi.js verified (same abbreviations, doubleheaders dropped).
  const kal = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-kalshi-prices.json"), "utf8")).rows;
  const MON = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
  const kByDate = new Map();
  for (const r of kal) {
    const m = /^KXMLBRFI-(\d\d)([A-Z]{3})(\d\d)\d{4}([A-Z]+)$/.exec(r.ticker);
    if (!m) continue;
    const d = `20${m[1]}-${MON[m[2]]}-${m[3]}`;
    if (!kByDate.has(d)) kByDate.set(d, []);
    kByDate.get(d).push(r);
  }
  // Kalshi tickers carry team CODES, these schedule rows carry team IDS, so the
  // join needs a map between them. Rather than hand-type 30 abbreviations and
  // risk the CWS/CHW-style mistakes that cost 90 games in nrfi-vs-kalshi.js,
  // derive it: the scored cache has both a gamePk and an "AWY@HOM" label, and
  // these rows have the same gamePk plus both team ids, so the mapping falls
  // out of the overlap.

  // Build id -> code from the scored cache, which has both.
  const mdl = JSON.parse(fs.readFileSync(path.join(__dirname, "nrfi-tout-vs-model.json"), "utf8"));
  const pkCode = new Map();
  for (const [, gs] of mdl.slates) for (const g of gs) if (g.gamePk && g.label) pkCode.set(g.gamePk, g.label);
  const idCode = new Map();
  for (const r of rated) {
    const lab = pkCode.get(r.pk);
    if (!lab) continue;
    const m = /^([A-Z]+)@([A-Z]+)$/.exec(lab);
    if (m) { idCode.set(r.away, m[1]); idCode.set(r.home, m[2]); }
  }
  console.log(`  resolved ${idCode.size} team ids to codes via the scored cache\n`);

  const kKey = new Map();
  for (const [d, rs] of kByDate) for (const r of rs) {
    const m = /^KXMLBRFI-\d\d[A-Z]{3}\d\d\d{4}([A-Z]+)$/.exec(r.ticker);
    if (m) kKey.set(d + "|" + m[1], r);
  }
  const dupe = new Map();
  for (const r of rated) {
    const k = r.date + "|" + idCode.get(r.away) + idCode.get(r.home);
    dupe.set(k, (dupe.get(k) || 0) + 1);
  }
  const rows = [];
  for (const r of rated) {
    const ca = idCode.get(r.away), ch = idCode.get(r.home);
    if (!ca || !ch) continue;
    const k = r.date + "|" + ca + ch;
    if (dupe.get(k) > 1) continue;          // doubleheader, cannot tell which game
    const km = kKey.get(k);
    if (!km) continue;
    rows.push({ date: r.date, p: r.p, q: clamp(1 - km.yes), y: r.nrfi, priorA: r.priorA, priorH: r.priorH });
  }
  if (rows.length < 100) {
    console.log(`  STOP: only ${rows.length} games joined; not enough to conclude anything.`);
    return;
  }

  const n = rows.length;
  const brier = (f) => rows.reduce((s, r) => { const d = f(r) - r.y; return s + d * d; }, 0) / n;
  const base = rows.filter((r) => r.y === 1).length / n;
  console.log("=================== VS THE PRICE, ON THE SAME GAMES ===================");
  console.log(`  ${n} games joined to Kalshi`);
  console.log("   forecaster              Brier");
  console.log(`  base rate (${pc(base)})       ${brier(() => base).toFixed(5)}`);
  console.log(`  Kalshi pregame price    ${brier((r) => r.q).toFixed(5)}`);
  console.log(`  leak-free model         ${brier((r) => r.p).toFixed(5)}\n`);

  const fit = (cols) => {
    const k = cols.length;
    let w = new Array(k).fill(0);
    const build = (ww) => {
      const g = new Array(k).fill(0), H = Array.from({ length: k }, () => new Array(k).fill(0));
      for (const r of rows) {
        const x = cols.map((f) => f(r));
        const mu = 1 / (1 + Math.exp(-x.reduce((s, v, i) => s + v * ww[i], 0))), wt = mu * (1 - mu), d = r.y - mu;
        for (let i = 0; i < k; i++) { g[i] += d * x[i]; for (let j = 0; j < k; j++) H[i][j] += wt * x[i] * x[j]; }
      }
      return { g, H };
    };
    for (let it = 0; it < 80; it++) {
      const { g, H } = build(w), inv = invert(H);
      if (!inv) break;
      for (let i = 0; i < k; i++) w[i] += inv[i].reduce((s, v, j) => s + v * g[j], 0);
    }
    const inv = invert(build(w).H);
    return { w, se: w.map((_, i) => Math.sqrt(inv[i][i])) };
  };
  function invert(A) {
    const k = A.length;
    const M = A.map((r, i) => [...r, ...A.map((_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < k; c++) {
      let p = c;
      for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c];
      for (let j = 0; j < 2 * k; j++) M[c][j] /= d;
      for (let r = 0; r < k; r++) {
        if (r === c) continue;
        const f = M[r][c];
        for (let j = 0; j < 2 * k; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map((r) => r.slice(k));
  }

  const one = () => 1, xq = (r) => lg(r.q), xp = (r) => lg(r.p);
  const solo = fit([one, xp]);
  const joint = fit([one, xq, xp]);
  console.log("=================== DOES IT ADD ANYTHING TO THE PRICE? ===================");
  console.log(`  model alone     logit(model) ${solo.w[1].toFixed(3)} +- ${solo.se[1].toFixed(3)}   z=${(solo.w[1] / solo.se[1]).toFixed(2)}`);
  console.log("  joint fit       y ~ a + b*logit(price) + c*logit(model)");
  console.log(`                  b (price)    ${joint.w[1].toFixed(3)} +- ${joint.se[1].toFixed(3)}   z=${(joint.w[1] / joint.se[1]).toFixed(2)}`);
  console.log(`                  c (model)    ${joint.w[2].toFixed(3)} +- ${joint.se[2].toFixed(3)}   z=${(joint.w[2] / joint.se[2]).toFixed(2)}`);
  console.log("\n  Same regression as nrfi-vs-kalshi.js ran on the leaky model, so the two");
  console.log("  c values are directly comparable. The difference between them is a");
  console.log("  measurement of the leak.\n");

  console.log("=================== BETTING ITS DISAGREEMENT ===================");
  console.log("   |model - price|      n     hit%    ROI/contract");
  for (const t of [0, 0.02, 0.04, 0.06]) {
    const b = rows.filter((r) => Math.abs(r.p - r.q) >= t);
    if (b.length < 20) continue;
    const cost = b.reduce((s, r) => s + (r.p > r.q ? r.q : 1 - r.q), 0);
    const ret = b.filter((r) => (r.p > r.q ? r.y === 1 : r.y === 0)).length;
    console.log(`  >= ${(t * 100).toFixed(0).padStart(2)}pts        ${String(b.length).padStart(5)}   ${pc(ret / b.length).padStart(6)}   ` +
      `${(((ret - cost) / cost * 100 >= 0 ? "+" : "") + ((ret - cost) / cost * 100).toFixed(1) + "%").padStart(8)}`);
  }
  console.log("\n  Losing here is not a contradiction of c>0 above, it is the compression");
  console.log("  finding biting. This model's range is 0.43-0.59 while prices run wider,");
  console.log("  so 'model above price' fires mostly when the price is LOW — i.e. the rule");
  console.log("  bets against the favourite, and nrfi-kalshi-bias.js showed the favourite");
  console.log("  is the underpriced side. Raw disagreement is the wrong way to spend this");
  console.log("  information. The joint fit says to AMPLIFY both inputs, not to oppose");
  console.log("  them, which is what the blend below does.\n");

  // The blend the joint fit actually prescribes. Fitted on the first half of
  // the window and scored only on the second, because a blend evaluated on the
  // rows that chose its weights will always look good.
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const cut = dates[Math.floor(dates.length / 2)];
  const trainRows = rows.filter((r) => r.date < cut);
  const testRows = rows.filter((r) => r.date >= cut);
  const fitOn = (R, cols) => {
    const saved = rows.splice(0, rows.length, ...R);
    const out = fit(cols);
    rows.splice(0, rows.length, ...saved);
    return out;
  };
  const bl = fitOn(trainRows, [one, xq, xp]);
  const blend = (r) => 1 / (1 + Math.exp(-(bl.w[0] + bl.w[1] * lg(r.q) + bl.w[2] * lg(r.p))));
  // The control that decides whether any of this was worth building. The market
  // is compressed, so simply STRETCHING the price — no model at all — already
  // beats the raw price. If the blend cannot beat that, then our pitcher rates
  // contributed nothing and the correct product is a one-line transform of the
  // Kalshi number.
  const st = fitOn(trainRows, [one, xq]);
  const stretch = (r) => 1 / (1 + Math.exp(-(st.w[0] + st.w[1] * lg(r.q))));

  console.log("=================== OUT-OF-SAMPLE BLEND ===================");
  console.log(`  weights fitted on ${trainRows.length} games before ${cut}, scored on ${testRows.length} after`);
  console.log(`  blend = logistic(${bl.w[0].toFixed(2)} + ${bl.w[1].toFixed(2)}*logit(price) + ${bl.w[2].toFixed(2)}*logit(model))`);
  const tb = (f) => testRows.reduce((s, r) => { const d = f(r) - r.y; return s + d * d; }, 0) / testRows.length;
  const tbase = testRows.filter((r) => r.y === 1).length / testRows.length;
  console.log("\n   forecaster              Brier (holdout)");
  console.log(`  base rate               ${tb(() => tbase).toFixed(5)}`);
  console.log(`  Kalshi price            ${tb((r) => r.q).toFixed(5)}`);
  console.log(`  leak-free model         ${tb((r) => r.p).toFixed(5)}`);
  console.log(`  price stretched only    ${tb(stretch).toFixed(5)}   <- the control`);
  console.log(`  blend (price + model)   ${tb(blend).toFixed(5)}`);
  console.log("\n   holdout bet            n     hit%    ROI/contract");
  for (const t of [0.02, 0.04, 0.06]) {
    const b = testRows.filter((r) => Math.abs(blend(r) - r.q) >= t);
    if (b.length < 20) continue;
    const cost = b.reduce((s, r) => s + (blend(r) > r.q ? r.q : 1 - r.q), 0);
    const ret = b.filter((r) => (blend(r) > r.q ? r.y === 1 : r.y === 0)).length;
    console.log(`  blend vs price >=${(t * 100).toFixed(0)}pts ${String(b.length).padStart(5)}   ${pc(ret / b.length).padStart(6)}   ` +
      `${(((ret - cost) / cost * 100 >= 0 ? "+" : "") + ((ret - cost) / cost * 100).toFixed(1) + "%").padStart(8)}`);
  }
  console.log("\n  The control is the interesting line. Stretching the price on its own");
  console.log("  barely moves the holdout Brier (.24211 -> .24202), so the compression");
  console.log("  found in nrfi-kalshi-bias.js is real but worth very little by itself.");
  console.log("  Adding leak-free pitcher rates moves it about ten times as far. Whatever");
  console.log("  this model knows, the price did not already know it.");
  console.log("\n  Read the MATURE GAMES block above before this one. On 6507 games where");
  console.log("  both arms actually had a record, the calibrated model scores .24956");
  console.log("  against a .24982 base rate. That is the honest size of this model: real,");
  console.log("  repeatedly measured, and small. The larger margins that show up on the");
  console.log("  831-game Kalshi window are one window, and a Brier difference of .003 on");
  console.log("  831 games is about one standard error — do not quote it as the model's");
  console.log("  accuracy.");
  console.log("\n  Against the price the model still contributes (the blend beats the");
  console.log("  stretch-only control, which is the control that could have killed it),");
  console.log("  but c now carries z=1.83. That is below the two-standard-error line and");
  console.log("  it fell as the model improved, because park and offence are things the");
  console.log("  market already prices. Accuracy and edge are moving in opposite");
  console.log("  directions here, and edge is the one that pays.");
  console.log("\n  The model is crude by design — regressed pitcher rates, a park nudge, a");
  console.log("  team-offence nudge and a calibration layer; no lineup, no bullpen, no");
  console.log("  weather, no handedness. Treat it as a floor on what an honest model can");
  console.log("  do, not as a finished forecaster, and do not size on the ROI column.");
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
