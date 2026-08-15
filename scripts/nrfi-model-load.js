// Load the shipped desk bundle in a sandbox and hand back the model functions.
//
// The point is to calibrate against the code that actually runs. Re-implementing
// the model in the harness is how the current seed went wrong: NRFI_CALIB_SEED
// was fit on the simplified lambda-model in app/api/desk/nrfi/backtest/route.ts
// and then applied to the far richer live evaluator, which over-shrinks it.
//
// app.js declares everything at top level and only touches the DOM on the final
// ReactDOM.createRoot line, so stubbing React/ReactDOM/document is enough to get
// the pure functions without rendering anything.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function noop() {}
function hookStub() { return [undefined, noop]; }

function loadDeskModel(bundlePath) {
  const file = bundlePath || path.join(__dirname, "..", "public", "desk", "app.js");
  const code = fs.readFileSync(file, "utf8");

  const React = {
    createElement: () => null, Fragment: "Fragment",
    useState: hookStub, useEffect: noop, useRef: () => ({ current: null }),
    useMemo: (f) => (typeof f === "function" ? undefined : undefined),
    useCallback: (f) => f, useContext: () => undefined, useReducer: hookStub,
    useLayoutEffect: noop,
  };
  const ReactDOM = { createRoot: () => ({ render: noop }), render: noop };
  const storage = { getItem: () => null, setItem: noop, removeItem: noop };

  const sandbox = {
    React, ReactDOM,
    document: { getElementById: () => ({}), createElement: () => ({ style: {} }), addEventListener: noop },
    window: { addEventListener: noop, localStorage: storage, matchMedia: () => ({ matches: false, addEventListener: noop }) },
    localStorage: storage, sessionStorage: storage,
    navigator: { userAgent: "node", serviceWorker: { register: () => Promise.resolve() } },
    location: { href: "https://www.fueltechaipro.com/desk", origin: "https://www.fueltechaipro.com" },
    fetch: globalThis.fetch,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
    console,
    // Hooks are pulled off React by name in the bundle's preamble.
    useState: hookStub, useEffect: noop, useRef: () => ({ current: null }),
    useMemo: () => undefined, useCallback: (f) => f,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename: "app.js" });
  // Top-level `function` declarations land on the context object, but `const`
  // and `let` live in the script's lexical scope and are invisible there. Read
  // those by evaluating the name inside the same context.
  ctx.read = (expr) => vm.runInContext(expr, ctx, { filename: "read" });
  return ctx;
}

module.exports = { loadDeskModel };

if (require.main === module) {
  const c = loadDeskModel();
  const want = ["nrfiEvaluate", "applyCalibration", "nrfiBlend", "nrfiVerdict",
    "halfNoRun", "nrfiRegress", "platoonFactor", "offKrateFactor", "checkFamily"];
  const missing = want.filter((n) => typeof c[n] !== "function");
  for (const n of want) console.log((typeof c[n] === "function" ? "  ok  " : " MISS ") + n);
  if (missing.length) { console.error("\nmissing: " + missing.join(", ")); process.exit(1); }
  console.log("\nmodel loaded from bundle — " + want.length + " functions available");
}
