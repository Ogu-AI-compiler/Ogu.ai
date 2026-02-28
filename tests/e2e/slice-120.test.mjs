/**
 * Slice 120 — Pipeline Orchestrator + Phase Coordinator
 *
 * Pipeline orchestrator: end-to-end pipeline execution with agent assignment.
 * Phase coordinator: coordinate transitions between pipeline phases.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 120 — Pipeline Orchestrator + Phase Coordinator\x1b[0m\n");

// ── Part 1: Pipeline Orchestrator ──────────────────────────────

console.log("\x1b[36m  Part 1: Pipeline Orchestrator\x1b[0m");

const poLib = join(process.cwd(), "tools/ogu/commands/lib/pipeline-orchestrator.mjs");
assert("pipeline-orchestrator.mjs exists", () => {
  if (!existsSync(poLib)) throw new Error("file missing");
});

const poMod = await import(poLib);

assert("createPipelineOrchestrator returns orchestrator", () => {
  if (typeof poMod.createPipelineOrchestrator !== "function") throw new Error("missing");
  const po = poMod.createPipelineOrchestrator();
  if (typeof po.definePhase !== "function") throw new Error("missing definePhase");
  if (typeof po.execute !== "function") throw new Error("missing execute");
  if (typeof po.getProgress !== "function") throw new Error("missing getProgress");
});

assert("definePhase registers pipeline phases", () => {
  const po = poMod.createPipelineOrchestrator();
  po.definePhase("idea", { agent: "pm", run: async () => "ideated" });
  po.definePhase("spec", { agent: "architect", run: async () => "specified", deps: ["idea"] });
  po.definePhase("build", { agent: "backend-dev", run: async () => "built", deps: ["spec"] });
  const phases = po.listPhases();
  if (phases.length !== 3) throw new Error(`expected 3, got ${phases.length}`);
});

assert("execute runs phases in order", async () => {
  const log = [];
  const po = poMod.createPipelineOrchestrator();
  po.definePhase("a", { agent: "pm", run: async () => { log.push("a"); return "a-done"; } });
  po.definePhase("b", { agent: "dev", run: async () => { log.push("b"); return "b-done"; }, deps: ["a"] });
  po.definePhase("c", { agent: "qa", run: async () => { log.push("c"); return "c-done"; }, deps: ["b"] });
  const result = await po.execute();
  if (result.status !== "completed") throw new Error(`expected completed, got ${result.status}`);
  if (log[0] !== "a" || log[1] !== "b" || log[2] !== "c") throw new Error("wrong order");
});

assert("execute handles phase failure", async () => {
  const po = poMod.createPipelineOrchestrator();
  po.definePhase("a", { agent: "pm", run: async () => "ok" });
  po.definePhase("b", { agent: "dev", run: async () => { throw new Error("fail"); }, deps: ["a"] });
  const result = await po.execute();
  if (result.status !== "failed") throw new Error(`expected failed, got ${result.status}`);
  if (result.failedPhase !== "b") throw new Error("wrong failed phase");
});

assert("getProgress shows completed/total", () => {
  const po = poMod.createPipelineOrchestrator();
  po.definePhase("a", { agent: "pm", run: async () => "ok" });
  po.definePhase("b", { agent: "dev", run: async () => "ok", deps: ["a"] });
  const progress = po.getProgress();
  if (progress.total !== 2) throw new Error("wrong total");
  if (progress.completed !== 0) throw new Error("wrong completed");
});

// ── Part 2: Phase Coordinator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Phase Coordinator\x1b[0m");

const pcLib = join(process.cwd(), "tools/ogu/commands/lib/phase-coordinator.mjs");
assert("phase-coordinator.mjs exists", () => {
  if (!existsSync(pcLib)) throw new Error("file missing");
});

const pcMod = await import(pcLib);

assert("createPhaseCoordinator returns coordinator", () => {
  if (typeof pcMod.createPhaseCoordinator !== "function") throw new Error("missing");
  const pc = pcMod.createPhaseCoordinator();
  if (typeof pc.registerTransition !== "function") throw new Error("missing registerTransition");
  if (typeof pc.canTransition !== "function") throw new Error("missing canTransition");
  if (typeof pc.transition !== "function") throw new Error("missing transition");
});

assert("registerTransition defines valid phase transition", () => {
  const pc = pcMod.createPhaseCoordinator();
  pc.registerTransition("idea", "spec", { gate: "prd-complete" });
  pc.registerTransition("spec", "build", { gate: "spec-approved" });
  const transitions = pc.listTransitions();
  if (transitions.length !== 2) throw new Error(`expected 2, got ${transitions.length}`);
});

assert("canTransition checks if transition is valid", () => {
  const pc = pcMod.createPhaseCoordinator();
  pc.registerTransition("idea", "spec", { gate: "prd-complete" });
  if (!pc.canTransition("idea", "spec")) throw new Error("should be valid");
  if (pc.canTransition("idea", "build")) throw new Error("should not be valid");
});

assert("transition executes gate check and moves phase", () => {
  const pc = pcMod.createPhaseCoordinator();
  pc.registerTransition("idea", "spec", { gate: "prd-complete", check: () => true });
  const result = pc.transition("idea", "spec");
  if (!result.allowed) throw new Error("should be allowed");
  if (result.from !== "idea" || result.to !== "spec") throw new Error("wrong from/to");
});

assert("transition blocks when gate check fails", () => {
  const pc = pcMod.createPhaseCoordinator();
  pc.registerTransition("spec", "build", { gate: "spec-approved", check: () => false });
  const result = pc.transition("spec", "build");
  if (result.allowed) throw new Error("should not be allowed");
  if (!result.blockedBy) throw new Error("should have blockedBy");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
