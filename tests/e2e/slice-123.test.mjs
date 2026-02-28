/**
 * Slice 123 — Merge Coordinator + Git Operations
 *
 * Merge coordinator: coordinate merges from agent worktrees back to main.
 * Git operations: safe git operations for agent workflow.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 123 — Merge Coordinator + Git Operations\x1b[0m\n");

// ── Part 1: Merge Coordinator ──────────────────────────────

console.log("\x1b[36m  Part 1: Merge Coordinator\x1b[0m");

const mcLib = join(process.cwd(), "tools/ogu/commands/lib/merge-coordinator.mjs");
assert("merge-coordinator.mjs exists", () => {
  if (!existsSync(mcLib)) throw new Error("file missing");
});

const mcMod = await import(mcLib);

assert("createMergeCoordinator returns coordinator", () => {
  if (typeof mcMod.createMergeCoordinator !== "function") throw new Error("missing");
  const mc = mcMod.createMergeCoordinator();
  if (typeof mc.requestMerge !== "function") throw new Error("missing requestMerge");
  if (typeof mc.approveMerge !== "function") throw new Error("missing approveMerge");
  if (typeof mc.getQueue !== "function") throw new Error("missing getQueue");
});

assert("requestMerge creates merge request", () => {
  const mc = mcMod.createMergeCoordinator();
  const req = mc.requestMerge({
    sourceBranch: "agent/backend-dev/auth-t1",
    targetBranch: "main",
    agentId: "backend-dev",
    files: ["src/auth.ts", "src/auth.test.ts"],
  });
  if (!req.id) throw new Error("missing id");
  if (req.status !== "pending") throw new Error(`expected pending, got ${req.status}`);
});

assert("approveMerge transitions to approved", () => {
  const mc = mcMod.createMergeCoordinator();
  const req = mc.requestMerge({ sourceBranch: "b1", targetBranch: "main", agentId: "dev", files: ["f.ts"] });
  const approved = mc.approveMerge(req.id, { by: "tech-lead" });
  if (approved.status !== "approved") throw new Error("should be approved");
});

assert("rejectMerge transitions to rejected", () => {
  const mc = mcMod.createMergeCoordinator();
  const req = mc.requestMerge({ sourceBranch: "b1", targetBranch: "main", agentId: "dev", files: ["f.ts"] });
  const rejected = mc.rejectMerge(req.id, { by: "tech-lead", reason: "Conflicts" });
  if (rejected.status !== "rejected") throw new Error("should be rejected");
});

assert("getQueue returns pending merges in order", () => {
  const mc = mcMod.createMergeCoordinator();
  mc.requestMerge({ sourceBranch: "b1", targetBranch: "main", agentId: "dev1", files: [] });
  mc.requestMerge({ sourceBranch: "b2", targetBranch: "main", agentId: "dev2", files: [] });
  const queue = mc.getQueue();
  if (queue.length !== 2) throw new Error(`expected 2, got ${queue.length}`);
});

assert("detectConflicts checks file overlap", () => {
  const mc = mcMod.createMergeCoordinator();
  mc.requestMerge({ sourceBranch: "b1", targetBranch: "main", agentId: "dev1", files: ["shared.ts"] });
  const req2 = mc.requestMerge({ sourceBranch: "b2", targetBranch: "main", agentId: "dev2", files: ["shared.ts", "other.ts"] });
  const conflicts = mc.detectConflicts(req2.id);
  if (conflicts.length !== 1) throw new Error(`expected 1 conflict, got ${conflicts.length}`);
  if (conflicts[0].file !== "shared.ts") throw new Error("wrong conflict file");
});

// ── Part 2: Git Operations ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Git Operations\x1b[0m");

const goLib = join(process.cwd(), "tools/ogu/commands/lib/git-operations.mjs");
assert("git-operations.mjs exists", () => {
  if (!existsSync(goLib)) throw new Error("file missing");
});

const goMod = await import(goLib);

assert("buildBranchName generates standard branch name", () => {
  if (typeof goMod.buildBranchName !== "function") throw new Error("missing");
  const name = goMod.buildBranchName({ agentId: "backend-dev", feature: "auth", taskId: "t1" });
  if (!name.includes("backend-dev")) throw new Error("should include agentId");
  if (!name.includes("auth")) throw new Error("should include feature");
});

assert("parseBranchName extracts components", () => {
  if (typeof goMod.parseBranchName !== "function") throw new Error("missing");
  const parsed = goMod.parseBranchName("agent/backend-dev/auth-t1");
  if (parsed.agentId !== "backend-dev") throw new Error("wrong agentId");
  if (parsed.feature !== "auth") throw new Error("wrong feature");
});

assert("buildCommitMessage formats standard message", () => {
  if (typeof goMod.buildCommitMessage !== "function") throw new Error("missing");
  const msg = goMod.buildCommitMessage({
    agentId: "backend-dev",
    taskId: "t1",
    description: "Implement auth API",
  });
  if (!msg.includes("backend-dev")) throw new Error("should include agentId");
  if (!msg.includes("Implement auth API")) throw new Error("should include description");
});

assert("GIT_CONVENTIONS exported", () => {
  if (!goMod.GIT_CONVENTIONS) throw new Error("missing");
  if (!goMod.GIT_CONVENTIONS.branchPrefix) throw new Error("missing branchPrefix");
  if (!goMod.GIT_CONVENTIONS.commitPrefix) throw new Error("missing commitPrefix");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
