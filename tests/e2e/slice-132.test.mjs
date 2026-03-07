/**
 * Slice 132 — Approval Enforcer
 *
 * Approval Enforcer: runtime enforcement of approval gates.

 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 132 — Approval Enforcer\x1b[0m\n");

// ── Part 1: Approval Enforcer ──────────────────────────────

console.log("\x1b[36m  Part 1: Approval Enforcer\x1b[0m");

const aeLib = join(process.cwd(), "tools/ogu/commands/lib/approval-enforcer.mjs");
assert("approval-enforcer.mjs exists", () => {
  if (!existsSync(aeLib)) throw new Error("file missing");
});

const aeMod = await import(aeLib);

assert("createApprovalEnforcer returns enforcer", () => {
  if (typeof aeMod.createApprovalEnforcer !== "function") throw new Error("missing");
  const enforcer = aeMod.createApprovalEnforcer();
  if (typeof enforcer.requireApproval !== "function") throw new Error("missing requireApproval");
  if (typeof enforcer.approve !== "function") throw new Error("missing approve");
  if (typeof enforcer.checkApproval !== "function") throw new Error("missing checkApproval");
});

assert("requireApproval creates pending gate", () => {
  const enforcer = aeMod.createApprovalEnforcer();
  const gate = enforcer.requireApproval({
    operation: "deploy",
    requiredRole: "tech-lead",
    agentId: "devops",
  });
  if (gate.status !== "pending") throw new Error(`expected pending, got ${gate.status}`);
  if (!gate.id) throw new Error("missing gate id");
});

assert("approve transitions gate to approved", () => {
  const enforcer = aeMod.createApprovalEnforcer();
  const gate = enforcer.requireApproval({ operation: "deploy", requiredRole: "cto", agentId: "dev" });
  const result = enforcer.approve(gate.id, { approvedBy: "cto", reason: "looks good" });
  if (result.status !== "approved") throw new Error(`expected approved, got ${result.status}`);
});

assert("checkApproval returns false for pending", () => {
  const enforcer = aeMod.createApprovalEnforcer();
  const gate = enforcer.requireApproval({ operation: "migrate", requiredRole: "dba", agentId: "dev" });
  if (enforcer.checkApproval(gate.id)) throw new Error("pending should not pass check");
});

assert("checkApproval returns true for approved", () => {
  const enforcer = aeMod.createApprovalEnforcer();
  const gate = enforcer.requireApproval({ operation: "x", requiredRole: "lead", agentId: "a" });
  enforcer.approve(gate.id, { approvedBy: "lead" });
  if (!enforcer.checkApproval(gate.id)) throw new Error("approved should pass check");
});

assert("deny blocks the gate", () => {
  const enforcer = aeMod.createApprovalEnforcer();
  const gate = enforcer.requireApproval({ operation: "x", requiredRole: "lead", agentId: "a" });
  const result = enforcer.deny(gate.id, { deniedBy: "lead", reason: "too risky" });
  if (result.status !== "denied") throw new Error(`expected denied, got ${result.status}`);
  if (enforcer.checkApproval(gate.id)) throw new Error("denied should not pass check");
});
