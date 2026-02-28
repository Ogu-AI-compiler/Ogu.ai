/**
 * Slice 36 — Policy AST + Budget Set + Session List (P14 adj + P3 ext + misc)
 *
 * Policy AST: extended operators (eq, gt, lt, in, matches_any).
 * Budget Set: change daily/monthly limits via CLI.
 * Session List: list agent sessions.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice36-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
mkdirSync(join(tmp, ".ogu/policies"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({ currentFeature: "ast-test", phase: "build" }));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");
writeFileSync(join(tmp, ".ogu/budget/budget-state.json"), JSON.stringify({
  daily: { limit: 50, costUsed: 10, tokenCount: 8000 },
  monthly: { limit: 500, costUsed: 80 },
}));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

const CLI = join(process.cwd(), "tools/ogu/cli.mjs");
const ogu = (cmd, args = []) =>
  execFileSync("node", [CLI, cmd, ...args], {
    cwd: tmp, encoding: "utf8", timeout: 15000,
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env, HOME: tmp },
  });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 36 — Policy AST + Budget Set (P14 adj + P3 ext)\x1b[0m\n");
console.log("  Extended policy operators, budget limit management\n");

// ── Part 1: Policy AST Extensions ──────────────────────────────

console.log("\x1b[36m  Part 1: Policy AST Extensions\x1b[0m");

const astLib = join(process.cwd(), "tools/ogu/commands/lib/policy-ast.mjs");
assert("policy-ast.mjs exists", () => {
  if (!existsSync(astLib)) throw new Error("file missing");
});

const astMod = await import(astLib);

assert("evaluateCondition supports eq operator", () => {
  if (typeof astMod.evaluateCondition !== "function") throw new Error("missing");
  const result = astMod.evaluateCondition(
    { field: "riskTier", op: "eq", value: "critical" },
    { riskTier: "critical" }
  );
  if (!result) throw new Error("eq should match");
});

assert("evaluateCondition supports gt/lt operators", () => {
  if (!astMod.evaluateCondition({ field: "cost", op: "gt", value: 10 }, { cost: 15 })) {
    throw new Error("gt should match 15 > 10");
  }
  if (!astMod.evaluateCondition({ field: "cost", op: "lt", value: 20 }, { cost: 15 })) {
    throw new Error("lt should match 15 < 20");
  }
  if (astMod.evaluateCondition({ field: "cost", op: "gt", value: 20 }, { cost: 15 })) {
    throw new Error("gt should not match 15 > 20");
  }
});

assert("evaluateCondition supports in operator", () => {
  const result = astMod.evaluateCondition(
    { field: "department", op: "in", value: ["engineering", "architecture"] },
    { department: "engineering" }
  );
  if (!result) throw new Error("in should match");
  const miss = astMod.evaluateCondition(
    { field: "department", op: "in", value: ["engineering", "architecture"] },
    { department: "security" }
  );
  if (miss) throw new Error("in should not match security");
});

assert("evaluateCondition supports matches_any operator", () => {
  const result = astMod.evaluateCondition(
    { field: "path", op: "matches_any", value: ["*.env*", "secrets/*"] },
    { path: ".env.local" }
  );
  if (!result) throw new Error("matches_any should match .env.local");
});

assert("evaluateRule combines conditions with AND/OR", () => {
  if (typeof astMod.evaluateRule !== "function") throw new Error("missing");
  const rule = {
    logic: "AND",
    conditions: [
      { field: "riskTier", op: "eq", value: "critical" },
      { field: "cost", op: "gt", value: 5 },
    ],
  };
  const match = astMod.evaluateRule(rule, { riskTier: "critical", cost: 10 });
  if (!match) throw new Error("AND should match when all true");
  const noMatch = astMod.evaluateRule(rule, { riskTier: "standard", cost: 10 });
  if (noMatch) throw new Error("AND should not match when one false");
});

assert("evaluateRule OR logic matches any condition", () => {
  const rule = {
    logic: "OR",
    conditions: [
      { field: "riskTier", op: "eq", value: "critical" },
      { field: "cost", op: "gt", value: 100 },
    ],
  };
  const match = astMod.evaluateRule(rule, { riskTier: "critical", cost: 1 });
  if (!match) throw new Error("OR should match when one is true");
});

// ── Part 2: Budget Set CLI ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Budget Set CLI\x1b[0m");

assert("budget:set changes daily limit", () => {
  const out = ogu("budget:set", ["--daily", "75"]);
  if (!out.includes("75") && !out.includes("updated") && !out.includes("set")) throw new Error(`unexpected: ${out}`);
  const budget = JSON.parse(readFileSync(join(tmp, ".ogu/budget/budget-state.json"), "utf8"));
  if (budget.daily.limit !== 75) throw new Error(`expected 75, got ${budget.daily.limit}`);
});

assert("budget:set changes monthly limit", () => {
  const out = ogu("budget:set", ["--monthly", "800"]);
  const budget = JSON.parse(readFileSync(join(tmp, ".ogu/budget/budget-state.json"), "utf8"));
  if (budget.monthly.limit !== 800) throw new Error(`expected 800, got ${budget.monthly.limit}`);
});

assert("budget:set with both daily and monthly", () => {
  ogu("budget:set", ["--daily", "100", "--monthly", "1000"]);
  const budget = JSON.parse(readFileSync(join(tmp, ".ogu/budget/budget-state.json"), "utf8"));
  if (budget.daily.limit !== 100) throw new Error(`daily: expected 100, got ${budget.daily.limit}`);
  if (budget.monthly.limit !== 1000) throw new Error(`monthly: expected 1000, got ${budget.monthly.limit}`);
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
