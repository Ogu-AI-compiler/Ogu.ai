/**
 * Slice 134 — Failure Domain Resolver + Rollback Coordinator
 *
 * Failure Domain Resolver: classify and recover from distinct failure domains.
 * Rollback Coordinator: atomic multi-agent rollback via SAGA pattern.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 134 — Failure Domain Resolver + Rollback Coordinator\x1b[0m\n");

// ── Part 1: Failure Domain Resolver ──────────────────────────────

console.log("\x1b[36m  Part 1: Failure Domain Resolver\x1b[0m");

const fdrLib = join(process.cwd(), "tools/ogu/commands/lib/failure-domain-resolver.mjs");
assert("failure-domain-resolver.mjs exists", () => {
  if (!existsSync(fdrLib)) throw new Error("file missing");
});

const fdrMod = await import(fdrLib);

assert("classifyFailure returns domain and strategy", () => {
  if (typeof fdrMod.classifyFailure !== "function") throw new Error("missing");
  const result = fdrMod.classifyFailure({
    error: "ECONNREFUSED",
    operation: "api.call",
    context: { service: "llm" },
  });
  if (!result.domain) throw new Error("missing domain");
  if (!result.strategy) throw new Error("missing strategy");
});

assert("network errors map to network domain", () => {
  const result = fdrMod.classifyFailure({
    error: "ECONNREFUSED",
    operation: "api.call",
  });
  if (result.domain !== "network") throw new Error(`expected network, got ${result.domain}`);
  if (result.strategy !== "retry") throw new Error(`expected retry, got ${result.strategy}`);
});

assert("file errors map to filesystem domain", () => {
  const result = fdrMod.classifyFailure({
    error: "ENOENT: no such file",
    operation: "file.read",
  });
  if (result.domain !== "filesystem") throw new Error(`expected filesystem, got ${result.domain}`);
});

assert("budget errors map to governance domain", () => {
  const result = fdrMod.classifyFailure({
    error: "BUDGET_EXCEEDED",
    operation: "agent.run",
  });
  if (result.domain !== "governance") throw new Error(`expected governance, got ${result.domain}`);
  if (result.strategy !== "escalate") throw new Error(`expected escalate, got ${result.strategy}`);
});

assert("unknown errors map to unknown domain", () => {
  const result = fdrMod.classifyFailure({
    error: "something weird happened",
    operation: "magic",
  });
  if (result.domain !== "unknown") throw new Error(`expected unknown, got ${result.domain}`);
});

// ── Part 2: Rollback Coordinator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Rollback Coordinator\x1b[0m");

const rcLib = join(process.cwd(), "tools/ogu/commands/lib/rollback-coordinator.mjs");
assert("rollback-coordinator.mjs exists", () => {
  if (!existsSync(rcLib)) throw new Error("file missing");
});

const rcMod = await import(rcLib);

assert("createRollbackCoordinator returns coordinator", () => {
  if (typeof rcMod.createRollbackCoordinator !== "function") throw new Error("missing");
  const coord = rcMod.createRollbackCoordinator();
  if (typeof coord.addStep !== "function") throw new Error("missing addStep");
  if (typeof coord.execute !== "function") throw new Error("missing execute");
});

assert("execute runs steps and completes", async () => {
  const coord = rcMod.createRollbackCoordinator();
  const log = [];
  coord.addStep({
    name: "create-branch",
    forward: async () => { log.push("forward-1"); },
    compensate: async () => { log.push("rollback-1"); },
  });
  coord.addStep({
    name: "write-code",
    forward: async () => { log.push("forward-2"); },
    compensate: async () => { log.push("rollback-2"); },
  });
  const result = await coord.execute();
  if (result.status !== "completed") throw new Error(`expected completed, got ${result.status}`);
  if (log.length !== 2) throw new Error(`expected 2 forward steps, got ${log.length}`);
});

assert("execute rolls back on failure", async () => {
  const coord = rcMod.createRollbackCoordinator();
  const log = [];
  coord.addStep({
    name: "step-1",
    forward: async () => { log.push("f1"); },
    compensate: async () => { log.push("c1"); },
  });
  coord.addStep({
    name: "step-2",
    forward: async () => { log.push("f2"); throw new Error("boom"); },
    compensate: async () => { log.push("c2"); },
  });
  coord.addStep({
    name: "step-3",
    forward: async () => { log.push("f3"); },
    compensate: async () => { log.push("c3"); },
  });
  const result = await coord.execute();
  if (result.status !== "rolled_back") throw new Error(`expected rolled_back, got ${result.status}`);
  // Should have run f1, f2 (failed), then c2, c1 (reverse order)
  if (!log.includes("c1")) throw new Error("should have compensated step 1");
});

assert("getHistory returns execution record", async () => {
  const coord = rcMod.createRollbackCoordinator();
  coord.addStep({
    name: "s1",
    forward: async () => {},
    compensate: async () => {},
  });
  await coord.execute();
  const history = coord.getHistory();
  if (history.length !== 1) throw new Error(`expected 1 record, got ${history.length}`);
  if (history[0].status !== "completed") throw new Error("should be completed");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
