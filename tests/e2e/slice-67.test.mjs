/**
 * Slice 67 — Workflow Engine
 *
 * Workflow engine: multi-step workflow execution with branching.

 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice67-${Date.now()}`);
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

console.log("\n\x1b[1mSlice 67 — Workflow Engine\x1b[0m\n");

// ── Part 1: Workflow Engine ──────────────────────────────

console.log("\x1b[36m  Part 1: Workflow Engine\x1b[0m");

const wfLib = join(process.cwd(), "tools/ogu/commands/lib/workflow-engine.mjs");
assert("workflow-engine.mjs exists", () => {
  if (!existsSync(wfLib)) throw new Error("file missing");
});

const wfMod = await import(wfLib);

assert("createWorkflow returns workflow", () => {
  if (typeof wfMod.createWorkflow !== "function") throw new Error("missing");
  const wf = wfMod.createWorkflow({ id: "deploy" });
  if (typeof wf.addStep !== "function") throw new Error("missing addStep");
  if (typeof wf.run !== "function") throw new Error("missing run");
  if (typeof wf.getStatus !== "function") throw new Error("missing getStatus");
});

assert("addStep and run execute steps in order", () => {
  const wf = wfMod.createWorkflow({ id: "test-wf" });
  const order = [];
  wf.addStep({ id: "s1", handler: () => { order.push("s1"); return { ok: true }; } });
  wf.addStep({ id: "s2", handler: () => { order.push("s2"); return { ok: true }; } });
  wf.addStep({ id: "s3", handler: () => { order.push("s3"); return { ok: true }; } });
  const result = wf.run();
  if (order.length !== 3) throw new Error(`expected 3 steps, got ${order.length}`);
  if (order[0] !== "s1" || order[2] !== "s3") throw new Error("wrong order");
  if (!result.completed) throw new Error("should complete");
});

assert("run stops on step failure", () => {
  const wf = wfMod.createWorkflow({ id: "fail-wf" });
  const order = [];
  wf.addStep({ id: "s1", handler: () => { order.push("s1"); return { ok: true }; } });
  wf.addStep({ id: "s2", handler: () => { order.push("s2"); return { ok: false, error: "boom" }; } });
  wf.addStep({ id: "s3", handler: () => { order.push("s3"); return { ok: true }; } });
  const result = wf.run();
  if (order.includes("s3")) throw new Error("should stop at failure");
  if (result.completed) throw new Error("should not complete");
  if (result.failedStep !== "s2") throw new Error("should identify failed step");
});

assert("getStatus returns workflow state", () => {
  const wf = wfMod.createWorkflow({ id: "status-wf" });
  wf.addStep({ id: "a", handler: () => ({ ok: true }) });
  const before = wf.getStatus();
  if (before.state !== "pending") throw new Error("should start pending");
  wf.run();
  const after = wf.getStatus();
  if (after.state !== "completed") throw new Error("should be completed");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
