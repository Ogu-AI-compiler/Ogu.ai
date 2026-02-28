/**
 * Slice 131 — Wave Conflict Detector + Complete Wave Executor
 *
 * Wave Conflict Detector: detect semantic conflicts between parallel agents.
 * Complete Wave Executor: full wave execution with conflict detection and rollback.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 131 — Wave Conflict Detector + Complete Wave Executor\x1b[0m\n");

// ── Part 1: Wave Conflict Detector ──────────────────────────────

console.log("\x1b[36m  Part 1: Wave Conflict Detector\x1b[0m");

const wcdLib = join(process.cwd(), "tools/ogu/commands/lib/wave-conflict-detector.mjs");
assert("wave-conflict-detector.mjs exists", () => {
  if (!existsSync(wcdLib)) throw new Error("file missing");
});

const wcdMod = await import(wcdLib);

assert("detectConflicts returns result", () => {
  if (typeof wcdMod.detectConflicts !== "function") throw new Error("missing");
  const result = wcdMod.detectConflicts({
    agents: [
      { id: "a1", files: ["src/app.ts", "src/utils.ts"] },
      { id: "a2", files: ["src/api.ts", "src/db.ts"] },
    ],
  });
  if (typeof result.hasConflicts !== "boolean") throw new Error("missing hasConflicts");
  if (!Array.isArray(result.conflicts)) throw new Error("missing conflicts");
});

assert("detects file overlap conflicts", () => {
  const result = wcdMod.detectConflicts({
    agents: [
      { id: "a1", files: ["src/shared.ts", "src/app.ts"] },
      { id: "a2", files: ["src/shared.ts", "src/api.ts"] },
    ],
  });
  if (!result.hasConflicts) throw new Error("should detect conflict on shared.ts");
  if (result.conflicts.length !== 1) throw new Error(`expected 1 conflict, got ${result.conflicts.length}`);
  if (result.conflicts[0].file !== "src/shared.ts") throw new Error("wrong file");
});

assert("no conflicts when files are disjoint", () => {
  const result = wcdMod.detectConflicts({
    agents: [
      { id: "a1", files: ["src/a.ts"] },
      { id: "a2", files: ["src/b.ts"] },
      { id: "a3", files: ["src/c.ts"] },
    ],
  });
  if (result.hasConflicts) throw new Error("should have no conflicts");
});

assert("detects multi-agent conflicts on same file", () => {
  const result = wcdMod.detectConflicts({
    agents: [
      { id: "a1", files: ["shared.ts"] },
      { id: "a2", files: ["shared.ts"] },
      { id: "a3", files: ["shared.ts"] },
    ],
  });
  if (!result.hasConflicts) throw new Error("should detect conflict");
  const sharedConflict = result.conflicts.find(c => c.file === "shared.ts");
  if (sharedConflict.agents.length !== 3) throw new Error("all 3 agents should be in conflict");
});

// ── Part 2: Complete Wave Executor ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Complete Wave Executor\x1b[0m");

const cweLib = join(process.cwd(), "tools/ogu/commands/lib/wave-executor-complete.mjs");
assert("wave-executor-complete.mjs exists", () => {
  if (!existsSync(cweLib)) throw new Error("file missing");
});

const cweMod = await import(cweLib);

assert("createCompleteWaveExecutor returns executor", () => {
  if (typeof cweMod.createCompleteWaveExecutor !== "function") throw new Error("missing");
  const exec = cweMod.createCompleteWaveExecutor();
  if (typeof exec.executeWave !== "function") throw new Error("missing executeWave");
  if (typeof exec.getResults !== "function") throw new Error("missing getResults");
});

assert("executeWave runs tasks in parallel", async () => {
  const exec = cweMod.createCompleteWaveExecutor();
  const results = await exec.executeWave({
    tasks: [
      { id: "t1", files: ["a.ts"], run: async () => ({ status: "ok" }) },
      { id: "t2", files: ["b.ts"], run: async () => ({ status: "ok" }) },
    ],
  });
  if (results.completed.length !== 2) throw new Error(`expected 2 completed, got ${results.completed.length}`);
  if (results.failed.length !== 0) throw new Error("expected no failures");
});

assert("executeWave blocks on conflict", async () => {
  const exec = cweMod.createCompleteWaveExecutor();
  const results = await exec.executeWave({
    tasks: [
      { id: "t1", files: ["shared.ts"], run: async () => ({ status: "ok" }) },
      { id: "t2", files: ["shared.ts"], run: async () => ({ status: "ok" }) },
    ],
  });
  if (results.conflicts.length === 0) throw new Error("should detect conflicts");
});

assert("executeWave captures failures", async () => {
  const exec = cweMod.createCompleteWaveExecutor();
  const results = await exec.executeWave({
    tasks: [
      { id: "t1", files: ["a.ts"], run: async () => ({ status: "ok" }) },
      { id: "t2", files: ["b.ts"], run: async () => { throw new Error("boom"); } },
    ],
  });
  if (results.failed.length !== 1) throw new Error(`expected 1 failed, got ${results.failed.length}`);
  if (results.completed.length !== 1) throw new Error(`expected 1 completed, got ${results.completed.length}`);
});

assert("getResults returns cumulative history", async () => {
  const exec = cweMod.createCompleteWaveExecutor();
  await exec.executeWave({
    tasks: [{ id: "t1", files: ["a.ts"], run: async () => ({ status: "ok" }) }],
  });
  await exec.executeWave({
    tasks: [{ id: "t2", files: ["b.ts"], run: async () => ({ status: "ok" }) }],
  });
  const all = exec.getResults();
  if (all.length !== 2) throw new Error(`expected 2 waves, got ${all.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
