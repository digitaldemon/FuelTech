// Is our record of him right, and does his own conviction say anything?
//
//   node scripts/nrfi-tout-conviction.js [sellerId]
//
// Two jobs, and the first one is the one that should have been run months ago.
//
// PART 1 — IS THE CACHE FAITHFUL? Every conclusion about this seller rests on
// nrfi-tout-vs-model.json's copy of his picks, and that copy had never been
// checked against the source. It matters because his measured edge is large
// (+15 pts over p-matched peers) and a scrape that quietly dropped losers would
// manufacture exactly that. So this walks his settled feed to exhaustion and
// grades the legs independently, then compares totals.
//
// The comparison has three traps, all of which produced a false alarm the first
// time and are handled here:
//   - HIS PAGE BINS BY DATE PLACED, the cache bins by GAME DATE. He places at
//     ~5am for that day's games but also the night before, so a day-by-day diff
//     against the site calendar shows losses "missing" that are simply filed one
//     day over. Legs are binned by start time converted to Eastern.
//   - HIS CALENDAR COUNTS EVERY BET, not just first-inning ones. His bad days
//     are full of pitcher-outs props and 1H spreads that we exclude correctly.
//   - A PARLAY IS ONE BET ON HIS PAGE AND N LEGS HERE, which inflates our count
//     on days a multi-leg ticket won.
//
// PART 2 — DOES HIS OWN CONVICTION PREDICT? The cache keeps a pick as a binary
// "he took it" and throws away the two things he says about how much he likes
// it: what he staked, and whether he came back and bet it again. Those are free
// signal if they carry any, and they are the only fields in his feed that are
// not already downstream of information we model ourselves.
//
// THE UNIT IS THE GAME, NOT THE LEG. Two tickets on the same game share one
// outcome, so counting them as two observations roughly doubles the apparent
// precision: the repeat-backing gap below reads 4 sigma per leg and 2.7 sigma
// per game. Per game is the honest one.
//
// AND NOTHING HERE IS A LICENCE TO SHIP A RULE. The repeat-backing result is a
// hypothesis formed by looking at this data, on 22 games. Two findings on this
// seller have already cleared a bar this high and then evaporated (a thin-arm
// profile, an environment tilt). The power line printed with it is the point:
// re-run as the sample grows, and act if it is still there.

const fs = require("fs");
const path = require("path");

const ID = process.argv[2] || "318949";
const JR = "https://www.juicereel.com/api";
const CACHE = path.join(__dirname, "nrfi-tout-vs-model.json");

const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const pct = (w, n) => (n ? (100 * w / n).toFixed(1) : "--") + "%";
// EDT for the season window. A first pitch at 7pm Eastern is the next day in
// UTC, so slicing the ISO string directly files half his book one day late.
const etDay = (iso) => new Date(new Date(iso).getTime() - 4 * 3600e3).toISOString().slice(0, 10);

async function jget(url) {
  const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "contract-desk/2.0" }, cache: "no-store" });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}

/* Walk to exhaustion rather than to a page budget. The live route stops at five
 * pages on purpose (it has a cache refresh to stay inside), but a faithfulness
 * check that reads a prefix of the book cannot tell a missing pick from a page
 * it never asked for. His full history is ~46 pages. */
async function allSettled(id) {
  const rows = [];
  for (let p = 0; p < 400; p++) {
    let j;
    try { j = await jget(`${JR}/bets/${id}/settled?page=${p}`); } catch { break; }
    const d = (((j || {}).data || {}).bets || {}).data;
    const r = (d || {}).rows || [];
    if (!r.length) break;
    rows.push(...r);
  }
  return rows;
}

/* The market, defined exactly as app/api/desk/nrfiking/route.ts defines it: a
 * directional Under/Over at a literal 0.5 line over the 1st inning. The feed
 * mixes player props and 1H spreads under nearby labels and admitting them is
 * what produced 31 legs whose grade contradicted the seller's own. */
function firstInningLegs(rows) {
  const out = [];
  for (const t of rows) {
    if (t.result === "Cancelled") continue;
    for (const l of t.Subbets || []) {
      if (l.duration !== "1I" || l.subbetType !== "GameOu" || Number(l.value) !== 0.5) continue;
      if (!/^(Under|Over)$/i.test(l.position || "")) continue;
      const res = String(((l.BetResult || {}).name) || "").toLowerCase();
      if (!/won|lost/.test(res)) continue;
      out.push({
        d: etDay(l.startDate), side: /under/i.test(l.position) ? "NRFI" : "YRFI",
        won: /won/.test(res), parlay: (t.numTeam || 1) > 1,
        risk: Number(t.iriskUnits || 0), clv: t.clvPct == null ? null : Number(t.clvPct),
        price: Number(l.vig || 0), live: !!l.wasLiveBet, book: t.siteId,
        placed: t.datePlaced, ticket: t.id, desc: String(l.description || ""),
      });
    }
  }
  return out;
}

(async () => {
  console.log(`walking seller ${ID}'s settled feed to exhaustion...`);
  const rows = await allSettled(ID);
  const legs = firstInningLegs(rows);
  if (!legs.length) { console.error("no gradable first-inning legs returned — feed shape changed?"); process.exit(2); }

  const scrub = rows.filter((t) => t.deletedAt).length, edited = rows.filter((t) => t.wasEdited).length;
  const days = legs.map((l) => l.d).sort();
  const lo = days[0], hi = days[days.length - 1];
  console.log(`${rows.length} settled tickets, ${legs.length} gradable 1I legs, ${lo} -> ${hi}`);
  console.log(`deleted tickets: ${scrub}   edited tickets: ${edited}` +
    `${scrub || edited ? "   <- a seller pruning his own book invalidates every rate below" : "   (his book is not being pruned)"}`);

  const w = legs.filter((l) => l.won).length;
  console.log(`\nPART 1 — CACHE FAITHFULNESS`);
  console.log(`  feed, graded here:  ${w}-${legs.length - w} = ${pct(w, legs.length)} on ${legs.length} legs`);

  if (!fs.existsSync(CACHE)) {
    console.log("  (no nrfi-tout-vs-model.json to compare against — run the rebuild first)");
  } else {
    const J = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    const act = new Map();
    for (const [d, gs] of J.slates) for (const g of gs) act.set(d + ":" + g.gamePk, g.actual);
    let cw = 0, cn = 0;
    for (const [d, ps] of J.byDate) {
      if (d < lo || d > hi) continue;
      for (const x of ps) {
        const a = act.get(d + ":" + x.gamePk);
        if (a == null) continue;
        cn++;
        if (x.side === "NRFI" ? a === 1 : a === 0) cw++;
      }
    }
    console.log(`  cache, same window: ${cw}-${cn - cw} = ${pct(cw, cn)} on ${cn} legs`);
    const dRate = Math.abs(cw / cn - w / legs.length), dN = Math.abs(cn - legs.length);
    console.log(dRate < 0.02 && dN <= 0.05 * legs.length
      ? `  FAITHFUL — ${dN} leg(s) apart, ${(100 * dRate).toFixed(1)} pts apart. The cache is not dropping losers.`
      : `  DIVERGENT — ${dN} legs and ${(100 * dRate).toFixed(1)} pts apart. Find out why before trusting any edge computed on the cache.`);
  }

  // ---- part 2 --------------------------------------------------------------
  const st = legs.filter((l) => !l.parlay && l.risk > 0);
  console.log(`\nPART 2 — HIS OWN CONVICTION, on ${st.length} straight legs`);

  const key = (l) => l.d + "|" + l.desc;
  const byGame = new Map();
  for (const l of st) { if (!byGame.has(key(l))) byGame.set(key(l), []); byGame.get(key(l)).push(l); }
  const single = [...byGame.values()].filter((a) => a.length === 1);
  const multi = [...byGame.values()].filter((a) => a.length > 1);
  const sw = single.filter((a) => a[0].won).length, mw = multi.filter((a) => a[0].won).length;
  console.log(`\n  REPEAT BACKING (per game — legs in one game share an outcome)`);
  console.log(`    backed once:  ${sw}-${single.length - sw} = ${pct(sw, single.length)}  (${single.length} games)`);
  console.log(`    backed 2+:    ${mw}-${multi.length - mw} = ${pct(mw, multi.length)}  (${multi.length} games)`);
  if (multi.length && single.length) {
    const se = Math.sqrt(0.25 / multi.length + 0.25 / single.length);
    const gap = sw / single.length - mw / multi.length;
    console.log(`    gap ${(100 * gap).toFixed(1)} pts, ${(gap / se).toFixed(1)} sigma` +
      `   — detectable here only above ${(200 * se).toFixed(1)} pts`);
    const liveN = multi.flat().filter((l) => l.live).length;
    const books = multi.filter((a) => new Set(a.map((l) => l.book)).size > 1).length;
    console.log(`    ${liveN} of ${multi.flat().length} repeat legs are live bets, ${books} of ${multi.length} span two books`);
    console.log(`    (both near zero means these are genuine second bets, not one bet scraped twice)`);
  }

  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
  const rs = st.map((l) => l.risk);
  const c1 = q(rs, 1 / 3), c2 = q(rs, 2 / 3);
  console.log(`\n  STAKE (units risked; median ${q(rs, 0.5).toFixed(2)}u)`);
  for (const [a, b, lab] of [[-1, c1, "bottom third"], [c1, c2, "middle third"], [c2, 1e9, "top third"]]) {
    const g = st.filter((l) => l.risk > a && l.risk <= b);
    if (!g.length) continue;
    console.log(`    ${lab.padEnd(13)} ${pct(g.filter((l) => l.won).length, g.length)}  (${g.length} legs)`);
  }

  const cl = st.filter((l) => l.clv != null);
  if (cl.length) {
    const beat = cl.filter((l) => l.clv > 0).length;
    console.log(`\n  CLOSING LINE VALUE, ${cl.length} legs`);
    console.log(`    mean CLV ${mean(cl.map((l) => l.clv)).toFixed(2)}%, beats the close on ${pct(beat, cl.length)} of legs`);
    console.log(`    (a beat RATE well above 50% with a mean near 0 says he wins the number`);
    console.log(`     often and by little — it is not the same claim as a large mean CLV)`);
  }

  console.log("\n" + "=".repeat(72));
  console.log("Nothing in PART 2 is a shipping rule. Both signals were formed by looking");
  console.log("at this data, on samples where the sigma is small enough that two earlier");
  console.log("findings on this same seller cleared a comparable bar and then evaporated.");
  console.log("Re-run as the book grows and act only if they survive.");
})().catch((e) => { console.error(e); process.exit(2); });
