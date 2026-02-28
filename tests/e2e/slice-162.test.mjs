/**
 * Slice 162 — Input Transformer + Schema Normalizer
 *
 * Input Transformer: transform input data before validation.
 * Schema Normalizer: normalize schemas for comparison and merge.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 162 — Input Transformer + Schema Normalizer\x1b[0m\n");

// ── Part 1: Input Transformer ──────────────────────────────

console.log("\x1b[36m  Part 1: Input Transformer\x1b[0m");

const itLib = join(process.cwd(), "tools/ogu/commands/lib/input-transformer.mjs");
assert("input-transformer.mjs exists", () => {
  if (!existsSync(itLib)) throw new Error("file missing");
});

const itMod = await import(itLib);

assert("createInputTransformer returns transformer", () => {
  if (typeof itMod.createInputTransformer !== "function") throw new Error("missing");
  const t = itMod.createInputTransformer();
  if (typeof t.addRule !== "function") throw new Error("missing addRule");
  if (typeof t.transform !== "function") throw new Error("missing transform");
});

assert("trim rule trims strings", () => {
  const t = itMod.createInputTransformer();
  t.addRule({ field: "name", transform: "trim" });
  const result = t.transform({ name: "  Alice  " });
  if (result.name !== "Alice") throw new Error(`got: ${result.name}`);
});

assert("lowercase rule lowercases strings", () => {
  const t = itMod.createInputTransformer();
  t.addRule({ field: "email", transform: "lowercase" });
  const result = t.transform({ email: "FOO@BAR.COM" });
  if (result.email !== "foo@bar.com") throw new Error(`got: ${result.email}`);
});

assert("custom transform function", () => {
  const t = itMod.createInputTransformer();
  t.addRule({ field: "age", transform: (v) => parseInt(v, 10) });
  const result = t.transform({ age: "30" });
  if (result.age !== 30) throw new Error(`got: ${result.age}`);
});

assert("untouched fields pass through", () => {
  const t = itMod.createInputTransformer();
  t.addRule({ field: "name", transform: "trim" });
  const result = t.transform({ name: " x ", other: 42 });
  if (result.other !== 42) throw new Error("other should pass through");
});

// ── Part 2: Schema Normalizer ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Schema Normalizer\x1b[0m");

const snLib = join(process.cwd(), "tools/ogu/commands/lib/schema-normalizer.mjs");
assert("schema-normalizer.mjs exists", () => {
  if (!existsSync(snLib)) throw new Error("file missing");
});

const snMod = await import(snLib);

assert("normalizeSchema returns normalized schema", () => {
  if (typeof snMod.normalizeSchema !== "function") throw new Error("missing");
  const schema = { fields: { name: "string", age: "number" } };
  const normalized = snMod.normalizeSchema(schema);
  if (!normalized.fields) throw new Error("missing fields");
});

assert("sorts fields alphabetically", () => {
  const normalized = snMod.normalizeSchema({
    fields: { z: "string", a: "number", m: "boolean" },
  });
  const keys = Object.keys(normalized.fields);
  if (keys[0] !== "a") throw new Error("should sort alphabetically");
  if (keys[2] !== "z") throw new Error("z should be last");
});

assert("mergeSchemas combines fields", () => {
  if (typeof snMod.mergeSchemas !== "function") throw new Error("missing");
  const merged = snMod.mergeSchemas(
    { fields: { a: "string" } },
    { fields: { b: "number" } }
  );
  if (!merged.fields.a) throw new Error("missing a");
  if (!merged.fields.b) throw new Error("missing b");
});

assert("compareSchemas returns differences", () => {
  if (typeof snMod.compareSchemas !== "function") throw new Error("missing");
  const diffs = snMod.compareSchemas(
    { fields: { a: "string", b: "number" } },
    { fields: { a: "string", c: "boolean" } }
  );
  if (!Array.isArray(diffs)) throw new Error("should be array");
  if (diffs.length < 2) throw new Error("should find differences");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
