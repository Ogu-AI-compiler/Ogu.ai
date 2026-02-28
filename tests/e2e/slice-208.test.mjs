/**
 * Slice 208 — Glob Matcher + File Pattern Engine
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 208 — Glob Matcher + File Pattern Engine\x1b[0m\n");

console.log("\x1b[36m  Part 1: Glob Matcher\x1b[0m");
const gmLib = join(process.cwd(), "tools/ogu/commands/lib/glob-matcher.mjs");
assert("glob-matcher.mjs exists", () => { if (!existsSync(gmLib)) throw new Error("missing"); });
const gmMod = await import(gmLib);
assert("matches wildcard *", () => {
  if (!gmMod.match("*.js", "app.js")) throw new Error("should match");
  if (gmMod.match("*.js", "app.ts")) throw new Error("should not match");
});
assert("matches question mark ?", () => {
  if (!gmMod.match("file?.txt", "file1.txt")) throw new Error("should match");
  if (gmMod.match("file?.txt", "file12.txt")) throw new Error("should not match");
});
assert("matches double star **", () => {
  if (!gmMod.match("src/**/*.js", "src/a/b/c.js")) throw new Error("should match");
});
assert("exact match", () => {
  if (!gmMod.match("exact.txt", "exact.txt")) throw new Error("should match");
  if (gmMod.match("exact.txt", "other.txt")) throw new Error("should not match");
});

console.log("\n\x1b[36m  Part 2: File Pattern Engine\x1b[0m");
const fpLib = join(process.cwd(), "tools/ogu/commands/lib/file-pattern-engine.mjs");
assert("file-pattern-engine.mjs exists", () => { if (!existsSync(fpLib)) throw new Error("missing"); });
const fpMod = await import(fpLib);
assert("addPattern and test", () => {
  const engine = fpMod.createFilePatternEngine();
  engine.addPattern("*.js", "javascript");
  const result = engine.test("app.js");
  if (result !== "javascript") throw new Error(`expected javascript, got ${result}`);
});
assert("returns null for no match", () => {
  const engine = fpMod.createFilePatternEngine();
  engine.addPattern("*.py", "python");
  if (engine.test("app.js") !== null) throw new Error("should be null");
});
assert("testAll returns all matches", () => {
  const engine = fpMod.createFilePatternEngine();
  engine.addPattern("**/*.js", "js");
  engine.addPattern("src/*", "src");
  const results = engine.testAll("src/app.js");
  if (results.length !== 2) throw new Error(`expected 2, got ${results.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
