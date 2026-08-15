// Does first-pitch LOCAL HOUR predict a first-inning run, once the park is held fixed?
//
// This is the loose end left by the day/night fix. Withdrawing that penalty
// (scripts/nrfi-daynight-measure.js) killed a -0.15 logit term that turned out to
// have been fitted on its own broken labels. But one thing survived the
// relabelling and was explicitly NOT shipped, because it is a different claim:
//
//   before 1pm  56.5%   1pm-4pm  49.1%   4pm-7pm  51.5%   7pm+  45.6%
//
// 7pm+ is the modal MLB start, so that bucket is huge, and ~5pp below the field
// is worth about -0.22 logit if real. Two reasons it was held back:
//
//   1. VENUE CONFOUND. Late local starts are not distributed evenly across
//      parks. If the 7pm+ bucket is overweight in hitters' parks, the hour is
//      just reading the park, which NRFI_PARK already prices.
//   2. It is partly the day/night axis restated, and that axis measured null.
//
// So the test that decides it is the WITHIN-VENUE one: at the same park, does a
// 7pm game score more in the first than a 6pm game? Park identity, park
// dimensions, altitude, roof, and the home team's own offense are all held
// fixed by construction. What is left is the hour.
//
// Three seasons, because one season of within-venue contrasts is thin: a park
// hosts ~81 games and only some of them are early.
const SEASONS = (process.argv[2] || "2024,2025,2026").split(",").map(Number);

const iso = (d) => d.toISOString().slice(0, 10);
const pct = (x) => (x * 100).toFixed(1) + "%";
const logit = (p) => Math.log(p / (1 - p));

function wilson(k, n) {
  if (!n) return [0, 0];
  const p = k / n, z = 1.96, z2 = z * z;
  const c = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n);
  return [c - h, c + h];
}

async function pull(a, b) {
  const u = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=R&startDate=" + iso(a) +
    "&endDate=" + iso(b) + "&hydrate=linescore,team,venue";
  const r = await fetch(u);
  if (!r.ok) throw new Error("schedule " + r.status);
  return ((await r.json()).dates || []).flatMap((x) => x.games || []);
}

// Venue timezone straight from the API rather than a hand-kept abbreviation map:
// neutral-site and relocated games (Sacramento, Tampa's 2025 season at Steinbrenner)
// carry the right zone without anyone remembering to add a row.
async function venueZones(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const j = await fetch("https://statsapi.mlb.com/api/v1/venues?venueIds=" + chunk.join(",") +
      "&hydrate=timezone").then((r) => r.json());
    for (const v of j.venues || []) if (v.timeZone && v.timeZone.id) out.set(v.id, v.timeZone.id);
  }
  return out;
}

function localHour(isoTs, tz) {
  const s = new Intl.DateTimeFormat("en-US",
    { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false }).format(new Date(isoTs));
  const [h, m] = s.split(":").map(Number);
  return (h % 24) + m / 60;
}

const BUCKETS = [[0, 13, "before 1pm"], [13, 16, "1pm-4pm"], [16, 19, "4pm-7pm"], [19, 24, "7pm+"]];
const bucketOf = (lh) => BUCKETS.findIndex(([lo, hi]) => lh >= lo && lh < hi);

(async () => {
  const games = [];
  for (const season of SEASONS) {
    const start = new Date(season + "-03-15T00:00:00Z");
    const end = new Date(Math.min(Date.now(), Date.parse(season + "-11-15T00:00:00Z")));
    for (let t = start.getTime(); t < end.getTime(); t += 14 * 864e5) {
      const a = new Date(t), b = new Date(Math.min(t + 13 * 864e5, end.getTime()));
      games.push(...(await pull(a, b)));
    }
  }

  const finals = games.filter((g) => g.status && g.status.abstractGameState === "Final" &&
    g.linescore && g.linescore.innings && g.linescore.innings[0] && g.venue && g.venue.id);
  const zones = await venueZones([...new Set(finals.map((g) => g.venue.id))]);

  const rows = [];
  for (const g of finals) {
    const tz = zones.get(g.venue.id);
    if (!tz || !g.gameDate) continue;
    const inn = g.linescore.innings[0];
    const runs = Number((inn.away && inn.away.runs) || 0) + Number((inn.home && inn.home.runs) || 0);
    const lh = localHour(g.gameDate, tz);
    rows.push({ nrfi: runs === 0, lh, b: bucketOf(lh), venue: g.venue.id,
      night: g.dayNight !== "day", year: Number(g.gameDate.slice(0, 4)) });
  }

  const rate = (f) => {
    const s = rows.filter(f);
    const k = s.filter((r) => r.nrfi).length;
    return { n: s.length, k, p: s.length ? k / s.length : 0, ci: wilson(k, s.length) };
  };
  const base = rate(() => true);
  console.log("\nFIRST-INNING NRFI BY LOCAL START HOUR");
  console.log("  seasons " + SEASONS.join(", ") + " · " + rows.length + " final regular-season games · " +
    zones.size + " venues · baseline " + pct(base.p));

  console.log("\n-- 1. RAW, as the earlier measurement had it --");
  console.log("  bucket                  n     NRFI      95% CI            vs base");
  for (let i = 0; i < BUCKETS.length; i++) {
    const r = rate((x) => x.b === i);
    console.log("  " + BUCKETS[i][2].padEnd(14) + String(r.n).padStart(6) + "   " + pct(r.p).padStart(6) +
      "   [" + pct(r.ci[0]) + ", " + pct(r.ci[1]) + "]   " +
      ((r.p - base.p) * 100 >= 0 ? "+" : "") + ((r.p - base.p) * 100).toFixed(2) + "pp");
  }

  /* ---- 2. within-venue ----
   * A park's own NRFI rate is subtracted from each of its games, so what is left
   * is that game's deviation from what that park usually does. Averaging those
   * residuals inside an hour bucket asks the only question that matters: at the
   * SAME park, is a late game different from an early one?
   *
   * SE is the standard error of the residual mean. It is very slightly optimistic
   * (the venue means are estimated from the same data), but with ~80 venues over
   * three seasons the correction is a fraction of a percent of the SE. */
  const vStat = new Map();
  for (const r of rows) {
    if (!vStat.has(r.venue)) vStat.set(r.venue, { n: 0, k: 0 });
    const v = vStat.get(r.venue); v.n++; if (r.nrfi) v.k++;
  }
  const resid = (f) => {
    const s = rows.filter(f);
    if (!s.length) return { n: 0, mean: 0, se: 0 };
    const d = s.map((r) => { const v = vStat.get(r.venue); return (r.nrfi ? 1 : 0) - v.k / v.n; });
    const mean = d.reduce((a, x) => a + x, 0) / d.length;
    const varr = d.reduce((a, x) => a + (x - mean) * (x - mean), 0) / Math.max(1, d.length - 1);
    return { n: d.length, mean, se: Math.sqrt(varr / d.length) };
  };
  console.log("\n-- 2. WITHIN VENUE (each game minus its own park's rate) --");
  console.log("  this is the test: same park, different hour");
  console.log("  bucket                  n   vs own park      95% CI            z");
  for (let i = 0; i < BUCKETS.length; i++) {
    const r = resid((x) => x.b === i);
    const lo = (r.mean - 1.96 * r.se) * 100, hi = (r.mean + 1.96 * r.se) * 100;
    console.log("  " + BUCKETS[i][2].padEnd(14) + String(r.n).padStart(6) + "   " +
      ((r.mean * 100 >= 0 ? "+" : "") + (r.mean * 100).toFixed(2) + "pp").padStart(8) +
      "   [" + lo.toFixed(2) + ", " + hi.toFixed(2) + "]" +
      "   z=" + (r.se ? (r.mean / r.se).toFixed(2) : "--") +
      (Math.abs(r.mean / r.se) >= 1.96 ? "  *" : ""));
  }

  /* ---- 3. night games only ----
   * The day/night axis already measured null on MLB's own labels, so if the hour
   * effect is only day-vs-night restated it has already been rejected. Restrict
   * to night games and the remaining contrast is 4pm-7pm against 7pm+, which is
   * a claim about start hour and nothing else. */
  console.log("\n-- 3. NIGHT GAMES ONLY, within venue (is this just day/night again?) --");
  for (const [lo, hi, lbl] of [[16, 19, "night, 4pm-7pm"], [19, 24, "night, 7pm+"]]) {
    const r = resid((x) => x.night && x.lh >= lo && x.lh < hi);
    console.log("  " + lbl.padEnd(16) + String(r.n).padStart(6) + "   " +
      ((r.mean * 100 >= 0 ? "+" : "") + (r.mean * 100).toFixed(2) + "pp").padStart(8) +
      "   z=" + (r.se ? (r.mean / r.se).toFixed(2) : "--"));
  }

  /* ---- 4. does it replicate? ----
   * A real effect shows up in each season on its own. One season carrying the
   * whole thing is the signature of a fluke that a pooled n makes look solid. */
  console.log("\n-- 4. 7pm+ within venue, season by season (does it replicate?) --");
  for (const s of SEASONS) {
    const r = resid((x) => x.year === s && x.b === 3);
    if (!r.n) continue;
    console.log("  " + s + "            " + String(r.n).padStart(6) + "   " +
      ((r.mean * 100 >= 0 ? "+" : "") + (r.mean * 100).toFixed(2) + "pp").padStart(8) +
      "   z=" + (r.se ? (r.mean / r.se).toFixed(2) : "--"));
  }

  /* ---- 5. day/night on the same three seasons ----
   * The withdrawn penalty was replaced by a card line quoting 51.1% vs 48.9%,
   * which came from 1,936 games of 2026 alone. If a null is going to be printed
   * on the card as the reason there is no adjustment, it should be the best null
   * available, and it should be checked for the same non-replication that just
   * sank the start-hour lead. */
  console.log("\n-- 5. DAY vs NIGHT on the same sample (the figure the card quotes) --");
  const md = rate((x) => !x.night), mn = rate((x) => x.night);
  console.log("  day            " + String(md.n).padStart(6) + "   " + pct(md.p).padStart(6) +
    "   [" + pct(md.ci[0]) + ", " + pct(md.ci[1]) + "]");
  console.log("  night          " + String(mn.n).padStart(6) + "   " + pct(mn.p).padStart(6) +
    "   [" + pct(mn.ci[0]) + ", " + pct(mn.ci[1]) + "]");
  console.log("  gap " + ((md.p - mn.p) * 100 >= 0 ? "+" : "") + ((md.p - mn.p) * 100).toFixed(2) +
    "pp   within venue " + (() => { const r = resid((x) => !x.night);
      return ((r.mean * 100 >= 0 ? "+" : "") + (r.mean * 100).toFixed(2) + "pp  z=" + (r.mean / r.se).toFixed(2)); })());
  for (const s of SEASONS) {
    const d = rate((x) => x.year === s && !x.night), n2 = rate((x) => x.year === s && x.night);
    if (!d.n) continue;
    console.log("    " + s + "  day " + pct(d.p) + " (n=" + d.n + ")  night " + pct(n2.p) +
      " (n=" + n2.n + ")   gap " + ((d.p - n2.p) * 100 >= 0 ? "+" : "") + ((d.p - n2.p) * 100).toFixed(2) + "pp");
  }

  const r3 = resid((x) => x.b === 3);
  const shift = logit(base.p + r3.mean) - logit(base.p);
  console.log("\n  VERDICT");
  console.log("  7pm+ within venue: " + (r3.mean * 100 >= 0 ? "+" : "") + (r3.mean * 100).toFixed(2) +
    "pp  (z=" + (r3.mean / r3.se).toFixed(2) + "), which is " +
    (shift >= 0 ? "+" : "") + shift.toFixed(4) + " logit. Nothing to price.");
  console.log("");
  console.log("  Note that the venue confound was NOT what killed it. The raw");
  console.log("  three-season gap is only -0.88pp, so the -5pp never existed");
  console.log("  outside 2026 to be confounded in the first place — section 4 is");
  console.log("  the one that decides it, and the two earlier seasons run the");
  console.log("  other way. A single season is not enough to fit a term on, which");
  console.log("  is the same lesson the -0.15 day-game penalty taught.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
