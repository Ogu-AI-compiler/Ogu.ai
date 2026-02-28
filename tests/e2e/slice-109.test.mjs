/**
 * Slice 109 — Governance Trigger Types + Policy Evaluator
 *
 * Governance triggers: scope_violation, path_match, budget_exceeded, risk_tier.
 * Policy evaluator: evaluate policies with full trigger support.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 109 — Governance Trigger Types + Policy Evaluator\x1b[0m\n");

// ── Part 1: Governance Trigger Types ──────────────────────────────

console.log("\x1b[36m  Part 1: Governance Trigger Types\x1b[0m");

const gtLib = join(process.cwd(), "tools/ogu/commands/lib/governance-triggers.mjs");
assert("governance-triggers.mjs exists", () => {
  if (!existsSync(gtLib)) throw new Error("file missing");
});

const gtMod = await import(gtLib);

assert("TRIGGER_TYPES exported", () => {
  if (!Array.isArray(gtMod.TRIGGER_TYPES)) throw new Error("missing");
  const expected = ["scope_violation", "path_match", "budget_exceeded", "risk_tier"];
  for (const t of expected) {
    if (!gtMod.TRIGGER_TYPES.includes(t)) throw new Error(`missing ${t}`);
  }
});

assert("checkScopeViolation detects out-of-scope path", () => {
  const result = gtMod.checkScopeViolation({
    agentId: "frontend-dev",
    ownershipScope: ["src/ui/**", "src/components/**"],
    targetPath: "src/api/server.ts",
  });
  if (!result.triggered) throw new Error("should trigger");
  if (result.type !== "scope_violation") throw new Error("wrong type");
});

assert("checkScopeViolation allows in-scope path", () => {
  const result = gtMod.checkScopeViolation({
    agentId: "frontend-dev",
    ownershipScope: ["src/ui/**", "src/components/**"],
    targetPath: "src/ui/Button.tsx",
  });
  if (result.triggered) throw new Error("should not trigger for in-scope path");
});

assert("checkBudgetExceeded triggers when over budget", () => {
  const result = gtMod.checkBudgetExceeded({
    roleId: "backend-dev",
    currentUsage: 95000,
    quota: 100000,
    threshold: 0.90,
  });
  if (!result.triggered) throw new Error("should trigger at 95%");
});

assert("checkRiskTier triggers for high-risk operations", () => {
  const result = gtMod.checkRiskTier({
    operation: "schema-migration",
    riskTier: "high",
    minTierForApproval: "medium",
  });
  if (!result.triggered) throw new Error("should trigger for high risk");
});

assert("checkRiskTier does not trigger for low risk", () => {
  const result = gtMod.checkRiskTier({
    operation: "add-comment",
    riskTier: "low",
    minTierForApproval: "medium",
  });
  if (result.triggered) throw new Error("should not trigger for low risk");
});

// ── Part 2: Policy Evaluator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Policy Evaluator\x1b[0m");

const peLib = join(process.cwd(), "tools/ogu/commands/lib/policy-evaluator.mjs");
assert("policy-evaluator.mjs exists", () => {
  if (!existsSync(peLib)) throw new Error("file missing");
});

const peMod = await import(peLib);

assert("createPolicyEvaluator returns evaluator", () => {
  if (typeof peMod.createPolicyEvaluator !== "function") throw new Error("missing");
  const pe = peMod.createPolicyEvaluator();
  if (typeof pe.addPolicy !== "function") throw new Error("missing addPolicy");
  if (typeof pe.evaluate !== "function") throw new Error("missing evaluate");
});

assert("addPolicy registers policy rules", () => {
  const pe = peMod.createPolicyEvaluator();
  pe.addPolicy({ id: "p1", trigger: "scope_violation", effect: "deny", priority: 100 });
  pe.addPolicy({ id: "p2", trigger: "budget_exceeded", effect: "requires_approval", priority: 50 });
  const policies = pe.listPolicies();
  if (policies.length !== 2) throw new Error(`expected 2, got ${policies.length}`);
});

assert("evaluate returns deny for matching scope violation", () => {
  const pe = peMod.createPolicyEvaluator();
  pe.addPolicy({ id: "scope-guard", trigger: "scope_violation", effect: "deny", priority: 100 });
  const result = pe.evaluate({ type: "scope_violation", agentId: "dev", path: "src/api/x.ts" });
  if (result.effect !== "deny") throw new Error(`expected deny, got ${result.effect}`);
  if (result.matchedPolicy !== "scope-guard") throw new Error("wrong policy");
});

assert("evaluate returns allow when no policies match", () => {
  const pe = peMod.createPolicyEvaluator();
  pe.addPolicy({ id: "p1", trigger: "budget_exceeded", effect: "deny", priority: 100 });
  const result = pe.evaluate({ type: "scope_violation", agentId: "dev", path: "x" });
  if (result.effect !== "allow") throw new Error(`expected allow, got ${result.effect}`);
});

assert("evaluate respects priority (highest wins)", () => {
  const pe = peMod.createPolicyEvaluator();
  pe.addPolicy({ id: "allow-all", trigger: "risk_tier", effect: "allow", priority: 10 });
  pe.addPolicy({ id: "deny-high", trigger: "risk_tier", effect: "deny", priority: 100 });
  const result = pe.evaluate({ type: "risk_tier", operation: "deploy" });
  if (result.effect !== "deny") throw new Error("highest priority should win");
  if (result.matchedPolicy !== "deny-high") throw new Error("wrong policy");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
