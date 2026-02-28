/**
 * Slice 122 — Lock Coordinator + Resource Contention Resolver
 *
 * Lock coordinator: coordinate file locks across agents.
 * Resource contention resolver: resolve conflicts when agents compete for resources.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 122 — Lock Coordinator + Resource Contention Resolver\x1b[0m\n");

// ── Part 1: Lock Coordinator ──────────────────────────────

console.log("\x1b[36m  Part 1: Lock Coordinator\x1b[0m");

const lcLib = join(process.cwd(), "tools/ogu/commands/lib/lock-coordinator.mjs");
assert("lock-coordinator.mjs exists", () => {
  if (!existsSync(lcLib)) throw new Error("file missing");
});

const lcMod = await import(lcLib);

assert("createLockCoordinator returns coordinator", () => {
  if (typeof lcMod.createLockCoordinator !== "function") throw new Error("missing");
  const lc = lcMod.createLockCoordinator();
  if (typeof lc.acquire !== "function") throw new Error("missing acquire");
  if (typeof lc.release !== "function") throw new Error("missing release");
  if (typeof lc.isLocked !== "function") throw new Error("missing isLocked");
});

assert("acquire locks a resource", () => {
  const lc = lcMod.createLockCoordinator();
  const result = lc.acquire("src/api/auth.ts", "backend-dev");
  if (!result.acquired) throw new Error("should acquire");
  if (lc.isLocked("src/api/auth.ts") !== true) throw new Error("should be locked");
});

assert("acquire fails when already locked by another agent", () => {
  const lc = lcMod.createLockCoordinator();
  lc.acquire("src/api/auth.ts", "backend-dev");
  const result = lc.acquire("src/api/auth.ts", "frontend-dev");
  if (result.acquired) throw new Error("should not acquire");
  if (result.heldBy !== "backend-dev") throw new Error("should show held by");
});

assert("same agent can re-acquire (reentrant)", () => {
  const lc = lcMod.createLockCoordinator();
  lc.acquire("file.ts", "dev");
  const result = lc.acquire("file.ts", "dev");
  if (!result.acquired) throw new Error("same agent should re-acquire");
});

assert("release frees the lock", () => {
  const lc = lcMod.createLockCoordinator();
  lc.acquire("file.ts", "dev");
  lc.release("file.ts", "dev");
  if (lc.isLocked("file.ts")) throw new Error("should be unlocked");
});

assert("listLocks shows all active locks", () => {
  const lc = lcMod.createLockCoordinator();
  lc.acquire("a.ts", "dev1");
  lc.acquire("b.ts", "dev2");
  const locks = lc.listLocks();
  if (locks.length !== 2) throw new Error(`expected 2, got ${locks.length}`);
});

// ── Part 2: Resource Contention Resolver ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Resource Contention Resolver\x1b[0m");

const crLib = join(process.cwd(), "tools/ogu/commands/lib/contention-resolver.mjs");
assert("contention-resolver.mjs exists", () => {
  if (!existsSync(crLib)) throw new Error("file missing");
});

const crMod = await import(crLib);

assert("createContentionResolver returns resolver", () => {
  if (typeof crMod.createContentionResolver !== "function") throw new Error("missing");
  const cr = crMod.createContentionResolver();
  if (typeof cr.reportConflict !== "function") throw new Error("missing reportConflict");
  if (typeof cr.resolve !== "function") throw new Error("missing resolve");
});

assert("reportConflict registers a contention", () => {
  const cr = crMod.createContentionResolver();
  cr.reportConflict({
    resource: "src/api/auth.ts",
    agents: ["backend-dev", "security"],
    type: "write-write",
  });
  const conflicts = cr.listConflicts();
  if (conflicts.length !== 1) throw new Error(`expected 1, got ${conflicts.length}`);
});

assert("resolve with priority gives resource to higher-priority agent", () => {
  const cr = crMod.createContentionResolver();
  const cid = cr.reportConflict({
    resource: "src/api/auth.ts",
    agents: ["backend-dev", "security"],
    type: "write-write",
  });
  const result = cr.resolve(cid, {
    strategy: "priority",
    priorities: { "security": 100, "backend-dev": 50 },
  });
  if (result.winner !== "security") throw new Error(`expected security, got ${result.winner}`);
});

assert("resolve with queue returns FIFO order", () => {
  const cr = crMod.createContentionResolver();
  const cid = cr.reportConflict({
    resource: "package.json",
    agents: ["devops", "backend-dev"],
    type: "write-write",
  });
  const result = cr.resolve(cid, { strategy: "queue" });
  if (result.winner !== "devops") throw new Error("first agent should win in queue");
  if (result.queued[0] !== "backend-dev") throw new Error("second agent should be queued");
});

assert("RESOLUTION_STRATEGIES exported", () => {
  if (!Array.isArray(crMod.RESOLUTION_STRATEGIES)) throw new Error("missing");
  if (!crMod.RESOLUTION_STRATEGIES.includes("priority")) throw new Error("missing priority");
  if (!crMod.RESOLUTION_STRATEGIES.includes("queue")) throw new Error("missing queue");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
