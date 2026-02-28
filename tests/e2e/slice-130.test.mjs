/**
 * Slice 130 — Determinism Validator + Execution Replay Engine
 *
 * Determinism Validator: detect non-deterministic operations in execution logs.
 * Execution Replay Engine: replay from snapshots with forced determinism.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 130 — Determinism Validator + Execution Replay Engine\x1b[0m\n");

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

// ── Part 2: Execution Replay Engine ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Execution Replay Engine\x1b[0m");

const ereLib = join(process.cwd(), "tools/ogu/commands/lib/execution-replay-engine.mjs");
assert("execution-replay-engine.mjs exists", () => {
  if (!existsSync(ereLib)) throw new Error("file missing");
});

const ereMod = await import(ereLib);

assert("createReplayEngine returns engine", () => {
  if (typeof ereMod.createReplayEngine !== "function") throw new Error("missing");
  const engine = ereMod.createReplayEngine();
  if (typeof engine.record !== "function") throw new Error("missing record");
  if (typeof engine.replay !== "function") throw new Error("missing replay");
});

assert("record captures operations", () => {
  const engine = ereMod.createReplayEngine();
  engine.record({ type: "file.read", path: "a.ts", result: "hello" });
  engine.record({ type: "file.write", path: "b.ts", result: "ok" });
  const log = engine.getLog();
  if (log.length !== 2) throw new Error(`expected 2 ops, got ${log.length}`);
});

assert("replay returns recorded results in order", () => {
  const engine = ereMod.createReplayEngine();
  engine.record({ type: "file.read", path: "a.ts", result: "hello" });
  engine.record({ type: "llm.call", model: "sonnet", result: "response-1" });
  engine.record({ type: "file.write", path: "b.ts", result: "ok" });

  const replayer = engine.replay();
  const r1 = replayer.next();
  if (r1.result !== "hello") throw new Error(`expected hello, got ${r1.result}`);
  const r2 = replayer.next();
  if (r2.result !== "response-1") throw new Error(`expected response-1, got ${r2.result}`);
});

assert("replay isDone after all operations", () => {
  const engine = ereMod.createReplayEngine();
  engine.record({ type: "a", result: "1" });
  const replayer = engine.replay();
  replayer.next();
  if (!replayer.isDone()) throw new Error("should be done");
});

assert("getSnapshot returns serializable state", () => {
  const engine = ereMod.createReplayEngine();
  engine.record({ type: "x", result: "y" });
  const snap = engine.getSnapshot();
  if (!snap.operations) throw new Error("missing operations in snapshot");
  if (snap.operations.length !== 1) throw new Error("expected 1 operation in snapshot");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
