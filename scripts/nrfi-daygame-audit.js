// Does `isDayGame` actually mean "day game"?
//
// nrfiEvaluate decides it with `new Date(startUtc).getUTCHours() < 20`, described
// in the code as "before ~4pm local (approximated as UTC < 20:00)". That
// approximation only holds for Eastern-time first pitches earlier than 8pm. Any
// start that crosses midnight UTC wraps to a small hour and re-enters the window
// from the bottom, so a 7:10pm Central or 7:05pm Pacific night game is graded a
// day game and takes the -0.15 logit YRFI penalty.
//
// This checks the rule against the venue's real local first-pitch time, which the
// MLB schedule already publishes as gameDate + the venue timezone.
const VENUE_TZ = {
  "AZ": "America/Phoenix", "ARI": "America/Phoenix",
  "ATL": "America/New_York", "BAL": "America/New_York", "BOS": "America/New_York",
  "CHC": "America/Chicago", "CIN": "America/New_York", "CLE": "America/New_York",
  "COL": "America/Denver", "CWS": "America/Chicago", "DET": "America/New_York",
  "HOU": "America/Chicago", "KC": "America/Chicago", "LAA": "America/Los_Angeles",
  "LAD": "America/Los_Angeles", "MIA": "America/New_York", "MIL": "America/Chicago",
  "MIN": "America/Chicago", "NYM": "America/New_York", "NYY": "America/New_York",
  "ATH": "America/Los_Angeles", "OAK": "America/Los_Angeles",
  "PHI": "America/New_York", "PIT": "America/New_York", "SD": "America/Los_Angeles",
  "SEA": "America/Los_Angeles", "SF": "America/Los_Angeles", "STL": "America/Chicago",
  "TB": "America/New_York", "TEX": "America/Chicago", "TOR": "America/New_York",
  "WSH": "America/New_York",
};

function localHour(iso, tz) {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false })
    .format(new Date(iso));
  const [h, m] = s.split(":").map(Number);
  return h + m / 60;
}

// What the shipped model believes.
const shipped = (iso) => new Date(iso).getUTCHours() < 20;

(async () => {
  const days = Number(process.argv[2] || 21);
  const end = new Date();
  const start = new Date(end - (days - 1) * 86400000);
  const f = (d) => d.toISOString().slice(0, 10);
  const url = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=" + f(start) +
    "&endDate=" + f(end) + "&hydrate=venue,team";
  const j = await fetch(url).then((r) => r.json());

  let n = 0, wrong = 0, falseDay = 0, falseNight = 0;
  const examples = [];
  for (const d of j.dates || []) {
    for (const g of d.games || []) {
      const abbr = g.teams && g.teams.home && g.teams.home.team && g.teams.home.team.abbreviation;
      const tz = VENUE_TZ[abbr];
      if (!tz || !g.gameDate) continue;
      n++;
      const lh = localHour(g.gameDate, tz);
      const truth = lh < 16;                    // the rule the comment describes
      const said = shipped(g.gameDate);
      if (truth === said) continue;
      wrong++;
      if (said && !truth) falseDay++; else falseNight++;
      if (examples.length < 12) {
        const hh = Math.floor(lh), mm = Math.round((lh - hh) * 60);
        examples.push("  " + (g.teams.away.team.abbreviation + "@" + abbr).padEnd(9) +
          g.gameDate.slice(0, 16).replace("T", " ") + "Z" +
          "  local " + String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") +
          "  model says " + (said ? "DAY" : "night") + ", actually " + (truth ? "day" : "NIGHT"));
      }
    }
  }
  console.log("\nDAY-GAME CLASSIFIER, last " + days + " days  (" + n + " games)");
  console.log("  misclassified:            " + wrong + "  (" + (wrong / n * 100).toFixed(1) + "%)");
  console.log("  night games called DAY:   " + falseDay + "   <- these take the -0.15 YRFI penalty");
  console.log("  day games called night:   " + falseNight);
  console.log("\nexamples:");
  for (const e of examples) console.log(e);
})().catch((e) => { console.error(e); process.exit(1); });
