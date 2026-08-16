// What rule is NRFIKINGKY actually running?
//
//   node scripts/nrfi-tout-reverse.js [sellerId]
//
// nrfi-tout-vs-model.js asked whether OUR model sees his games and answered
// "sort of" — his picks land at the 62nd percentile of our ranking, which is
// barely above average. That result is usually read as "he has signal we lack",
// and the natural response is to go hunting for the missing factor.
//
// Before doing that, rule out a cheaper explanation that fits the same evidence
// better. His book is 205-117 on NRFI and 0-3 on YRFI — he is not choosing a
// SIDE, he only ever takes one. So the only decisions he makes are WHICH games
// and AT WHAT PRICE. If his edge lives in price and timing rather than in game
// quality, then no amount of model work reproduces it, and the 62nd-percentile
// result is not a gap in our signal at all — it is evidence that game quality
// was never what he was selecting on.
//
// Three things separate those worlds, and all three are in the pick record:
//
//   TIMING   placedAt vs startUtc. A model player bets when he has information
//            (lineups, weather, confirmed starters). A price player bets when
//            the number is soft, which is early, before the market absorbs it.
//   PRICE    the vig he accepts. A rule like "NRFI at -125 or better, else pass"
//            produces a tight, left-truncated price distribution. Selecting on
//            game quality produces a wide one, because a great spot is worth a
//            bad price.
//   CLV      whether beating the close is concentrated among his early bets.
//            If CLV decays to zero as he bets later, he is being paid for
//            immediacy, not for insight.
//
// This does not grade him. nrfi-tout-grade.js does that. This asks what he is
// doing, which is the only question that can be turned into code on our side.
const { gradeSeller } = require("./nrfi-tout-grade");

const pc = (x) => (x * 100).toFixed(1) + "%";
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
// American odds -> decimal payout per unit risked, so prices are comparable.
const payout = (v) => (v > 0 ? v / 100 : 100 / -v);

(async () => {
  const id = process.argv[2] || "318949";
  const g = await gradeSeller(id, true);
  // Straight single-leg tickets only. Parlay legs have no independent price and
  // no independent CLV, so including them would blur exactly the two axes this
  // script exists to separate.
  // g.picks, not g.rows: rows is the raw JuiceReel ticket feed, picks is the
  // parsed first-inning legs with side/price/timing already resolved.
  const p = g.picks.filter((r) => r.type === "Straight" && r.legs === 1 && r.placedAt && r.startUtc);
  console.log(`reverse-engineering ${p.length} straight single-leg first-inning picks\n`);

  const sides = {};
  for (const r of p) sides[r.side] = (sides[r.side] || 0) + 1;
  console.log("=================== WHAT DECISIONS DOES HE EVEN MAKE? ===================");
  console.log("  sides taken:", Object.entries(sides).map(([k, v]) => `${k} ${v}`).join(", "));
  console.log("  If one side is ~100% of the book he is not handicapping direction,");
  console.log("  he is deciding which games to buy and at what number.\n");

  // ---- TIMING -------------------------------------------------------------
  const hrs = p.map((r) => ({ ...r, h: (new Date(r.startUtc) - new Date(r.placedAt)) / 36e5 }))
    .filter((r) => Number.isFinite(r.h) && r.h > -2 && r.h < 72);
  console.log("=================== TIMING (hours before first pitch) ===================");
  console.log(`  median ${med(hrs.map((r) => r.h)).toFixed(1)}h   mean ${mean(hrs.map((r) => r.h)).toFixed(1)}h`);
  const buckets = [[0, 1], [1, 3], [3, 6], [6, 10], [10, 16], [16, 72]];
  console.log("   window        n     win%      ROI      mean CLV");
  for (const [lo, hi] of buckets) {
    const b = hrs.filter((r) => r.h >= lo && r.h < hi);
    if (!b.length) continue;
    const w = b.filter((r) => r.ticketResult === "Won").length;
    const risk = b.reduce((s, r) => s + r.risk, 0), net = b.reduce((s, r) => s + r.net, 0);
    const cl = b.filter((r) => r.clvPct != null).map((r) => r.clvPct);
    console.log(`  ${String(lo).padStart(3)}-${String(hi).padEnd(3)}h  ${String(b.length).padStart(5)}   ${pc(w / b.length).padStart(6)}   ${(net / risk * 100 >= 0 ? "+" : "") + (net / risk * 100).toFixed(1) + "%"}` +
      `      ${cl.length ? (mean(cl) * 100 >= 0 ? "+" : "") + (mean(cl) * 100).toFixed(2) + "%" : "  —"}`);
  }
  console.log("\n  Lineups post ~3-4h out and confirmed starters ~24h out. Betting BEFORE");
  console.log("  lineups means he is not using them, which rules out a whole class of");
  console.log("  model he could be running.\n");

  // ---- PRICE --------------------------------------------------------------
  const vigs = p.map((r) => r.vig).filter((v) => Number.isFinite(v));
  console.log("=================== PRICE TAKEN ===================");
  console.log(`  median ${med(vigs).toFixed(0)}   mean ${mean(vigs).toFixed(0)}   range ${Math.min(...vigs)} .. ${Math.max(...vigs)}`);
  const pb = [[-1000, -140], [-140, -125], [-125, -115], [-115, -105], [-105, 100], [100, 1000]];
  // Margin over the price's own implied probability is the column that matters.
  // Win rate alone rises with price by construction — a -200 favorite SHOULD win
  // more often than a +120 dog — so a rising win rate proves nothing. If the
  // MARGIN also rises, the market is underpricing its own favorites, and that is
  // a bias anyone can bet, not a read only he has.
  console.log("   price band       n      share    win%   implied   margin      ROI");
  for (const [lo, hi] of pb) {
    const b = p.filter((r) => r.vig >= lo && r.vig < hi);
    if (!b.length) continue;
    const w = b.filter((r) => r.ticketResult === "Won").length;
    const risk = b.reduce((s, r) => s + r.risk, 0), net = b.reduce((s, r) => s + r.net, 0);
    const imp = mean(b.map((r) => 1 / (1 + payout(r.vig))));
    const mg = w / b.length - imp;
    console.log(`  ${String(lo === -1000 ? "  <" : lo).padStart(5)}..${String(hi).padEnd(5)}  ${String(b.length).padStart(5)}   ${pc(b.length / p.length).padStart(6)}   ${pc(w / b.length).padStart(6)}   ${pc(imp).padStart(6)}   ` +
      `${((mg * 100 >= 0 ? "+" : "") + (mg * 100).toFixed(1) + "pp").padStart(7)}   ${((net / risk * 100 >= 0 ? "+" : "") + (net / risk * 100).toFixed(1) + "%").padStart(7)}`);
  }
  // The break-even implied by his own average price. If his win rate barely
  // clears it, the whole edge is price discipline and nothing else.
  const be = mean(vigs.map((v) => 1 / (1 + payout(v))));
  const wins = p.filter((r) => r.ticketResult === "Won").length;
  console.log(`\n  mean break-even at the prices he took   ${pc(be)}`);
  console.log(`  his actual win rate                    ${pc(wins / p.length)}`);
  console.log(`  margin                                 ${((wins / p.length - be) * 100 >= 0 ? "+" : "") + ((wins / p.length - be) * 100).toFixed(1)}pp\n`);

  // ---- HOW SELECTIVE IS HE ------------------------------------------------
  const days = new Map();
  for (const r of p) {
    const d = new Date(r.startUtc).toISOString().slice(0, 10);
    days.set(d, (days.get(d) || 0) + 1);
  }
  const counts = [...days.values()];
  console.log("=================== SELECTIVITY ===================");
  console.log(`  active on ${days.size} days, ${p.length} picks, median ${med(counts)} picks/day, max ${Math.max(...counts)}`);
  console.log(`  a typical MLB slate is ~15 games, so he plays roughly ${pc(med(counts) / 15)} of a board.`);
  console.log("  Someone playing most of the board is selling volume; someone playing two");
  console.log("  games a night is either very selective or waiting for one specific setup.\n");

  // ---- REPEAT CUSTOMERS ---------------------------------------------------
  // The feed spells the same club several ways ("Boston", "BOS Red Sox"), which
  // a first pass reported as 98 distinct teams in a 30-team league. Normalise to
  // the last word of the name — "Red Sox" and "Sox" still differ, but it
  // collapses the prefix-vs-city split that caused the bogus count.
  const norm = (t) => String(t).trim().split(/\s+/).slice(-1)[0].toLowerCase();
  const teamN = new Map();
  for (const r of p) for (const t of r.teams || []) teamN.set(norm(t), (teamN.get(norm(t)) || 0) + 1);
  const top = [...teamN.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log("=================== TEAMS HE KEEPS COMING BACK TO ===================");
  console.log("  " + top.map(([t, n]) => `${t} ${n}`).join(" · "));
  const totalTeamSlots = [...teamN.values()].reduce((s, x) => s + x, 0);
  console.log(`  ${teamN.size} distinct teams over ${totalTeamSlots} team-slots.`);
  console.log("  Heavy concentration would mean a team-level read (a bad offense, a good");
  console.log("  rotation) that we could reproduce directly. A flat spread means he is");
  console.log("  reacting to something that moves game to game — most likely the price.");
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
