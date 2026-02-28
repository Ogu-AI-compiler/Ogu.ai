/**
 * Slice 104 — Approval Lifecycle + Escalation Chain
 *
 * Approval lifecycle: formal state machine for approval records.
 * Escalation chain: timeout-based escalation through role hierarchy.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 104 — Approval Lifecycle + Escalation Chain\x1b[0m\n");

// ── Part 1: Approval Lifecycle ──────────────────────────────

console.log("\x1b[36m  Part 1: Approval Lifecycle\x1b[0m");

const alLib = join(process.cwd(), "tools/ogu/commands/lib/approval-lifecycle.mjs");
assert("approval-lifecycle.mjs exists", () => {
  if (!existsSync(alLib)) throw new Error("file missing");
});

const alMod = await import(alLib);

assert("createApprovalLifecycle returns lifecycle manager", () => {
  if (typeof alMod.createApprovalLifecycle !== "function") throw new Error("missing");
  const al = alMod.createApprovalLifecycle();
  if (typeof al.create !== "function") throw new Error("missing create");
  if (typeof al.approve !== "function") throw new Error("missing approve");
  if (typeof al.deny !== "function") throw new Error("missing deny");
  if (typeof al.escalate !== "function") throw new Error("missing escalate");
});

assert("create starts in pending state", () => {
  const al = alMod.createApprovalLifecycle();
  const approval = al.create({ requestor: "backend-dev", approver: "tech-lead", action: "deploy", context: {} });
  if (approval.status !== "pending") throw new Error(`expected pending, got ${approval.status}`);
  if (!approval.id) throw new Error("missing id");
});

assert("approve transitions to approved", () => {
  const al = alMod.createApprovalLifecycle();
  const a = al.create({ requestor: "qa", approver: "pm", action: "release", context: {} });
  const approved = al.approve(a.id, { by: "pm", notes: "Looks good" });
  if (approved.status !== "approved") throw new Error(`expected approved, got ${approved.status}`);
});

assert("deny transitions to denied", () => {
  const al = alMod.createApprovalLifecycle();
  const a = al.create({ requestor: "dev", approver: "security", action: "deploy", context: {} });
  const denied = al.deny(a.id, { by: "security", reason: "Missing audit" });
  if (denied.status !== "denied") throw new Error(`expected denied, got ${denied.status}`);
  if (denied.reason !== "Missing audit") throw new Error("wrong reason");
});

assert("escalate transitions to escalated with new approver", () => {
  const al = alMod.createApprovalLifecycle();
  const a = al.create({ requestor: "dev", approver: "tech-lead", action: "schema-change", context: {} });
  const escalated = al.escalate(a.id, { to: "cto", reason: "Tech lead unavailable" });
  if (escalated.status !== "escalated") throw new Error(`expected escalated, got ${escalated.status}`);
  if (escalated.escalatedTo !== "cto") throw new Error("wrong escalation target");
});

assert("APPROVAL_STATES exported", () => {
  if (!Array.isArray(alMod.APPROVAL_STATES)) throw new Error("missing");
  const expected = ["pending", "approved", "denied", "escalated", "timed_out"];
  for (const s of expected) {
    if (!alMod.APPROVAL_STATES.includes(s)) throw new Error(`missing state ${s}`);
  }
});

assert("cannot approve already denied", () => {
  const al = alMod.createApprovalLifecycle();
  const a = al.create({ requestor: "dev", approver: "pm", action: "x", context: {} });
  al.deny(a.id, { by: "pm", reason: "no" });
  let threw = false;
  try { al.approve(a.id, { by: "pm" }); } catch (_) { threw = true; }
  if (!threw) throw new Error("should throw on double transition");
});

// ── Part 2: Escalation Chain ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Escalation Chain\x1b[0m");

const ecLib = join(process.cwd(), "tools/ogu/commands/lib/escalation-chain.mjs");
assert("escalation-chain.mjs exists", () => {
  if (!existsSync(ecLib)) throw new Error("file missing");
});

const ecMod = await import(ecLib);

assert("createEscalationChain returns chain manager", () => {
  if (typeof ecMod.createEscalationChain !== "function") throw new Error("missing");
  const ec = ecMod.createEscalationChain({ chain: ["tech-lead", "cto"], timeoutMs: 60000 });
  if (typeof ec.getCurrentApprover !== "function") throw new Error("missing getCurrentApprover");
  if (typeof ec.escalate !== "function") throw new Error("missing escalate");
  if (typeof ec.isExhausted !== "function") throw new Error("missing isExhausted");
});

assert("getCurrentApprover returns first in chain", () => {
  const ec = ecMod.createEscalationChain({ chain: ["tech-lead", "architect", "cto"], timeoutMs: 5000 });
  if (ec.getCurrentApprover() !== "tech-lead") throw new Error("should start at tech-lead");
});

assert("escalate moves to next approver", () => {
  const ec = ecMod.createEscalationChain({ chain: ["tech-lead", "architect", "cto"], timeoutMs: 5000 });
  ec.escalate();
  if (ec.getCurrentApprover() !== "architect") throw new Error("should be architect after first escalation");
  ec.escalate();
  if (ec.getCurrentApprover() !== "cto") throw new Error("should be cto after second escalation");
});

assert("isExhausted returns true when chain is done", () => {
  const ec = ecMod.createEscalationChain({ chain: ["tech-lead", "cto"], timeoutMs: 5000 });
  if (ec.isExhausted()) throw new Error("should not be exhausted initially");
  ec.escalate();
  if (ec.isExhausted()) throw new Error("should not be exhausted at cto");
  ec.escalate();
  if (!ec.isExhausted()) throw new Error("should be exhausted after last");
});

assert("getEscalationHistory tracks all escalations", () => {
  const ec = ecMod.createEscalationChain({ chain: ["a", "b", "c"], timeoutMs: 1000 });
  ec.escalate();
  ec.escalate();
  const history = ec.getEscalationHistory();
  if (history.length !== 2) throw new Error(`expected 2, got ${history.length}`);
  if (history[0].from !== "a") throw new Error("first from should be a");
  if (history[0].to !== "b") throw new Error("first to should be b");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
