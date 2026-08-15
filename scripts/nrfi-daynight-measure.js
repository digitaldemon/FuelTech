// Re-measure the day-game penalty against CORRECT labels.
//
// nrfiEvaluate applies a -0.15 logit YRFI shift to "day games", and cites a 2026
// backtest of 886 day / 877 night showing 4.5pp less NRFI. That split is almost
// exactly 50/50 -- but real day games are about a quarter of an MLB schedule.
// The backtest was counting `getUTCHours() < 20`, the same rule the model uses,
// and that rule wraps: any first pitch after 8pm Eastern crosses midnight UTC and
// re-enters the window from the bottom. So the "day" bucket it fitted on was
// roughly half genuine day games and half West-Coast and Central night games.
//
// A coefficient fitted on a scrambled label does not transfer to a clean one.
// This measures the real effect with venue local time, so the classifier fix and
// the coefficient it feeds can move together.
const DAYS = Number(process.argv[2] || 140);
const end = new Date();
const start = new Date(end.getTime() - DAYS * 864e5);
const iso = (d) => d.toISOString().slice(0, 10);

const VENUE_TZ = {
  AZ: "America/Phoenix", ARI: "America/Phoenix", ATL: "America/New_York",
  BAL: "America/New_York", BOS: "America/New_York", CHC: "America/Chicago",
  CIN: "America/New_York", CLE: "America/New_York", COL: "America/Denver",
  CWS: "America/Chicago", DET: "America/New_York", HOU: "America/Chicago",
  KC: "America/Chicago", LAA: "America/Los_Angeles", LAD: "America/Los_Angeles",
  MIA: "America/New_York", MIL: "America/Chicago", MIN: "America/Chicago",
  NYM: "America/New_York", NYY: "America/New_York", ATH: "America/Los_Angeles",
  OAK: "America/Los_Angeles", PHI: "America/New_York", PIT: "America/New_York",
  SD: "America/Los_Angeles", SEA: "America/Los_Angeles", SF: "America/Los_Angeles",
  STL: "America/Chicago", TB: "America/New_York", TEX: "America/Chicago",
  TOR: "America/New_York", WSH: "America/New_York",
};
function localHour(isoTs, tz) {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false })
    .format(new Date(isoTs));
  const [h, m] = s.split(":").map(Number);
  return (h % 24) + m / 60;
}

function wilson(k, n) {
  if (!n) return [0, 0];
  const p = k / n, z = 1.96, z2 = z * z;
  const c = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n);
  return [c - h, c + h];
}
const pct = (x) => (x * 100).toFixed(1) + "%";
const logit = (p) => Math.log(p / (1 - p));

async function pull(a, b) {
  const u = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=" + iso(a) +
    "&endDate=" + iso(b) + "&hydrate=linescore,team";
  const r = await fetch(u);
  if (!r.ok) throw new Error("schedule " + r.status);
  return ((await r.json()).dates || []).flatMap((x) => x.games || []);
}

(async () => {
  const games = [];
  for (let t = start.getTime(); t < end.getTime(); t += 14 * 864e5) {
    const a = new Date(t), b = new Date(Math.min(t + 13 * 864e5, end.getTime()));
    games.push(...(await pull(a, b)));
  }
  const rows = [];
  for (const g of games) {
    if (!g.status || g.status.abstractGameState !== "Final") continue;
    const inn = g.linescore && g.linescore.innings && g.linescore.innings[0];
    if (!inn) continue;
    const abbr = g.teams && g.teams.home && g.teams.home.team && g.teams.home.team.abbreviation;
    const tz = VENUE_TZ[abbr];
    if (!tz || !g.gameDate) continue;
    const runs = Number((inn.away && inn.away.runs) || 0) + Number((inn.home && inn.home.runs) || 0);
    rows.push({
      nrfi: runs === 0,
      lh: localHour(g.gameDate, tz),
      shipped: new Date(g.gameDate).getUTCHours() < 20,   // the rule in the model
      mlb: g.dayNight === "day",                          // MLB's own designation
    });
  }

  const rate = (f) => {
    const s = rows.filter(f);
    const k = s.filter((r) => r.nrfi).length;
    return { n: s.length, k, p: s.length ? k / s.length : 0, ci: wilson(k, s.length) };
  };
  const line = (label, r) => console.log("  " + label.padEnd(30) + String(r.n).padStart(5) + "   " +
    pct(r.p).padStart(6) + "   [" + pct(r.ci[0]) + ", " + pct(r.ci[1]) + "]");

  console.log("\nFIRST-INNING NRFI BY START TIME  (" + rows.length + " final games, last " + DAYS + " days)");
  console.log("  bucket                            n     NRFI      95% CI");

  console.log("\n  -- as the SHIPPED classifier labels them (getUTCHours() < 20) --");
  const sd = rate((r) => r.shipped), sn = rate((r) => !r.shipped);
  line("\"day\"", sd); line("\"night\"", sn);
  console.log("    share labelled day: " + pct(sd.n / rows.length) +
    "   gap: " + ((sd.p - sn.p) * 100).toFixed(2) + "pp");

  console.log("\n  -- by venue LOCAL first pitch --");
  const td = rate((r) => r.lh < 16), tn = rate((r) => r.lh >= 16);
  line("day (local < 4pm)", td); line("night (local >= 4pm)", tn);
  console.log("    share genuinely day: " + pct(td.n / rows.length) +
    "   gap: " + ((td.p - tn.p) * 100).toFixed(2) + "pp");

  console.log("\n  -- by MLB's own dayNight field (what the fix will ship) --");
  const md = rate((r) => r.mlb), mn = rate((r) => !r.mlb);
  line("day", md); line("night", mn);
  console.log("    share labelled day: " + pct(md.n / rows.length) +
    "   gap: " + ((md.p - mn.p) * 100).toFixed(2) + "pp" +
    "   logit: " + (logit(md.p) - logit(mn.p) >= 0 ? "+" : "") + (logit(md.p) - logit(mn.p)).toFixed(4));
  console.log("    agrees with venue local time on " +
    pct(rows.filter((r) => r.mlb === (r.lh < 16)).length / rows.length) + " of games");

  console.log("\n  -- finer, by local hour --");
  for (const [lo, hi, lbl] of [[0, 13, "before 1pm"], [13, 16, "1pm-4pm"], [16, 19, "4pm-7pm"], [19, 24, "7pm+"]])
    line(lbl, rate((r) => r.lh >= lo && r.lh < hi));

  console.log("\n  -- the games the shipped rule gets wrong --");
  line("night, mislabelled day", rate((r) => r.shipped && r.lh >= 16));
  line("day, mislabelled night", rate((r) => !r.shipped && r.lh < 16));

  const shift = logit(td.p) - logit(tn.p);
  console.log("\n  SHIPPED penalty:  -0.15 logit  (fitted on the labels above-left)");
  console.log("  MEASURED on clean labels: " + (shift >= 0 ? "+" : "") + shift.toFixed(4) + " logit" +
    "  -> day is " + (td.p >= tn.p ? "MORE" : "less") + " NRFI than night");
  console.log("  (model subtracts the shift, so a POSITIVE measured logit means the");
  console.log("   penalty is pointed the wrong way once the labels are fixed)");
})().catch((e) => { console.error(e); process.exit(1); });
