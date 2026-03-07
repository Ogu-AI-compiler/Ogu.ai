/**
 * Slice 130 — Determinism Validator
 *
 * Determinism Validator: detect non-deterministic operations in execution logs.

 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 130 — Determinism Validator\x1b[0m\n");

// ── Part 1: Determinism Validator ──────────────────────────────

console.log("\x1b[36m  Part 1: Determinism Validator\x1b[0m");

const dvLib = join(process.cwd(), "tools/ogu/commands/lib/determinism-validator.mjs");
assert("determinism-validator.mjs exists", () => {
  if (!existsSync(dvLib)) throw new Error("file missing");
});

const dvMod = await import(dvLib);

assert("validateDeterminism returns result", () => {
  if (typeof dvMod.validateDeterminism !== "function") throw new Error("missing");
  const result = dvMod.validateDeterminism({
    operations: [
      { type: "file.read", path: "src/app.ts", result: "content" },
      { type: "file.write", path: "src/app.ts", result: "ok" },
    ],
  });
  if (typeof result.isDeterministic !== "boolean") throw new Error("missing isDeterministic");
  if (!Array.isArray(result.violations)) throw new Error("missing violations");
});

assert("detects random operations as non-deterministic", () => {
  const result = dvMod.validateDeterminism({
    operations: [
      { type: "random", result: 0.5 },
      { type: "file.read", path: "a.ts", result: "ok" },
    ],
  });
  if (result.isDeterministic) throw new Error("random should be non-deterministic");
  if (result.violations.length === 0) throw new Error("should have violations");
});

assert("detects Date.now as non-deterministic", () => {
  const result = dvMod.validateDeterminism({
    operations: [
      { type: "timestamp", result: Date.now() },
    ],
  });
  if (result.isDeterministic) throw new Error("timestamp should be non-deterministic");
});

assert("pure file operations are deterministic", () => {
  const result = dvMod.validateDeterminism({
    operations: [
      { type: "file.read", path: "a.ts", result: "content" },
      { type: "file.write", path: "b.ts", result: "ok" },
    ],
  });
  if (!result.isDeterministic) throw new Error("pure file ops should be deterministic");
});

assert("classifyOperation categorizes correctly", () => {
  if (typeof dvMod.classifyOperation !== "function") throw new Error("missing");
  const r1 = dvMod.classifyOperation({ type: "random" });
  if (r1 !== "non-deterministic") throw new Error(`expected non-deterministic, got ${r1}`);
  const r2 = dvMod.classifyOperation({ type: "file.read" });
  if (r2 !== "deterministic") throw new Error(`expected deterministic, got ${r2}`);
});
