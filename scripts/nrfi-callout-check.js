// Does the first-inning callout actually read a real feed?
// Runs against completed games, where the truth is knowable: the number of runs
// the callout would have announced must equal the line score's 1st-inning total.
const { loadDeskModel } = require("./nrfi-model-load");
const { installLocalApi } = require("./nrfi-local-api");
const c = loadDeskModel();
const realFetch = global.fetch;
// Serves /api/desk/savant for real and refuses the rest loudly; see nrfi-local-api.js
const localApi = installLocalApi(c);

const date = process.argv[2] || new Date(Date.now() - 36e5 * 30).toISOString().slice(0, 10);
let fails = 0;
const check = (ok, what, detail) => {
  console.log((ok ? "  PASS  " : "  FAIL  ") + what + (ok ? "" : "\n          " + detail));
  if (!ok) fails++;
};

(async () => {
  const sch = await (await realFetch("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + date)).json();
  const games = (sch.dates || []).flatMap((d) => d.games || [])
    .filter((g) => String(g.status && g.status.abstractGameState).toLowerCase() === "final").slice(0, 8);
  if (!games.length) { console.log("no finals on " + date); process.exit(0); }
  console.log("\nfirst-inning callout, " + games.length + " finals on " + date);
  console.log("-".repeat(78));
  for (const g of games) {
    const live = await c.fetchFirstInning(g.gamePk);
    if (!live) { check(false, "feed reachable for " + g.gamePk, "fetchFirstInning returned null"); continue; }
    // Truth: the line score's own 1st-inning runs.
    const ls = await (await realFetch("https://statsapi.mlb.com/api/v1/game/" + g.gamePk + "/linescore")).json();
    const inn1 = (ls.innings || [])[0] || {};
    const truth = ((inn1.away && inn1.away.runs) || 0) + ((inn1.home && inn1.home.runs) || 0);
    let counted = 0, spoken = 0;
    for (let i = 0; i < live.plays.length; i++) {
      counted += c.playRuns(live.plays[i], live.plays[i - 1]);
      if (c.playCallout(live.plays[i])) spoken++;
    }
    const nm = (g.teams.away.team.abbreviation || "") + "@" + (g.teams.home.team.abbreviation || "");
    check(counted === truth && spoken === live.plays.length && live.past1,
      nm.padEnd(9) + live.plays.length + " plays, " + counted + " run(s) — matches the line score",
      "counted " + counted + " vs line score " + truth + "; " + spoken + "/" + live.plays.length +
      " plays had a callout; past1=" + live.past1);
  }
  /* ---- pitch level ----
   * The play callout speaks once per at-bat, which on a slow inning is forty
   * seconds of silence. The pitch stream fills it, and it reads a DIFFERENT
   * slice of the feed — every 1st-inning play including the one still in
   * progress — so it needs its own truth check. */
  console.log("\npitch level");
  const g0 = games[0];
  const live0 = await c.fetchFirstInning(g0.gamePk);
  const raw = await (await realFetch("https://statsapi.mlb.com/api/v1.1/game/" + g0.gamePk +
    "/feed/live")).json();
  // Truth: every pitch thrown in the 1st, straight off the unprojected feed.
  const truthPitches = ((raw.liveData && raw.liveData.plays && raw.liveData.plays.allPlays) || [])
    .filter((p) => p.about && p.about.inning === 1)
    .flatMap((p) => (p.playEvents || []).filter((e) => e.isPitch));
  // In-play pitches are now CALLED, not skipped — contact carries its outcome
  // class (out / aboard / runs) the moment it is published, so every pitch of
  // the inning must be in the stream.
  check(live0 && live0.pitches.length === truthPitches.length,
    "every 1st-inning pitch is picked up, in-play contact included (" +
      (live0 ? live0.pitches.length : "?") + " called, " + truthPitches.length + " thrown)",
    "pitch count " + (live0 ? live0.pitches.length : "null") + " != " +
      truthPitches.length + " — the projection is dropping playEvents.");
  // Dedup is by playId; a repeated id means the same pitch would be spoken twice
  // on the next poll, or a real pitch would be swallowed.
  const ids = (live0 ? live0.pitches : []).map((p) => p.id);
  check(ids.length > 0 && new Set(ids).size === ids.length,
    "every pitch has a unique id, so the poll loop cannot repeat or swallow one",
    "duplicate ids in the pitch stream: " + (ids.length - new Set(ids).size) + " collisions.");
  check((live0 ? live0.pitches : []).every((p) => p.text && !/undefined|NaN/.test(p.text)),
    "no pitch line contains an unfilled field",
    "a pitch line came out with undefined/NaN in it: " +
      JSON.stringify((live0 ? live0.pitches : []).find((p) => !p.text || /undefined|NaN/.test(p.text))));
  // Contact is called the moment it is published, with the outcome class the
  // call code already carries — the play's exact description follows a beat
  // later. The immediate line must state out/aboard/runs and never a count
  // (the at-bat is over).
  check(c.pitchCallout({ isPitch: true, details: { call: { code: "X", description: "In play, out(s)" } },
    count: { balls: 0, strikes: 2 }, pitchData: { startSpeed: 94.6 } }) === "95, in play — out.",
    "contact with an out is called immediately as an out",
    "X came out as: " + c.pitchCallout({ isPitch: true, details: { call: { code: "X", description: "In play, out(s)" } },
      count: { balls: 0, strikes: 2 }, pitchData: { startSpeed: 94.6 } }));
  check(c.pitchCallout({ isPitch: true, details: { call: { code: "D", description: "In play, no out" } },
    count: { balls: 1, strikes: 1 } }) === "in play — batter aboard, no out.",
    "contact with the batter safe is called as aboard, no count",
    "D came out as: " + c.pitchCallout({ isPitch: true, details: { call: { code: "D", description: "In play, no out" } },
      count: { balls: 1, strikes: 1 } }));
  check(c.pitchCallout({ isPitch: true, details: { call: { code: "E", description: "In play, run(s)" } },
    count: { balls: 2, strikes: 2 } }) === "in play — runs scoring.",
    "contact with runs scoring is called as runs scoring",
    "E came out as: " + c.pitchCallout({ isPitch: true, details: { call: { code: "E", description: "In play, run(s)" } },
      count: { balls: 2, strikes: 2 } }));
  check(c.pitchCallout({ isPitch: false, type: "action",
    details: { description: "Batter Timeout." } }) === null,
    "a non-pitch event (timeout, substitution) is not read as a pitch",
    "pitchCallout spoke a non-pitch event.");
  // The count in the feed is the count AFTER the pitch, so ball four and strike
  // three would read as "four and oh" / "oh and three".
  check(!/four and|and three/.test(c.pitchCallout({ isPitch: true,
    details: { call: { code: "B", description: "Ball" } }, count: { balls: 4, strikes: 1 } }) || ""),
    "ball four is not read out as a count",
    "the post-pitch count is being spoken on a completed at-bat.");
  check(!/and three/.test(c.pitchCallout({ isPitch: true,
    details: { call: { code: "S", description: "Swinging Strike" } }, count: { balls: 1, strikes: 3 } }) || ""),
    "strike three is not read out as a count",
    "the post-pitch count is being spoken on a strikeout.");
  check(c.pitchCallout({ isPitch: true, details: { call: { code: "H", description: "Hit By Pitch" } },
    count: { balls: 1, strikes: 0 } }) === "hit by pitch.",
    "a hit batsman is called without a count — the feed charges it as a ball on a finished at-bat",
    "HBP came out as: " + c.pitchCallout({ isPitch: true,
      details: { call: { code: "H", description: "Hit By Pitch" } }, count: { balls: 1, strikes: 0 } }));
  check(c.pitchCallout({ isPitch: true, details: { call: { code: "S", description: "Swinging Strike (Blocked)" } },
    count: { balls: 0, strikes: 1 } }) === "swinging strike. oh and one.",
    "a scorer's parenthetical qualifier is not read aloud",
    "the qualifier survived: " + c.pitchCallout({ isPitch: true,
      details: { call: { code: "S", description: "Swinging Strike (Blocked)" } }, count: { balls: 0, strikes: 1 } }));
  // Velocity is what makes it sound like a broadcast, but the feed carries 0 for
  // untracked pitches and a pickoff is not a pitch speed.
  check(/^94, /.test(c.pitchCallout({ isPitch: true, details: { call: { code: "C", description: "Called Strike" } },
    count: { balls: 0, strikes: 1 }, pitchData: { startSpeed: 93.7 } }) || ""),
    "velocity leads the call and is rounded to whole miles per hour",
    "velocity is missing or unrounded in the pitch line.");
  check(!/0,|^\d+, /.test(c.pitchCallout({ isPitch: true, details: { call: { code: "B", description: "Ball" } },
    count: { balls: 1, strikes: 0 }, pitchData: { startSpeed: 0 } }) || ""),
    "an untracked pitch (startSpeed 0) is called without a bogus velocity",
    "a zero/none velocity leaked into the spoken line.");

  /* ---- the two-strike foul, i.e. "the voice repeats itself" ----
   * A foul with two strikes is the only pitch that changes nothing: same call,
   * same count, and usually the same velocity bucket. Two in a row therefore
   * produced a byte-identical sentence three seconds apart. Measured at roughly
   * one occurrence per three 1st innings by scripts/nrfi-callout-dupe.js. */
  const foul = (strikes, seq, mph) => c.pitchCallout({ isPitch: true,
    details: { call: { code: "F", description: "Foul" } },
    count: { balls: 3, strikes }, pitchData: { startSpeed: mph || 94 } }, seq);
  check(foul(2, 0) !== foul(2, 1),
    "two consecutive two-strike fouls do not produce the same sentence",
    "both fouls came out as " + JSON.stringify(foul(2, 0)) + " — the repeat is back.");
  check(!/three and two/.test(foul(2, 0) || ""),
    "a two-strike foul does not restate a count it cannot have changed",
    "the unchanged count is still being read out: " + foul(2, 0));
  // The helper pins balls at 3, so a one-strike foul is 3-1 after the pitch.
  check(/three and one/.test(foul(1, 0) || ""),
    "a foul that DOES move the count still reads the count out",
    "a sub-two-strike foul lost its count: " + foul(1, 0));
  check(/^foul\.$/.test(String(foul(2, 0)).replace(/^\d+, /, "")),
    "the first foul of an at-bat is still the plain word",
    "the first foul was dressed up: " + foul(2, 0));
  // A marathon at-bat must not run off the end of the phrase list.
  check(foul(2, 99) && !/undefined/.test(foul(2, 99)),
    "a 100-foul at-bat still produces a line",
    "the foul phrasing ran past the end of its list: " + foul(2, 99));
  // A foul tip is strike three and a foul bunt with two strikes is an out. Both
  // END the at-bat, so neither may be softened into "still alive".
  check(/foul tip/.test(String(c.pitchCallout({ isPitch: true,
    details: { call: { code: "T", description: "Foul Tip" } }, count: { balls: 3, strikes: 3 } }, 4))),
    "a foul tip keeps its own words — it is strike three, not another foul",
    "a foul tip was rotated into the foul phrasing and reads as a live at-bat.");
  // The batter is named once per at-bat. Every pitch would be nagging; none at
  // all leaves an unattributable stream of counts.
  const named = c.firstInningPitches({ liveData: { plays: { allPlays: [{
    about: { inning: 1 }, atBatIndex: 0, matchup: { batter: { fullName: "Aaron Judge" } },
    playEvents: [
      { isPitch: true, playId: "a", details: { call: { code: "B", description: "Ball" } }, count: { balls: 1, strikes: 0 } },
      { isPitch: true, playId: "b", details: { call: { code: "C", description: "Called Strike" } }, count: { balls: 1, strikes: 1 } },
    ],
  }] } } });
  check(named.length === 2 && /^Aaron Judge\. /.test(named[0].text) && !/Judge/.test(named[1].text),
    "the batter is named on his first pitch and not on the rest of the at-bat",
    "batter naming is wrong: " + JSON.stringify(named.map((p) => p.text)));
  // "Luis García Jr." already ends the sentence.
  const suffix = c.firstInningPitches({ liveData: { plays: { allPlays: [{
    about: { inning: 1 }, atBatIndex: 0, matchup: { batter: { fullName: "Luis García Jr." } },
    playEvents: [{ isPitch: true, playId: "a", details: { call: { code: "B", description: "Ball" } },
      count: { balls: 1, strikes: 0 } }],
  }] } } });
  check(suffix.length === 1 && suffix[0].text.startsWith("Luis García Jr. ball."),
    "a name ending in a suffix does not get a second full stop",
    "double punctuation survived: " + JSON.stringify(suffix.map((p) => p.text)));
  // A play with no description must not be spoken as an empty utterance.
  check(c.playCallout({ result: {} }) === null, "a play with no description is skipped, not spoken as silence",
    "playCallout returned a non-null for an empty result.");
  // The very first play has no predecessor; runs must read off its own score.
  check(c.playRuns({ result: { awayScore: 1, homeScore: 0 } }, undefined) === 1,
    "the leadoff play scores against zero, not against undefined",
    "playRuns mishandled the first play of the inning.");
  /* ---- latency ----
   * A callout that lags is just a recap. Three things decided the delay and all
   * three are pinned here, because each was individually enough to put the voice
   * half a minute behind the park. */
  console.log("\nlatency");
  const pks = games.map((g) => g.gamePk);
  let t = Date.now();
  const par = await Promise.all(pks.map((pk) => c.fetchFirstInning(pk)));
  const parMs = Date.now() - t;
  t = Date.now();
  for (const pk of pks.slice(0, 3)) await c.fetchFirstInning(pk);
  const seqMs = (Date.now() - t) / 3 * pks.length;
  check(par.every(Boolean) && parMs < seqMs / 2,
    "the whole board is polled in parallel — " + parMs + "ms for " + pks.length +
      " games, vs ~" + Math.round(seqMs) + "ms one at a time",
    "parallel " + parMs + "ms is not meaningfully faster than sequential " + Math.round(seqMs) + "ms.");
  /* The field projection is what makes a 2.5s interval affordable rather than
   * ~48MB/min of feed across a full board. Two numbers matter and they are not
   * the same number:
   *   - what the projection saves on an arbitrary feed, and
   *   - what a poll ACTUALLY moves, which is a game in the 1st inning.
   * The pitch stream made the first number much worse (playEvents is ~92KB of a
   * finished game and `fields` cannot be scoped to one inning) while barely
   * touching the second, because the callout attaches at first pitch and
   * detaches at past1 — it never fetches a 9-inning feed at speed. Pinning only
   * the 9-inning figure would have failed a change that costs nothing in use;
   * pinning only the 1st-inning figure would let the projection rot. Both. */
  const bare = await (await realFetch("https://statsapi.mlb.com/api/v1.1/game/" + pks[0] + "/feed/live")).text();
  const trimmed = await (await realFetch("https://statsapi.mlb.com/api/v1.1/game/" + pks[0] +
    "/feed/live?fields=" + c.read("CALLOUT_FIELDS"))).text();
  check(trimmed.length * 6 < bare.length,
    "the field projection cuts a whole-game feed by 6x or more (" + (bare.length / 1024).toFixed(0) +
      "KB -> " + (trimmed.length / 1024).toFixed(0) + "KB)",
    "projection saved little: " + bare.length + " -> " + trimmed.length +
      "; the leaf list has grown past what the callout reads.");
  // The real cost: the same projected feed with only the 1st inning in it, which
  // is all that exists while a game is being called.
  const proj = JSON.parse(trimmed);
  proj.liveData.plays.allPlays = (proj.liveData.plays.allPlays || [])
    .filter((p) => p.about && p.about.inning === 1);
  const inn1 = JSON.stringify(proj).length;
  const mbMin = inn1 * 15 * (60000 / 2500) / 1048576;
  check(mbMin < 8,
    "a 1st-inning poll moves " + (inn1 / 1024).toFixed(1) + "KB — " + mbMin.toFixed(1) +
      "MB/min for a 15-game board at 2.5s",
    "the live poll would move " + mbMin.toFixed(1) + "MB/min; that is not affordable at 2.5s.");
  // The stale-play skip is what stops a mid-inning attach from narrating history
  // and then trailing the game for the rest of the inning.
  check(c.playAgeMs({ about: { endTime: new Date(Date.now() - 90000).toISOString() } }) > 45000 &&
        c.playAgeMs({ about: { endTime: new Date().toISOString() } }) < 5000 &&
        c.playAgeMs({}) === Infinity,
    "play age is read from endTime, and a play with no endTime is treated as old",
    "playAgeMs mis-reports how long ago a play finished.");

  /* ---- following the money ----
   * The callout used to follow only LEAN-or-better games. The desk PASSes
   * whenever the market has a game priced right, which says nothing about
   * whether there is a position on it — on a live board two of three open
   * positions were PASS. Worse, the obvious fix (match the position to the row
   * by r.market.ticker) fails exactly when it matters: a Kalshi market leaves
   * status=open at first pitch, so r.market is null for any game under way.
   * The match therefore has to run off the position's own ticker. */
  console.log("\nopen positions");
  const pos = [
    { ticker: "KXMLBRFI-26AUG151507NYYTOR", call: "NRFI", contracts: 1259 },
    { ticker: "KXMLBRFI-26AUG151810BALTB", call: "NRFI", contracts: 1531 },
    { ticker: "KXMLBRFI-26AUG161940SDCLE", call: "YRFI", contracts: 10 },
    { ticker: "KXMLBRFI-26AUG151915BOSPIT", call: "NRFI", contracts: 0 },
  ];
  const held = pos.filter((p) => p.ticker && p.contracts > 0)
    .map((p) => ({ call: p.call, date: c.tickerDate(p.ticker), codes: c.teamCodes(p.ticker) }));
  const side = (row) => { const h = c.matchRFI(row, held); return h ? h.call : null; };
  const row = (d, a, h) => ({ date: d, awayAbbr: a, homeAbbr: h });
  check(side(row("2026-08-15", "NYY", "TOR")) === "NRFI",
    "a held position is matched to its game with no live market at all",
    "the ticker-only match failed — a game under way would go uncalled.");
  check(side(row("2026-08-15", "BAL", "TB")) === "NRFI",
    "a two-letter home code (TB) still matches",
    "TB/TBR aliasing broke the match.");
  check(side(row("2026-08-15", "SD", "CLE")) === null,
    "a position on TOMORROW's game is not attached to today's slate",
    "the ET date guard is not holding — the wrong game would be narrated.");
  check(side(row("2026-08-15", "BOS", "PIT")) === null,
    "a settled/zero-contract position is not treated as money on the game",
    "a closed position still pulls the callout in.");
  check(side(row("2026-08-15", "MIA", "CIN")) === null,
    "a game with no position and no call is left alone",
    "an unheld game matched a position.");

  /* ---- which games are followed ----
   * The picker and the poll have to agree on this exactly. Two copies of the
   * predicate would drift, and the drift shows up as a game listed in the picker
   * that never speaks — the most confusing possible failure, because the UI says
   * it is being listened to. Both now call calloutEligible; this pins it. */
  console.log("\ngame selection");
  const soon = new Date(Date.now() + 2 * 60000).toISOString();
  const late = new Date(Date.now() + 60 * 60000).toISOString();
  const g = (o) => ({ gamePk: 1, date: "2026-08-15", awayAbbr: "MIA", homeAbbr: "CIN",
    currentInning: 1, ...o });
  check(c.calloutEligible(g({ v: { strength: "LEAN" } }), []) === true,
    "a LEAN in the 1st is followed",
    "a LEAN with no position was dropped.");
  check(c.calloutEligible(g({ v: { strength: "PASS" } }), []) === false,
    "a PASS with no money on it is not followed",
    "a PASS is being narrated — the callout would talk through games nobody is in.");
  check(c.calloutEligible(g({ v: { strength: "PASS" }, awayAbbr: "NYY", homeAbbr: "TOR" }), held) === true,
    "a PASS is followed anyway when a position is open on it",
    "money on the game did not override the PASS gate.");
  check(c.calloutEligible(g({ v: { strength: "BET" }, currentInning: 0, startUtc: soon }), []) === true,
    "a game about to start is picked up before first pitch",
    "the pre-start window is not attaching, so the opening pitches would be missed.");
  check(c.calloutEligible(g({ v: { strength: "BET" }, currentInning: 0, startUtc: late }), []) === false,
    "a game an hour out is not attached yet",
    "the callout is attaching to games far from first pitch.");
  check(c.calloutEligible(g({ v: { strength: "BET" }, currentInning: 3 }), []) === false,
    "a game past the 1st is dropped — the inning that settles it is over",
    "the callout is still polling a game whose 1st inning has ended.");
  check(c.calloutEligible(g({ v: { strength: "BET" }, final: true }), []) === false,
    "a final is not followed", "a finished game is still being polled.");
  check(c.calloutEligible(g({ v: { strength: "BET" }, gamePk: null }), []) === false,
    "a row with no gamePk cannot be polled and is dropped",
    "a row with no gamePk would be fetched as /game/null/feed/live.");

  /* ---- voice ----
   * "Natural" as a bare substring matched Edge's whole neural family, and the
   * first hit in that family is usually Ava or Emma. The rank has to name the
   * male voices individually rather than trust enumeration order, so the thing
   * worth pinning is the OUTCOME — a man — not the list. */
  console.log("\nvoice");
  // A fixture entry is either a bare name (en-US, not default) or a full voice
  // object. The mobile sets need both fields: WebKit marks Samantha `default`,
  // and Android's whole problem is that the only thing separating its voices is
  // `lang`, so a fixture that flattened lang to en-US could not express it.
  const vs = (names) => ({ getVoices: () => names.map((n) =>
    (typeof n === "string" ? { name: n, lang: "en-US" } : { lang: "en-US", ...n })) });
  const CHROME_WIN = ["Microsoft David - English (United States)", "Microsoft Mark - English (United States)",
    "Microsoft Zira - English (United States)", "Google US English", "Google UK English Female",
    "Google UK English Male"];
  // Chosen by ear against the alternatives, not off a spec sheet — Mark is a
  // local formant synth and loses to the Google network man on paper.
  check(/Microsoft Mark/.test(c.pickVoice(vs(CHROME_WIN)).name),
    "on Chrome/Windows the voice picked by ear (Microsoft Mark) is the one used",
    "picked " + c.pickVoice(vs(CHROME_WIN)).name + " from the real Chrome/Windows voice set.");
  check(!/Zira|Female|Google US English/.test(c.pickVoice(vs(CHROME_WIN)).name),
    "no female voice can win on the real Chrome/Windows voice set",
    "a female voice was selected: " + c.pickVoice(vs(CHROME_WIN)).name);
  // Edge enumerates Ava before Andrew; a bare "Natural" match takes the woman.
  const EDGE = ["Microsoft Ava Online (Natural) - English (United States)",
    "Microsoft Andrew Online (Natural) - English (United States)",
    "Microsoft Emma Online (Natural) - English (United States)", "Google UK English Male"];
  check(/Andrew/.test(c.pickVoice(vs(EDGE)).name),
    "in Edge a neural man is chosen even though a neural woman enumerates first",
    "picked " + c.pickVoice(vs(EDGE)).name + " — enumeration order is deciding this, not the rank.");
  check(c.pickVoice(vs(["Microsoft Zira - English (United States)",
    "Microsoft David - English (United States)"])).name.includes("David"),
    "with only the two old SAPI5 voices installed, the man is still chosen",
    "fell through to the female voice when no ranked voice was present.");
  check(c.pickVoice({ getVoices: () => [] }) === null,
    "an unenumerated voice list returns null rather than caching a wrong choice",
    "pickVoice committed to a voice before the engine had enumerated.");

  /* ---- the same voice on the phone as on the desk ----
   * Every name in VOICE_RANK above the Apple block exists on Windows and on
   * nothing else, so on an iPhone the rank used to miss outright and the pick
   * fell through to the browser default — Samantha. The desk called the inning
   * in a man's voice and the phone called it in a woman's. An IDENTICAL voice
   * is not reachable (Microsoft Mark does not ship on iOS or Android), so what
   * these pin is the achievable thing: same character, American and male, on
   * every platform that names its voices well enough to allow it. */
  const IOS = [{ name: "Samantha", lang: "en-US", default: true }, "Aaron", "Nicky",
    { name: "Daniel", lang: "en-GB" }, { name: "Karen", lang: "en-AU" },
    { name: "Moira", lang: "en-IE" }, { name: "Rishi", lang: "en-IN" }];
  check(/Aaron/.test(c.pickVoice(vs(IOS)).name),
    "on iOS the American man is chosen over the default (Samantha)",
    "picked " + c.pickVoice(vs(IOS)).name + " on iOS — the phone is calling the game " +
    "in a different voice from the desk.");
  /* The human-sounding iOS voices are downloads: Apple ships the phone with
   * compact (robotic) voices only, and the neural builds appear to WebKit only
   * after the user installs them in Settings. Once present, they must win —
   * both when they carry their own name (Evan) and when they are an Enhanced
   * copy of a name already in the rank (Tom vs "Tom (Enhanced)", where the
   * substring match hits both and the tie-break has to pick the download). */
  const IOS_ENH = [{ name: "Samantha", lang: "en-US", default: true }, "Aaron",
    { name: "Evan (Enhanced)", lang: "en-US", localService: true }, "Nicky"];
  check(/Evan \(Enhanced\)/.test(c.pickVoice(vs(IOS_ENH)).name),
    "a downloaded Enhanced man is chosen over the stock compact voices on iOS",
    "picked " + c.pickVoice(vs(IOS_ENH)).name + " with Evan (Enhanced) installed — the download is being ignored.");
  // "Alex" is ranked bare, so a set holding both copies exercises the
  // tie-break itself rather than a named rank entry: the substring match hits
  // both and better() must pick the download over the compact local copy.
  const TIE = ["Alex", { name: "Alex (Enhanced)", lang: "en-US", localService: true }];
  check(/Alex \(Enhanced\)/.test(c.pickVoice(vs(TIE)).name),
    "the Enhanced copy of a ranked name beats its compact copy via the tie-break",
    "picked " + c.pickVoice(vs(TIE)).name + " — the tie-break is discarding the downloaded build.");
  const MACOS = [{ name: "Samantha", lang: "en-US", default: true }, "Alex", "Fred", "Victoria",
    { name: "Daniel", lang: "en-GB" }];
  check(/Alex/.test(c.pickVoice(vs(MACOS)).name),
    "on macOS Alex is chosen ahead of Fred and the default",
    "picked " + c.pickVoice(vs(MACOS)).name + " on macOS.");
  /* Android names its voices for locale only — there is no gender anywhere in
   * the string or the object, so no rank entry can reach it and no check here
   * can honestly assert a man. What the fallback CAN do is refuse to swap the
   * accent, which is the most audible half of the mismatch, so that is what is
   * pinned. If this ever fails it means the en-US narrowing stopped working. */
  const ANDROID = [{ name: "English United Kingdom", lang: "en-GB", default: true },
    { name: "English Australia", lang: "en-AU" }, { name: "English United States", lang: "en-US" },
    { name: "English India", lang: "en-IN" }];
  check(/United States/.test(c.pickVoice(vs(ANDROID)).name),
    "on Android an American voice is chosen even though en-GB is the default",
    "picked " + c.pickVoice(vs(ANDROID)).name + " on Android — the call would change accent " +
    "between desk and phone.");
  // The denylist must never outrank a named voice: Mark wins on a set that also
  // contains a woman the fallback would have skipped for a different reason.
  check(/Microsoft Mark/.test(c.pickVoice(vs([{ name: "Samantha", lang: "en-US", default: true },
    "Microsoft Mark - English (United States)"])).name),
    "VOICE_RANK still outranks the fallback's female denylist",
    "the fallback is running ahead of the rank.");
  // A pool of nothing but voices on the denylist must still return one. The
  // filter narrows; it is not allowed to empty the pool and go silent.
  check(c.pickVoice(vs(["Samantha", "Victoria"])) !== null,
    "a voice set containing only denylisted names still returns a voice",
    "the fallback filtered the pool to empty and the callout would go silent.");

  /* ---- neural over robotic, where the API will say which is which ----
   * localService is the only quality signal exposed. On Android the stock LOCAL
   * voice is the robotic one and the network voice is the neural model, and both
   * carry the same locale-only name — so the flag is the only way to tell them
   * apart, and it used to be ignored entirely. */
  const ANDROID2 = [
    { name: "English United States", lang: "en-US", localService: true, default: true },
    { name: "English United States", lang: "en-US", localService: false },
    { name: "English United Kingdom", lang: "en-GB", localService: false }];
  check(c.pickVoice(vs(ANDROID2)).localService === false,
    "on Android the network (neural) voice is preferred over the robotic local one",
    "the local voice won — the phone gets the sat-nav voice.");
  // Two copies of a RANKED voice: the tie-break applies inside a rank entry too.
  check(c.pickVoice(vs([{ name: "Aaron", lang: "en-US", localService: true },
    { name: "Aaron", lang: "en-US", localService: false }])).localService === false,
    "given two copies of the same ranked voice, the network one is chosen",
    "picked the local copy of a voice that also exists as a network voice.");
  /* THE REGRESSION THIS MUST NOT CAUSE. Microsoft Mark is a LOCAL formant voice
   * that won a listening A/B against the smoother network man. Quality is a
   * tie-break WITHIN a rank entry and must never reorder the rank itself, or
   * this change quietly overturns a measured result on spec-sheet reasoning. */
  check(/Microsoft Mark/.test(c.pickVoice(vs([
    { name: "Microsoft Mark - English (United States)", lang: "en-US", localService: true },
    { name: "Google UK English Male", lang: "en-GB", localService: false }])).name),
    "a local voice that won its A/B still outranks a network voice below it",
    "the network preference reordered VOICE_RANK and overturned the listening test.");
  // Every fixture above this section omits localService entirely. Behaviour must
  // be unchanged when the engine does not report it.
  check(/Microsoft Mark/.test(c.pickVoice(vs(CHROME_WIN)).name),
    "a voice list with no localService reported behaves exactly as before",
    "the quality pass changed the pick on an engine that reports no quality flag.");

  console.log("\n" + "=".repeat(78));
  if (fails) { console.log(fails + " check(s) FAILED"); process.exit(1); }
  console.log("callout reads the live feed correctly");
})().catch((e) => { console.error(e); process.exit(1); });
