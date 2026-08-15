// Precompile the Contract Desk frontend so phones never run Babel.
// - public/desk/app.jsx  ->  public/desk/app.js (JSX stripped, same code)
// - React UMD bundles copied from node_modules into public/desk/vendor/
// Runs automatically via the npm "prebuild" hook on every Vercel build.
const fs = require("fs");
const path = require("path");
const Babel = require("@babel/standalone");

const root = path.join(__dirname, "..");
const deskDir = path.join(root, "public", "desk");
const vendorDir = path.join(deskDir, "vendor");

// Babel is a transpiler, not a linter — it happily compiles a reference to a
// variable that is out of scope, which then throws only in the browser and
// takes the whole board down. Gate the build on the scope check.
require("child_process").execFileSync(
  process.execPath, [path.join(__dirname, "check-scope.js")], { stdio: "inherit" }
);

const src = fs.readFileSync(path.join(deskDir, "app.jsx"), "utf8");
const out = Babel.transform(src, { presets: ["react"] }).code;
fs.writeFileSync(path.join(deskDir, "app.js"),
  "/* Generated from app.jsx by scripts/desk-build.js — edit app.jsx, not this file. */\n" + out);

fs.mkdirSync(vendorDir, { recursive: true });
for (const [pkg, file] of [
  ["react", "react.production.min.js"],
  ["react-dom", "react-dom.production.min.js"],
]) {
  fs.copyFileSync(
    path.join(root, "node_modules", pkg, "umd", file),
    path.join(vendorDir, file)
  );
}
console.log("desk-build: app.js " + (out.length / 1024).toFixed(0) + "KB + vendored React UMD");
