/**
 * Slice 35 — Execution Graph Hash + Lifecycle Guards (P33 adj + P15 lifecycle)
 *
 * Execution Graph Hash: hash DAG execution paths for determinism verification.
 * Lifecycle Guards: per-state invariants, automatic triggers, timeout transitions.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice35-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/state/features"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({ currentFeature: "guard-test", phase: "build" }));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");
writeFileSync(join(tmp, ".ogu/state/features/guard-test.json"), JSON.stringify({
  slug: "guard-test", phase: "build", createdAt: new Date().toISOString(),
}));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 35 — Execution Graph Hash + Lifecycle Guards\x1b[0m\n");
console.log("  DAG hash verification, per-state invariants\n");

// ── Part 1: Execution Graph Hash ──────────────────────────────

console.log("\x1b[36m  Part 1: Execution Graph Hash\x1b[0m");

const graphHashLib = join(process.cwd(), "tools/ogu/commands/lib/execution-graph-hash.mjs");
assert("execution-graph-hash.mjs exists", () => {
  if (!existsSync(graphHashLib)) throw new Error("file missing");
});

const ghMod = await import(graphHashLib);

assert("hashDAG computes hash of a task DAG", () => {
  if (typeof ghMod.hashDAG !== "function") throw new Error("missing");
  const dag = {
    tasks: [
      { id: "t1", deps: [] },
      { id: "t2", deps: ["t1"] },
      { id: "t3", deps: ["t1"] },
      { id: "t4", deps: ["t2", "t3"] },
    ],
  };
  const hash = ghMod.hashDAG(dag);
  if (typeof hash !== "string") throw new Error("hash not string");
  if (hash.length < 16) throw new Error("hash too short");
});

assert("hashDAG is deterministic (same DAG → same hash)", () => {
  const dag = {
    tasks: [
      { id: "t1", deps: [] },
      { id: "t2", deps: ["t1"] },
    ],
  };
  const h1 = ghMod.hashDAG(dag);
  const h2 = ghMod.hashDAG(dag);
  if (h1 !== h2) throw new Error("hashes differ for same DAG");
});

assert("hashDAG changes when DAG structure changes", () => {
  const dag1 = { tasks: [{ id: "t1", deps: [] }, { id: "t2", deps: ["t1"] }] };
  const dag2 = { tasks: [{ id: "t1", deps: [] }, { id: "t2", deps: [] }] };
  const h1 = ghMod.hashDAG(dag1);
  const h2 = ghMod.hashDAG(dag2);
  if (h1 === h2) throw new Error("hashes should differ for different DAGs");
});

assert("hashExecution includes inputs and outputs", () => {
  if (typeof ghMod.hashExecution !== "function") throw new Error("missing");
  const hash = ghMod.hashExecution({
    dagHash: "dag123",
    inputs: { config: "a" },
    outputs: { result: "b" },
  });
  if (typeof hash !== "string") throw new Error("hash not string");
});

// ── Part 2: Lifecycle Guards ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Lifecycle Guards\x1b[0m");

const guardsLib = join(process.cwd(), "tools/ogu/commands/lib/lifecycle-guards.mjs");
assert("lifecycle-guards.mjs exists", () => {
  if (!existsSync(guardsLib)) throw new Error("file missing");
});

const guardMod = await import(guardsLib);

assert("PHASE_INVARIANTS defines invariants for each phase", () => {
  if (!guardMod.PHASE_INVARIANTS) throw new Error("missing");
  if (typeof guardMod.PHASE_INVARIANTS !== "object") throw new Error("not object");
  if (!guardMod.PHASE_INVARIANTS.build) throw new Error("no build invariants");
});

assert("checkInvariant validates phase requirements", () => {
  if (typeof guardMod.checkInvariant !== "function") throw new Error("missing");
  const result = guardMod.checkInvariant({
    phase: "build",
    root: tmp,
    featureSlug: "guard-test",
  });
  if (typeof result.satisfied !== "boolean") throw new Error("no satisfied field");
  if (!Array.isArray(result.violations)) throw new Error("no violations array");
});

assert("registerGuard adds a custom guard", () => {
  if (typeof guardMod.registerGuard !== "function") throw new Error("missing");
  guardMod.registerGuard({
    phase: "build",
    name: "custom-check",
    check: ({ root }) => ({ ok: true }),
  });
  // Guard should be in the registry now
  const guards = guardMod.getGuards("build");
  if (!guards.some(g => g.name === "custom-check")) throw new Error("guard not registered");
});

assert("checkTransition validates phase transition legality", () => {
  if (typeof guardMod.checkTransition !== "function") throw new Error("missing");
  // build → verify should be valid
  const valid = guardMod.checkTransition({ from: "build", to: "verify-ui" });
  if (!valid.allowed) throw new Error("build → verify-ui should be allowed");
  // build → idea should be invalid (going backwards)
  const invalid = guardMod.checkTransition({ from: "build", to: "idea" });
  if (invalid.allowed) throw new Error("build → idea should not be allowed");
});

assert("getGuards returns guards for a phase", () => {
  if (typeof guardMod.getGuards !== "function") throw new Error("missing");
  const guards = guardMod.getGuards("build");
  if (!Array.isArray(guards)) throw new Error("not array");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
