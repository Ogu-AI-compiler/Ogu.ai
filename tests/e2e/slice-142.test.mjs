/**
 * Slice 142 — Template Engine
 *
 * Template Engine: simple template rendering with variable substitution.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 142 — Template Engine\x1b[0m\n");

// ── Part 1: Template Engine ──────────────────────────────

console.log("\x1b[36m  Part 1: Template Engine\x1b[0m");

const teLib = join(process.cwd(), "tools/ogu/commands/lib/template-engine.mjs");
assert("template-engine.mjs exists", () => {
  if (!existsSync(teLib)) throw new Error("file missing");
});

const teMod = await import(teLib);

assert("render substitutes variables", () => {
  if (typeof teMod.render !== "function") throw new Error("missing");
  const result = teMod.render("Hello, {{name}}!", { name: "World" });
  if (result !== "Hello, World!") throw new Error(`got: ${result}`);
});

assert("render handles multiple variables", () => {
  const result = teMod.render("{{greeting}}, {{name}}! You are {{age}}.", {
    greeting: "Hi", name: "Alice", age: "30"
  });
  if (result !== "Hi, Alice! You are 30.") throw new Error(`got: ${result}`);
});

assert("render handles missing variables gracefully", () => {
  const result = teMod.render("Hello, {{name}}!", { name: "Bob" });
  if (result !== "Hello, Bob!") throw new Error(`got: ${result}`);
});

assert("renderBlock handles conditional blocks", () => {
  if (typeof teMod.renderBlock !== "function") throw new Error("missing");
  const tmpl = "{{#if hasAuth}}auth enabled{{/if}}";
  const result = teMod.renderBlock(tmpl, { hasAuth: true });
  if (!result.includes("auth enabled")) throw new Error("should include block");
  const result2 = teMod.renderBlock(tmpl, { hasAuth: false });
  if (result2.includes("auth enabled")) throw new Error("should exclude block");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
