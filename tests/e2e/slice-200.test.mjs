/**
 * Slice 200 — Expression Evaluator + Operator Registry
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 200 — Expression Evaluator + Operator Registry\x1b[0m\n");

console.log("\x1b[36m  Part 1: Expression Evaluator\x1b[0m");
const eeLib = join(process.cwd(), "tools/ogu/commands/lib/expression-evaluator.mjs");
assert("expression-evaluator.mjs exists", () => { if (!existsSync(eeLib)) throw new Error("missing"); });
const eeMod = await import(eeLib);
assert("evaluates simple arithmetic", () => {
  const result = eeMod.evaluate("2 + 3");
  if (result !== 5) throw new Error(`expected 5, got ${result}`);
});
assert("respects operator precedence", () => {
  const result = eeMod.evaluate("2 + 3 * 4");
  if (result !== 14) throw new Error(`expected 14, got ${result}`);
});
assert("handles parentheses", () => {
  const result = eeMod.evaluate("(2 + 3) * 4");
  if (result !== 20) throw new Error(`expected 20, got ${result}`);
});
assert("evaluates with variables", () => {
  const result = eeMod.evaluate("x + y", { x: 10, y: 20 });
  if (result !== 30) throw new Error(`expected 30, got ${result}`);
});

console.log("\n\x1b[36m  Part 2: Operator Registry\x1b[0m");
const orLib = join(process.cwd(), "tools/ogu/commands/lib/operator-registry.mjs");
assert("operator-registry.mjs exists", () => { if (!existsSync(orLib)) throw new Error("missing"); });
const orMod = await import(orLib);
assert("register and apply operator", () => {
  const reg = orMod.createOperatorRegistry();
  reg.register("double", (a) => a * 2);
  if (reg.apply("double", 5) !== 10) throw new Error("expected 10");
});
assert("list returns all operators", () => {
  const reg = orMod.createOperatorRegistry();
  reg.register("add", (a, b) => a + b);
  reg.register("sub", (a, b) => a - b);
  if (reg.list().length !== 2) throw new Error("expected 2");
});
assert("has checks existence", () => {
  const reg = orMod.createOperatorRegistry();
  reg.register("foo", () => {});
  if (!reg.has("foo")) throw new Error("should have foo");
  if (reg.has("bar")) throw new Error("should not have bar");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
