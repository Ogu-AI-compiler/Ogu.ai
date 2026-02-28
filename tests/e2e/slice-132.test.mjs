/**
 * Slice 132 — Approval Enforcer + Override Audit Log
 *
 * Approval Enforcer: runtime enforcement of approval gates.
 * Override Audit Log: formal override records with authority validation.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 132 — Approval Enforcer + Override Audit Log\x1b[0m\n");

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

// ── Part 2: Override Audit Log ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Override Audit Log\x1b[0m");

const oalLib = join(process.cwd(), "tools/ogu/commands/lib/override-audit-log.mjs");
assert("override-audit-log.mjs exists", () => {
  if (!existsSync(oalLib)) throw new Error("file missing");
});

const oalMod = await import(oalLib);

assert("createOverrideAuditLog returns logger", () => {
  if (typeof oalMod.createOverrideAuditLog !== "function") throw new Error("missing");
  const log = oalMod.createOverrideAuditLog();
  if (typeof log.recordOverride !== "function") throw new Error("missing recordOverride");
  if (typeof log.getOverrides !== "function") throw new Error("missing getOverrides");
});

assert("recordOverride captures override details", () => {
  const log = oalMod.createOverrideAuditLog();
  const entry = log.recordOverride({
    gateId: "g1",
    overriddenBy: "cto",
    reason: "production emergency",
    authority: "emergency-protocol",
  });
  if (!entry.id) throw new Error("missing entry id");
  if (!entry.timestamp) throw new Error("missing timestamp");
  if (entry.overriddenBy !== "cto") throw new Error("wrong overriddenBy");
});

assert("getOverrides returns all records", () => {
  const log = oalMod.createOverrideAuditLog();
  log.recordOverride({ gateId: "g1", overriddenBy: "cto", reason: "r1", authority: "a1" });
  log.recordOverride({ gateId: "g2", overriddenBy: "lead", reason: "r2", authority: "a2" });
  const records = log.getOverrides();
  if (records.length !== 2) throw new Error(`expected 2, got ${records.length}`);
});

assert("getOverridesByAuthority filters correctly", () => {
  const log = oalMod.createOverrideAuditLog();
  log.recordOverride({ gateId: "g1", overriddenBy: "cto", reason: "r1", authority: "emergency" });
  log.recordOverride({ gateId: "g2", overriddenBy: "lead", reason: "r2", authority: "standard" });
  log.recordOverride({ gateId: "g3", overriddenBy: "cto", reason: "r3", authority: "emergency" });
  const emergency = log.getOverridesByAuthority("emergency");
  if (emergency.length !== 2) throw new Error(`expected 2, got ${emergency.length}`);
});

assert("validateAuthority checks role permissions", () => {
  const log = oalMod.createOverrideAuditLog({
    authorizedRoles: { "emergency": ["cto"], "standard": ["tech-lead", "cto"] },
  });
  if (!log.validateAuthority("cto", "emergency")) throw new Error("cto should have emergency authority");
  if (log.validateAuthority("dev", "emergency")) throw new Error("dev should not have emergency authority");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
