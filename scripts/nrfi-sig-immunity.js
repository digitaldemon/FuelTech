// Does modelSig actually ignore prose, and still catch logic? Proves both.
//
// The claim this checks is the whole reason blankComments exists in
// nrfi-model-lib.js: a fingerprint that moves when someone writes a comment is
// a fingerprint people route around, and a fingerprint that holds when someone
// changes the math is worse than none. Both halves are asserted here, because
// "comments are excluded" is exactly the kind of statement that stays true
// until a slice list or a parser option quietly changes underneath it.
//
// HOW IT WORKS, and the one thing to know before running it: it temporarily
// EDITS public/desk/app.jsx, reloads the library in a child process, and puts
// the file back. The original bytes are written to a .bak beside the file
// first, and the restore is in a finally, so a crash still restores. If the
// process is killed outright, restore by hand from the .bak path it prints.
//
// Run: node scripts/nrfi-sig-immunity.js
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);
const APP = "public/desk/app.jsx";
const BAK = "public/desk/.app.jsx.sigtest.bak";

// Child process, not require(): modelSig is computed at module load, and
// Node's module cache would hand back the first result for every later case.
const sigOf = () => JSON.parse(cp.execSync(
  'node -e "const L=require(\'./scripts/nrfi-model-lib.js\');' +
  'console.log(JSON.stringify({m:L.modelSig,l:L.ladderSig}))"',
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim());

/* Each case edits one thing and says whether modelSig is allowed to move.
 *
 * The mutations deliberately avoid the literal slice markers themselves —
 * those are meant to fail loudly on a rename, so mutating one tests the marker
 * design rather than the fingerprint. Targets are bodies and comments. */
const CASES = [
  ["comment line added inside a sliced fn", false,
    (s) => s.replace("function nrfiEvaluate(",
      "// a brand new note nobody had written before\nfunction nrfiEvaluate(")],
  ["existing comment reflowed to more lines", false,
    (s) => s.replace("// Start-thin but carrying enough relief work to clear the gate — worth saying out",
      "// Start-thin but carrying\n// enough relief work to clear the gate\n// — worth saying out")],
  ["trailing inline comment on a code line", false,
    (s) => s.replace("  if (!p) return true;",
      "  if (!p) return true; // no profile at all counts as thin")],
  ["code line re-indented", false,
    (s) => s.replace("  if ((p.sample || 0) >= NRFI_THIN_STARTS) return false;",
      "        if ((p.sample || 0) >= NRFI_THIN_STARTS) return false;")],
  // The half that matters more. If this one ever reports "sig held", the guard
  // has stopped guarding and every cache built afterwards is suspect.
  ["real logic changed (must move)", true,
    (s) => s.replace("  if (!p) return true;", "  if (!p) return false;")],
];

const orig = fs.readFileSync(APP);
fs.writeFileSync(BAK, orig);
let pass = 0;
const failures = [];
try {
  const base = sigOf();
  console.log("baseline  modelSig " + base.m + "   ladderSig " + base.l + "\n");
  for (const [name, mustMove, mutate] of CASES) {
    const before = orig.toString("utf8");
    const after = mutate(before);
    if (after === before) {
      // A mutation that matched nothing silently tests nothing, which is the
      // failure mode this whole file exists to avoid. Treat it as a failure.
      failures.push(name + " — the target text no longer exists in app.jsx, so this case tested nothing");
      console.log("STALE " + name.padEnd(42) + "target text not found");
      continue;
    }
    fs.writeFileSync(APP, after);
    let r;
    try {
      r = sigOf();
    } catch (e) {
      const line = String(e.stderr || e.message).split("\n").find((l) => /Error:/.test(l));
      failures.push(name + " — library threw: " + (line || "").trim());
      console.log("THREW " + name.padEnd(42) + (line || "").trim().slice(0, 100));
      continue;
    }
    const moved = r.m !== base.m;
    const ok = moved === mustMove;
    if (ok) pass++;
    else failures.push(name + " — expected sig to " + (mustMove ? "move" : "hold") + ", it " + (moved ? "moved" : "held"));
    console.log((ok ? "PASS  " : "FAIL  ") + name.padEnd(42) +
      (moved ? "sig MOVED -> " + r.m : "sig held"));
  }
} finally {
  fs.writeFileSync(APP, orig);
  const restored = fs.readFileSync(APP).equals(orig);
  console.log("\n" + APP + " restored byte-identical: " + restored);
  if (restored) fs.unlinkSync(BAK);
  else console.log("RESTORE FAILED — original bytes are at " + BAK + ", copy it back before doing anything else");
}

console.log(pass + " / " + CASES.length + " passed");
if (failures.length) {
  console.log("\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
