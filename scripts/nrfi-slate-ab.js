// Old model vs shipped model on the SAME live slate.
//
// A regression report of the form "the leans disappeared" is a claim about the
// verdict LADDER, not about any one factor, so it has to be measured end to end:
// same games, same feeds, two bundles, and the difference attributed to the
// pieces that changed. Anything less is a guess about which edit did it.
const { loadDeskModel } = require("./nrfi-model-load");

const BUNDLES = [
  ["before", process.argv[2] || "/tmp/app-before-hfa.js"],
  ["shipped", require("path").join(__dirname, "..", "public", "desk", "app.js")],
];

function attach(c) {
  const realFetch = global.fetch;
  c.fetch = (u, o) => (String(u).startsWith("/") ? Promise.reject(new Error("local api")) : realFetch(u, o));
  return c;
}

(async () => {
  const runs = {};
  for (const [tag, file] of BUNDLES) {
    const c = attach(loadDeskModel(file));
    const rows = await c.scanNrfi();
    runs[tag] = { c, rows: new Map(rows.map((r) => [(r.awayAbbr || r.away) + "@" + (r.homeAbbr || r.home), r])) };
  }
  const a = runs.before, b = runs.shipped;
  const keys = [...b.rows.keys()];

  const tier = (r) => r.strength || r.verdict || "?";
  console.log("\nSAME SLATE, TWO BUNDLES  (" + keys.length + " games)");
  console.log("matchup      before          shipped         pNRFI       env      ");
  console.log("-".repeat(76));
  let sumBefore = 0, sumAfter = 0, n = 0;
  const moved = [];
  for (const k of keys) {
    const ra = a.rows.get(k), rb = b.rows.get(k);
    if (!ra || !rb) { console.log(k.padEnd(12) + " (missing in one run)"); continue; }
    const pa = ra.pNRFI, pb = rb.pNRFI;
    sumBefore += pa; sumAfter += pb; n++;
    const ta = tier(ra), tb = tier(rb);
    const chg = ta !== tb;
    if (chg) moved.push([k, ta, tb, pa, pb]);
    console.log(k.padEnd(12) +
      (ta + " " + (pa * 100).toFixed(1) + "%").padEnd(16) +
      (tb + " " + (pb * 100).toFixed(1) + "%").padEnd(16) +
      (((pb - pa) >= 0 ? "+" : "") + ((pb - pa) * 100).toFixed(1) + "pp").padStart(8) +
      ("  " + (rb.wx ? "x" + rb.wx.factor.toFixed(3) : "-")).padStart(10) +
      (chg ? "   <- tier moved" : ""));
  }
  console.log("\n  mean pNRFI  before " + (sumBefore / n * 100).toFixed(2) + "%   shipped " +
    (sumAfter / n * 100).toFixed(2) + "%   shift " +
    (((sumAfter - sumBefore) / n >= 0 ? "+" : "") + ((sumAfter - sumBefore) / n * 100).toFixed(2)) + "pp");

  const count = (run) => {
    const t = {};
    for (const r of run.rows.values()) t[tier(r)] = (t[tier(r)] || 0) + 1;
    return t;
  };
  console.log("\n  tier counts before:  " + JSON.stringify(count(a)));
  console.log("  tier counts shipped: " + JSON.stringify(count(b)));
  if (moved.length) {
    console.log("\n  " + moved.length + " game(s) changed tier:");
    for (const [k, ta, tb, pa, pb] of moved)
      console.log("    " + k.padEnd(11) + ta + " -> " + tb + "   " +
        (pa * 100).toFixed(1) + "% -> " + (pb * 100).toFixed(1) + "%");
  } else console.log("\n  no game changed tier.");

  /* ---- attribute the shift ---- */
  console.log("\nWHERE THE SHIFT COMES FROM");
  const bc = b.c, ac = a.c;
  let envB = 0, envA = 0, m = 0;
  for (const k of keys) {
    const ra = a.rows.get(k), rb = b.rows.get(k);
    if (!ra || !rb || !ra.wx || !rb.wx) continue;
    envA += ra.wx.factor; envB += rb.wx.factor; m++;
  }
  console.log("  mean env factor  before x" + (envA / m).toFixed(4) +
    "   shipped x" + (envB / m).toFixed(4));
  console.log("  env multiplies lambda in BOTH halves, so P(NRFI) takes it twice:");
  console.log("    implied P(NRFI) effect  x" + Math.pow(envB / envA, 2).toFixed(4) + " on summed lambda");
  const up = bc.read("HFA_UP"), down = bc.read("HFA_DOWN");
  console.log("  HFA pair   before x" + (1.02 * 1.03).toFixed(4) + " / x" + (0.98 * 0.97).toFixed(4) +
    "  (sum " + (1.02 * 1.03 + 0.98 * 0.97).toFixed(4) + ")");
  console.log("             shipped x" + up.toFixed(4) + " / x" + down.toFixed(4) +
    "  (sum " + (up + down).toFixed(4) + ")");
  console.log("    a centred PAIR still raises SUMMED lambda when the halves are equal:");
  console.log("    sum ratio x" + ((up + down) / (1.02 * 1.03 + 0.98 * 0.97)).toFixed(4) + " -> P(NRFI) falls by that much");
})().catch((e) => { console.error(e); process.exit(1); });
