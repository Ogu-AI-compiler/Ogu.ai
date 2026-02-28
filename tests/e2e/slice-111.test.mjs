/**
 * Slice 111 — Envelope Protocol + Error Envelope
 *
 * Envelope protocol: InputEnvelope/OutputEnvelope for agent communication.
 * Error envelope: structured error envelope with OGU codes and recovery info.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 111 — Envelope Protocol + Error Envelope\x1b[0m\n");

// ── Part 1: Envelope Protocol ──────────────────────────────

console.log("\x1b[36m  Part 1: Envelope Protocol\x1b[0m");

const epLib = join(process.cwd(), "tools/ogu/commands/lib/envelope-protocol.mjs");
assert("envelope-protocol.mjs exists", () => {
  if (!existsSync(epLib)) throw new Error("file missing");
});

const epMod = await import(epLib);

assert("createInputEnvelope builds valid envelope", () => {
  if (typeof epMod.createInputEnvelope !== "function") throw new Error("missing");
  const env = epMod.createInputEnvelope({
    taskId: "task-42",
    agentId: "backend-dev",
    feature: "auth",
    phase: "build",
    context: { spec: "Spec.md" },
  });
  if (env.taskId !== "task-42") throw new Error("wrong taskId");
  if (env.agentId !== "backend-dev") throw new Error("wrong agentId");
  if (!env.timestamp) throw new Error("missing timestamp");
  if (!env.envelopeId) throw new Error("missing envelopeId");
});

assert("createOutputEnvelope builds valid envelope", () => {
  if (typeof epMod.createOutputEnvelope !== "function") throw new Error("missing");
  const env = epMod.createOutputEnvelope({
    taskId: "task-42",
    agentId: "backend-dev",
    result: "success",
    artifacts: ["src/api/auth.ts"],
    metrics: { tokensIn: 1000, tokensOut: 500, durationMs: 3000 },
  });
  if (env.result !== "success") throw new Error("wrong result");
  if (env.artifacts.length !== 1) throw new Error("wrong artifacts");
  if (env.metrics.tokensIn !== 1000) throw new Error("wrong metrics");
});

assert("validateInputEnvelope rejects incomplete envelope", () => {
  if (typeof epMod.validateInputEnvelope !== "function") throw new Error("missing");
  const result = epMod.validateInputEnvelope({ taskId: "x" });
  if (result.valid) throw new Error("should be invalid");
  if (result.errors.length === 0) throw new Error("should have errors");
});

assert("validateOutputEnvelope rejects missing result", () => {
  if (typeof epMod.validateOutputEnvelope !== "function") throw new Error("missing");
  const result = epMod.validateOutputEnvelope({ taskId: "x", agentId: "y" });
  if (result.valid) throw new Error("should be invalid");
});

// ── Part 2: Error Envelope ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Error Envelope\x1b[0m");

const eeLib = join(process.cwd(), "tools/ogu/commands/lib/error-envelope-protocol.mjs");
assert("error-envelope-protocol.mjs exists", () => {
  if (!existsSync(eeLib)) throw new Error("file missing");
});

const eeMod = await import(eeLib);

assert("createErrorEnvelope builds error envelope", () => {
  if (typeof eeMod.createErrorEnvelope !== "function") throw new Error("missing");
  const env = eeMod.createErrorEnvelope({
    taskId: "task-42",
    agentId: "backend-dev",
    error: "Compilation failed",
    code: "OGU1001",
    recoverable: true,
    suggestedAction: "retry",
  });
  if (env.error !== "Compilation failed") throw new Error("wrong error");
  if (env.code !== "OGU1001") throw new Error("wrong code");
  if (env.recoverable !== true) throw new Error("should be recoverable");
});

assert("createEscalationEnvelope builds escalation", () => {
  if (typeof eeMod.createEscalationEnvelope !== "function") throw new Error("missing");
  const env = eeMod.createEscalationEnvelope({
    taskId: "task-42",
    fromRole: "backend-dev",
    toRole: "tech-lead",
    reason: "Budget exceeded",
    context: { budgetUsed: 95000 },
  });
  if (env.fromRole !== "backend-dev") throw new Error("wrong fromRole");
  if (env.toRole !== "tech-lead") throw new Error("wrong toRole");
  if (env.type !== "escalation") throw new Error("wrong type");
});

assert("RECOVERY_ACTIONS lists valid actions", () => {
  if (!Array.isArray(eeMod.RECOVERY_ACTIONS)) throw new Error("missing");
  const expected = ["retry", "escalate", "abort", "skip", "manual"];
  for (const a of expected) {
    if (!eeMod.RECOVERY_ACTIONS.includes(a)) throw new Error(`missing ${a}`);
  }
});

assert("validateErrorEnvelope checks required fields", () => {
  if (typeof eeMod.validateErrorEnvelope !== "function") throw new Error("missing");
  const result = eeMod.validateErrorEnvelope({ taskId: "x" });
  if (result.valid) throw new Error("should be invalid");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
