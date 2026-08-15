// Do rest days and season workload actually predict a first-inning run?
//
// FIXED — rest is gone and season load no longer votes. This keeps the
// measurement on the record and asserts the bundle stays that way.
//
// What shipped before: restFactor bumped a tired or rusty arm up to 1.05, with a
// doc comment claiming "Weight is 0.10 so effect is tiny" -- but pitMult took it
// as `_rest` and never read it, so the real weight was zero. seasonLoadFactor
// climbs to 1.04 past 150 IP at weight 0.7. Neither can return a value below 1,
// so as consensus checks they could only ever vote YRFI or abstain.
//
// That one-sidedness was not cosmetic. On NYY@TOR the pitching family held 3
// NRFI checks against 3 YRFI, one of which was the season-load row; an even
// family abstains, so the ONLY family with any votes cast none, `total` fell to
// 0, and the "no check confirms this" rule knocked a STRONG down to BET. A vote
// with no term behind it silenced the five votes that did have terms.
//
// Measured at the HALF-INNING, which is the level the claim is about: rest is a
// property of one pitcher, so the question is whether HIS first inning goes
// badly, not whether the game as a whole scores. Home starter faces the top of
// the 1st, away starter the bottom.
//
// Workload is measured in cumulative starts rather than IP, because season IP as
// of a past date is not on the schedule feed. At roughly 5.3 IP a start, the
// 120/130/150 IP thresholds the model uses land near 23/25/28 starts.
const iso = (d) => d.toISOString().slice(0, 10);

function wilson(k, n) {
  if (!n) return [0, 0];
  const p = k / n, z = 1.96, z2 = z * z;
  const c = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n);
  return [c - h, c + h];
}
const pct = (x) => (x * 100).toFixed(1) + "%";

async function pull(a, b) {
  // gameType=R: sportId=1 alone also returns spring training, where rotations are
  // deliberately irregular and starters go two innings. Leaving those in put half
  // the sample in the "<10 starts" bucket and stretched the gaps between starts.
  const u = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=R&startDate=" + iso(a) +
    "&endDate=" + iso(b) + "&hydrate=probablePitcher,linescore";
  const r = await fetch(u);
  if (!r.ok) throw new Error("schedule " + r.status);
  return ((await r.json()).dates || []).flatMap((x) => x.games || []);
}

(async () => {
  const season = Number(process.argv[2] || new Date().getFullYear());
  const start = new Date(season + "-03-01T00:00:00Z");
  const end = new Date(Math.min(Date.now(), Date.parse(season + "-11-15T00:00:00Z")));

  const games = [];
  for (let t = start.getTime(); t < end.getTime(); t += 14 * 864e5) {
    const a = new Date(t), b = new Date(Math.min(t + 13 * 864e5, end.getTime()));
    games.push(...(await pull(a, b)));
  }
  games.sort((x, y) => Date.parse(x.gameDate) - Date.parse(y.gameDate));

  // One row per STARTER per game: his own half-inning result, his rest, and how
  // many starts he had already made this season.
  const lastStart = new Map();   // pid -> ms of previous start
  const startCount = new Map();  // pid -> starts so far
  const rows = [];
  for (const g of games) {
    if (!g.status || g.status.abstractGameState !== "Final") continue;
    const inn = g.linescore && g.linescore.innings && g.linescore.innings[0];
    if (!inn) continue;
    const t = Date.parse(g.gameDate);
    // A starter's own half: the home starter is on the mound for the top 1st.
    for (const [side, opp] of [["home", "away"], ["away", "home"]]) {
      const pp = g.teams && g.teams[side] && g.teams[side].probablePitcher;
      if (!pp || !pp.id) continue;
      const prev = lastStart.get(pp.id);
      const n = startCount.get(pp.id) || 0;
      const runs = Number((inn[opp] && inn[opp].runs) || 0);
      if (prev != null) {
        rows.push({
          pid: pp.id,
          rest: Math.round((t - prev) / 864e5),
          starts: n,
          clean: runs === 0,
        });
      }
      lastStart.set(pp.id, t);
      startCount.set(pp.id, n + 1);
    }
  }

  const rate = (f) => {
    const s = rows.filter(f);
    const k = s.filter((r) => r.clean).length;
    return { n: s.length, k, p: s.length ? k / s.length : 0, ci: wilson(k, s.length) };
  };
  const base = rate(() => true);
  const line = (label, r) => {
    const d = (r.p - base.p) * 100;
    console.log("  " + label.padEnd(22) + String(r.n).padStart(5) + "   " + pct(r.p).padStart(6) +
      "   [" + pct(r.ci[0]) + ", " + pct(r.ci[1]) + "]" +
      "   " + (d >= 0 ? "+" : "") + d.toFixed(2) + "pp" +
      (r.ci[0] > base.p || r.ci[1] < base.p ? "  *" : ""));
  };

  console.log("\nCLEAN FIRST INNING BY STARTER (" + season + ", " + rows.length + " starts)");
  console.log("  baseline clean rate: " + pct(base.p) + "   (* = 95% CI excludes the baseline)");

  console.log("\n-- REST DAYS --   model: <=3d f=1.05, 6-7d f=1.03, >=8d f=1.02 (all YRFI), weight 0");
  console.log("  bucket                    n    clean       95% CI            vs base");
  line("<=3 (short)", rate((r) => r.rest <= 3));
  line("4 (normal)", rate((r) => r.rest === 4));
  line("5 (normal)", rate((r) => r.rest === 5));
  line("6-7 (extra)", rate((r) => r.rest >= 6 && r.rest <= 7));
  line(">=8 (layoff)", rate((r) => r.rest >= 8 && r.rest <= 30));
  console.log("\n  the three buckets the model penalises, pooled:");
  line("  penalised", rate((r) => r.rest <= 3 || (r.rest >= 6 && r.rest <= 30)));
  line("  not penalised", rate((r) => r.rest === 4 || r.rest === 5));

  console.log("\n-- SEASON WORKLOAD --   model: >=120IP f=1.01, >=130 f=1.02, >=150 f=1.04, weight 0.7");
  console.log("  (starts, ~5.3 IP each; 120/130/150 IP is about 23/25/28 starts)");
  console.log("  bucket                    n    clean       95% CI            vs base");
  line("<10 starts", rate((r) => r.starts < 10));
  line("10-17", rate((r) => r.starts >= 10 && r.starts < 18));
  line("18-22", rate((r) => r.starts >= 18 && r.starts < 23));
  line("23-24 (~120IP)", rate((r) => r.starts >= 23 && r.starts < 25));
  line("25-27 (~130IP)", rate((r) => r.starts >= 25 && r.starts < 28));
  line(">=28 (~150IP)", rate((r) => r.starts >= 28));
  console.log("\n  the buckets the model penalises, pooled:");
  line("  >=23 starts", rate((r) => r.starts >= 23));
  line("  <23 starts", rate((r) => r.starts < 23));

  // Regression guard. Comments survive the Babel build and the ones documenting
  // this removal quote the code they replaced, so assert against code only.
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  let fail = 0;
  const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };
  console.log("\nshipped bundle");
  ok(!/function\s+restFactor|restFactor\s*\(/.test(src),
    "restFactor is gone, not merely unused");
  ok(!/\b_rest\b/.test(src),
    "pitMult has no parameter it accepts and never reads");
  ok(!/label:\s*"Pitcher rest days"/.test(src),
    "the zero-weight factor no longer casts a consensus ballot");
  ok(!/awayLoad\.f\s*>=[\s\S]{0,30}\|\|[\s\S]{0,30}homeLoad\.f\s*>=/.test(src),
    "season load no longer lets one heavy arm carry a paired row");
  ok(/label:\s*"Pitcher season load"[\s\S]{0,300}?lean:\s*"neutral"/.test(src),
    "season load is informational until a full season fills its >=23-start tail");
  // Whatever still votes has to be able to vote both ways. A check whose lean
  // expression names only one side is a thumb on the scale: it either pushes or
  // abstains, and an abstention is not neutral — an even family casts NO vote,
  // which is how the season-load row silenced five checks that had terms.
  //
  // A ternary chain has no closing token, so scan to the end of the object
  // literal by depth rather than trying to write a regex for it.
  const leans = [];
  for (let i = src.indexOf("lean:"); i >= 0; i = src.indexOf("lean:", i + 5)) {
    let d = 0;
    for (let j = i + 5; j < src.length && j < i + 600; j++) {
      const ch = src[j];
      if (ch === "(" || ch === "[" || ch === "{") d++;
      else if (ch === ")" || ch === "]") d--;
      else if (ch === "}") { if (d === 0) { leans.push(src.slice(i, j)); break; } d--; }
      else if (ch === "," && d === 0) { leans.push(src.slice(i, j)); break; }
    }
  }
  const oneSided = leans.filter((s) => {
    if (/facLean\s*\(/.test(s)) return false;              // facLean is symmetric by construction
    if (!/"(?:nrfi|yrfi)"/.test(s)) return false;           // a bare literal casts no conditional vote
    if (/OpenG\.opener/i.test(s)) return false;             // "is an opener starting" is a genuinely binary event
    return !(/"nrfi"/.test(s) && /"yrfi"/.test(s));
  });
  ok(oneSided.length === 0,
    "every surviving conditional vote can reach both nrfi and yrfi" +
    (oneSided.length ? " — one-sided: " + oneSided.join("  |  ") : ""));
  console.log("        (scanned " + leans.length + " lean expressions)");
  console.log(fail ? "\n" + fail + " FAILED" : "\nall checks pass");
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
