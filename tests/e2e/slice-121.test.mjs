/**
 * Slice 121 — Agent Execution Context + Memory Scope
 *
 * Agent execution context: scoped context for agent task execution.
 * Memory scope: restrict agent memory access based on role.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 121 — Agent Execution Context + Memory Scope\x1b[0m\n");

// ── Part 1: Agent Execution Context ──────────────────────────────

console.log("\x1b[36m  Part 1: Agent Execution Context\x1b[0m");

const aecLib = join(process.cwd(), "tools/ogu/commands/lib/agent-execution-context.mjs");
assert("agent-execution-context.mjs exists", () => {
  if (!existsSync(aecLib)) throw new Error("file missing");
});

const aecMod = await import(aecLib);

assert("createAgentExecutionContext returns context", () => {
  if (typeof aecMod.createAgentExecutionContext !== "function") throw new Error("missing");
  const ctx = aecMod.createAgentExecutionContext({
    agentId: "backend-dev",
    taskId: "task-42",
    feature: "auth",
    phase: "build",
  });
  if (typeof ctx.get !== "function") throw new Error("missing get");
  if (typeof ctx.set !== "function") throw new Error("missing set");
  if (typeof ctx.getMetadata !== "function") throw new Error("missing getMetadata");
});

assert("context stores and retrieves values", () => {
  const ctx = aecMod.createAgentExecutionContext({ agentId: "dev", taskId: "t1", feature: "auth", phase: "build" });
  ctx.set("spec", { content: "..." });
  const spec = ctx.get("spec");
  if (!spec || spec.content !== "...") throw new Error("failed to retrieve");
});

assert("getMetadata returns agent/task/feature/phase", () => {
  const ctx = aecMod.createAgentExecutionContext({ agentId: "qa", taskId: "t2", feature: "pay", phase: "test" });
  const meta = ctx.getMetadata();
  if (meta.agentId !== "qa") throw new Error("wrong agentId");
  if (meta.feature !== "pay") throw new Error("wrong feature");
});

assert("context tracks artifacts produced", () => {
  const ctx = aecMod.createAgentExecutionContext({ agentId: "dev", taskId: "t1", feature: "auth", phase: "build" });
  ctx.addArtifact("src/auth.ts");
  ctx.addArtifact("src/auth.test.ts");
  const artifacts = ctx.getArtifacts();
  if (artifacts.length !== 2) throw new Error(`expected 2, got ${artifacts.length}`);
});

assert("context tracks metrics", () => {
  const ctx = aecMod.createAgentExecutionContext({ agentId: "dev", taskId: "t1", feature: "auth", phase: "build" });
  ctx.recordMetric("tokensIn", 500);
  ctx.recordMetric("tokensOut", 250);
  const metrics = ctx.getMetrics();
  if (metrics.tokensIn !== 500) throw new Error("wrong tokensIn");
});

// ── Part 2: Memory Scope ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Memory Scope\x1b[0m");

const msLib = join(process.cwd(), "tools/ogu/commands/lib/memory-scope.mjs");
assert("memory-scope.mjs exists", () => {
  if (!existsSync(msLib)) throw new Error("file missing");
});

const msMod = await import(msLib);

assert("createMemoryScope returns scope manager", () => {
  if (typeof msMod.createMemoryScope !== "function") throw new Error("missing");
  const ms = msMod.createMemoryScope({ allowedScopes: ["code", "tests", "api"] });
  if (typeof ms.canAccess !== "function") throw new Error("missing canAccess");
  if (typeof ms.read !== "function") throw new Error("missing read");
  if (typeof ms.write !== "function") throw new Error("missing write");
});

assert("canAccess returns true for allowed scope", () => {
  const ms = msMod.createMemoryScope({ allowedScopes: ["code", "tests"] });
  if (!ms.canAccess("code")) throw new Error("should allow code");
  if (!ms.canAccess("tests")) throw new Error("should allow tests");
  if (ms.canAccess("security")) throw new Error("should not allow security");
});

assert("write stores memory in allowed scope", () => {
  const ms = msMod.createMemoryScope({ allowedScopes: ["code"] });
  ms.write("code", "pattern-1", { description: "Singleton pattern for DB" });
  const val = ms.read("code", "pattern-1");
  if (!val || val.description !== "Singleton pattern for DB") throw new Error("write/read failed");
});

assert("write rejects disallowed scope", () => {
  const ms = msMod.createMemoryScope({ allowedScopes: ["code"] });
  let threw = false;
  try { ms.write("security", "vuln-1", { data: "secret" }); } catch (_) { threw = true; }
  if (!threw) throw new Error("should throw for disallowed scope");
});

assert("all scope grants full access", () => {
  const ms = msMod.createMemoryScope({ allowedScopes: ["all"] });
  if (!ms.canAccess("code")) throw new Error("all should allow code");
  if (!ms.canAccess("security")) throw new Error("all should allow security");
  if (!ms.canAccess("anything")) throw new Error("all should allow anything");
});

assert("listEntries returns all memory in scope", () => {
  const ms = msMod.createMemoryScope({ allowedScopes: ["code", "api"] });
  ms.write("code", "p1", { x: 1 });
  ms.write("code", "p2", { x: 2 });
  ms.write("api", "p3", { x: 3 });
  const entries = ms.listEntries("code");
  if (entries.length !== 2) throw new Error(`expected 2, got ${entries.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
