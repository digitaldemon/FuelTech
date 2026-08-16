// Regression tests for the live-callout speech queue in public/desk/app.jsx.
// Run: node scripts/desk-callout-queue-test.js
//
// The queue cannot be exercised by ear from here and speechSynthesis does not
// exist in node, so this drives the REAL source (sliced out of app.jsx, not
// copied) against a fake synthesiser that reproduces the one behaviour that
// makes this code hard: cancel() delivers the cancelled utterance's `end` event
// LATER, after its replacement has already started speaking.
//
// That late event is the bug these tests exist to pin. `done` is wired to
// onend, onerror and a watchdog, and if it cannot tell which utterance fired
// it, a ghost from a cancelled line walks into the settle line's state and
// drains the queue on top of it.
const fs = require("fs");
const path = require("path");
// CALLOUT_SRC exists so the suite can be pointed at a deliberately broken copy
// of app.jsx to confirm it still fails there. A test for a race that passes on
// both the fixed and the broken source is not testing the race.
const srcPath = process.env.CALLOUT_SRC || path.join(__dirname, "..", "public", "desk", "app.jsx");
const src = fs.readFileSync(srcPath, "utf8");

function slice(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  if (a === -1) throw new Error("start marker not found: " + startMarker);
  const b = src.indexOf(endMarker, a);
  if (b === -1) throw new Error("end marker not found after: " + startMarker);
  return src.slice(a, b + endMarker.length);
}

// A synthesiser that behaves like Chrome's in the way that matters: utterances
// do not finish on their own, and cancel() fires the outgoing utterance's end
// event asynchronously rather than immediately.
function makeSynth() {
  const spoken = [];
  let current = null;
  const ghosts = [];
  return {
    spoken,
    paused: false,
    speaking: false,
    speak(u) { spoken.push(u.text); current = u; },
    cancel() {
      if (current && current.onend) ghosts.push(current.onend);
      current = null;
    },
    resume() { this.paused = false; },
    // Deliver a pending cancelled-utterance end event, i.e. the ghost.
    flushGhosts() { const g = ghosts.splice(0); for (const f of g) f(); },
    // Finish the utterance that is genuinely speaking right now.
    finish() { const u = current; current = null; if (u && u.onend) u.onend(); },
    pendingGhosts: () => ghosts.length,
  };
}

const harness = [
  "let _voice = null, _voiceTried = false;",
  "function pickVoice() { return null; }",
  // Markers deliberately avoid the tunable VALUES — an earlier version ended a
  // slice on "const SAY_STALE_MS = 12000;" and broke the moment that was retuned.
  slice("const SAY_MAX = 3;", "const _sayQ = [];"),   // both caps + the queue
  slice("let _sayOn = false", "\n}"),                 // _sayGen decl + _sayDrain
  slice("function speak(text, urgent, at)", "\n}"),
  slice("function speakStop()", "\n}"),
  "return { speak, speakStop, state: () => ({ on: _sayOn, depth: _sayQ.length, gen: _sayGen }) };",
].join("\n");

let fails = 0, passes = 0;
function check(name, cond, detail) {
  if (cond) { passes++; console.log("  ok   " + name); }
  else { fails++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
}

function fresh() {
  const synth = makeSynth();
  global.window = { SpeechSynthesisUtterance: function (t) { this.text = t; }, speechSynthesis: synth };
  // The watchdog is a timer, and waiting out a real one would make this suite
  // take seconds per case. Capture them instead and fire on demand.
  // The queue resolves setTimeout at call time, not at construction, so the
  // override has to stay installed while the tests drive it. Each fresh() gets
  // its own timer list and the suite runs sequentially, so they cannot mix.
  const timers = [];
  global.setTimeout = (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length - 1; };
  global.clearTimeout = (id) => { if (timers[id]) timers[id].live = false; };
  const api = new Function(harness)();
  // Fire the most recently armed timer that is still live, i.e. the watchdog for
  // whatever is speaking now.
  const fireGuard = () => {
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].live) { timers[i].live = false; timers[i].fn(); return true; }
    }
    return false;
  };
  return { synth, api, fireGuard, armed: () => timers.filter((t) => t.live).length };
}

console.log("ghost end event from a cancelled utterance");
{
  const { synth, api } = fresh();
  api.speak("ball one", false);
  check("first line starts speaking", synth.spoken.length === 1, synth.spoken.join("|"));
  const genBefore = api.state().gen;

  // A run scores: urgent cancels whatever is speaking and takes over.
  api.speak("A run scores. That is Y-R-F-I.", true);
  check("settle line starts", synth.spoken[1] === "A run scores. That is Y-R-F-I.", synth.spoken.join("|"));
  check("settle owns the latch", api.state().on === true);
  check("generation advanced past the cancelled line", api.state().gen > genBefore);
  check("a ghost is pending", synth.pendingGhosts() === 1);

  // The cancelled line's end event now lands, mid-settle.
  synth.flushGhosts();
  check("ghost does not release the latch", api.state().on === true,
    "latch cleared by an event from a line that was already cancelled");
  check("ghost speaks nothing extra", synth.spoken.length === 2, synth.spoken.join("|"));

  // Commentary arriving during the settle must QUEUE, not jump on top of it.
  api.speak("strike two", false, Date.now());
  check("later line queues behind the settle", synth.spoken.length === 2, synth.spoken.join("|"));
  check("queue holds it", api.state().depth === 1);

  // Settle finishes normally; the queued line then goes.
  synth.finish();
  check("queued line follows the settle", synth.spoken[2] === "strike two", synth.spoken.join("|"));
  check("latch held by the new line", api.state().on === true);
}

console.log("\nstop, then immediately restart");
{
  const { synth, api } = fresh();
  api.speak("ball one", false);
  api.speakStop();
  check("stop clears the latch", api.state().on === false);
  api.speak("new game. First inning.", false);
  check("new session speaks", synth.spoken[1] === "new game. First inning.", synth.spoken.join("|"));
  synth.flushGhosts();   // the stopped utterance's end event lands late
  check("ghost does not disturb the new session", api.state().on === true);
  check("nothing extra spoken", synth.spoken.length === 2, synth.spoken.join("|"));
}

console.log("\nnormal drain still works");
{
  const { synth, api } = fresh();
  api.speak("one", false);
  api.speak("two", false);
  check("second line waits", synth.spoken.length === 1, synth.spoken.join("|"));
  synth.finish();
  check("second line follows", synth.spoken[1] === "two", synth.spoken.join("|"));
  synth.finish();
  check("queue empties and latch releases", api.state().on === false && api.state().depth === 0);
}

console.log("\nstale lines are skipped at drain");
{
  const { synth, api } = fresh();
  api.speak("current", false);
  // Thrown 40s ago: past SAY_STALE_MS, must never be spoken.
  api.speak("ancient", false, Date.now() - 40000);
  api.speak("recent", false, Date.now());
  synth.finish();
  check("stale line dropped, fresh one spoken", synth.spoken[1] === "recent", synth.spoken.join("|"));
}

console.log("\ndepth cap keeps the newest lines");
{
  const { synth, api } = fresh();
  api.speak("speaking now", false);
  for (const t of ["a", "b", "c", "d", "e"]) api.speak(t, false);
  check("queue capped at SAY_MAX", api.state().depth === 3, "depth " + api.state().depth);
  synth.finish();
  check("oldest backlog dropped, newest kept", synth.spoken[1] === "c", synth.spoken.join("|"));
}

console.log("\nwatchdog does not talk over a line that is still speaking");
{
  const { synth, api, fireGuard } = fresh();
  api.speak("a long line of commentary", false);
  api.speak("next up", false);
  // Budget expired, but the engine says it is still going: a slow voice, not a
  // dropped utterance. Interrupting here is what produced garble.
  synth.speaking = true;
  fireGuard();
  check("queued line held back while still speaking", synth.spoken.length === 1, synth.spoken.join("|"));
  check("latch still held", api.state().on === true);
  // Chrome drops utterances silently and never fires end. Once it admits it is
  // not speaking, the watchdog is the only thing that can recover the queue.
  synth.speaking = false;
  fireGuard();
  check("recovers once the engine reports idle", synth.spoken[1] === "next up", synth.spoken.join("|"));
}

console.log("\nwatchdog re-arms are capped so a stuck engine still recovers");
{
  const { synth, api, fireGuard } = fresh();
  api.speak("one", false);
  api.speak("two", false);
  synth.speaking = true;   // never goes false: synthesis parked
  let fired = 0;
  while (fired < 12 && synth.spoken.length === 1) { if (!fireGuard()) break; fired++; }
  check("queue recovers despite speaking stuck true", synth.spoken[1] === "two", synth.spoken.join("|"));
  check("gave the voice several chances first", fired > 1, "fired " + fired);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exitCode = fails ? 1 : 0;
