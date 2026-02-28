/**
 * Slice 54 — Policy AST Enhancement + Studio API Data Layer
 *
 * Policy AST: expanded condition operators, effect aggregation, complex rules.
 * Studio Data Layer: audit search, budget summary, agent listing backend functions.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice54-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
mkdirSync(join(tmp, ".ogu/policies"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");

// Seed audit events
const events = [
  { id: "e1", type: "gate.passed", feature: "auth", severity: "info", timestamp: "2026-02-27T10:00:00Z", message: "Gate 1 passed" },
  { id: "e2", type: "gate.failed", feature: "auth", severity: "warn", timestamp: "2026-02-27T11:00:00Z", message: "Gate 3 failed" },
  { id: "e3", type: "build.started", feature: "payments", severity: "info", timestamp: "2026-02-28T08:00:00Z", message: "Build started" },
  { id: "e4", type: "gate.passed", feature: "payments", severity: "info", timestamp: "2026-02-28T09:00:00Z", message: "Gate 1 passed" },
  { id: "e5", type: "error.runtime", feature: "auth", severity: "error", timestamp: "2026-02-28T10:00:00Z", message: "Runtime error" },
];
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), events.map(e => JSON.stringify(e)).join("\n") + "\n");

// Seed budget
writeFileSync(join(tmp, ".ogu/budget/budget-state.json"), JSON.stringify({
  dailyLimit: 100, monthlyLimit: 2000,
  dailySpent: 45.50, monthlySpent: 312.75,
  lastReset: "2026-02-28",
}, null, 2));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 54 — Policy AST Enhancement + Studio Data Layer\x1b[0m\n");
console.log("  Expanded policy operators, audit/budget/agent data\n");

// ── Part 1: Policy AST Enhancement ──────────────────────────────

console.log("\x1b[36m  Part 1: Policy AST Enhancement\x1b[0m");

const policyLib = join(process.cwd(), "tools/ogu/commands/lib/policy-ast.mjs");
assert("policy-ast.mjs exists", () => {
  if (!existsSync(policyLib)) throw new Error("file missing");
});

const policyMod = await import(policyLib);

assert("OPERATORS includes all required operators", () => {
  if (!policyMod.OPERATORS) throw new Error("missing");
  const required = ["eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in", "matches", "contains"];
  for (const op of required) {
    if (!policyMod.OPERATORS[op]) throw new Error(`missing operator: ${op}`);
  }
});

assert("evaluateCondition works with eq operator", () => {
  if (typeof policyMod.evaluateCondition !== "function") throw new Error("missing");
  const result = policyMod.evaluateCondition({ field: "role", op: "eq", value: "developer" }, { role: "developer" });
  if (result !== true) throw new Error("eq should match");
  const result2 = policyMod.evaluateCondition({ field: "role", op: "eq", value: "developer" }, { role: "architect" });
  if (result2 !== false) throw new Error("eq should not match");
});

assert("evaluateCondition works with gt/lt operators", () => {
  const gt = policyMod.evaluateCondition({ field: "risk", op: "gt", value: 5 }, { risk: 7 });
  if (gt !== true) throw new Error("7 > 5 should be true");
  const lt = policyMod.evaluateCondition({ field: "risk", op: "lt", value: 5 }, { risk: 3 });
  if (lt !== true) throw new Error("3 < 5 should be true");
});

assert("evaluateCondition works with in operator", () => {
  const result = policyMod.evaluateCondition(
    { field: "tier", op: "in", value: ["high", "critical"] },
    { tier: "high" }
  );
  if (result !== true) throw new Error("in should match");
});

assert("evaluateCondition works with contains operator", () => {
  const result = policyMod.evaluateCondition(
    { field: "capabilities", op: "contains", value: "deploy" },
    { capabilities: ["code", "deploy", "test"] }
  );
  if (result !== true) throw new Error("contains should match");
});

assert("evaluateRule handles AND/OR logic", () => {
  if (typeof policyMod.evaluateRule !== "function") throw new Error("missing");
  const rule = {
    logic: "and",
    conditions: [
      { field: "role", op: "eq", value: "developer" },
      { field: "risk", op: "lt", value: 5 },
    ],
  };
  const match = policyMod.evaluateRule(rule, { role: "developer", risk: 3 });
  if (!match) throw new Error("AND should match");
  const noMatch = policyMod.evaluateRule(rule, { role: "developer", risk: 7 });
  if (noMatch) throw new Error("AND should not match when risk > 5");

  const orRule = { logic: "or", conditions: [
    { field: "role", op: "eq", value: "cto" },
    { field: "role", op: "eq", value: "architect" },
  ]};
  if (!policyMod.evaluateRule(orRule, { role: "architect" })) throw new Error("OR should match");
  if (policyMod.evaluateRule(orRule, { role: "developer" })) throw new Error("OR should not match");
});

assert("EFFECTS includes standard effect types", () => {
  if (!policyMod.EFFECTS) throw new Error("missing");
  const required = ["permit", "deny", "audit_only", "escalate"];
  for (const e of required) {
    if (!policyMod.EFFECTS.includes(e)) throw new Error(`missing effect: ${e}`);
  }
});

assert("evaluatePolicy returns effect and matched rules", () => {
  if (typeof policyMod.evaluatePolicy !== "function") throw new Error("missing");
  const policy = {
    rules: [
      { id: "r1", logic: "and", conditions: [{ field: "role", op: "eq", value: "developer" }], effect: "permit" },
      { id: "r2", logic: "and", conditions: [{ field: "risk", op: "gt", value: 8 }], effect: "deny" },
    ],
    defaultEffect: "deny",
  };
  const result = policyMod.evaluatePolicy(policy, { role: "developer", risk: 3 });
  if (result.effect !== "permit") throw new Error(`expected permit, got ${result.effect}`);
  if (!result.matchedRules.includes("r1")) throw new Error("should include r1");
});

// ── Part 2: Studio Data Layer ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Studio Data Layer\x1b[0m");

const studioDataLib = join(process.cwd(), "tools/ogu/commands/lib/studio-data-layer.mjs");
assert("studio-data-layer.mjs exists", () => {
  if (!existsSync(studioDataLib)) throw new Error("file missing");
});

const studioMod = await import(studioDataLib);

assert("searchAudit filters by feature", () => {
  if (typeof studioMod.searchAudit !== "function") throw new Error("missing");
  const results = studioMod.searchAudit({ root: tmp, feature: "auth" });
  if (!Array.isArray(results)) throw new Error("should return array");
  if (results.length !== 3) throw new Error(`expected 3 auth events, got ${results.length}`);
});

assert("searchAudit filters by type", () => {
  const results = studioMod.searchAudit({ root: tmp, type: "gate.passed" });
  if (results.length !== 2) throw new Error(`expected 2 gate.passed, got ${results.length}`);
});

assert("searchAudit filters by severity", () => {
  const results = studioMod.searchAudit({ root: tmp, severity: "error" });
  if (results.length !== 1) throw new Error(`expected 1 error, got ${results.length}`);
});

assert("searchAudit supports limit", () => {
  const results = studioMod.searchAudit({ root: tmp, limit: 2 });
  if (results.length !== 2) throw new Error(`expected 2, got ${results.length}`);
});

assert("getBudgetSummary returns spending data", () => {
  if (typeof studioMod.getBudgetSummary !== "function") throw new Error("missing");
  const summary = studioMod.getBudgetSummary({ root: tmp });
  if (typeof summary.dailySpent !== "number") throw new Error("missing dailySpent");
  if (typeof summary.monthlySpent !== "number") throw new Error("missing monthlySpent");
  if (typeof summary.dailyLimit !== "number") throw new Error("missing dailyLimit");
  if (typeof summary.dailyPercent !== "number") throw new Error("missing dailyPercent");
  if (typeof summary.monthlyPercent !== "number") throw new Error("missing monthlyPercent");
});

assert("getBudgetSummary computes alert level", () => {
  const summary = studioMod.getBudgetSummary({ root: tmp });
  // 45.50/100 = 45.5% → "normal"
  if (!["normal", "warning", "critical"].includes(summary.alertLevel)) {
    throw new Error(`unexpected alertLevel: ${summary.alertLevel}`);
  }
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
