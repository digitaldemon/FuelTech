// Today's board, scored with the shipped model, next to NRFIKINGKY's open legs.
//
//   node scripts/nrfi-today-vs-tout.js [YYYY-MM-DD] "Blue Jays @ Yankees" "Braves @ Diamondbacks" ...
//
// Pass his legs EXACTLY as juicereel.com renders them. Do not re-order them by
// hand — this script does that, and doing it in two places is how it goes wrong.
//
// THE REVERSAL, which is the whole reason this file is not three lines. The
// JuiceReel profile page prints first-inning legs with the HOME team first:
// its "Blue Jays @ Yankees" is MLB's NYY@TOR. Verified 6/6 against MLB
// `gameDate` on 2026-08-15 and 5/5 again on 2026-08-16, so 11/11 with no
// counterexample. The scratch version of this script had his picks pasted in
// the page's own order and reported
//
//     TOR@NYY   NOT SCORED — not on this slate
//     ...
//     overlap with his 5: 0
//
// which is a wrong answer that looks like a finding: "we agree on nothing
// today" is a perfectly plausible sentence, and every one of his legs WAS on
// the slate. A join that silently drops everything must never be able to print
// a comparison, so an unmatched leg is fatal here.
//
// Teams are matched on full club NAME from the schedule feed rather than on
// abbreviation, because the abbreviations do not agree across sources — the
// scratch version also carried "ARI" where MLB says "AZ".
const { J, savant, mapLimit, buildCtx, scoreBothPaths, makeVerdict, modelSig, PIT_MODE } = require("./nrfi-model-lib");
const { nrfiVerdict, applyCalibration } = makeVerdict();

const args = process.argv.slice(2);
const date = /^\d{4}-\d\d-\d\d$/.test(args[0]) ? args.shift() : new Date().toISOString().slice(0, 10);
const HIS_AS_RENDERED = args;

(async () => {
  const se = Number(date.slice(0, 4));
  const { by: periBy, lg } = await savant(se);
  const sch = await J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,linescore,team,lineups,weather,venue,officials`);
  const games = sch.dates?.[0]?.games || [];
  console.log(`model ${modelSig}  PIT_MODE=${PIT_MODE}  date ${date}  ${games.length} games on the schedule\n`);

  /* Resolve his legs against the slate BEFORE scoring anything.
   *
   * Order matters: if a leg cannot be placed, the run stops here rather than
   * after printing a board that invites reading the overlap number. */
  const nameIdx = new Map();
  for (const g of games) {
    const a = g.teams.away.team, h = g.teams.home.team;
    nameIdx.set(a.name.toLowerCase(), { g, side: "away" });
    nameIdx.set(h.name.toLowerCase(), { g, side: "home" });
    // Clubs are commonly written by nickname alone ("Yankees", "Blue Jays").
    const nick = (n) => n.split(" ").slice(-(n.includes("Red Sox") || n.includes("White Sox") || n.includes("Blue Jays") ? 2 : 1)).join(" ").toLowerCase();
    nameIdx.set(nick(a.name), { g, side: "away" });
    nameIdx.set(nick(h.name), { g, side: "home" });
  }
  const keyOf = (g) => `${g.teams.away.team.abbreviation}@${g.teams.home.team.abbreviation}`;
  const his = [];
  const unresolved = [];
  for (const raw of HIS_AS_RENDERED) {
    const parts = raw.split(/\s*@\s*|\s+vs\.?\s+/i).map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 2) { unresolved.push(`${raw} — could not split into two clubs`); continue; }
    // Page order is HOME first, so parts[1] is the AWAY club. Resolve both and
    // require them to name the same game; that check is what would catch the
    // reversal flipping back without this comment being updated.
    const first = nameIdx.get(parts[0].toLowerCase()), second = nameIdx.get(parts[1].toLowerCase());
    if (!first || !second) { unresolved.push(`${raw} — ${!first ? parts[0] : parts[1]} is not playing on ${date}`); continue; }
    if (first.g !== second.g) { unresolved.push(`${raw} — those two clubs are not playing each other on ${date}`); continue; }
    if (first.side !== "home") {
      unresolved.push(`${raw} — "${parts[0]}" is the AWAY club in MLB's feed, but this script ` +
        `expects juicereel's home-first rendering. If the site changed its order, fix the parse here; ` +
        `do not silently accept both orders, because then neither is checked.`);
      continue;
    }
    his.push({ raw, key: keyOf(first.g), gamePk: first.g.gamePk });
  }
  if (unresolved.length) {
    console.error("REFUSING TO COMPARE — could not place " + unresolved.length + " of his legs:");
    for (const u of unresolved) console.error("  " + u);
    console.error("\nAn overlap computed against legs that silently failed to join is not a low");
    console.error("overlap, it is no measurement at all. Fix the join and re-run.");
    process.exit(1);
  }

  const rows = await mapLimit(games, 5, async (g) => {
    const key = keyOf(g);
    const ctx = await buildCtx(g, date, se, periBy);
    if (!ctx) return { key, skip: "no context (probable pitcher not posted?)" };
    const { ev } = scoreBothPaths(ctx, lg);
    if (ev.pNRFI == null) return { key, skip: "model returned no probability" };
    const p = applyCalibration(ev.pNRFI);
    const call = p >= 0.5 ? "NRFI" : "YRFI";
    const pMax = Math.max(p, 1 - p) * 100;
    /* Build the verdict argument explicitly rather than spreading `ev`.
     *
     * The pitcher names and the pitcher profiles are on the CONTEXT, not on the
     * evaluation, so `{...ev}` leaves them undefined — and nrfiVerdict does not
     * complain, it interpolates them into its notes. That printed
     *
     *     undefined is a reliever/opener — few starts
     *     undefined thin data
     *
     * on a board that otherwise looked completely normal. A spread is the wrong
     * tool for feeding a function with a known signature: it silently supplies
     * whatever happens to be present and silently omits the rest. */
    const v = nrfiVerdict({
      pMax, call, market: null,
      awayPP: ctx.awayPP, homePP: ctx.homePP,
      aligned: ev.aligned, confidence: ev.confidence,
      pitProfiles: { away: ev.awayProfile || ctx.awayPit, home: ev.homeProfile || ctx.homePit },
    });
    // Structural, not cosmetic: an absent `notes` renders as a blank column,
    // which is indistinguishable from a verdict that had nothing to say. Check
    // the property EXISTS rather than that it is truthy, so an empty-but-real
    // notes array still passes and a renamed field still fails.
    if (!("notes" in v)) throw new Error("nrfiVerdict no longer returns `notes` — the notes column in this script is reading a field that does not exist, and would print blank on every game.");
    /* Both of these come from places that are easy to get wrong, and getting
     * them wrong is silent. The notes that explain a verdict live on the
     * VERDICT (thin data, no check confirms this), not on the evaluation; and
     * the posted-lineup count comes off the schedule feed, not the model. An
     * earlier draft of this file read ev.notes and ev.lineupCount — neither
     * field exists, so the notes column rendered empty and the lineup column
     * rendered 0 on every game, which reads as "no lineups posted" rather than
     * as "this script is looking in the wrong place". */
    const lineups = (g.lineups?.awayPlayers?.length || 0) + (g.lineups?.homePlayers?.length || 0);
    // isBet comes from the verdict itself. Re-deriving it from the strength
    // string would be a second copy of the ladder's bet/no-bet rule, free to
    // drift from the one the board actually uses.
    return { key, gamePk: g.gamePk, p, call, strength: v.strength,
      isBet: v.isBet, notes: (v.notes || []).join("; "),
      lineups, method: ev.method };
  });
  const ok = rows.filter((r) => !r.skip).sort((a, b) => b.p - a.p);
  const bad = rows.filter((r) => r.skip);
  const hisKeys = new Set(his.map((h) => h.key));

  console.log("rank  game       pNRFI  call  strength  lu  method    notes");
  ok.forEach((r, i) => {
    console.log(
      String(i + 1).padStart(4) + "  " + r.key.padEnd(9) + " " +
      (r.p * 100).toFixed(1).padStart(5) + "  " + r.call.padEnd(4) + "  " +
      (r.strength || "?").padEnd(8) + "  " + String(r.lineups).padStart(2) + "  " +
      String(r.method).padEnd(8) + "  " + (r.notes || "").slice(0, 38) +
      (hisKeys.has(r.key) ? "  <== HIS" : ""));
  });
  if (bad.length) { console.log("\nnot scored:"); for (const r of bad) console.log("  " + r.key.padEnd(9) + " " + r.skip); }

  console.log(`\n=============== HIS ${his.length} vs OUR BOARD ===============`);
  let agreeSide = 0;
  for (const h of his) {
    const r = ok.find((x) => x.key === h.key);
    if (!r) {
      // Resolved to a real game but we could not score it. Distinct from an
      // unmatched leg, and it is a gap in OUR coverage, not in the join.
      console.log(`  ${h.key.padEnd(9)} on the slate but WE could not score it — ${(bad.find((x) => x.key === h.key) || {}).skip}`);
      continue;
    }
    if (r.call === "NRFI") agreeSide++;
    console.log(`  ${h.key.padEnd(9)} our pNRFI ${(r.p * 100).toFixed(1)}%  call ${r.call}  verdict ${(r.strength || "?").padEnd(6)}` +
      `  (rank ${ok.indexOf(r) + 1} of ${ok.length})` + (r.call === "NRFI" ? "" : "   <-- WE DISAGREE ON SIDE"));
  }
  const ourBets = ok.filter((r) => r.isBet);
  console.log(`\n  we call NRFI on ${agreeSide} of his ${his.length}`);
  console.log(`  our board would play ${ourBets.length}: ${ourBets.map((r) => r.key + "(" + r.call + "/" + r.strength + ")").join(", ") || "nothing"}`);
  console.log(`  both his and a BET on our board: ${ourBets.filter((r) => hisKeys.has(r.key)).length}`);
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
