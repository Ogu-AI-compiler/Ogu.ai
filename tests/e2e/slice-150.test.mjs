/**
 * Slice 150 — Error Recovery Manager + Health Check Runner
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 150 — Error Recovery Manager + Health Check Runner\x1b[0m\n");

console.log("\x1b[36m  Part 1: Error Recovery Manager\x1b[0m");

const ermLib = join(process.cwd(), "tools/ogu/commands/lib/error-recovery-manager.mjs");
assert("error-recovery-manager.mjs exists", () => { if (!existsSync(ermLib)) throw new Error("file missing"); });

const ermMod = await import(ermLib);

assert("createErrorRecoveryManager returns manager", () => {
  if (typeof ermMod.createErrorRecoveryManager !== "function") throw new Error("missing");
  const mgr = ermMod.createErrorRecoveryManager();
  if (typeof mgr.addStrategy !== "function") throw new Error("missing addStrategy");
  if (typeof mgr.recover !== "function") throw new Error("missing recover");
});

assert("recover uses matching strategy", () => {
  const mgr = ermMod.createErrorRecoveryManager();
  mgr.addStrategy({ pattern: /ECONNREFUSED/, action: "retry", maxAttempts: 3 });
  const result = mgr.recover(new Error("ECONNREFUSED 127.0.0.1:3000"));
  if (result.action !== "retry") throw new Error(`expected retry, got ${result.action}`);
});

assert("recover returns escalate for unknown errors", () => {
  const mgr = ermMod.createErrorRecoveryManager();
  const result = mgr.recover(new Error("something random"));
  if (result.action !== "escalate") throw new Error(`expected escalate, got ${result.action}`);
});

assert("recover tracks error history", () => {
  const mgr = ermMod.createErrorRecoveryManager();
  mgr.recover(new Error("err1"));
  mgr.recover(new Error("err2"));
  const history = mgr.getHistory();
  if (history.length !== 2) throw new Error(`expected 2, got ${history.length}`);
});

console.log("\n\x1b[36m  Part 2: Health Check Runner\x1b[0m");

const hcrLib = join(process.cwd(), "tools/ogu/commands/lib/health-check-runner.mjs");
assert("health-check-runner.mjs exists", () => { if (!existsSync(hcrLib)) throw new Error("file missing"); });

const hcrMod = await import(hcrLib);

assert("createHealthCheckRunner returns runner", () => {
  if (typeof hcrMod.createHealthCheckRunner !== "function") throw new Error("missing");
  const runner = hcrMod.createHealthCheckRunner();
  if (typeof runner.addCheck !== "function") throw new Error("missing addCheck");
  if (typeof runner.runAll !== "function") throw new Error("missing runAll");
});

assert("runAll executes all checks", async () => {
  const runner = hcrMod.createHealthCheckRunner();
  runner.addCheck({ name: "db", check: async () => ({ healthy: true }) });
  runner.addCheck({ name: "cache", check: async () => ({ healthy: true }) });
  const results = await runner.runAll();
  if (results.length !== 2) throw new Error(`expected 2, got ${results.length}`);
  if (!results.every(r => r.healthy)) throw new Error("all should be healthy");
});

assert("runAll captures unhealthy checks", async () => {
  const runner = hcrMod.createHealthCheckRunner();
  runner.addCheck({ name: "ok", check: async () => ({ healthy: true }) });
  runner.addCheck({ name: "fail", check: async () => ({ healthy: false, error: "down" }) });
  const results = await runner.runAll();
  const failed = results.filter(r => !r.healthy);
  if (failed.length !== 1) throw new Error(`expected 1 failed, got ${failed.length}`);
});

assert("isHealthy returns overall status", async () => {
  const runner = hcrMod.createHealthCheckRunner();
  runner.addCheck({ name: "a", check: async () => ({ healthy: true }) });
  if (!(await runner.isHealthy())) throw new Error("should be healthy");
  runner.addCheck({ name: "b", check: async () => ({ healthy: false }) });
  if (await runner.isHealthy()) throw new Error("should be unhealthy");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
