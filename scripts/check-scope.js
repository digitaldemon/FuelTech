// Static check for references to variables that were never declared in scope.
//
// Catches the class of bug that broke the NRFI board: a `let` declared inside a
// try block but read after the catch compiles cleanly and only throws at
// runtime ("Can't find variable: recentK9"). Babel is a transpiler, not a
// linter, so `desk-build` cannot see it. Run this before shipping app.jsx.
//
//   node scripts/check-scope.js            → checks public/desk/app.jsx
//   node scripts/check-scope.js <file...>  → checks the given files
//
// Exits 1 if any unresolved reference is found.
const fs = require("fs");
const path = require("path");
const Babel = require("@babel/standalone");

const { parser } = Babel.packages;
// @babel/standalone exposes traverse as a module namespace, not a bare function.
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;

// Globals available in the browser/JSX runtime that have no local binding.
const KNOWN_GLOBALS = new Set([
  "window", "document", "navigator", "location", "console", "fetch", "URL",
  "URLSearchParams", "localStorage", "sessionStorage", "caches", "Headers",
  "Request", "Response", "AbortController", "FormData", "Blob", "File",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask",
  "requestAnimationFrame", "cancelAnimationFrame", "structuredClone", "crypto",
  "Math", "JSON", "Object", "Array", "String", "Number", "Boolean", "Date",
  "RegExp", "Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError",
  "Promise", "Map", "Set", "WeakMap", "WeakSet", "Symbol", "Proxy", "Reflect",
  "Intl", "BigInt", "ArrayBuffer", "Uint8Array", "Int32Array", "Float64Array",
  "DataView", "TextEncoder", "TextDecoder", "Infinity", "NaN", "undefined",
  "globalThis", "isNaN", "isFinite", "parseInt", "parseFloat", "encodeURIComponent",
  "decodeURIComponent", "encodeURI", "decodeURI", "atob", "btoa", "alert",
  "performance", "process", "module", "require", "exports", "self", "EventSource",
  "WebSocket", "Notification", "MutationObserver", "IntersectionObserver",
  // Worker drives the callout metronome; a hidden tab throttles a main-thread
  // setInterval to one wake per minute and leaves Worker timers alone.
  "Worker", "AudioContext", "webkitAudioContext", "SpeechSynthesisUtterance",
  // Vendored UMD globals + React hooks pulled off the React namespace.
  "React", "ReactDOM", "useState", "useEffect", "useRef", "useMemo",
  "useCallback", "useContext", "useReducer", "useLayoutEffect", "Fragment",
]);

// Exported so nrfi-slice-gap.js can ask the same question of the model bundle
// without keeping a second hand-written copy of this list. Two guessed lists
// that agree today drift the first time one of them is corrected, and both
// keep printing green the whole time.
module.exports = { KNOWN_GLOBALS };
// desk-build.js spawns this as its own process, so the CLI still runs there.
if (require.main !== module) return;

const files = process.argv.slice(2);
if (!files.length) files.push(path.join("public", "desk", "app.jsx"));

let problems = 0;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const ast = parser.parse(src, {
    sourceType: "unambiguous",
    plugins: ["jsx", "optionalChaining", "nullishCoalescingOperator", "classProperties"],
    errorRecovery: true,
  });

  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (KNOWN_GLOBALS.has(name)) return;
      if (p.scope.hasBinding(name, /* noGlobals */ true)) return;
      // JSX intrinsic elements (<div>) are lowercase and not variables.
      if (p.parent.type === "JSXOpeningElement" || p.parent.type === "JSXClosingElement") return;

      problems++;
      const line = p.node.loc ? p.node.loc.start.line : "?";
      console.error(`${file}:${line}  unresolved reference: ${name}`);
    },
  });
}

if (problems) {
  console.error(`\ncheck-scope: ${problems} unresolved reference(s) — these throw at runtime.`);
  process.exit(1);
}
console.log("check-scope: no unresolved references");
