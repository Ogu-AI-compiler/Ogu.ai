/**
 * Slice 126 — Allocation Strategy + Capability Matcher
 *
 * Allocation strategy: select best agent for a task using scoring.
 * Capability matcher: match task requirements to agent capabilities.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 126 — Allocation Strategy + Capability Matcher\x1b[0m\n");

// ── Part 1: Allocation Strategy ──────────────────────────────

console.log("\x1b[36m  Part 1: Allocation Strategy\x1b[0m");

const asLib = join(process.cwd(), "tools/ogu/commands/lib/allocation-strategy.mjs");
assert("allocation-strategy.mjs exists", () => {
  if (!existsSync(asLib)) throw new Error("file missing");
});

const asMod = await import(asLib);

assert("createAllocationStrategy returns strategy", () => {
  if (typeof asMod.createAllocationStrategy !== "function") throw new Error("missing");
  const as = asMod.createAllocationStrategy();
  if (typeof as.score !== "function") throw new Error("missing score");
  if (typeof as.selectBest !== "function") throw new Error("missing selectBest");
});

assert("score evaluates agent fitness for a task", () => {
  const as = asMod.createAllocationStrategy();
  const score = as.score({
    agent: { id: "dev", capabilities: ["api", "db"], load: 0.3, budgetRemaining: 0.8 },
    task: { requiredCapabilities: ["api"], priority: "high" },
  });
  if (typeof score !== "number") throw new Error("should return number");
  if (score < 0 || score > 1) throw new Error("score out of range");
});

assert("selectBest picks highest-scoring agent", () => {
  const as = asMod.createAllocationStrategy();
  const best = as.selectBest({
    agents: [
      { id: "dev1", capabilities: ["api"], load: 0.9, budgetRemaining: 0.1 },
      { id: "dev2", capabilities: ["api", "db"], load: 0.2, budgetRemaining: 0.9 },
    ],
    task: { requiredCapabilities: ["api"], priority: "normal" },
  });
  if (best.id !== "dev2") throw new Error(`expected dev2, got ${best.id}`);
});

assert("selectBest returns null when no agent qualifies", () => {
  const as = asMod.createAllocationStrategy();
  const best = as.selectBest({
    agents: [
      { id: "dev1", capabilities: ["ui"], load: 0.1, budgetRemaining: 0.9 },
    ],
    task: { requiredCapabilities: ["api"], priority: "normal" },
  });
  if (best !== null) throw new Error("should return null");
});

assert("ALLOCATION_WEIGHTS exported", () => {
  if (!asMod.ALLOCATION_WEIGHTS) throw new Error("missing");
  if (typeof asMod.ALLOCATION_WEIGHTS.capability !== "number") throw new Error("missing capability weight");
  if (typeof asMod.ALLOCATION_WEIGHTS.load !== "number") throw new Error("missing load weight");
});

// ── Part 2: Capability Matcher ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Capability Matcher\x1b[0m");

const cmLib = join(process.cwd(), "tools/ogu/commands/lib/capability-matcher.mjs");
assert("capability-matcher.mjs exists", () => {
  if (!existsSync(cmLib)) throw new Error("file missing");
});

const cmMod = await import(cmLib);

assert("matchCapabilities returns match score", () => {
  if (typeof cmMod.matchCapabilities !== "function") throw new Error("missing");
  const result = cmMod.matchCapabilities({
    required: ["api", "db"],
    available: ["api", "db", "testing"],
  });
  if (result.matched !== true) throw new Error("should match");
  if (result.score !== 1.0) throw new Error("should be perfect score");
});

assert("matchCapabilities detects partial match", () => {
  const result = cmMod.matchCapabilities({
    required: ["api", "db", "caching"],
    available: ["api", "db"],
  });
  if (result.matched !== false) throw new Error("should not fully match");
  if (result.missing.length !== 1) throw new Error("should have 1 missing");
  if (result.missing[0] !== "caching") throw new Error("wrong missing");
});

assert("matchCapabilities handles empty requirements", () => {
  const result = cmMod.matchCapabilities({
    required: [],
    available: ["api"],
  });
  if (!result.matched) throw new Error("empty requirements should match");
  if (result.score !== 1.0) throw new Error("should be perfect");
});

assert("findBestMatch returns best agent from list", () => {
  if (typeof cmMod.findBestMatch !== "function") throw new Error("missing");
  const best = cmMod.findBestMatch({
    required: ["api", "db"],
    agents: [
      { id: "a", capabilities: ["api"] },
      { id: "b", capabilities: ["api", "db", "testing"] },
      { id: "c", capabilities: ["ui"] },
    ],
  });
  if (best.id !== "b") throw new Error(`expected b, got ${best.id}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
