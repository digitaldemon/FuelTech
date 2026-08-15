// What are the home-field and weather effects on FIRST-INNING scoring, actually?
//
// homePitAdvantage/homeOffAdvantage ship as hardcoded constants (0.97/1.03,
// 1.02/0.98) and weatherPark multiplies a park factor by a temperature factor by
// a wind factor with no weight and no clamp. None of those numbers was ever
// measured against first-inning data — they are full-game intuitions carried
// into a model that only ever sees one inning.
//
// This measures all of them off completed games, so the fix is a fit and not
// another guess. First inning only; the whole point is that the 1st does not
// behave like the game around it.
const DAYS = Number(process.argv[2] || 140);
const end = new Date();
const start = new Date(end.getTime() - DAYS * 864e5);
const iso = (d) => d.toISOString().slice(0, 10);

async function pullSchedule(a, b) {
  const u = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=" + iso(a) +
    "&endDate=" + iso(b) + "&hydrate=linescore,weather,venue";
  const r = await fetch(u);
  if (!r.ok) throw new Error("schedule " + r.status);
  const d = await r.json();
  return (d.dates || []).flatMap((x) => x.games || []);
}

// A Wilson interval, so a 40-game weather bucket is not read as if it were 2000.
function wilson(k, n) {
  if (!n) return [0, 0];
  const p = k / n, z = 1.96, z2 = z * z;
  const c = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n);
  return [c - h, c + h];
}
const pct = (x) => (x * 100).toFixed(1) + "%";

(async () => {
  const games = [];
  // The API caps a schedule span, so walk it in fortnights.
  for (let t = start.getTime(); t < end.getTime(); t += 14 * 864e5) {
    const a = new Date(t), b = new Date(Math.min(t + 13 * 864e5, end.getTime()));
    games.push(...(await pullSchedule(a, b)));
  }
  const rows = [];
  for (const g of games) {
    if (String(g.status && g.status.abstractGameState).toLowerCase() !== "final") continue;
    const inn1 = ((g.linescore && g.linescore.innings) || [])[0];
    if (!inn1 || !inn1.away || !inn1.home) continue;
    // A skipped bottom of the 1st cannot exist, but a suspended game can leave
    // the half unplayed; runs==null is not runs==0.
    if (inn1.away.runs == null || inn1.home.runs == null) continue;
    const w = g.weather || {};
    rows.push({
      awayR: inn1.away.runs, homeR: inn1.home.runs,
      temp: w.temp != null && w.temp !== "" ? Number(w.temp) : null,
      cond: String(w.condition || ""), wind: String(w.wind || ""),
      park: (g.venue && g.venue.name) || "",
    });
  }
  console.log("\n" + rows.length + " completed games with a first inning, " +
    iso(start) + " .. " + iso(end));

  /* ---- 1. home field ---- */
  console.log("\n" + "=".repeat(72) + "\nHOME FIELD IN THE FIRST INNING");
  const awayScored = rows.filter((r) => r.awayR > 0).length;
  const homeScored = rows.filter((r) => r.homeR > 0).length;
  const n = rows.length;
  const [al, ah] = wilson(awayScored, n), [hl, hh] = wilson(homeScored, n);
  console.log("  away bats top 1st, scores:  " + pct(awayScored / n) + "  [" + pct(al) + ", " + pct(ah) + "]");
  console.log("  home bats bot 1st, scores:  " + pct(homeScored / n) + "  [" + pct(hl) + ", " + pct(hh) + "]");
  const ratio = (homeScored / n) / (awayScored / n);
  console.log("  home/away scoring-rate ratio: " + ratio.toFixed(4));
  console.log("  overlap of the two intervals: " + (hl <= ah && al <= hh ? "YES — the split is inside noise" : "no"));
  // The model applies offense and pitching HFA separately, but a half-inning's
  // run rate is the only thing observable; they cannot be identified apart.
  const lamAway = -Math.log(1 - awayScored / n), lamHome = -Math.log(1 - homeScored / n);
  console.log("  implied lambda ratio (home half / away half): " + (lamHome / lamAway).toFixed(4));
  console.log("  model currently applies: away half x" + (0.98 * 0.97).toFixed(4) +
    ", home half x" + (1.02 * 1.03).toFixed(4) +
    "  -> ratio " + ((1.02 * 1.03) / (0.98 * 0.97)).toFixed(4));
  console.log("  net effect on P(NRFI), both halves combined: x" +
    (0.98 * 0.97 * 1.02 * 1.03).toFixed(5) + " on summed lambda");

  /* ---- 2. weather ---- */
  const rate = (sub) => {
    const k = sub.filter((r) => r.awayR > 0 || r.homeR > 0).length;
    return { k, n: sub.length, p: sub.length ? k / sub.length : 0 };
  };
  const all = rate(rows);
  console.log("\n" + "=".repeat(72) + "\nWEATHER IN THE FIRST INNING  (baseline: any run scored in the 1st = " +
    pct(all.p) + " over " + all.n + " games)");
  const report = (label, sub) => {
    if (sub.length < 25) { console.log("  " + label.padEnd(26) + String(sub.length).padStart(5) + "g   (too thin to read)"); return; }
    const s = rate(sub);
    const [lo, hi] = wilson(s.k, s.n);
    // Convert the run-rate ratio into the lambda multiplier the model would need.
    const lam = -Math.log(1 - s.p), lam0 = -Math.log(1 - all.p);
    const sig = lo > all.p || hi < all.p;
    console.log("  " + label.padEnd(26) + String(s.n).padStart(5) + "g   " + pct(s.p) +
      "  [" + pct(lo) + ", " + pct(hi) + "]   implied x" + (lam / lam0).toFixed(3) +
      (sig ? "   <- clears noise" : ""));
  };
  const dome = rows.filter((r) => /dome|roof closed/i.test(r.cond));
  const open = rows.filter((r) => !/dome|roof closed/i.test(r.cond));
  report("indoors", dome);
  report("outdoors", open);
  console.log("  -- temperature (outdoor only), model bands --");
  report("temp >= 92  (x1.09)", open.filter((r) => r.temp != null && r.temp >= 92));
  report("temp 82-91  (x1.05)", open.filter((r) => r.temp != null && r.temp >= 82 && r.temp < 92));
  report("temp 56-81  (neutral)", open.filter((r) => r.temp != null && r.temp >= 56 && r.temp < 82));
  report("temp 46-55  (x0.94)", open.filter((r) => r.temp != null && r.temp >= 46 && r.temp < 56));
  report("temp < 46   (x0.89)", open.filter((r) => r.temp != null && r.temp < 46));
  console.log("  -- wind (outdoor only), model bands --");
  const mph = (r) => Number((r.wind.match(/(\d+)/) || [])[1] || 0);
  report("out to CF, 12+ (x1.09+)", open.filter((r) => /out to c/i.test(r.wind) && mph(r) >= 12));
  report("out to CF, 5-11 (x1.05)", open.filter((r) => /out to c/i.test(r.wind) && mph(r) >= 5 && mph(r) < 12));
  report("in from CF, 12+ (x0.92-)", open.filter((r) => /in from c/i.test(r.wind) && mph(r) >= 12));
  report("out to LF/RF, 5+", open.filter((r) => /out to/i.test(r.wind) && !/out to c/i.test(r.wind) && mph(r) >= 5));
  report("in from LF/RF, 5+", open.filter((r) => /in from/i.test(r.wind) && !/in from c/i.test(r.wind) && mph(r) >= 5));
  report("crosswind 20+ (x0.98)", open.filter((r) => mph(r) >= 20 && /l to r|r to l/i.test(r.wind)));
  report("calm (<5 mph)", open.filter((r) => mph(r) < 5));

  /* ---- 3. does the compounding ever actually bite? ---- */
  console.log("\n" + "=".repeat(72) + "\nCOMPOUNDING");
  let worst = 1, worstNote = "";
  for (const r of rows) {
    if (/dome|roof closed/i.test(r.cond)) continue;
    let f = 1;
    if (r.temp != null) f *= r.temp >= 92 ? 1.09 : r.temp >= 82 ? 1.05 : r.temp >= 56 ? 1 : r.temp >= 46 ? 0.94 : 0.89;
    const m = mph(r);
    if (m >= 5) {
      if (/out to c/i.test(r.wind)) f *= m >= 20 ? 1.14 : m >= 12 ? 1.09 : 1.05;
      else if (/in from c/i.test(r.wind)) f *= m >= 20 ? 0.87 : m >= 12 ? 0.92 : 0.96;
      else if (/out to/i.test(r.wind)) f *= m >= 20 ? 1.07 : m >= 12 ? 1.04 : 1.02;
      else if (/in from/i.test(r.wind)) f *= m >= 20 ? 0.94 : m >= 12 ? 0.97 : 0.99;
      else if (m >= 20 && /l to r|r to l/i.test(r.wind)) f *= 0.98;
    }
    if (f > worst) { worst = f; worstNote = r.park + " " + r.temp + "° " + r.wind; }
  }
  console.log("  largest temp x wind product observed: x" + worst.toFixed(3) + "   (" + worstNote + ")");
  console.log("  before the park factor, which multiplies on top and reaches ~1.12 at Coors.");
  console.log("  env multiplies lambda in BOTH halves, so P(NRFI) takes it twice.");
})().catch((e) => { console.error(e); process.exit(1); });
