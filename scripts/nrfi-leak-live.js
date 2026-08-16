// Print the leak the card will show, for today's real starters.
const { loadDeskModel } = require("./nrfi-model-load");
const { installLocalApi } = require("./nrfi-local-api");
const c = loadDeskModel();
const realFetch = global.fetch;
// Serves /api/desk/savant for real and refuses the rest loudly; see nrfi-local-api.js
const localApi = installLocalApi(c);

(async () => {
  const rows = await c.scanNrfi();
  for (const r of rows || []) {
    if (!r.pitProfiles) continue;
    console.log("\n" + (r.away || "?") + " @ " + (r.home || "?"));
    for (const [nm, p] of [[r.awayPP, r.pitProfiles.away], [r.homePP, r.pitProfiles.home]]) {
      if (!p) continue;
      const lks = p.leaks || [];
      console.log("  " + String(nm).padEnd(22) + " grade " + String(p.grade).padEnd(3) +
        " clean " + String(p.cleanPct).padStart(3) + "%  " +
        (lks.length ? lks.map((l) => l.why + " (" + l.cost + ")").join(" | ") : "— no leak"));
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
