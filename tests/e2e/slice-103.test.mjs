/**
 * Slice 103 — Artifact Handoff + Agent Handoff Protocol
 *
 * Artifact handoff: pass artifacts between agents with validation.
 * Agent handoff protocol: structured agent-to-agent task transfer.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 103 — Artifact Handoff + Agent Handoff Protocol\x1b[0m\n");

// ── Part 1: Artifact Handoff ──────────────────────────────

console.log("\x1b[36m  Part 1: Artifact Handoff\x1b[0m");

const ahLib = join(process.cwd(), "tools/ogu/commands/lib/artifact-handoff.mjs");
assert("artifact-handoff.mjs exists", () => {
  if (!existsSync(ahLib)) throw new Error("file missing");
});

const ahMod = await import(ahLib);

assert("createArtifactHandoff returns handoff manager", () => {
  if (typeof ahMod.createArtifactHandoff !== "function") throw new Error("missing");
  const ah = ahMod.createArtifactHandoff();
  if (typeof ah.send !== "function") throw new Error("missing send");
  if (typeof ah.receive !== "function") throw new Error("missing receive");
  if (typeof ah.listPending !== "function") throw new Error("missing listPending");
});

assert("send creates a handoff envelope", () => {
  const ah = ahMod.createArtifactHandoff();
  const id = ah.send({
    from: "backend-dev",
    to: "qa",
    artifact: { type: "code", path: "src/api/auth.ts", hash: "abc123" },
    message: "Auth module ready for testing",
  });
  if (!id) throw new Error("should return handoff ID");
  const pending = ah.listPending("qa");
  if (pending.length !== 1) throw new Error(`expected 1 pending, got ${pending.length}`);
});

assert("receive marks handoff as accepted", () => {
  const ah = ahMod.createArtifactHandoff();
  const id = ah.send({
    from: "architect",
    to: "backend-dev",
    artifact: { type: "spec", path: "docs/vault/Spec.md", hash: "def456" },
    message: "Spec ready for implementation",
  });
  const envelope = ah.receive(id, { accepted: true });
  if (envelope.status !== "accepted") throw new Error(`expected accepted, got ${envelope.status}`);
  const pending = ah.listPending("backend-dev");
  if (pending.length !== 0) throw new Error("should have no pending after accept");
});

assert("receive can reject with reason", () => {
  const ah = ahMod.createArtifactHandoff();
  const id = ah.send({
    from: "backend-dev",
    to: "qa",
    artifact: { type: "code", path: "src/main.ts", hash: "xyz" },
    message: "Ready",
  });
  const envelope = ah.receive(id, { accepted: false, reason: "Missing tests" });
  if (envelope.status !== "rejected") throw new Error(`expected rejected, got ${envelope.status}`);
});

assert("getHistory returns all handoffs", () => {
  const ah = ahMod.createArtifactHandoff();
  ah.send({ from: "a", to: "b", artifact: { type: "x" }, message: "1" });
  ah.send({ from: "b", to: "c", artifact: { type: "y" }, message: "2" });
  const history = ah.getHistory();
  if (history.length !== 2) throw new Error(`expected 2, got ${history.length}`);
});

// ── Part 2: Agent Handoff Protocol ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Agent Handoff Protocol\x1b[0m");

const hpLib = join(process.cwd(), "tools/ogu/commands/lib/handoff-protocol.mjs");
assert("handoff-protocol.mjs exists", () => {
  if (!existsSync(hpLib)) throw new Error("file missing");
});

const hpMod = await import(hpLib);

assert("createHandoffProtocol returns protocol", () => {
  if (typeof hpMod.createHandoffProtocol !== "function") throw new Error("missing");
  const hp = hpMod.createHandoffProtocol();
  if (typeof hp.initiateHandoff !== "function") throw new Error("missing initiateHandoff");
  if (typeof hp.completeHandoff !== "function") throw new Error("missing completeHandoff");
});

assert("initiateHandoff creates transfer request", () => {
  const hp = hpMod.createHandoffProtocol();
  const handoff = hp.initiateHandoff({
    fromAgent: "architect",
    toAgent: "backend-dev",
    taskId: "task-42",
    context: { spec: "Spec.md", plan: "Plan.json" },
    priority: "high",
  });
  if (!handoff.id) throw new Error("missing id");
  if (handoff.status !== "pending") throw new Error(`expected pending, got ${handoff.status}`);
  if (handoff.fromAgent !== "architect") throw new Error("wrong fromAgent");
});

assert("completeHandoff transitions to completed", () => {
  const hp = hpMod.createHandoffProtocol();
  const handoff = hp.initiateHandoff({
    fromAgent: "qa",
    toAgent: "devops",
    taskId: "task-99",
    context: { report: "QA-report.md" },
    priority: "normal",
  });
  const completed = hp.completeHandoff(handoff.id, { result: "approved", notes: "All tests pass" });
  if (completed.status !== "completed") throw new Error(`expected completed, got ${completed.status}`);
  if (completed.result !== "approved") throw new Error(`expected approved, got ${completed.result}`);
});

assert("listActive returns only pending handoffs", () => {
  const hp = hpMod.createHandoffProtocol();
  const h1 = hp.initiateHandoff({ fromAgent: "a", toAgent: "b", taskId: "t1", context: {}, priority: "normal" });
  hp.initiateHandoff({ fromAgent: "b", toAgent: "c", taskId: "t2", context: {}, priority: "normal" });
  hp.completeHandoff(h1.id, { result: "done" });
  const active = hp.listActive();
  if (active.length !== 1) throw new Error(`expected 1 active, got ${active.length}`);
});

assert("HANDOFF_PRIORITIES exported", () => {
  if (!Array.isArray(hpMod.HANDOFF_PRIORITIES)) throw new Error("missing HANDOFF_PRIORITIES");
  if (!hpMod.HANDOFF_PRIORITIES.includes("high")) throw new Error("missing high");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
