/**
 * Slice 373 — learning-event.mjs
 * Tests: createLearningCandidate writes file, detectLearningTrigger correct,
 *        listPendingCandidates reads all, markCandidateProcessed updates status.
 */

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 373 — learning-event\x1b[0m\n");

const mod = await import(join(process.cwd(), "tools/ogu/commands/lib/learning-event.mjs"));
const { createLearningCandidate, listPendingCandidates, markCandidateProcessed, detectLearningTrigger } = mod;

function makeRoot() {
  const root = join(tmpdir(), `ogu-e2e-373-${randomUUID().slice(0,8)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

const root = makeRoot();

assert("createLearningCandidate writes file and returns candidate", () => {
  const c = createLearningCandidate(root, {
    agentId:           "agent_0001",
    taskType:          "code-review",
    contextSignature:  { framework: "react", runtime: "node" },
    failureSignals:    ["lint-failure"],
    resolutionSummary: "Fixed lint errors",
    iterationCount:    2,
    trigger:           "gate_failure",
  });
  if (!c.event_id)       throw new Error("missing event_id");
  if (c.status !== "pending") throw new Error(`expected pending, got ${c.status}`);
  if (c.task_type !== "code-review") throw new Error("wrong task_type");
});

assert("listPendingCandidates returns all pending", () => {
  const root2 = makeRoot();
  createLearningCandidate(root2, { agentId: "a1", taskType: "build", contextSignature: {}, iterationCount: 0 });
  createLearningCandidate(root2, { agentId: "a2", taskType: "test",  contextSignature: {}, iterationCount: 0 });
  const pending = listPendingCandidates(root2);
  if (pending.length !== 2) throw new Error(`expected 2, got ${pending.length}`);
  rmSync(root2, { recursive: true, force: true });
});

assert("markCandidateProcessed updates status", () => {
  const root3 = makeRoot();
  const c = createLearningCandidate(root3, { agentId: "a3", taskType: "deploy", contextSignature: {}, iterationCount: 1 });
  markCandidateProcessed(root3, c.event_id);
  const pending = listPendingCandidates(root3);
  if (pending.some(p => p.event_id === c.event_id)) throw new Error("still pending after mark");
  rmSync(root3, { recursive: true, force: true });
});

assert("markCandidateProcessed throws for unknown event", () => {
  let threw = false;
  try { markCandidateProcessed(root, "fake-uuid"); }
  catch { threw = true; }
  if (!threw) throw new Error("should throw");
});

// detectLearningTrigger tests
assert("detectLearningTrigger: gate_failure when gateFailed=true", () => {
  const t = detectLearningTrigger({ gateFailed: true });
  if (t !== "gate_failure") throw new Error(`got ${t}`);
});

assert("detectLearningTrigger: review_rejection when iterations>0 + reviewerChangedStrategy", () => {
  const t = detectLearningTrigger({ iterationCount: 1, reviewerChangedStrategy: true });
  if (t !== "review_rejection") throw new Error(`got ${t}`);
});

assert("detectLearningTrigger: excessive_iterations when count>3", () => {
  const t = detectLearningTrigger({ iterationCount: 5 });
  if (t !== "excessive_iterations") throw new Error(`got ${t}`);
});

assert("detectLearningTrigger: exceptional_improvement when durationDrop>0.5", () => {
  const t = detectLearningTrigger({ durationDrop: 0.7 });
  if (t !== "exceptional_improvement") throw new Error(`got ${t}`);
});

assert("detectLearningTrigger: null for normal outcome", () => {
  const t = detectLearningTrigger({ iterationCount: 1, durationDrop: 0.1 });
  if (t !== null) throw new Error(`expected null, got ${t}`);
});

assert("gate_failure takes priority over other signals", () => {
  const t = detectLearningTrigger({ gateFailed: true, iterationCount: 5, durationDrop: 0.9 });
  if (t !== "gate_failure") throw new Error(`expected gate_failure, got ${t}`);
});

rmSync(root, { recursive: true, force: true });

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
