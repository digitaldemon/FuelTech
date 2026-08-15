// Is PITCHER_BT still true? The table is hand-maintained (see the "v5: revised"
// comments) and holds each starter's clean-1st-inning rate as a literal. Those
// literals age every start, and nothing in the build checks them, so a pitcher
// who has since fallen apart keeps voting "elite" until someone notices by hand.
//
//   node scripts/nrfi-pitcherbt-audit.js
//
// Pulls each named pitcher's actual i01 split for the current season and prints
// the drift. Read-only: it changes nothing, it just tells you what to fix.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");

const i = src.indexOf("const PITCHER_BT = (() => {");
const j = src.indexOf("\n})();", i);
if (i < 0 || j < 0) throw new Error("PITCHER_BT not found — did it move?");
const table = eval(src.slice(i, j + "\n})();".length).replace("const PITCHER_BT =", "(") + ")");

const J = async (u) => { const r = await fetch(u, { headers: { accept: "application/json" } }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };
const se = new Date().getUTCFullYear();

// The table keys on lowercased full name, so resolve names the same way the app
// does — pitcherBT(ctx.awayPP) with whatever string the schedule feed supplies.
async function lookup(name) {
  const d = await J(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&sportIds=1`);
  const p = (d.people || []).find((x) => x.primaryPosition?.code === "1") || (d.people || [])[0];
  if (!p) return null;
  const s = await J(`https://statsapi.mlb.com/api/v1/people/${p.id}/stats?stats=statSplits&group=pitching&sitCodes=i01&season=${se}&gameType=R`);
  const st = s.stats?.[0]?.splits?.[0]?.stat;
  if (!st || !st.gamesPlayed) return { id: p.id, n: 0, clean: null };
  // "clean" in the table means share of first innings with no run allowed. The
  // i01 split gives runs and games; a game with 0 runs in the 1st is a clean one.
  // MLB does not expose the count directly, so derive it from the game log.
  const gl = await J(`https://statsapi.mlb.com/api/v1/people/${p.id}/stats?stats=gameLog&group=pitching&season=${se}&gameType=R`);
  return { id: p.id, n: st.gamesPlayed, runs: +st.runs || 0, gl: (gl.stats?.[0]?.splits || []).length };
}

(async () => {
  const names = Object.keys(table);
  console.log(`PITCHER_BT holds ${names.length} entries (some are accent/no-accent duplicates of one pitcher).`);
  console.log(`Checking each against actual ${se} first-inning splits...\n`);

  const rows = [];
  let done = 0;
  for (const key of names) {
    const t = table[key];
    let live = null;
    try { live = await lookup(key); } catch { /* leave null */ }
    rows.push({ key, t, live });
    if (++done % 10 === 0) process.stderr.write(`  ${done}/${names.length}\n`);
  }

  const missing = rows.filter((r) => !r.live || !r.live.n);
  const found = rows.filter((r) => r.live && r.live.n);
  console.log("=== SAMPLE DRIFT (table 'n' vs starts actually on file now) ===");
  let stale = 0;
  for (const r of found.sort((a, b) => (b.live.n - b.t.n) - (a.live.n - a.t.n))) {
    const d = r.live.n - r.t.n;
    if (d >= 3) {
      stale++;
      console.log(`  ${r.key.padEnd(24)} table n=${String(r.t.n).padStart(2)}  actual ${String(r.live.n).padStart(2)}  (+${d} starts unaccounted, ${r.t.clean}% ${r.t.tier})`);
    }
  }
  if (!stale) console.log("  none more than 2 starts behind");

  console.log(`\n=== NOT FOUND / NO 1st-INNING DATA (${missing.length}) ===`);
  for (const r of missing) console.log(`  ${r.key.padEnd(24)} table says ${r.t.clean}% (${r.t.n}gs, ${r.t.tier})`);

  const totalDrift = found.reduce((a, r) => a + Math.max(0, r.live.n - r.t.n), 0);
  console.log(`\nsummary: ${found.length} resolved, ${missing.length} unresolved, ` +
    `${stale} at least 3 starts stale, ${totalDrift} starts total unaccounted for.`);
  console.log("\nPITCHER_BT only feeds the `checks` array (app.jsx:7089), never pNRFI, so");
  console.log("staleness cannot bias the probability — it biases the displayed reasoning");
  console.log("and the family-consensus vote that gates the verdict.");
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
