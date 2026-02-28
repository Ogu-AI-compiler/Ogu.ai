/**
 * Slice 79 — Chaos Engine + Capability Testing
 *
 * Chaos engine: failure injection for testing resilience.
 * Capability testing: test runner for agent capabilities.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 79 — Chaos Engine + Capability Testing\x1b[0m\n");

// ── Part 1: Chaos Engine ──────────────────────────────

console.log("\x1b[36m  Part 1: Chaos Engine\x1b[0m");

const chaosLib = join(process.cwd(), "tools/ogu/commands/lib/chaos-engine.mjs");
assert("chaos-engine.mjs exists", () => {
  if (!existsSync(chaosLib)) throw new Error("file missing");
});

const chaosMod = await import(chaosLib);

assert("createChaosEngine returns engine", () => {
  if (typeof chaosMod.createChaosEngine !== "function") throw new Error("missing");
  const engine = chaosMod.createChaosEngine();
  if (typeof engine.injectFailure !== "function") throw new Error("missing injectFailure");
  if (typeof engine.simulateScenario !== "function") throw new Error("missing simulateScenario");
  if (typeof engine.getReport !== "function") throw new Error("missing getReport");
});

assert("injectFailure adds a failure to target", () => {
  const engine = chaosMod.createChaosEngine();
  engine.injectFailure({ target: "llm", type: "timeout", duration: 5000 });
  const active = engine.getActiveFailures();
  if (active.length !== 1) throw new Error(`expected 1, got ${active.length}`);
  if (active[0].target !== "llm") throw new Error("wrong target");
});

assert("clearFailures removes all injected failures", () => {
  const engine = chaosMod.createChaosEngine();
  engine.injectFailure({ target: "db", type: "crash" });
  engine.injectFailure({ target: "api", type: "latency" });
  engine.clearFailures();
  if (engine.getActiveFailures().length !== 0) throw new Error("should be empty");
});

assert("simulateScenario runs predefined chaos scenario", () => {
  const engine = chaosMod.createChaosEngine();
  const result = engine.simulateScenario("budget_exhaustion");
  if (typeof result.scenario !== "string") throw new Error("missing scenario name");
  if (typeof result.injected !== "number") throw new Error("missing injected count");
});

assert("getReport returns chaos session report", () => {
  const engine = chaosMod.createChaosEngine();
  engine.injectFailure({ target: "api", type: "error_500" });
  const report = engine.getReport();
  if (typeof report.totalInjected !== "number") throw new Error("missing totalInjected");
  if (!report.timestamp) throw new Error("missing timestamp");
});

assert("CHAOS_SCENARIOS exported", () => {
  if (!chaosMod.CHAOS_SCENARIOS) throw new Error("missing");
  if (!Array.isArray(chaosMod.CHAOS_SCENARIOS)) throw new Error("should be array");
  if (chaosMod.CHAOS_SCENARIOS.length < 3) throw new Error("should have at least 3 scenarios");
});

// ── Part 2: Capability Testing ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Capability Testing\x1b[0m");

const capLib = join(process.cwd(), "tools/ogu/commands/lib/capability-testing.mjs");
assert("capability-testing.mjs exists", () => {
  if (!existsSync(capLib)) throw new Error("file missing");
});

const capMod = await import(capLib);

assert("createCapabilityRunner returns runner", () => {
  if (typeof capMod.createCapabilityRunner !== "function") throw new Error("missing");
  const runner = capMod.createCapabilityRunner();
  if (typeof runner.addTest !== "function") throw new Error("missing addTest");
  if (typeof runner.run !== "function") throw new Error("missing run");
  if (typeof runner.getResults !== "function") throw new Error("missing getResults");
});

assert("addTest registers capability test", () => {
  const runner = capMod.createCapabilityRunner();
  runner.addTest({ capability: "code_review", test: () => true });
  runner.addTest({ capability: "testing", test: () => true });
  const tests = runner.listTests();
  if (tests.length !== 2) throw new Error(`expected 2, got ${tests.length}`);
});

assert("run executes tests and returns results", async () => {
  const runner = capMod.createCapabilityRunner();
  runner.addTest({ capability: "code", test: () => true });
  runner.addTest({ capability: "broken", test: () => { throw new Error("fail"); } });
  const results = await runner.run();
  if (results.total !== 2) throw new Error(`expected 2 total, got ${results.total}`);
  if (results.passed !== 1) throw new Error(`expected 1 passed, got ${results.passed}`);
  if (results.failed !== 1) throw new Error(`expected 1 failed, got ${results.failed}`);
});

assert("scoreCapability returns score 0-100", async () => {
  if (typeof capMod.scoreCapability !== "function") throw new Error("missing");
  const score = capMod.scoreCapability({ total: 10, passed: 8 });
  if (score !== 80) throw new Error(`expected 80, got ${score}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
