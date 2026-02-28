/**
 * Slice 176 — Scope Resolver + Variable Binder
 *
 * Scope Resolver: resolve variable scopes in nested blocks.
 * Variable Binder: bind variables to values with lifetime tracking.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 176 — Scope Resolver + Variable Binder\x1b[0m\n");

// ── Part 1: Scope Resolver ──────────────────────────────

console.log("\x1b[36m  Part 1: Scope Resolver\x1b[0m");

const srLib = join(process.cwd(), "tools/ogu/commands/lib/scope-resolver.mjs");
assert("scope-resolver.mjs exists", () => {
  if (!existsSync(srLib)) throw new Error("file missing");
});

const srMod = await import(srLib);

assert("createScopeResolver returns resolver", () => {
  if (typeof srMod.createScopeResolver !== "function") throw new Error("missing");
  const sr = srMod.createScopeResolver();
  if (typeof sr.openScope !== "function") throw new Error("missing openScope");
  if (typeof sr.closeScope !== "function") throw new Error("missing closeScope");
  if (typeof sr.declare !== "function") throw new Error("missing declare");
  if (typeof sr.resolve !== "function") throw new Error("missing resolve");
});

assert("declare and resolve in same scope", () => {
  const sr = srMod.createScopeResolver();
  sr.declare("x", { type: "let", value: 42 });
  const binding = sr.resolve("x");
  if (!binding) throw new Error("should find x");
  if (binding.value !== 42) throw new Error(`expected 42, got ${binding.value}`);
});

assert("inner scope shadows outer", () => {
  const sr = srMod.createScopeResolver();
  sr.declare("x", { value: "outer" });
  sr.openScope("block");
  sr.declare("x", { value: "inner" });
  if (sr.resolve("x").value !== "inner") throw new Error("should shadow");
  sr.closeScope();
  if (sr.resolve("x").value !== "outer") throw new Error("should restore");
});

assert("resolve finds outer scope", () => {
  const sr = srMod.createScopeResolver();
  sr.declare("global", { value: "g" });
  sr.openScope("fn");
  sr.openScope("block");
  if (sr.resolve("global").value !== "g") throw new Error("should find outer");
});

assert("resolve returns null for undeclared", () => {
  const sr = srMod.createScopeResolver();
  if (sr.resolve("unknown") !== null) throw new Error("should return null");
});

// ── Part 2: Variable Binder ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Variable Binder\x1b[0m");

const vbLib = join(process.cwd(), "tools/ogu/commands/lib/variable-binder.mjs");
assert("variable-binder.mjs exists", () => {
  if (!existsSync(vbLib)) throw new Error("file missing");
});

const vbMod = await import(vbLib);

assert("createVariableBinder returns binder", () => {
  if (typeof vbMod.createVariableBinder !== "function") throw new Error("missing");
  const vb = vbMod.createVariableBinder();
  if (typeof vb.bind !== "function") throw new Error("missing bind");
  if (typeof vb.get !== "function") throw new Error("missing get");
  if (typeof vb.unbind !== "function") throw new Error("missing unbind");
});

assert("bind and get work", () => {
  const vb = vbMod.createVariableBinder();
  vb.bind("name", "Alice");
  if (vb.get("name") !== "Alice") throw new Error("should get Alice");
});

assert("unbind removes binding", () => {
  const vb = vbMod.createVariableBinder();
  vb.bind("x", 10);
  vb.unbind("x");
  if (vb.get("x") !== undefined) throw new Error("should be undefined");
});

assert("listBindings returns all", () => {
  const vb = vbMod.createVariableBinder();
  vb.bind("a", 1);
  vb.bind("b", 2);
  const bindings = vb.listBindings();
  if (bindings.length !== 2) throw new Error(`expected 2, got ${bindings.length}`);
});

assert("rebind updates value", () => {
  const vb = vbMod.createVariableBinder();
  vb.bind("x", 1);
  vb.bind("x", 2);
  if (vb.get("x") !== 2) throw new Error("should be 2 after rebind");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
