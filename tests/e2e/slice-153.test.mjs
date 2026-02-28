/**
 * Slice 153 — Diff Engine + Patch Applier
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 153 — Diff Engine + Patch Applier\x1b[0m\n");

console.log("\x1b[36m  Part 1: Diff Engine\x1b[0m");

const deLib = join(process.cwd(), "tools/ogu/commands/lib/diff-engine.mjs");
assert("diff-engine.mjs exists", () => { if (!existsSync(deLib)) throw new Error("file missing"); });
const deMod = await import(deLib);

assert("diff returns changes between two objects", () => {
  if (typeof deMod.diff !== "function") throw new Error("missing");
  const changes = deMod.diff(
    { name: "Alice", age: 30 },
    { name: "Alice", age: 31, email: "a@b.com" }
  );
  if (!Array.isArray(changes)) throw new Error("should return array");
  const ageChange = changes.find(c => c.key === "age");
  if (!ageChange) throw new Error("should detect age change");
  if (ageChange.type !== "modified") throw new Error(`expected modified, got ${ageChange.type}`);
});

assert("diff detects added fields", () => {
  const changes = deMod.diff({ a: 1 }, { a: 1, b: 2 });
  const added = changes.find(c => c.key === "b");
  if (!added || added.type !== "added") throw new Error("should detect added");
});

assert("diff detects removed fields", () => {
  const changes = deMod.diff({ a: 1, b: 2 }, { a: 1 });
  const removed = changes.find(c => c.key === "b");
  if (!removed || removed.type !== "removed") throw new Error("should detect removed");
});

assert("diff returns empty for identical objects", () => {
  const changes = deMod.diff({ x: 1 }, { x: 1 });
  if (changes.length !== 0) throw new Error("should be empty for identical");
});

console.log("\n\x1b[36m  Part 2: Patch Applier\x1b[0m");

const paLib = join(process.cwd(), "tools/ogu/commands/lib/patch-applier.mjs");
assert("patch-applier.mjs exists", () => { if (!existsSync(paLib)) throw new Error("file missing"); });
const paMod = await import(paLib);

assert("applyPatch applies changes to object", () => {
  if (typeof paMod.applyPatch !== "function") throw new Error("missing");
  const result = paMod.applyPatch(
    { name: "Alice", age: 30 },
    [
      { type: "modified", key: "age", newValue: 31 },
      { type: "added", key: "email", newValue: "a@b.com" },
    ]
  );
  if (result.age !== 31) throw new Error("should update age");
  if (result.email !== "a@b.com") throw new Error("should add email");
});

assert("applyPatch handles removals", () => {
  const result = paMod.applyPatch(
    { a: 1, b: 2, c: 3 },
    [{ type: "removed", key: "b" }]
  );
  if ("b" in result) throw new Error("should remove b");
  if (result.a !== 1) throw new Error("should keep a");
});

assert("roundtrip: diff then patch restores target", () => {
  const source = { x: 1, y: 2 };
  const target = { x: 1, y: 3, z: 4 };
  const changes = deMod.diff(source, target);
  const result = paMod.applyPatch(source, changes);
  if (result.y !== 3) throw new Error("y should be 3");
  if (result.z !== 4) throw new Error("z should be 4");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
