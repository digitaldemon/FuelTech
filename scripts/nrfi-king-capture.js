/* Turns a copy of NRFIKINGKY's board into a fixture we can fit against.
 *
 *   node scripts/nrfi-king-capture.js <page-text-file>
 *   node scripts/nrfi-king-capture.js -            (reads stdin)
 *
 * Writes scripts/nrfi-king-board-YYYY-MM-DD.json, which nrfi-king-compare.js
 * and nrfi-king-resid.js pick up automatically.
 *
 * WHY A PARSER AND NOT A SCRAPER: his board is behind a login we are a paying
 * member of, and his API returned 401 when probed, so it is not ours to hit on
 * a timer. The input here is the rendered text of a page a human already has
 * open -- one page view a day, the same one a member makes anyway. This file
 * does no network I/O at all.
 *
 * The first board was transcribed by hand and that does not scale to the ten or
 * twenty days needed to separate his opposing-lineup term from a constant. It
 * is also the step most likely to introduce a quiet error, and a quiet error in
 * the fixture would be fitted to as if it were his model. */
const fs = require("fs");
const path = require("path");

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/nrfi-king-capture.js <file|->");
  process.exit(2);
}
const text = fs.readFileSync(src === "-" ? 0 : src, "utf8");
const L = text.split(/\r?\n/).map((s) => s.trim());

const DASH = /^[—–-]$/; // he prints an em dash for a missing pct, en dash for n
const cell = (pctLine, nLine) => {
  if (pctLine == null || DASH.test(pctLine)) return null;
  const p = /^(-?[\d.]+)%$/.exec(pctLine);
  const n = /^(\d+)g$/.exec(nLine || "");
  return p ? [parseFloat(p[1]), n ? parseInt(n[1], 10) : 0] : null;
};

/* ---- panels ------------------------------------------------------------ */
const date = (L.find((l) => /^\d{4}-\d{2}-\d{2}$/.test(l)) || "").trim();
if (!date) throw new Error("no board date found — is this his page text?");

const gatesBy = {};
for (const l of L) {
  // "LEAK DET@PIT: one-sided leak — away Keider Montero 40% L30 under 50%"
  const m = /^(LEAK|BLIND|THIN|TBD|COORS)\s+([A-Z]{2,3}@[A-Z]{2,3}):/.exec(l);
  if (m) (gatesBy[m[2]] = gatesBy[m[2]] || []).push(m[1]);
}
const parkBy = {};
for (const l of L) {
  // "DET@PIT: PNC — pitcher friendly, arms bumped 2%"
  const m = /^([A-Z]{2,3}@[A-Z]{2,3}):.*arms (bumped|docked) (\d+)%/.exec(l);
  if (m) parkBy[m[1]] = (m[2] === "bumped" ? 1 : -1) * parseInt(m[3], 10);
}

/* ---- cards ------------------------------------------------------------- */
/* Each card starts "TOR @ TB". The two window blocks inside it are the away
 * and home arms in that order; the pitcher's name sits three lines above his
 * SZN label ("name / headline% / NRFI L30 · NNGS / SZN"). */
const starts = [];
L.forEach((l, i) => { if (/^[A-Z]{2,3} @ [A-Z]{2,3}$/.test(l)) starts.push(i); });

const games = [];
const seen = new Set();
for (let s = 0; s < starts.length; s++) {
  const i0 = starts[s], i1 = s + 1 < starts.length ? starts[s + 1] : L.length;
  const card = L.slice(i0, i1);
  const [away, home] = card[0].split(" @ ");
  const key = away + "@" + home;
  if (seen.has(key)) continue; // he repeats the leak games on the YRFI tab

  const wi = [];
  card.forEach((l, i) => { if (l === "SZN") wi.push(i); });
  /* Not every "ARI @ BOS" line is a card — the DAILY VERDICT names its two
   * runners-up the same way, with no window cells under them. Those must be
   * skipped WITHOUT being marked seen, or the runner-up mention swallows the
   * real card further down the page and the game vanishes from the fixture. */
  if (wi.length < 2) continue;
  seen.add(key);

  const armAt = (i) => {
    const w = {};
    ["SZN", "L50", "L30", "L10"].forEach((k, j) => { w[k] = cell(card[i + 1 + j * 3], card[i + 2 + j * 3]); });
    w.who = card[i - 3] || "?";
    /* A 0-start arm prints no cells at all; his headline still carries the GS
     * count, so recover the zero rather than leaving SZN null and looking like
     * a parse failure downstream. */
    if (!w.SZN) w.SZN = [null, 0];
    return w;
  };
  const a = armAt(wi[0]), h = armAt(wi[1]);

  const di = card.findIndex((l, i) => l === "DS" && i > wi[1]);
  const ds = di > 0 && !DASH.test(card[di - 1]) ? parseFloat(card[di - 1]) : null;
  const tier = di > 0 ? (card[di + 1] || "").toUpperCase() : "";
  const pm = card.map((l) => /^N ([+-]\d+)/.exec(l)).find(Boolean);

  /* The opposing-lineup inputs, which only exist on an EXPANDED card:
   *
   *     TEAM 1ST-INN RATES (YRFI%)
   *     STL / 32.0%  ·  CIN / 27.2%
   *     K-BB% (away) 14.1%  ·  K-BB% (home) 6.6%
   *
   * These are the numbers his ±3% lineup term must be built from, and unlike
   * the arm cells he prints them to ONE DECIMAL -- so they do not carry the
   * whole-percent rounding floor that caps a fit against the rest of the card.
   * A card is collapsed by default, so a capture taken without clicking every
   * matchup header simply has no panel and these come back null. Signed: the
   * K-BB% cells go negative on weak arms (LAA -1.3%). */
  const li = card.findIndex((l) => /^TEAM 1ST-INN RATES/.test(l));
  const num = (s) => (s == null || DASH.test(s) ? null
    : (/^(-?[\d.]+)%$/.test(s) ? parseFloat(s.slice(0, -1)) : null));
  const lineup = li < 0 ? null : {
    yrfiA: num(card[li + 2]), yrfiH: num(card[li + 4]),
    kbbA: num(card[li + 6]), kbbH: num(card[li + 8]),
  };

  games.push({
    g: key, home, park: parkBy[key] || 0,
    ds: Number.isFinite(ds) ? ds : null,
    tier: tier === "NO PLAY" ? "RED" : tier,
    gates: gatesBy[key] || [],
    price: pm ? parseInt(pm[1], 10) : null,
    a, h, lineup,
  });
}

if (!games.length) throw new Error("parsed 0 games — the page text is probably truncated");

const out = path.join(__dirname, "nrfi-king-board-" + date + ".json");
fs.writeFileSync(out, JSON.stringify({
  _source: "https://nrfi-edge.replit.app/ board for " + date + ", parsed by nrfi-king-capture.js",
  _note: "Window cells are [pct, games] exactly as displayed. He rounds pct to whole percents, which floors any fit against this board around 0.5-0.9 RMSE. n on SZN is season GS and is the shrink denominator.",
  games,
}, null, 1) + "\n");

const scored = games.filter((g) => g.ds != null).length;
console.log("wrote " + path.basename(out));
console.log("  " + games.length + " games, " + scored + " scored, " +
  games.filter((g) => g.gates.length).length + " gated, " +
  Object.keys(parkBy).length + " park flags, " +
  games.filter((g) => g.lineup).length + " lineup panels");
if (!games.some((g) => g.lineup)) {
  console.log("  ?? no lineup panels — the cards were captured COLLAPSED. Click");
  console.log("     every matchup header before copying the page, or the board");
  console.log("     cannot be used to fit the opposing-lineup term.");
}
for (const g of games) {
  if (!g.a.SZN || !g.h.SZN) console.log("  ?? " + g.g + " missing an arm");
  if (g.ds == null && !g.gates.length) console.log("  ?? " + g.g + " has no score and no gate");
}
