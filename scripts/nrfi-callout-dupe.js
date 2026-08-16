// Does the callout ever say the same thing twice?
//
//   node scripts/nrfi-callout-dupe.js [gamePk ...]
//   node scripts/nrfi-callout-dupe.js            # yesterday's finals
//
// The report is "I'm hearing the voice repeat itself twice during the
// announcing", and the honest way to chase that is not to read the dedupe logic
// and decide it looks right. It is to feed the real feed through the real
// functions the way the real poll sees it, and print what comes out.
//
// HOW A POLL ACTUALLY SEES THE FEED, and why replaying a finished game is not a
// cheat. statsapi delivers the whole 1st inning every time, with one more event
// appended to the live at-bat. So a poll at time T sees a strict prefix of what
// a poll at T+1 sees: allPlays truncated to the at-bats that have started, and
// the last of those truncated to the pitches thrown so far. Rebuilding those
// prefixes from a completed game reproduces every snapshot the live poll would
// have been handed, in order, with none of the waiting — and unlike a live poll
// it is deterministic, so a fix can be proved rather than hoped at.
//
// WHAT IT CANNOT SEE. A prefix replay cannot reproduce a feed that goes
// BACKWARDS — a poll returning fewer plays than the one before it, which is the
// other way a line gets said twice (st.n is assigned live.plays.length rather
// than max'd with it, so a shrink rewinds the pointer). --shrink injects that
// case directly; --live watches a real game for it.

const { loadDeskModel } = require("./nrfi-model-load");
const c = loadDeskModel();

const ARGS = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const LIVE = process.argv.includes("--live");
const SHRINK = process.argv.includes("--shrink");
const CALLOUT_STALE_MS = 45000;

const J = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(r.status + " " + u); return r.json(); };
const FIELDS = c.read("CALLOUT_FIELDS");
const feedUrl = (pk) => "https://statsapi.mlb.com/api/v1.1/game/" + pk +
  "/feed/live?fields=" + FIELDS + "&_=" + Date.now();

/* The poll body, lifted from the effect in app.jsx and kept deliberately thin.
 *
 * This is a copy, and a copy can drift from the original — which is exactly the
 * failure mode the desk keeps hitting. It is a copy anyway because pollGame is
 * closed over inside a React effect and cannot be reached from here, and the
 * three lines that matter (the pitch Set, the play index, and how st.n is
 * committed) are short enough to compare by eye against app.jsx:9015-9050.
 * Everything the copy could get wrong about TEXT is delegated to the real
 * firstInningPitches/firstInningPlays/playCallout out of the bundle. */
function pollOnce(st, live, said, now) {
  if (!st.pitch) {
    st.pitch = new Set();
    for (const p of live.pitches) if (!(now - p.ts < CALLOUT_STALE_MS)) st.pitch.add(p.id);
  }
  for (const p of live.pitches) {
    if (st.pitch.has(p.id)) continue;
    st.pitch.add(p.id);
    said.push({ kind: "pitch", text: p.text, id: p.id });
  }
  for (let i = st.n; i < live.plays.length; i++) {
    const line = c.playCallout(live.plays[i]);
    if (line) said.push({ kind: "play", text: line, i });
  }
  st.n = Math.max(st.n, live.plays.length);
}

/* The copy above is only worth running if it is still a copy.
 *
 * This script already caught itself drifting once: app.jsx was changed from
 * `st.n = live.plays.length` to a Math.max and the copy here was not, so the
 * shrink probe went on reporting a rewind that the shipped code had stopped
 * doing. A harness that reports a fixed bug as live is worse than no harness.
 * So the two lines that carry the de-duplication are asserted against the source
 * rather than trusted. */
function assertNoDrift() {
  const src = require("fs").readFileSync(
    require("path").join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");
  const want = [
    [/st\.n\s*=\s*Math\.max\(st\.n,\s*live\.plays\.length\)/, "st.n advanced with Math.max"],
    [/if\s*\(st\.pitch\.has\(p\.id\)\)\s*continue;/, "pitches de-duplicated by id"],
    [/for\s*\(let i = st\.n; i < live\.plays\.length; i\+\+\)/, "plays announced from st.n"],
  ];
  const missing = want.filter(([re]) => !re.test(src)).map(([, w]) => w);
  if (missing.length) {
    console.error("DRIFT: app.jsx no longer matches the poll body copied into this\n" +
      "script, so nothing below describes the shipped callout. Missing:\n  " +
      missing.join("\n  ") + "\nRe-copy app.jsx's pollGame into pollOnce() before trusting a result.");
    process.exit(2);
  }
}

// Rebuild the sequence of snapshots a live poll would have been handed.
function snapshots(feed) {
  const all = ((feed.liveData || {}).plays || {}).allPlays || [];
  const first = all.filter((p) => p.about && p.about.inning === 1);
  const out = [];
  for (let a = 0; a < first.length; a++) {
    const evs = (first[a].playEvents || []).length;
    // One snapshot per pitch of the live at-bat, then one with it complete.
    for (let e = 1; e <= evs; e++) {
      const partial = { ...first[a], playEvents: first[a].playEvents.slice(0, e),
        about: { ...first[a].about, isComplete: e === evs && first[a].about.isComplete } };
      out.push(first.slice(0, a).concat([partial]));
    }
    out.push(first.slice(0, a + 1));
  }
  return out.map((plays) => ({ liveData: { plays: { allPlays: plays }, linescore: {} }, gameData: {} }));
}

async function run(pk) {
  const feed = await J(feedUrl(pk));
  const snaps = snapshots(feed);
  if (!snaps.length) { console.log(pk + ": no 1st-inning plays in feed"); return 0; }

  const st = { n: 0, opened: true, settled: false };
  const said = [];
  // Every snapshot is scored as if it arrived live, so nothing is stale-skipped
  // for the wrong reason: the replay is about de-duplication, not about age.
  for (const s of snaps) {
    pollOnce(st, { plays: c.firstInningPlays(s), pitches: c.firstInningPitches(s) }, said, 0);
  }

  /* A repeat is the same text said twice — but only ADJACENT repeats are a
   * defect, and conflating the two was the first thing this script got wrong.
   *
   * Two fouls at 1-2 in the same at-bat genuinely produce the identical
   * sentence, and so do two 95mph balls twenty minutes apart. The second is
   * nobody's problem: no listener holds a line in their head across two innings
   * and hears an echo. The first is the actual complaint, because the two lines
   * land three seconds apart and the call sounds stuck.
   *
   * So distance is reported, and only distance 1 is counted as a failure. A
   * detector that flagged both would have "found" 21 repeats here and buried
   * the 3 that a listener can actually hear. */
  const seen = new Map(), dupes = [];
  said.forEach((x, k) => {
    if (seen.has(x.text)) dupes.push({ text: x.text, first: seen.get(x.text), again: k, kind: x.kind });
    if (!seen.has(x.text) || k - seen.get(x.text) === 1) seen.set(x.text, k);
  });
  const back2back = dupes.filter((d) => d.again - d.first === 1);
  console.log(`\n${pk}  ${snaps.length} snapshots -> ${said.length} lines spoken, ` +
    `${said.filter((x) => x.kind === "pitch").length} pitch / ${said.filter((x) => x.kind === "play").length} play`);
  if (!back2back.length) console.log(`  no line said back-to-back (${dupes.length} distant echo, harmless)`);
  for (const d of back2back)
    console.log(`  BACK-TO-BACK (${d.kind}) lines ${d.first}/${d.again}: ${JSON.stringify(d.text)}`);

  /* The shrink case, which the prefix replay above cannot produce on its own.
   * Hand the poll a snapshot with one fewer complete play than the last one — a
   * transient partial feed, a revision, a proxy serving a slightly older body —
   * and see whether the next full snapshot re-announces what it already said. */
  if (SHRINK) {
    const st2 = { n: 0, opened: true, settled: false }, said2 = [];
    const full = snaps[snaps.length - 1];
    const plays = c.firstInningPlays(full);
    pollOnce(st2, { plays, pitches: [] }, said2, 0);
    const before = said2.length;
    pollOnce(st2, { plays: plays.slice(0, Math.max(0, plays.length - 2)), pitches: [] }, said2, 0);
    pollOnce(st2, { plays, pitches: [] }, said2, 0);
    const extra = said2.length - before;
    console.log(`  shrink probe: ${plays.length} plays, then ${Math.max(0, plays.length - 2)}, then ${plays.length}`);
    console.log(extra
      ? `  REWIND: ${extra} play line(s) said a second time after the feed went backwards`
      : "  a feed that goes backwards does not rewind the pointer");
    if (extra) for (const x of said2.slice(before)) console.log("    again: " + JSON.stringify(x.text));
    return back2back.length + extra;
  }
  return back2back.length;
}

/* Watch a real game and answer the one question the replay cannot: does the
 * feed ever hand back fewer 1st-inning plays than it did a moment ago? */
async function live(pk) {
  console.log("watching " + pk + " for 90s at 1200ms — plays.length per poll");
  let prev = -1, shrinks = 0, polls = 0;
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    let n = null;
    try { n = c.firstInningPlays(await J(feedUrl(pk))).length; } catch { /* a failed poll is not a shrink */ }
    if (n != null) {
      polls++;
      if (prev >= 0 && n < prev) { shrinks++; console.log(`  SHRINK ${prev} -> ${n}`); }
      prev = n;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log(`  ${polls} polls, high-water ${prev}, ${shrinks} shrink(s)`);
  return shrinks;
}

(async () => {
  assertNoDrift();
  let pks = ARGS.map(Number).filter(Boolean);
  if (!pks.length) {
    const d = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const j = await J("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + d);
    pks = (((j.dates || [])[0] || {}).games || [])
      .filter((g) => String(g.status.abstractGameState).toLowerCase() === "final")
      .slice(0, 6).map((g) => g.gamePk);
    console.log("no gamePk given — replaying " + pks.length + " finals from " + d);
  }
  let bad = 0;
  for (const pk of pks) bad += LIVE ? await live(pk) : await run(pk);
  console.log("\n" + "=".repeat(70));
  console.log(bad ? bad + " repeat(s) found" : "no repeats across " + pks.length + " game(s)");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
