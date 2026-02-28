/**
 * Slice 173 — Type Checker + Type Resolver
 *
 * Type Checker: validate values against type schemas.
 * Type Resolver: resolve type references and unions.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 173 — Type Checker + Type Resolver\x1b[0m\n");

// ── Part 1: Type Checker ──────────────────────────────

console.log("\x1b[36m  Part 1: Type Checker\x1b[0m");

const tcLib = join(process.cwd(), "tools/ogu/commands/lib/type-checker.mjs");
assert("type-checker.mjs exists", () => {
  if (!existsSync(tcLib)) throw new Error("file missing");
});

const tcMod = await import(tcLib);

assert("createTypeChecker returns checker", () => {
  if (typeof tcMod.createTypeChecker !== "function") throw new Error("missing");
  const tc = tcMod.createTypeChecker();
  if (typeof tc.check !== "function") throw new Error("missing check");
  if (typeof tc.registerType !== "function") throw new Error("missing registerType");
});

assert("check validates primitive types", () => {
  const tc = tcMod.createTypeChecker();
  const r1 = tc.check(42, "number");
  if (!r1.valid) throw new Error("42 should be number");
  const r2 = tc.check("hello", "string");
  if (!r2.valid) throw new Error("hello should be string");
  const r3 = tc.check(true, "boolean");
  if (!r3.valid) throw new Error("true should be boolean");
});

assert("check rejects wrong type", () => {
  const tc = tcMod.createTypeChecker();
  const r = tc.check("hello", "number");
  if (r.valid) throw new Error("string should not be number");
  if (!r.error) throw new Error("should have error message");
});

assert("check validates custom types", () => {
  const tc = tcMod.createTypeChecker();
  tc.registerType("User", {
    fields: { name: "string", age: "number" },
  });
  const r1 = tc.check({ name: "Alice", age: 30 }, "User");
  if (!r1.valid) throw new Error("should pass");
  const r2 = tc.check({ name: "Bob", age: "thirty" }, "User");
  if (r2.valid) throw new Error("should fail — age is string");
});

assert("check validates arrays", () => {
  const tc = tcMod.createTypeChecker();
  const r = tc.check([1, 2, 3], "array");
  if (!r.valid) throw new Error("should be array");
  const r2 = tc.check("not array", "array");
  if (r2.valid) throw new Error("should fail");
});

// ── Part 2: Type Resolver ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Type Resolver\x1b[0m");

const trLib = join(process.cwd(), "tools/ogu/commands/lib/type-resolver.mjs");
assert("type-resolver.mjs exists", () => {
  if (!existsSync(trLib)) throw new Error("file missing");
});

const trMod = await import(trLib);

assert("createTypeResolver returns resolver", () => {
  if (typeof trMod.createTypeResolver !== "function") throw new Error("missing");
  const tr = trMod.createTypeResolver();
  if (typeof tr.define !== "function") throw new Error("missing define");
  if (typeof tr.resolve !== "function") throw new Error("missing resolve");
});

assert("resolve returns primitive type info", () => {
  const tr = trMod.createTypeResolver();
  const info = tr.resolve("string");
  if (info.kind !== "primitive") throw new Error(`expected primitive, got ${info.kind}`);
});

assert("resolve resolves custom types", () => {
  const tr = trMod.createTypeResolver();
  tr.define("UserId", { kind: "alias", target: "string" });
  const info = tr.resolve("UserId");
  if (info.kind !== "alias") throw new Error(`expected alias, got ${info.kind}`);
  if (info.target !== "string") throw new Error("target should be string");
});

assert("resolve handles union types", () => {
  const tr = trMod.createTypeResolver();
  tr.define("StringOrNumber", { kind: "union", types: ["string", "number"] });
  const info = tr.resolve("StringOrNumber");
  if (info.kind !== "union") throw new Error(`expected union, got ${info.kind}`);
  if (info.types.length !== 2) throw new Error("should have 2 types");
});

assert("resolve unknown returns null", () => {
  const tr = trMod.createTypeResolver();
  const info = tr.resolve("Unknown");
  if (info !== null) throw new Error("should return null for unknown");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
