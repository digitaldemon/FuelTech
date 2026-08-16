/* Which of the 20-odd checks on a game card actually SAY anything?
 *
 * The checks are not decoration. Each one returns lean "nrfi" | "yrfi" |
 * "neutral", the leans are folded into three family votes, and the family tally
 * is what the consensus gate in nrfiVerdict reads: zero families voting costs a
 * rung, a split across two families costs a rung. So a check's voting behaviour
 * feeds the bet slate directly, and there has never been a measurement of it.
 *
 * TWO FAILURE MODES, and they look nothing alike on a game card.
 *
 * A check that NEVER votes is a row of text that pays no rent. Harmless to the
 * tally, but it means a fact the model claims to weigh is not reaching the
 * consensus at all, and the card implies otherwise.
 *
 * A check that ALWAYS votes the SAME WAY is worse, because it looks like a
 * working signal. It is a constant, and a constant added to a tally is a thumb
 * on the scale: it does not discriminate between games, it just shifts where
 * the family lands. This is not hypothetical here. `Travel & rest` shipped as
 * `factor < 0.97 ? "nrfi" : "neutral"` -- structurally unable to vote YRFI --
 * and two teams that both played yesterday multiply to 0.960, the ordinary
 * mid-season state, so it fired NRFI on 14 of 15 live games before anyone
 * noticed (see the comment at that check in app.jsx). The same shape was found
 * twice more, in `Pitcher season load` and in the offense-baseline check whose
 * thresholds NRFI_OFF_REG had put out of reach.
 *
 * WHAT THIS DOES NOT DO: guess which checks are supposed to be silent. Several
 * are deliberately informational -- they were demoted to `lean: "neutral"` on
 * purpose after their vote was found to rest on a bad split. A hand-kept list
 * of those would be the same stale-by-construction artefact this repo keeps
 * finding, so the by-design flag is READ OUT OF app.jsx: the check's own `lean`
 * expression is located next to its label, and it counts as by-design only when
 * that expression is the bare literal "neutral". Make it a real vote tomorrow
 * and this reclassifies itself. A label that cannot be located in the source
 * throws rather than defaulting, because "not found" silently becoming "fine"
 * is how the last three of these went unseen.
 */
const fs = require("fs");
const path = require("path");
const { loadDeskModel } = require("./nrfi-model-load");
const { installLocalApi } = require("./nrfi-local-api");

/* Default 30 days, not 14, and the reason is on the record.
 *
 * On a 14-day window `Offense trend (1st inn L10)` printed -43.0pp at z=-3.08
 * and tripped the BACKWARDS verdict below. Doubling the window to 30 days took
 * the same check to -12.3pp at z=-1.25 — the finding lost two thirds of its
 * size and all of its significance on nothing but more games. Nothing about the
 * check changed; there were simply 41 votes behind the first number and 109
 * behind the second. A window short enough to manufacture a z of -3 from a
 * non-effect is a window that will do it again on whichever check happens to
 * run cold, so the floor is set where the first false positive died. */
const DAYS = Number(process.argv[2] || 30);
const c = loadDeskModel();
const localApi = installLocalApi(c);
const SRC = fs.readFileSync(path.join(__dirname, "..", "public", "desk", "app.jsx"), "utf8");

/* Read the check's own lean expression out of the source.
 *
 * Locate the label literal, then take the next `lean:` after it and capture the
 * expression up to the comma or brace that closes the property. Only an exact
 * `"neutral"` counts as informational-by-design; anything else -- a ternary, a
 * facLean() call, a variable -- is a check that CAN vote, and if it never does,
 * that is a finding rather than a design note. */
function leanExprFor(label) {
  /* Match the PROPERTY, not the string. Searching for the bare quoted label
   * found `"Day game"` inside a comment forty lines above the check that
   * mentions it by name, and then read a `lean:` belonging to something else
   * entirely — a lookup that lands on prose and returns an answer anyway. */
  const re = new RegExp('label:\\s*"' + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"');
  const m = SRC.match(re);
  if (!m) {
    throw new Error('check label not found in app.jsx: "' + label + '" — the label is built ' +
      "dynamically or has been reworded. Fix the lookup; do not default it to unknown, " +
      "because a check silently classified as by-design-silent is exactly what this file exists to find.");
  }
  const i = m.index;
  const j = SRC.indexOf("lean:", i);
  if (j < 0 || j - i > 800) throw new Error('no lean: found near label "' + label + '"');
  let k = j + 5, depth = 0, out = "";
  while (k < SRC.length) {
    const ch = SRC[k];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "}") { if (depth === 0) break; depth--; }
    if (ch === "," && depth === 0) break;
    out += ch; k++;
  }
  return out.trim();
}

const iso = (d) => d.toISOString().slice(0, 10);
const pc = (x) => (x * 100).toFixed(0) + "%";

(async () => {
  const tally = new Map();   // label -> {seen, nrfi, yrfi, neutral}
  let slates = 0, gamesSeen = 0;
  for (let i = 1; i <= DAYS; i++) {
    const d = iso(new Date(Date.now() - i * 864e5));
    let got;
    try { got = await c.scanNrfi(null, d); } catch (e) { console.error("  " + d + " failed: " + e.message); continue; }
    const usable = got.filter((r) => Array.isArray(r.checks) && r.checks.length);
    if (!usable.length) continue;
    slates++; gamesSeen += usable.length;
    console.log("  " + d + "  " + String(usable.length).padStart(2) + " games");
    for (const r of usable) {
      // Graded games only can answer "was the vote right"; ungraded ones still
      // count toward how often a check speaks.
      const clean = r.final && r.inning1runs != null ? r.inning1runs === 0 : null;
      for (const ch of r.checks) {
        if (!ch || !ch.label) continue;
        if (!tally.has(ch.label)) {
          tally.set(ch.label, { seen: 0, nrfi: 0, yrfi: 0, neutral: 0, nC: 0, nN: 0, yC: 0, yN: 0 });
        }
        const t = tally.get(ch.label);
        t.seen++;
        if (ch.lean === "nrfi") { t.nrfi++; if (clean != null) { t.nN++; if (clean) t.nC++; } }
        else if (ch.lean === "yrfi") { t.yrfi++; if (clean != null) { t.yN++; if (clean) t.yC++; } }
        else t.neutral++;
      }
    }
  }
  if (gamesSeen < 30) { console.log("\nnot enough scanned games (" + gamesSeen + ")"); process.exit(0); }

  console.log("\n" + "=".repeat(94));
  console.log(`CHECK VOTING · ${gamesSeen} games over ${slates} slates (last ${DAYS} days)`);
  console.log("=".repeat(94));
  console.log("  check                                 fam     shown   votes    NRFI    YRFI   silent");

  const rows = [...tally.entries()].map(([label, t]) => {
    const votes = t.nrfi + t.yrfi;
    return { label, t, votes, byDesign: leanExprFor(label) === '"neutral"',
      fam: c.checkFamily(label) };
  }).sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label));

  for (const r of rows) {
    console.log("  " + r.label.slice(0, 36).padEnd(38) + r.fam.slice(0, 5).padEnd(7) +
      String(r.t.seen).padStart(5) + String(r.votes).padStart(8) +
      String(r.t.nrfi).padStart(8) + String(r.t.yrfi).padStart(8) +
      pc(r.t.neutral / r.t.seen).padStart(8) +
      (r.byDesign ? "   informational by design" : ""));
  }

  /* DOES THE VOTE SEPARATE GAMES? That is the only question worth a verdict.
   *
   * The first version of this section flagged any check whose votes leaned one
   * way past two standard errors of a 50/50 null, and called that "one-sided".
   * The null was wrong. A clean first inning is the MAJORITY outcome -- the
   * board runs near 70% clean -- so a check reading a real signal should lean
   * NRFI most of the time, and testing against a coin marks correct behaviour
   * as a defect. It flagged seven checks on that basis, including ones doing
   * their job. Imbalance is now printed as description and nothing more.
   *
   * What actually matters is whether the games a check calls NRFI come in
   * cleaner than the games it calls YRFI. That is measurable here because
   * scanNrfi returns inning1runs on finished games. The gap has its own SE from
   * both arms, and below two of them it says nothing -- most of these checks
   * will land there on a fortnight, and that is the honest answer rather than a
   * ranking of noise.
   *
   * ONE EXCEPTION IS STRUCTURAL, not statistical: a check that has never once
   * cast the other side cannot discriminate no matter what the outcomes say,
   * because it partitions nothing. That is reported on its own terms. */
  console.log("\n" + "=".repeat(94));
  console.log("DOES THE VOTE SEPARATE GAMES?  (graded games only; clean-1st rate by vote)");
  console.log("  LEAKAGE-INFLATED — a positive gap here is NOT evidence of skill. See note below.");
  console.log("  check                                votes    said NRFI     said YRFI      gap       z");
  const disc = [];
  for (const r of rows) {
    const { nC, nN, yC, yN } = r.t;
    if (nN < 5 || yN < 5) continue;
    const r1 = nC / nN, r2 = yC / yN;
    const se = Math.sqrt((r1 * (1 - r1)) / nN + (r2 * (1 - r2)) / yN);
    const gap = r1 - r2, z = se ? gap / se : 0;
    disc.push({ ...r, r1, r2, nN, yN, gap, z });
  }
  disc.sort((a, b) => b.z - a.z);
  for (const r of disc) {
    console.log("  " + r.label.slice(0, 35).padEnd(37) + String(r.votes).padStart(5) +
      `   ${pc(r.r1).padStart(4)} of ${String(r.nN).padStart(3)}   ${pc(r.r2).padStart(4)} of ${String(r.yN).padStart(3)}` +
      `   ${((r.gap * 100 >= 0 ? "+" : "") + (r.gap * 100).toFixed(1) + "pp").padStart(8)}  ${r.z.toFixed(2).padStart(6)}`);
  }
  const skipped = rows.filter((r) => r.votes > 0 && !disc.some((d) => d.label === r.label));
  if (skipped.length) {
    console.log(`  (${skipped.length} checks omitted: fewer than 5 graded games on one side, so no gap is computable —`);
    console.log(`   ${skipped.map((r) => r.label.split(" (")[0]).join(", ")})`);
  }

  console.log("\n" + "=".repeat(94));
  console.log("FINDINGS");
  /* A feed the harness could not reach makes its check look silent. `Umpire`
   * came back "appeared 187 times, never voted" on the first run of this file,
   * which is not a fact about the check: /api/desk/umpires is not served here,
   * so umpFactor was pinned and the vote was never reachable. Any SILENT
   * verdict taken while a feed is down is void, exactly as the calibration
   * audit's numbers were void while Statcast was unserved. Say so instead of
   * printing a finding that reads as a code defect. */
  const feedNote = localApi.note();
  const dead = rows.filter((r) => r.votes === 0 && !r.byDesign);
  if (feedNote && dead.length) {
    console.log("  CANNOT BE JUDGED FROM THIS HARNESS — a feed is missing, so a check that never");
    console.log("  voted may simply never have had an input. This is not a finding about the code:");
    for (const r of dead) console.log(`    - ${r.label} (0 votes on ${r.t.seen} games)`);
  } else if (!dead.length) {
    console.log("  no check is silently unable to vote.");
  } else {
    for (const r of dead) {
      console.log(`  SILENT: ${r.label} appeared on ${r.t.seen} games and never voted, and its lean`);
      console.log(`          expression is not a literal "neutral" — so it is built to vote and does not.`);
      console.log(`          lean: ${leanExprFor(r.label).replace(/\s+/g, " ").slice(0, 110)}`);
    }
  }
  const stuck = rows.filter((r) => r.votes >= 12 && (r.t.nrfi === 0 || r.t.yrfi === 0));
  for (const r of stuck) {
    const side = r.t.nrfi ? "NRFI" : "YRFI";
    console.log(`  NEVER VOTES THE OTHER WAY: ${r.label} cast ${r.votes} votes, all ${side}.`);
    console.log(`          It splits no games, so it cannot discriminate whatever the outcomes say —`);
    console.log(`          it only shifts the ${r.fam} family's tally on the games where it speaks.`);
  }
  const quiet = rows.filter((r) => r.votes > 0 && r.votes / r.t.seen < 0.05);
  for (const r of quiet) {
    console.log(`  RARE: ${r.label} voted on ${r.votes} of ${r.t.seen} games (${pc(r.votes / r.t.seen)}).`);
    console.log(`          Reachable, so not dead — but it is not moving the consensus either.`);
  }
  /* THE LEAKAGE IS NOT SYMMETRIC, AND THAT IS THE WHOLE VALUE OF THIS SECTION.
   *
   * scanNrfi's pitcher and team feeds are season-to-date and are not rewound,
   * so scanning a past date reads stats that already include that date. The
   * gaps above are therefore biased in the CORRECT direction: a check gets
   * partial credit for having been told the answer. Measured on `Last start
   * momentum`, the worst offender because it reads a single most-recent start:
   * games where both starters' "last start" was clean came in 84.1% clean over
   * 63 games, against a board that runs near 70%. Not the 100% that total
   * leakage would give, so this is contamination rather than a straight copy of
   * the answer key -- and there is no way to tell the two apart from here.
   *
   * So a positive gap proves NOTHING. It is what a leaked feed produces whether
   * the check is skilful or not, and reporting "DISCRIMINATES, z=7.32" off it
   * would be manufacturing a finding out of a known measurement defect.
   *
   * A NEGATIVE gap is a different matter. The bias pushes gaps upward, so a
   * check that still points the wrong way is doing so against a tailwind, and
   * the true gap is more negative than what prints. That survives the caveat
   * and is worth acting on. Only that direction gets a verdict here. */
  const backwards = disc.filter((r) => r.z < -2);
  for (const r of backwards) {
    console.log(`  BACKWARDS: ${r.label} — games it called NRFI came in ${pc(r.r1)} clean vs ${pc(r.r2)}`);
    console.log(`          when it called YRFI (${(r.gap * 100).toFixed(1)}pp, z=${r.z.toFixed(2)}). The feeds leak in`);
    console.log(`          this check's FAVOUR, so the real gap is worse than this. Its vote is inverted`);
    console.log(`          or its thresholds are the wrong way round — read the lean expression.`);
  }
  const topPos = disc.filter((r) => r.z > 2);
  if (topPos.length) {
    console.log(`  ${topPos.length} checks show a positive gap past 2 SE (` +
      topPos.map((r) => r.label.split(" (")[0]).join(", ") + ").");
    console.log("          NOT reported as skill: the feeds are not rewound, so these gaps are exactly");
    console.log("          what a leaked input produces regardless of whether the check is any good.");
    console.log("          Confirm on point-in-time data before believing any of them.");
  }
  if (!backwards.length) console.log("  No check's vote points the wrong way past 2 SE.");

  console.log(`\n  ${DAYS}-day live scan, not a cached backtest. Treat every count as recent behaviour`);
  console.log("  rather than the season's, and re-run at a longer window before acting on any");
  console.log("  verdict above — one of these findings already halved when the window doubled.");
  if (feedNote) console.log(feedNote);
})().catch((e) => { console.error(e); process.exit(1); });
