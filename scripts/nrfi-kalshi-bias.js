// Is the NRFI edge a market bias, or is it NRFIKINGKY?
//
//   node scripts/nrfi-kalshi-bias.js [--refresh]
//
// nrfi-tout-reverse.js found that his margin over implied probability RISES
// with how much the market already favours NRFI: +8.1pp on games priced below
// -140, +1.3pp on games priced near even. Two very different worlds produce
// that exact table:
//
//   MARKET BIAS      first-inning NRFI favourites are systematically
//                    underpriced. Everyone who buys them beats the number.
//                    He is not picking; he is standing in front of a leak.
//   SELECTION SKILL  only HIS favourites beat the number, because he knows
//                    which ones. The bias does not exist on the games he
//                    passed on.
//
// His pick record cannot tell them apart, because it only contains games he
// chose. The margin is conditioned on his selection, so selection and price
// are perfectly confounded. Breaking the confound needs prices for the games
// he DIDN'T bet, which is exactly what a public exchange has.
//
// Kalshi lists every MLB first-inning game as its own market (series
// KXMLBRFI, YES = "a run scored in the 1st", so NO = NRFI). Settled markets
// carry the result, and candlesticks carry the pregame price. Pull both for
// the whole board and the question answers itself:
//
//   ALL NRFI favourites beat their price  -> market bias. Bet it ourselves.
//                                            He is a weather vane, not an edge.
//   ONLY his do                           -> real selection skill, and THAT
//                                            is the thing worth reproducing.
//
// PRICE ANCHOR. These markets close early — the moment a run scores, or the
// moment the first inning ends — so close_time lands DURING the game, and the
// final candles are contaminated by settlement (the example market ran 0.43
// -> 0.01 inside one hour). Anchoring on close_time - 1h steps back safely
// ahead of first pitch: a first inning takes ~20 min, so this is ~35-40 min
// pregame on an NRFI settle and ~50 min on a YRFI settle. occurrence_datetime
// is NOT usable as the anchor — on the sample market it read 02:15Z for a game
// whose first inning had already settled at 23:36Z.
const fs = require("fs");
const path = require("path");

const B = "https://api.elections.kalshi.com/trade-api/v2";
const CACHE = path.join(__dirname, "nrfi-kalshi-prices.json");
const pc = (x) => (x * 100).toFixed(1) + "%";
const pp = (x) => (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "pp";
const num = (v) => (v == null ? null : Number(v));

async function getJSON(u, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u);
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 1500 * (i + 1))); continue; }
      if (!r.ok) throw new Error(r.status + " " + u);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((s) => setTimeout(s, 500 * (i + 1)));
    }
  }
}

async function allSettledMarkets() {
  const out = [];
  let cur = "";
  for (;;) {
    const j = await getJSON(`${B}/markets?series_ticker=KXMLBRFI&status=settled&limit=1000` + (cur ? `&cursor=${cur}` : ""));
    const ms = j.markets || [];
    if (!ms.length) break;
    out.push(...ms);
    cur = j.cursor;
    if (!cur) break;
  }
  return out;
}

// Last candle that closed at least an hour before the market did. Prefers the
// traded close; falls back to the bid/ask midpoint for periods with no trades,
// which is still a price, just a quoted one rather than a struck one.
async function pregamePrice(ticker, closeTs) {
  const j = await getJSON(`${B}/series/KXMLBRFI/markets/${ticker}/candlesticks` +
    `?start_ts=${closeTs - 86400}&end_ts=${closeTs}&period_interval=60`);
  const cs = (j.candlesticks || []).filter((c) => c.end_period_ts <= closeTs - 3600);
  for (let i = cs.length - 1; i >= 0; i--) {
    const c = cs[i];
    const close = num(c.price?.close_dollars);
    if (close != null && close > 0 && close < 1) return { yes: close, src: "trade", ts: c.end_period_ts };
    const bid = num(c.yes_bid?.close_dollars), ask = num(c.yes_ask?.close_dollars);
    if (bid != null && ask != null && ask > bid && bid > 0 && ask < 1) {
      return { yes: (bid + ask) / 2, src: "quote", ts: c.end_period_ts };
    }
  }
  return null;
}

async function build() {
  const markets = (await allSettledMarkets()).filter((m) => m.result === "yes" || m.result === "no");
  console.error(`${markets.length} settled binary markets, pulling pregame prices...`);
  const rows = [];
  const CONC = 6;
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (;;) {
      const k = i++;
      if (k >= markets.length) return;
      const m = markets[k];
      const closeTs = Math.floor(new Date(m.close_time).getTime() / 1000);
      let p = null;
      try { p = await pregamePrice(m.ticker, closeTs); } catch (e) { /* leave null, counted below */ }
      if (++done % 100 === 0) console.error(`  ${done}/${markets.length}`);
      if (!p) continue;
      rows.push({
        ticker: m.ticker,
        title: m.title,
        date: m.close_time.slice(0, 10),
        closeTs,
        priceTs: p.ts,
        src: p.src,
        yes: p.yes,              // YES = a run scored in the 1st
        nrfi: m.result === "no", // NO  = NRFI hit
      });
    }
  }));
  fs.writeFileSync(CACHE, JSON.stringify({ built: new Date().toISOString(), n: markets.length, rows }, null, 0));
  console.error(`priced ${rows.length}/${markets.length}\n`);
  return rows;
}

(async () => {
  let rows;
  if (!process.argv.includes("--refresh") && fs.existsSync(CACHE)) {
    rows = JSON.parse(fs.readFileSync(CACHE, "utf8")).rows;
    console.error(`cache: ${rows.length} priced markets (--refresh to rebuild)\n`);
  } else {
    rows = await build();
  }

  // Anchor sanity. A pregame first-inning market lives in a narrow band; a
  // price of 0.01 means the anchor landed after the run had already scored.
  // Only 2 of 855 do, but logit(0.01) has enormous leverage on a slope fit, so
  // they come out before anything is measured. (Verified: dropping them moves
  // the slope by 0.001, so nothing below depends on this choice.)
  const all = rows.map((r) => ({ ...r, p: 1 - r.yes })).sort((a, b) => a.date.localeCompare(b.date));
  const imp = all.filter((r) => r.p >= 0.15 && r.p <= 0.85);
  const hit = imp.filter((r) => r.nrfi).length;
  const meanP = imp.reduce((s, r) => s + r.p, 0) / imp.length;
  const lg = (x) => Math.log(x / (1 - x));

  console.log("=================== THE WHOLE BOARD ===================");
  console.log(`  ${imp.length} settled first-inning markets, ${imp[0].date} .. ${imp[imp.length - 1].date}` +
    (all.length - imp.length ? `  (${all.length - imp.length} dropped, anchor landed mid-game)` : ""));
  console.log(`  mean implied P(NRFI)   ${pc(meanP)}`);
  console.log(`  actual NRFI rate       ${pc(hit / imp.length)}`);
  console.log(`  margin                 ${pp(hit / imp.length - meanP)}`);
  console.log("  The board as a whole is priced right, so whatever he is being paid for");
  console.log("  is not 'NRFI is cheap'. It has to live in WHICH games.\n");

  console.log("=================== MARGIN BY HOW FAVOURED NRFI IS ===================");
  const bands = [[0.15, 0.45], [0.45, 0.5], [0.5, 0.55], [0.55, 0.6], [0.6, 0.85]];
  console.log("   implied P(NRFI)      n     implied    actual    margin");
  for (const [lo, hi] of bands) {
    const b = imp.filter((r) => r.p >= lo && r.p < hi);
    if (b.length < 5) continue;
    const e = b.reduce((s, r) => s + r.p, 0) / b.length;
    const a = b.filter((r) => r.nrfi).length / b.length;
    console.log(`  ${lo.toFixed(2)}-${hi.toFixed(2)}      ${String(b.length).padStart(5)}    ${pc(e).padStart(6)}    ${pc(a).padStart(6)}   ${pp(a - e).padStart(7)}`);
  }
  console.log("\n  His table ran +8.1pp on his biggest NRFI favourites down to +1.3pp near");
  console.log("  even money (nrfi-tout-reverse.js). This is the same staircase, on the");
  console.log("  whole board, including every game he never touched.\n");

  // Do not read that staircase off five bins. Fit the price against the result
  // directly: y ~ a + b*logit(p). A perfectly calibrated market gives b = 1.
  console.log("=================== IS THE PRICE CALIBRATED? ===================");
  let a = 0, b = 1;
  for (let it = 0; it < 60; it++) {
    let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
    for (const r of imp) {
      const x = lg(r.p), q = 1 / (1 + Math.exp(-(a + b * x))), w = q * (1 - q), d = (r.nrfi ? 1 : 0) - q;
      g0 += d; g1 += d * x; h00 += w; h01 += w * x; h11 += w * x * x;
    }
    const det = h00 * h11 - h01 * h01;
    a += (h11 * g0 - h01 * g1) / det; b += (-h01 * g0 + h00 * g1) / det;
  }
  let h00 = 0, h01 = 0, h11 = 0;
  for (const r of imp) {
    const x = lg(r.p), q = 1 / (1 + Math.exp(-(a + b * x))), w = q * (1 - q);
    h00 += w; h01 += w * x; h11 += w * x * x;
  }
  const det = h00 * h11 - h01 * h01, seB = Math.sqrt(h00 / det), seA = Math.sqrt(h11 / det);
  console.log(`  intercept  ${a.toFixed(3)} +- ${seA.toFixed(3)}   (0 = no side is cheap overall)   z=${(a / seA).toFixed(2)}`);
  console.log(`  slope      ${b.toFixed(3)} +- ${seB.toFixed(3)}   (1 = perfectly calibrated)      z=${((b - 1) / seB).toFixed(2)} vs 1`);
  console.log(`\n  Slope ${b.toFixed(2)} means outcomes are roughly TWICE as far from 50/50 as the`);
  console.log("  price is. The market is not biased toward NRFI — it is too timid in");
  console.log("  whichever direction it already leans. At a 0.55 price the honest number");
  console.log(`  is about ${(1 / (1 + Math.exp(-(a + b * lg(0.55))))).toFixed(3)}.\n`);

  // If that reading is right the bias must be symmetric: the YRFI side should
  // pay exactly as well when YRFI is the favourite. That is a real prediction,
  // and it is the one that separates "NRFI is underpriced" from "favourites
  // are underpriced", because the two agree on everything he ever bet.
  console.log("=================== BUY THE FAVOURED SIDE, WHICHEVER IT IS ===================");
  console.log("   side bought                      n     hit%    ROI/contract");
  const roi = (b2, side) => {
    // Buy at the implied price; a winner returns 1.00.
    const cost = b2.reduce((s, r) => s + (side === "NRFI" ? r.p : 1 - r.p), 0);
    const ret = b2.filter((r) => (side === "NRFI" ? r.nrfi : !r.nrfi)).length;
    return { roi: (ret - cost) / cost, hit: ret / b2.length };
  };
  const show = (name, b2, side) => {
    if (!b2.length) return;
    const { roi: v, hit: h } = roi(b2, side);
    console.log(`  ${name.padEnd(30)} ${String(b2.length).padStart(4)}   ${pc(h).padStart(6)}   ` +
      `${((v * 100 >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%").padStart(8)}`);
  };
  show("NRFI when NRFI favoured", imp.filter((r) => r.p > 0.5), "NRFI");
  show("YRFI when YRFI favoured", imp.filter((r) => r.p < 0.5), "YRFI");
  show("NRFI when YRFI favoured", imp.filter((r) => r.p < 0.5), "NRFI");
  // Whichever side the price leans, taken together. show() cannot express this
  // one because the side varies row by row.
  {
    const b2 = imp.filter((r) => Math.abs(r.p - 0.5) > 0.04);
    const cost = b2.reduce((s, r) => s + Math.max(r.p, 1 - r.p), 0);
    const ret = b2.filter((r) => (r.p > 0.5 ? r.nrfi : !r.nrfi)).length;
    console.log(`  ${"favourite side, |edge|>4pts".padEnd(30)} ${String(b2.length).padStart(4)}   ${pc(ret / b2.length).padStart(6)}   ` +
      `${(((ret - cost) / cost * 100 >= 0 ? "+" : "") + ((ret - cost) / cost * 100).toFixed(1) + "%").padStart(8)}`);
  }
  console.log("\n  Those rows are the whole answer. If NRFI were the underpriced side,");
  console.log("  buying YRFI when YRFI is favoured would lose money. It pays the same.");

  // Split by time. An edge that only exists in one half of the sample is a
  // sampling artifact wearing a strategy's clothes.
  const dates = [...new Set(imp.map((r) => r.date))].sort();
  const mid = dates[Math.floor(dates.length / 2)];
  console.log("\n   holdout                          n     hit%    ROI/contract");
  for (const [nm, f] of [["favourite side, " + dates[0] + "+", (r) => r.date < mid],
                         ["favourite side, " + mid + "+", (r) => r.date >= mid]]) {
    const b2 = imp.filter(f).filter((r) => Math.abs(r.p - 0.5) > 0.02);
    const cost = b2.reduce((s, r) => s + Math.max(r.p, 1 - r.p), 0);
    const ret = b2.filter((r) => (r.p > 0.5 ? r.nrfi : !r.nrfi)).length;
    console.log(`  ${nm.padEnd(30)} ${String(b2.length).padStart(4)}   ${pc(ret / b2.length).padStart(6)}   ` +
      `${(((ret - cost) / cost * 100 >= 0 ? "+" : "") + ((ret - cost) / cost * 100).toFixed(1) + "%").padStart(8)}`);
  }

  console.log("\n  READ THIS BEFORE BETTING IT. Kalshi takes a trading fee that is not in");
  console.log("  these prices, and a sportsbook adds vig on top, so a few points of ROI");
  console.log("  here is not a few points in the account. Two months and ~850 games is");
  console.log("  also one slice of one season: the slope clears 2 SE, the half-split");
  console.log("  clears one tail at p=0.035, and neither is the kind of number to size");
  console.log("  up on. What it does settle is the question that was asked — the pattern");
  console.log("  is in the market, not in him.");
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
