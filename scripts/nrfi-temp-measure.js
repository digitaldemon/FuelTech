// Is the temperature band real, or is it summer?
//
// ANSWER, and what shipped: the band is not real; the gradient underneath it is.
// The >=82F band does not replicate across seasons (x1.466 / x1.218 / x1.006,
// venue+month held out) — a term worth +47% in 2024 and +0.6% in 2026 is fit to
// 2024. The continuous trend does hold: 0.1224pp of YRFI per degree F, t=1.97 on
// n=5339, one test on the full sample, and monotone as air density actually is.
// Temperature now ships as a ramp centred on the mean outdoor game temperature
// (see NRFI_TEMP_SLOPE in app.jsx) instead of a 0.120-of-lambda cliff at 82F
// that five of a fifteen-game August board were sitting directly on top of.
// Sections 1-4 below are the measurement that established this; section 5 shows
// what ships and section 6 guards it.
//
// ENV_W_TEMP was 0.60 on a factor that reached 1.20 at 82F, which made heat the
// single largest environmental adjustment in the model outside the park factor.
// The band was fit in scripts/nrfi-env-measure.js against 1,821 games, and the
// comment above the constant concedes the fit is "confounded with venue and
// month" — but nothing in that script ever held either one out. It also pulls
// with sportId=1 and no gameType filter, so spring training is in the sample:
// March baseball in Arizona and Florida, warm, with split squads and pitchers
// on strict pitch counts. Those games land squarely in the hot bucket.
//
// The confound is not subtle. A game at 82F+ is disproportionately July and
// August, and disproportionately Texas, Atlanta, Miami, Phoenix. If summer
// baseball scores more for reasons that have nothing to do with air density —
// rotations thinned by injury, bullpens worn down, the best hitters healthy —
// then a temperature term will pick that up and call it heat.
//
// So: three passes, each a strictly harder test than the last.
//   1. raw bands, to reproduce the shipped claim
//   2. venue held out — each park compared against its OWN rate
//   3. venue AND month held out — the actual question
// Then season-by-season, because a real environmental effect replicates and a
// fluke does not. This is the same protocol that retired the start-hour lead.
const SEASONS = (process.argv[2] || "2024,2025,2026").split(",").map(Number);
const iso = (d) => d.toISOString().slice(0, 10);

async function pull(a, b) {
  // gameType=R matters more here than anywhere else in the model: spring
  // training is played in two of the hottest metros in the country, and leaving
  // it in loads the >=82F bucket with games that are not major league baseball.
  const u = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=R&startDate=" + iso(a) +
    "&endDate=" + iso(b) + "&hydrate=linescore,weather,venue";
  const r = await fetch(u);
  if (!r.ok) throw new Error("schedule " + r.status);
  return ((await r.json()).dates || []).flatMap((x) => x.games || []);
}

const pct = (x) => (x * 100).toFixed(1) + "%";
// A rate is not the thing the model applies — the model multiplies a lambda. Go
// through the Poisson link so a band's effect is quoted in the units it ships in.
const lamOf = (p) => -Math.log(1 - p);

(async () => {
  const rows = [];
  for (const season of SEASONS) {
    const start = new Date(season + "-03-15T00:00:00Z");
    const end = new Date(Math.min(Date.now(), Date.parse(season + "-11-15T00:00:00Z")));
    if (end <= start) continue;
    for (let t = start.getTime(); t < end.getTime(); t += 14 * 864e5) {
      const a = new Date(t), b = new Date(Math.min(t + 13 * 864e5, end.getTime()));
      for (const g of await pull(a, b)) {
        if (String(g.status && g.status.abstractGameState).toLowerCase() !== "final") continue;
        const i1 = ((g.linescore && g.linescore.innings) || [])[0];
        if (!i1 || !i1.away || !i1.home) continue;
        // A suspended game can leave a half unplayed; runs==null is not runs==0.
        if (i1.away.runs == null || i1.home.runs == null) continue;
        const w = g.weather || {};
        const temp = w.temp != null && w.temp !== "" ? Number(w.temp) : null;
        if (temp == null || !isFinite(temp)) continue;
        const cond = String(w.condition || "");
        rows.push({
          season,
          month: new Date(g.gameDate).getUTCMonth() + 1,
          venue: (g.venue && g.venue.name) || "?",
          temp, cond, wind: String(w.wind || ""),
          indoor: /dome|roof closed/i.test(cond),
          scored: i1.away.runs > 0 || i1.home.runs > 0,
        });
      }
    }
  }

  // Everything below is outdoor-only. A closed roof reports a thermostat
  // setting, not weather, and those readings cluster at 72F — feeding them to a
  // temperature fit puts a few thousand climate-controlled games in the
  // reference band and makes every outdoor band look more extreme by contrast.
  const open = rows.filter((r) => !r.indoor);
  console.log("\nTEMPERATURE AND THE FIRST INNING");
  console.log(rows.length + " regular-season games with a 1st inning and a temperature reading, " +
    SEASONS.join("/") + "  (" + open.length + " outdoor, " + (rows.length - open.length) + " under a roof)");

  const BANDS = [
    [">= 92", (r) => r.temp >= 92],
    ["82-91", (r) => r.temp >= 82 && r.temp < 92],
    ["56-81  (reference)", (r) => r.temp >= 56 && r.temp < 82],
    ["46-55", (r) => r.temp >= 46 && r.temp < 56],
    ["< 46", (r) => r.temp < 46],
  ];

  /* ---- 1. raw ---- */
  const base = open.filter((r) => r.scored).length / open.length;
  console.log("\n" + "-".repeat(78));
  console.log("1. RAW — every outdoor game, no controls. This is what the shipped fit saw.");
  console.log("   baseline YRFI rate " + pct(base) + "\n");
  console.log("   band                    n     YRFI     implied lambda x");
  for (const [label, f] of BANDS) {
    const s = open.filter(f);
    if (!s.length) continue;
    const p = s.filter((r) => r.scored).length / s.length;
    console.log("   " + label.padEnd(22) + String(s.length).padStart(5) + "   " +
      pct(p).padStart(6) + "     x" + (lamOf(p) / lamOf(base)).toFixed(3));
  }

  /* ---- 2 & 3. held out ---- */
  // For a bucket, the expectation is built from each game's own cell rate with
  // the bucket's games REMOVED from that cell. Without the hold-out a bucket
  // that dominates a cell is largely compared against itself, which drags every
  // effect toward zero and would let a dead term look merely small.
  // `pop` is passed in rather than closed over so the season-by-season pass can
  // hand it a subset without mutating the shared array.
  function holdout(bucket, cellKey, label, pop) {
    const open = pop;
    const inB = new Set(open.filter(bucket));
    const cells = new Map();
    for (const r of open) {
      if (inB.has(r)) continue;
      const k = cellKey(r);
      const c = cells.get(k) || { k: 0, n: 0 };
      c.n++; if (r.scored) c.k++;
      cells.set(k, c);
    }
    let obs = 0, exp = 0, varr = 0, n = 0, thin = 0;
    for (const r of open) {
      if (!inB.has(r)) continue;
      const c = cells.get(cellKey(r));
      // A cell with no hold-out games left carries no information about what
      // this game should have done. Counting it against the global rate would
      // smuggle the confound back in, so it is dropped and reported.
      if (!c || c.n < 10) { thin++; continue; }
      const p = c.k / c.n;
      obs += r.scored ? 1 : 0; exp += p; varr += p * (1 - p); n++;
    }
    if (!n) { console.log("   " + label.padEnd(22) + "  no comparable games"); return; }
    const pObs = obs / n, pExp = exp / n;
    const z = (obs - exp) / Math.sqrt(varr);
    const mult = lamOf(pObs) / lamOf(pExp);
    console.log("   " + label.padEnd(22) + String(n).padStart(5) + "   " + pct(pObs).padStart(6) +
      " vs " + pct(pExp).padStart(6) + "     x" + mult.toFixed(3) +
      "   z=" + (z >= 0 ? "+" : "") + z.toFixed(2) +
      (Math.abs(z) >= 1.96 ? "  <- clears noise" : "") +
      (thin ? "   (" + thin + " dropped, thin cell)" : ""));
  }

  console.log("\n" + "-".repeat(78));
  console.log("2. VENUE HELD OUT — each park compared against its own outdoor rate.");
  console.log("   Removes 'hot bands are hot parks'. Does not remove 'hot bands are July'.\n");
  console.log("   band                    n     YRFI     expected      lambda x");
  for (const [label, f] of BANDS) holdout(f, (r) => r.venue, label, open);

  console.log("\n" + "-".repeat(78));
  console.log("3. VENUE AND MONTH HELD OUT — the real test. A game is compared only");
  console.log("   against other games at the same park in the same month, so what is");
  console.log("   left is a hot day at Wrigley in May against a normal day at Wrigley");
  console.log("   in May. If the effect is air temperature it survives. If it is the");
  console.log("   summer schedule, it dies here.\n");
  console.log("   band                    n     YRFI     expected      lambda x");
  for (const [label, f] of BANDS) holdout(f, (r) => r.venue + "|" + r.month, label, open);

  /* ---- 4. does it replicate? ---- */
  console.log("\n" + "-".repeat(78));
  console.log("4. SEASON BY SEASON, venue+month held out, hot band only (>=82F).");
  console.log("   One season can produce almost any number. Three that agree are a");
  console.log("   signal; three that disagree in sign are a sampling artefact.\n");
  for (const s of SEASONS) {
    const sub = open.filter((r) => r.season === s);
    if (sub.length < 200) continue;
    holdout((r) => r.temp >= 82, (r) => r.venue + "|" + r.month, "  " + s + "  >= 82", sub);
  }

  /* ---- 4b. the powerful version of the same question ---- */
  // Band tests throw away most of the sample: the cold bands hold 273 and 83
  // games and cannot resolve anything. But "is there a temperature response" is
  // one question, not five, and asking it once with the temperature kept
  // continuous uses all 5,530 games. Residual = did this game score, minus what
  // its own park-month scored without it, so the slope is already de-confounded.
  console.log("\n" + "-".repeat(78));
  console.log("4b. CONTINUOUS TREND, venue+month held out. One test, full sample —");
  console.log("    far more power than five band tests, and it is the shape the");
  console.log("    physics actually predicts (monotone in air density).\n");
  {
    const cells = new Map();
    for (const r of open) {
      const k = r.venue + "|" + r.month;
      const c = cells.get(k) || { k: 0, n: 0 };
      c.n++; if (r.scored) c.k++;
      cells.set(k, c);
    }
    // Leave-one-out on the cell, so a game is never part of its own expectation.
    const pts = [];
    for (const r of open) {
      const c = cells.get(r.venue + "|" + r.month);
      if (!c || c.n < 10) continue;
      const p = (c.k - (r.scored ? 1 : 0)) / (c.n - 1);
      pts.push([r.temp, (r.scored ? 1 : 0) - p]);
    }
    const n = pts.length;
    const mx = pts.reduce((a, p) => a + p[0], 0) / n;
    const my = pts.reduce((a, p) => a + p[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
    const slope = sxy / sxx;                       // YRFI probability per degree F
    const r = sxy / Math.sqrt(sxx * syy);
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    console.log("    n=" + n + "   slope " + (slope * 100).toFixed(4) + "pp of YRFI per degree F" +
      "   t=" + t.toFixed(2) + (Math.abs(t) >= 1.96 ? "   <- clears noise" : "   (inside noise)"));
    console.log("    over the 56F->86F span the model treats as neutral->hot, that is " +
      (slope * 30 * 100).toFixed(2) + "pp of YRFI.");
    const shipped = (1 + 0.20 * 0.60);
    const impl = lamOf(base + slope * 15) / lamOf(base - slope * 15);
    console.log("    implied lambda multiplier across that span: x" + impl.toFixed(3) +
      "   model applies x" + shipped.toFixed(3));
  }

  /* ---- 4c. wind, the same way ---- */
  // ENV_W_WIND is 0.25 and its own comment says the bands are kept "because the
  // physics is real ... not because this data supports it" — a factor retained
  // on faith. It has never been through a venue+month hold-out, and wind
  // direction is strongly park-specific (Wrigley's flags are a genuine local
  // climate), so the raw read is exactly the kind that a park control changes.
  console.log("\n" + "-".repeat(78));
  console.log("4c. WIND, venue+month held out. The bands the model actually branches on.\n");
  console.log("   band                    n     YRFI     expected      lambda x");
  const mphOf = (r) => Number((r.wind.match(/(\d+)/) || [])[1] || 0);
  const W = [
    ["out to CF 5+", (r) => /out to c/i.test(r.wind) && mphOf(r) >= 5],
    ["out to LF/RF 5+", (r) => /out to/i.test(r.wind) && !/out to c/i.test(r.wind) && mphOf(r) >= 5],
    ["in from CF 5+", (r) => /in from c/i.test(r.wind) && mphOf(r) >= 5],
    ["in from LF/RF 5+", (r) => /in from/i.test(r.wind) && !/in from c/i.test(r.wind) && mphOf(r) >= 5],
    ["crosswind 20+", (r) => mphOf(r) >= 20 && /l to r|r to l/i.test(r.wind)],
    ["calm (<5)", (r) => mphOf(r) < 5],
  ];
  for (const [label, f] of W) holdout(f, (r) => r.venue + "|" + r.month, label, open);

  // Six bands were tested, so one at p<0.05 is roughly what noise alone
  // produces. Two guards before any of this is allowed to change the model.
  //
  // First: is "blowing in" just a proxy for cold? Both suppress scoring, both
  // happen in April, and the venue+month cell does not separate them. If the
  // in-from buckets run several degrees colder than the out-to buckets, the
  // wind effect is partly the temperature effect wearing a different hat.
  console.log("\n   confound check — mean temperature in each band:");
  for (const [label, f] of W) {
    const s = open.filter(f);
    if (!s.length) continue;
    console.log("     " + label.padEnd(20) + (s.reduce((a, r) => a + r.temp, 0) / s.length).toFixed(1) + "F");
  }
  console.log("     " + "ALL OUTDOOR".padEnd(20) + (open.reduce((a, r) => a + r.temp, 0) / open.length).toFixed(1) + "F");

  // The model tiers every wind band by speed (5-11 / 12-19 / 20+). That
  // structure was assumed, never fit. If the tiers do not separate, tiering is
  // just three chances to overfit the same games, so measure before assigning.
  console.log("\n   speed tiers within the corner bands (the only ones with an effect):");
  console.log("   band                    n     YRFI     expected      lambda x");
  const corner = (dir) => (r) => new RegExp(dir, "i").test(r.wind) &&
    !new RegExp(dir + " c", "i").test(r.wind);
  for (const [dir, name] of [["out to", "out to LF/RF"], ["in from", "in from LF/RF"]])
    for (const [lo, hi, tag] of [[5, 11, "5-11"], [12, 19, "12-19"], [20, 99, "20+"]])
      holdout((r) => corner(dir)(r) && mphOf(r) >= lo && mphOf(r) <= hi,
        (r) => r.venue + "|" + r.month, "  " + name + " " + tag, open);

  // Second: does it replicate? A band that is real shows the same sign every
  // season. This is the test the start-hour lead failed.
  console.log("\n   replication, venue+month held out, by season:");
  for (const [label, f] of W) {
    if (!/LF\/RF/.test(label)) continue;   // only the two that cleared noise
    for (const s of SEASONS) {
      const sub = open.filter((r) => r.season === s);
      if (sub.length < 200) continue;
      holdout(f, (r) => r.venue + "|" + r.month, "  " + s + " " + label, sub);
    }
  }

  /* ---- 5. what the model does with it ---- */
  console.log("\n" + "-".repeat(78));
  console.log("5. WHAT SHIPS.  A continuous ramp, not a band: tFactor = 1 + 0.00377*(T-73.7),");
  console.log("   clamped to 0.91/1.09, ENV_W_TEMP 1.00 — applied to BOTH halves.");
  const ship = (t) => Math.max(0.91, Math.min(1.09, 1 + 0.00377 * (t - 73.7)));
  console.log("   temp:   " + [40, 50, 60, 70, 74, 80, 82, 84, 90, 100]
    .map((t) => t + "F").map((s) => s.padStart(7)).join(""));
  console.log("   ships:  " + [40, 50, 60, 70, 74, 80, 82, 84, 90, 100]
    .map((t) => ship(t).toFixed(3)).map((s) => s.padStart(7)).join(""));
  // The band this replaced jumped 1.000 -> 1.120 between 81F and 82F. Quantify
  // what that step was worth so a future reader can see why it had to go.
  console.log("   the retired band went 1.000 -> 1.120 across 81F/82F; the ramp moves " +
    (ship(82) - ship(81)).toFixed(4) + " there.");
  const hot = open.filter((r) => r.temp >= 82).length;
  console.log("   " + hot + " of " + open.length + " outdoor games (" + pct(hot / open.length) +
    ") were over that step, so it was not a rare correction — it was a quarter of the slate.");
  const meanT = open.reduce((a, r) => a + r.temp, 0) / open.length;
  console.log("   mean outdoor temp " + meanT.toFixed(1) + "F vs NRFI_TEMP_REF 73.7 — the ramp is");
  console.log("   centred on the season, so it is unbiased on average rather than only when cold.");
  if (Math.abs(meanT - 73.7) > 1.0)
    console.log("   ^ REF IS STALE by " + (meanT - 73.7).toFixed(1) + "F — re-centre NRFI_TEMP_REF.");
  /* ---- 6. regression guards ---- */
  // Comments survive the Babel build, and the note above weatherPark quotes the
  // very code it replaced, so assert against code only.
  const fs = require("fs"), pathm = require("path");
  const src = fs.readFileSync(pathm.join(__dirname, "..", "public", "desk", "app.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  let fail = 0;
  const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };
  console.log("\n" + "-".repeat(78) + "\nshipped bundle");

  // The wind block, isolated, so these assertions cannot be satisfied or broken
  // by mph tests belonging to some other factor. Anchor on the wind-specific mph
  // parse: the build emits a second, unrelated `const mph=` for pitch velocity,
  // and the minifier splits the wFactor assignments across statements, so
  // slicing from `wFactor=` catches only the `wFactor=1` initialiser.
  // Slice to the FIRST wFactor branch chain, not to `note =` — the note now
  // carries its own explanatory branches and pushed the terminator out of range.
  const wb = (src.match(/Number\(\(wind\.match[\s\S]{0,700}?note\s*=/) || [""])[0];
  if (!wb) throw new Error("could not locate the wind block — the guards below would vacuously pass");
  // Temperature bands are gone entirely. Assert on the absence of ANY threshold
  // test against temp, so re-introducing a band anywhere in the chain fails here
  // rather than quietly shipping a second cliff next to the ramp.
  ok(!/temp\s*[<>]=?\s*\d/.test(src),
    "temperature is banded nowhere — the 82F cliff is gone, not merely moved");
  ok(/ENV_W_TEMP\s*=\s*1(?:\.0+)?\b/.test(src),
    "temperature carries its magnitude in the slope, not hidden in a second weight");
  ok(!/mph\s*>=\s*(?:12|20)/.test(wb),
    "wind is not tiered by speed — the tiers ran backwards and were never fit");
  ok(/out to c\|in from c/i.test(wb) || /!\/(?:out to c|in from c)/i.test(wb),
    "centre-field wind is excluded, having measured x0.973 and x1.000 on 905 games");
  ok(/ENV_W_WIND\s*=\s*1(?:\.0+)?\b/.test(src),
    "wind carries its shrink in the band values, not hidden in a second weight");
  ok(/0\.82\s*,\s*1\.2(?:0)?\)/.test(src),
    "the env clamp admits a pitcher's park with the wind in rather than truncating it");
  // The refit is only meaningful if the two corner directions actually differ;
  // a copy-paste that set them equal would pass every test above.
  {
    const { loadDeskModel } = require("./nrfi-model-load");
    const c = loadDeskModel(pathm.join(__dirname, "..", "public", "desk", "app.js"));
    const wp = c.read("weatherPark");
    const f = (w) => wp({ weather: { temp: "70", condition: "Clear", wind: w } }, "CHC").wind;
    ok(f("10 mph, In From LF") < 0.95 && f("10 mph, Out To RF") > 1.02,
      "corner wind moves both ways: in=" + f("10 mph, In From LF").toFixed(3) +
      " out=" + f("10 mph, Out To RF").toFixed(3));
    ok(f("10 mph, In From CF") === 1 && f("10 mph, Out To CF") === 1,
      "centre field is exactly neutral in both directions");
    ok(f("3 mph, In From LF") === 1,
      "sub-5mph readings are treated as no wind, as they were in the measurement");

    // Temperature, behaviourally. A regex can confirm the band literals are gone
    // while the ramp is still wired up wrong, so exercise the real function.
    const t = (deg) => wp({ weather: { temp: String(deg), condition: "Clear", wind: "" } }, "CHC").temp;
    ok(Math.abs(t(73.7) - 1) < 1e-9,
      "the ramp is centred on NRFI_TEMP_REF: 73.7F is exactly neutral (" + t(73.7).toFixed(6) + ")");
    // The defect that started this: one degree used to be worth 0.120 of lambda.
    ok(Math.abs(t(82) - t(81) - 0.00377) < 1e-6,
      "81F -> 82F is one slope step (" + (t(82) - t(81)).toFixed(5) + "), not a 0.120 cliff");
    ok(t(84) > 1.03 && t(84) < 1.05,
      "84F carries x" + t(84).toFixed(3) + " — the measured gradient, not the retired band's x1.120");
    // Monotone across the whole plausible range, which the band was not: it was
    // flat from 56F to 81F and then vertical.
    let mono = true;
    for (let d = 30; d < 110; d++) if (t(d + 1) < t(d)) mono = false;
    ok(mono, "the ramp is monotone in temperature from 30F to 110F");
    ok(t(30) === 0.91 && t(110) === 1.09,
      "the ramp clamps outside the dense sample rather than extrapolating the fit");
  }
  console.log(fail ? "\n" + fail + " FAILED" : "\nall guards pass");
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
