// Grade a JuiceReel seller's first-inning picks against what actually happened.
//
//   node scripts/nrfi-tout-grade.js [sellerId] [name]
//   node scripts/nrfi-tout-grade.js 318949 NRFIKINGKY      (default)
//
// The desk's header strip shows "NRFIKINGKY: 4-6". That number comes from
// app/api/desk/nrfiking/route.ts, which reads only page 0 of the settled feed
// AND filters to `side === "NRFI"`. So it is a partial record of one side of his
// book, not his record. This walks every page, keeps both sides, and grades each
// pick from the MLB line score rather than trusting the seller's own result
// field — then reports where the two disagree.
//
// Three numbers matter, in increasing order of honesty:
//   hit rate  — how often the pick won. Says nothing about price.
//   ROI       — what the picks actually returned at the odds taken.
//   CLV       — whether he beat the closing line. This is the one that predicts
//               future edge; hit rate over a few dozen picks mostly measures luck.
const JR = "https://www.juicereel.com/api";
const UA = { accept: "application/json", "user-agent": "contract-desk/2.0" };
const jget = async (u) => { const r = await fetch(u, { headers: UA, cache: "no-store" }); if (!r.ok) throw new Error(u + " -> " + r.status); return r.json(); };
const J = async (u) => { const r = await fetch(u, { headers: { accept: "application/json" } }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };

// Same parsing the live route uses, so this grades what the desk actually tails.
function teamsFromDesc(desc) {
  if (!desc) return [];
  let s = String(desc);
  s = s.split(/\s+First Inning/i)[0];
  s = s.split(/\s+-\s+(?:Under|Over)/i)[0];
  s = s.replace(/\?.*$/, "").trim();
  const parts = s.split(/\s+(?:vs\.?|@|at)\s+/i).map((x) => x.trim()).filter(Boolean);
  return parts.length === 2 ? parts : [];
}
// A first-inning leg is not automatically an NRFI leg. The feed mixes several
// markets under the same 1I duration, and treating them alike is what produced
// the last two phantom disagreements:
//   Under/Over 0.5 Runs - 1st Inning   <- the real market, both teams
//   Under/Over 1.5, Over 5.5           <- different lines, different question
//   "No - LA Dodgers Run Scored"       <- ONE team only; can win while a run scores
//   "Single - Live Hunter Goodman"     <- a player prop that happens to be 1I
//   "To Score A Run in the First"      <- one team, and carries no team names
// So require the two things that define the market: a directional Under/Over
// position and a literal 0.5 line. Nothing else survives that pair.
function classify(s) {
  const pos = String(s.position || "").trim().toLowerCase();
  if (pos !== "under" && pos !== "over") return { reject: "not an over/under market" };
  if (s.value == null) return { reject: "no line on the leg" };
  const line = Number(s.value);
  if (line !== 0.5) return { reject: `line ${line}, not 0.5` };
  return { side: pos === "under" ? "NRFI" : "YRFI", line };
}

function firstInningSubbets(rows) {
  const out = [];
  for (const r of rows || []) {
    for (const s of r.Subbets || []) {
      const dur = String(s.duration || "");
      const desc = String(s.description || s.scrapeDescription || "");
      if (!(/1I/i.test(dur) || /first[_\s]?inning|- 1st\b|Runs - 1st/i.test(desc))) continue;
      const c = classify(s);
      out.push({
        side: c.side || null, reject: c.reject || null,
        teams: teamsFromDesc(desc), desc,
        startUtc: s.startDate || null, line: c.line ?? null,
        ticketResult: String(r.result || "Pending"),
        vig: r.vig != null ? Number(r.vig) : null,
        risk: Number(r.irisk || 0), net: Number(r.netResult || 0),
        clvPct: r.clvPct != null ? Number(r.clvPct) : null,
        legs: Number(r.numTeam || 1), type: r.BetType?.typeName || "?",
        ticket: String(r.ticketNum || ""), placedAt: r.datePlaced || null,
      });
    }
  }
  return out;
}

const tok = (s) => String(s || "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
const overlap = (a, b) => { const A = tok(a), B = tok(b); return A.some((w) => B.includes(w)); };

const schedCache = new Map();
async function scheduleFor(date) {
  if (schedCache.has(date)) return schedCache.get(date);
  const p = J(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team`)
    .then((d) => (d.dates?.[0]?.games || [])).catch(() => []);
  schedCache.set(date, p);
  return p;
}

const MONTHS = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };

// The Kalshi ticker on the ticket is exact: KXMLBRFI-26AUG151810BALTB is
// 26AUG15 (date), 1810 (ET start), BAL+TB (away+home). Prefer it over the
// description. Fuzzy name matching is genuinely dangerous here — tokenising on
// words of 3+ chars makes "Los Angeles Dodgers" and "Los Angeles Angels"
// collide on "angeles", and on a two-Los-Angeles-game slate that silently
// grades a pick against the wrong game. That is how a first pass at this
// produced 38 phantom disagreements with the seller's own result field.
function fromTicker(ticket) {
  const m = String(ticket || "").match(/KXMLBRFI-(\d{2})([A-Z]{3})(\d{2})\d{4}([A-Z]+)/i);
  if (!m) return null;
  const mo = MONTHS[m[2].toUpperCase()];
  if (!mo) return null;
  return { date: `20${m[1]}-${mo}-${m[3]}`, blob: m[4].toUpperCase() };
}

const STOP = new Set(["los", "new", "san", "angeles", "york", "bay", "city", "saint"]);
const distinct = (s) => tok(s).filter((w) => !STOP.has(w));

// Collect every game on `day` matching `pred`, across a +/-1 day window. The
// window is not optional: MLB's `officialDate` is the local calendar day, so a
// 7:15pm Denver game lands on the NEXT UTC date, and the ticker's date field is
// the ET date. But scanning offsets and taking the FIRST hit is wrong — two
// meetings of the same pair on consecutive days both match the team test, and
// a doubleheader puts two on one day. That silently graded a night game against
// the next afternoon's rematch. Gather all candidates, then split on start time.
async function candidates(anchorDay, pred) {
  const out = [];
  for (const off of [0, -1, 1]) {
    const day = new Date(new Date(anchorDay + "T12:00:00Z").getTime() + off * 864e5).toISOString().slice(0, 10);
    for (const g of await scheduleFor(day)) if (pred(g)) out.push(g);
  }
  // The same game can appear on two adjacent schedule days; de-dupe on gamePk.
  return [...new Map(out.map((g) => [g.gamePk, g])).values()];
}

// The pick's own startDate is exact to the minute, so it identifies the game
// outright. Anything more than an hour off is a different game, not a rounding
// difference — refuse rather than pick the nearest.
function byStart(list, startUtc) {
  if (list.length <= 1) return list[0] || null;
  const want = startUtc ? new Date(startUtc).getTime() : NaN;
  if (isNaN(want)) return "ambiguous";
  const scored = list
    .map((g) => ({ g, d: Math.abs(new Date(g.gameDate).getTime() - want) }))
    .sort((a, b) => a.d - b.d);
  if (scored[0].d > 36e5) return "ambiguous";
  // A near-tie between two candidates means the start time did not actually
  // separate them, so it has not resolved anything.
  if (scored[1] && scored[1].d - scored[0].d < 6e5) return "ambiguous";
  return scored[0].g;
}

async function findGame(pick) {
  // 1) exact, via the ticker
  const t = fromTicker(pick.ticket);
  if (t) {
    const list = await candidates(t.date, (g) =>
      ((g.teams?.away?.team?.abbreviation || "") + (g.teams?.home?.team?.abbreviation || "")).toUpperCase() === t.blob);
    if (list.length) return byStart(list, pick.startUtc);
  }
  // 2) fall back to names, but require a DISTINCTIVE token on both sides so the
  //    two Los Angeles clubs cannot be confused for one another.
  if (!pick.startUtc || pick.teams.length !== 2) return null;
  const d0 = new Date(pick.startUtc);
  if (isNaN(d0)) return null;
  const list = await candidates(d0.toISOString().slice(0, 10), (g) => {
    const A = distinct(g.teams?.away?.team?.name), H = distinct(g.teams?.home?.team?.name);
    const mA = pick.teams.some((x) => distinct(x).some((w) => A.includes(w)));
    const mH = pick.teams.some((x) => distinct(x).some((w) => H.includes(w)));
    return mA && mH;
  });
  if (!list.length) return null;
  return byStart(list, pick.startUtc);
}

async function actualFirstInning(pick) {
  if (pick.reject) return { ok: false, why: pick.reject };
  const g = await findGame(pick);
  if (g === "ambiguous") return { ok: false, why: "ambiguous team match" };
  if (!g) return { ok: false, why: "no game matched" };
  if (g.status?.abstractGameState !== "Final") return { ok: false, why: "not final" };
  const inn1 = g.linescore?.innings?.[0];
  if (!inn1) return { ok: false, why: "no linescore" };
  const runs = (+(inn1.away?.runs || 0)) + (+(inn1.home?.runs || 0));
  return { ok: true, runs, nrfi: runs === 0, day: g.officialDate,
    game: `${g.teams?.away?.team?.name} @ ${g.teams?.home?.team?.name}` };
}

(async () => {
  const id = process.argv[2] || "318949";
  const name = process.argv[3] || "NRFIKINGKY";
  console.log(`Grading ${name} (JuiceReel ${id})\n`);

  const rows = [];
  for (let page = 0; page < 40; page++) {
    let j;
    try { j = await jget(`${JR}/bets/${id}/settled?page=${page}`); } catch (e) { console.error("  page " + page + " failed: " + e.message); break; }
    const r = j?.data?.bets?.data?.rows;
    if (!Array.isArray(r) || !r.length) break;
    rows.push(...r);
    process.stderr.write(`  page ${page}: ${r.length} tickets (total ${rows.length})\n`);
  }
  const picks = firstInningSubbets(rows);
  console.log(`settled tickets pulled: ${rows.length}   first-inning legs: ${picks.length}`);
  if (!picks.length) { console.log("Nothing to grade."); return; }

  const graded = [];
  for (const p of picks) { graded.push({ p, a: await actualFirstInning(p) }); }

  const ok = graded.filter((x) => x.a.ok);
  const bad = graded.filter((x) => !x.a.ok);
  console.log(`resolved to a final game: ${ok.length}   unresolved: ${bad.length}`);
  if (bad.length) {
    const why = {}; bad.forEach((x) => { why[x.a.why] = (why[x.a.why] || 0) + 1; });
    console.log("  unresolved reasons: " + JSON.stringify(why));
  }

  // Independent grade: did the pick's side actually happen?
  let W = 0, L = 0;
  const bySide = { NRFI: { w: 0, l: 0 }, YRFI: { w: 0, l: 0 } };
  const disagree = [];
  for (const x of ok) {
    const won = x.p.side === "NRFI" ? x.a.nrfi : !x.a.nrfi;
    if (won) { W++; bySide[x.p.side].w++; } else { L++; bySide[x.p.side].l++; }
    const theirs = /won/i.test(x.p.ticketResult) ? true : /lost/i.test(x.p.ticketResult) ? false : null;
    if (theirs !== null && x.p.legs === 1 && theirs !== won) disagree.push({ x, won, theirs });
  }
  const n = W + L;
  console.log("\n=========== INDEPENDENT GRADE (from MLB line scores) ===========");
  console.log(`  overall      ${W}-${L}   (${n ? (W / n * 100).toFixed(1) : "0"}% on ${n} legs)`);
  console.log(`  NRFI side    ${bySide.NRFI.w}-${bySide.NRFI.l}`);
  console.log(`  YRFI side    ${bySide.YRFI.w}-${bySide.YRFI.l}`);
  console.log(`\n  the desk header shows only page 0 AND only NRFI-side, which is why it reads 4-6`);
  if (disagree.length) {
    console.log(`\n  !! ${disagree.length} straight bets where my grade disagrees with their result field:`);
    // Print the pick AND the game it resolved to. Printing only the resolved
    // game hides the failure mode that matters — a mis-resolution looks
    // identical to a genuine feed disagreement until you can see both sides.
    for (const d of disagree.slice(0, 8)) {
      console.log(`     pick:  ${d.x.p.desc}  [${d.x.p.side}, start ${d.x.p.startUtc}, ticket ${d.x.p.ticket}]`);
      console.log(`     graded ${d.x.a.game} ${d.x.a.day} 1st=${d.x.a.runs} -> ${d.won ? "WON" : "LOST"}, feed says ${d.x.p.ticketResult}`);
    }
  } else {
    console.log("\n  no disagreements with the seller's own result field on straight bets");
  }

  // Money. Straights only — a parlay's netResult belongs to the whole ticket,
  // so charging it to one first-inning leg would invent a number.
  const straights = [...new Map(ok.filter((x) => x.p.legs === 1).map((x) => [x.p.ticket, x.p])).values()];
  const risk = straights.reduce((a, p) => a + p.risk, 0);
  const net = straights.reduce((a, p) => a + p.net, 0);
  console.log("\n=========== MONEY (straight single-leg tickets only) ===========");
  console.log(`  tickets      ${straights.length}`);
  console.log(`  total risk   ${risk.toFixed(0)} units`);
  console.log(`  net result   ${net >= 0 ? "+" : ""}${net.toFixed(0)} units`);
  console.log(`  ROI          ${risk ? (net / risk * 100).toFixed(2) + "%" : "n/a"}`);
  const parlayLegs = ok.filter((x) => x.p.legs > 1).length;
  if (parlayLegs) console.log(`  (${parlayLegs} further legs sat inside parlays and are excluded from ROI)`);

  // CLV — the seller's own field, so this is his number, not mine.
  const clv = straights.filter((p) => p.clvPct != null).map((p) => p.clvPct);
  console.log("\n=========== CLOSING LINE VALUE (JuiceReel's own clvPct) ===========");
  if (!clv.length) { console.log("  no clvPct on file"); }
  else {
    const mean = clv.reduce((a, v) => a + v, 0) / clv.length;
    const beat = clv.filter((v) => v > 0).length;
    const sd = Math.sqrt(clv.reduce((a, v) => a + (v - mean) ** 2, 0) / clv.length);
    const t = sd ? mean / (sd / Math.sqrt(clv.length)) : 0;
    console.log(`  n            ${clv.length}`);
    console.log(`  mean CLV     ${(mean * 100).toFixed(2)}%`);
    console.log(`  beat close   ${beat}/${clv.length} (${(beat / clv.length * 100).toFixed(0)}%)`);
    console.log(`  t-stat       ${t.toFixed(2)}  ${Math.abs(t) < 2 ? "-> not distinguishable from zero edge" : "-> real, at this sample"}`);
    console.log("\n  CLV is the number that predicts future results. Hit rate over a few");
    console.log("  dozen picks is mostly variance; beating the close is not.");
  }
})().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
