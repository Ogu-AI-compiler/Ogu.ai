/**
 * Slice 113 — SAGA Integrator + Failure Domain Manager
 *
 * SAGA integrator: wire saga transactions into multi-step operations.
 * Failure domain manager: map operations to domains with resilience strategies.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 113 — SAGA Integrator + Failure Domain Manager\x1b[0m\n");

// ── Part 1: SAGA Integrator ──────────────────────────────

console.log("\x1b[36m  Part 1: SAGA Integrator\x1b[0m");

const siLib = join(process.cwd(), "tools/ogu/commands/lib/saga-integrator.mjs");
assert("saga-integrator.mjs exists", () => {
  if (!existsSync(siLib)) throw new Error("file missing");
});

const siMod = await import(siLib);

assert("createSagaIntegrator returns integrator", () => {
  if (typeof siMod.createSagaIntegrator !== "function") throw new Error("missing");
  const si = siMod.createSagaIntegrator();
  if (typeof si.defineSaga !== "function") throw new Error("missing defineSaga");
  if (typeof si.executeSaga !== "function") throw new Error("missing executeSaga");
});

assert("defineSaga registers a multi-step saga", () => {
  const si = siMod.createSagaIntegrator();
  si.defineSaga("deploy", {
    steps: [
      { name: "build", execute: async () => "built", compensate: async () => "build-rolled-back" },
      { name: "test", execute: async () => "tested", compensate: async () => "test-rolled-back" },
      { name: "deploy", execute: async () => "deployed", compensate: async () => "deploy-rolled-back" },
    ],
  });
  const sagas = si.listSagas();
  if (sagas.length !== 1) throw new Error(`expected 1, got ${sagas.length}`);
});

assert("executeSaga runs all steps on success", async () => {
  const si = siMod.createSagaIntegrator();
  const log = [];
  si.defineSaga("deploy", {
    steps: [
      { name: "build", execute: async () => log.push("build"), compensate: async () => {} },
      { name: "test", execute: async () => log.push("test"), compensate: async () => {} },
    ],
  });
  const result = await si.executeSaga("deploy");
  if (result.status !== "completed") throw new Error(`expected completed, got ${result.status}`);
  if (log.length !== 2) throw new Error(`expected 2 steps, got ${log.length}`);
});

assert("executeSaga compensates on failure", async () => {
  const si = siMod.createSagaIntegrator();
  const compensated = [];
  si.defineSaga("deploy", {
    steps: [
      { name: "build", execute: async () => "ok", compensate: async () => compensated.push("build") },
      { name: "test", execute: async () => { throw new Error("test fail"); }, compensate: async () => compensated.push("test") },
      { name: "deploy", execute: async () => "ok", compensate: async () => compensated.push("deploy") },
    ],
  });
  const result = await si.executeSaga("deploy");
  if (result.status !== "compensated") throw new Error(`expected compensated, got ${result.status}`);
  // Only build should be compensated (test failed, deploy never ran)
  if (compensated.length !== 1) throw new Error(`expected 1 compensated, got ${compensated.length}`);
  if (compensated[0] !== "build") throw new Error("build should be compensated");
});

assert("executeSaga tracks step results", async () => {
  const si = siMod.createSagaIntegrator();
  si.defineSaga("simple", {
    steps: [
      { name: "a", execute: async () => 42, compensate: async () => {} },
    ],
  });
  const result = await si.executeSaga("simple");
  if (result.stepResults.a !== 42) throw new Error(`expected 42, got ${result.stepResults.a}`);
});

// ── Part 2: Failure Domain Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Failure Domain Manager\x1b[0m");

const fdLib = join(process.cwd(), "tools/ogu/commands/lib/failure-domain-manager.mjs");
assert("failure-domain-manager.mjs exists", () => {
  if (!existsSync(fdLib)) throw new Error("file missing");
});

const fdMod = await import(fdLib);

assert("createFailureDomainManager returns manager", () => {
  if (typeof fdMod.createFailureDomainManager !== "function") throw new Error("missing");
  const fdm = fdMod.createFailureDomainManager();
  if (typeof fdm.defineDomain !== "function") throw new Error("missing defineDomain");
  if (typeof fdm.handleFailure !== "function") throw new Error("missing handleFailure");
});

assert("defineDomain registers domain with strategy", () => {
  const fdm = fdMod.createFailureDomainManager();
  fdm.defineDomain("llm", { strategy: "retry", maxRetries: 3, circuitBreaker: true });
  fdm.defineDomain("git", { strategy: "escalate", maxRetries: 1 });
  const domains = fdm.listDomains();
  if (domains.length !== 2) throw new Error(`expected 2, got ${domains.length}`);
});

assert("handleFailure returns strategy-based action", () => {
  const fdm = fdMod.createFailureDomainManager();
  fdm.defineDomain("llm", { strategy: "retry", maxRetries: 3 });
  const action = fdm.handleFailure("llm", { error: "timeout", attempt: 1 });
  if (action.action !== "retry") throw new Error(`expected retry, got ${action.action}`);
});

assert("handleFailure escalates after max retries", () => {
  const fdm = fdMod.createFailureDomainManager();
  fdm.defineDomain("llm", { strategy: "retry", maxRetries: 2 });
  const action = fdm.handleFailure("llm", { error: "timeout", attempt: 3 });
  if (action.action !== "escalate") throw new Error(`expected escalate, got ${action.action}`);
});

assert("handleFailure returns abort for unknown domain", () => {
  const fdm = fdMod.createFailureDomainManager();
  const action = fdm.handleFailure("unknown", { error: "oops", attempt: 1 });
  if (action.action !== "abort") throw new Error(`expected abort, got ${action.action}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
