/**
 * Slice 42 — Functional Determinism Tolerance (P37) + MicroVM Execution Matrix (P38)
 *
 * Determinism Tolerance: detect and measure non-determinism in agent outputs.
 * MicroVM Matrix: execution isolation planning with resource quotas.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice42-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 42 — Determinism Tolerance + MicroVM Execution Matrix\x1b[0m\n");
console.log("  Non-determinism measurement, VM isolation planning\n");

// ── Part 1: Functional Determinism Tolerance ──────────────────────────────

console.log("\x1b[36m  Part 1: Functional Determinism Tolerance\x1b[0m");

const detLib = join(process.cwd(), "tools/ogu/commands/lib/determinism-tolerance.mjs");
assert("determinism-tolerance.mjs exists", () => {
  if (!existsSync(detLib)) throw new Error("file missing");
});

const detMod = await import(detLib);

assert("computeDivergence measures output similarity", () => {
  if (typeof detMod.computeDivergence !== "function") throw new Error("missing");
  const div = detMod.computeDivergence({
    expected: "function hello() { return 'world'; }",
    actual: "function hello() { return 'world'; }",
  });
  if (div.score !== 1.0) throw new Error(`expected 1.0, got ${div.score}`);
  if (div.divergent !== false) throw new Error("identical should not be divergent");
});

assert("computeDivergence detects partial divergence", () => {
  const div = detMod.computeDivergence({
    expected: "function hello() { return 'world'; }",
    actual: "function hello() { return 'earth'; }",
  });
  if (div.score >= 1.0) throw new Error("should not be perfect match");
  if (div.score <= 0) throw new Error("should have some similarity");
});

assert("computeDivergence detects full divergence", () => {
  const div = detMod.computeDivergence({
    expected: "function hello() { return 'world'; }",
    actual: "xyz completely different content abc",
  });
  if (div.score >= 0.9) throw new Error("should be highly divergent");
});

assert("classifyDivergence categorizes divergence type", () => {
  if (typeof detMod.classifyDivergence !== "function") throw new Error("missing");
  const cls = detMod.classifyDivergence({
    expected: "const x = 1;\nconst y = 2;\nconst z = 3;",
    actual: "const x = 1;\nconst y = 2;\nconst z = 3;",
  });
  if (cls.type !== "identical") throw new Error(`expected identical, got ${cls.type}`);
});

assert("classifyDivergence detects cosmetic changes", () => {
  const cls = detMod.classifyDivergence({
    expected: "const x = 1;\nconst y = 2;",
    actual: "const  x  =  1;\nconst  y  =  2;",
  });
  if (cls.type !== "cosmetic") throw new Error(`expected cosmetic, got ${cls.type}`);
});

assert("TOLERANCE_LEVELS has defined thresholds", () => {
  if (!detMod.TOLERANCE_LEVELS) throw new Error("missing");
  if (!detMod.TOLERANCE_LEVELS.strict) throw new Error("no strict level");
  if (!detMod.TOLERANCE_LEVELS.relaxed) throw new Error("no relaxed level");
  if (detMod.TOLERANCE_LEVELS.strict.threshold < detMod.TOLERANCE_LEVELS.relaxed.threshold) {
    throw new Error("strict should have higher threshold than relaxed");
  }
});

assert("isWithinTolerance checks against level", () => {
  if (typeof detMod.isWithinTolerance !== "function") throw new Error("missing");
  // Perfect match should pass any level
  if (!detMod.isWithinTolerance(1.0, "strict")) throw new Error("perfect should pass strict");
  if (!detMod.isWithinTolerance(1.0, "relaxed")) throw new Error("perfect should pass relaxed");
  // Zero should fail any level
  if (detMod.isWithinTolerance(0.0, "strict")) throw new Error("zero should fail strict");
});

// ── Part 2: MicroVM Execution Matrix ──────────────────────────────

console.log("\n\x1b[36m  Part 2: MicroVM Execution Matrix\x1b[0m");

const vmLib = join(process.cwd(), "tools/ogu/commands/lib/microvm-matrix.mjs");
assert("microvm-matrix.mjs exists", () => {
  if (!existsSync(vmLib)) throw new Error("file missing");
});

const vmMod = await import(vmLib);

assert("createVMSpec plans a VM with resource quotas", () => {
  if (typeof vmMod.createVMSpec !== "function") throw new Error("missing");
  const spec = vmMod.createVMSpec({
    taskId: "t1",
    roleId: "developer",
    isolation: "process",
    resources: { maxMemoryMB: 512, maxCpuPercent: 50, timeoutMs: 60000 },
  });
  if (!spec.id) throw new Error("no id");
  if (spec.isolation !== "process") throw new Error("wrong isolation");
  if (spec.resources.maxMemoryMB !== 512) throw new Error("wrong memory");
});

assert("ISOLATION_LEVELS has defined levels", () => {
  if (!vmMod.ISOLATION_LEVELS) throw new Error("missing");
  if (!vmMod.ISOLATION_LEVELS.none) throw new Error("no none level");
  if (!vmMod.ISOLATION_LEVELS.process) throw new Error("no process level");
  if (!vmMod.ISOLATION_LEVELS.container) throw new Error("no container level");
});

assert("createExecutionMatrix builds matrix for DAG tasks", () => {
  if (typeof vmMod.createExecutionMatrix !== "function") throw new Error("missing");
  const matrix = vmMod.createExecutionMatrix({
    tasks: [
      { id: "t1", roleId: "developer", isolation: "process" },
      { id: "t2", roleId: "tester", isolation: "process" },
      { id: "t3", roleId: "reviewer", isolation: "none" },
    ],
  });
  if (!Array.isArray(matrix.vms)) throw new Error("no vms array");
  if (matrix.vms.length !== 3) throw new Error(`expected 3 VMs, got ${matrix.vms.length}`);
  if (!matrix.totalResources) throw new Error("no totalResources");
});

assert("validateResourceQuota checks against system limits", () => {
  if (typeof vmMod.validateResourceQuota !== "function") throw new Error("missing");
  const result = vmMod.validateResourceQuota({
    requested: { maxMemoryMB: 256, maxCpuPercent: 25 },
    systemLimits: { totalMemoryMB: 1024, totalCpuPercent: 100 },
    currentUsage: { memoryMB: 512, cpuPercent: 50 },
  });
  if (typeof result.allowed !== "boolean") throw new Error("no allowed field");
  if (!result.allowed) throw new Error("should be allowed within limits");
});

assert("validateResourceQuota rejects over-limit requests", () => {
  const result = vmMod.validateResourceQuota({
    requested: { maxMemoryMB: 1024, maxCpuPercent: 80 },
    systemLimits: { totalMemoryMB: 1024, totalCpuPercent: 100 },
    currentUsage: { memoryMB: 512, cpuPercent: 50 },
  });
  if (result.allowed) throw new Error("should reject over-limit");
  if (!result.reason) throw new Error("should explain rejection");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
