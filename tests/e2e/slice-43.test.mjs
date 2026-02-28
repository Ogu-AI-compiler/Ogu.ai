/**
 * Slice 43 — Model Routing Config + Decision Log + Contract Generator
 *
 * Model routing policies (.ogu/model-config.json), decision logging,
 * and automated contract documentation generation.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice43-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/agents"), { recursive: true });
mkdirSync(join(tmp, "docs/vault/02_Contracts"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");
writeFileSync(join(tmp, ".ogu/OrgSpec.json"), JSON.stringify({
  company: "TestCo",
  roles: [
    { id: "developer", name: "Developer", capabilities: ["code", "test"], modelPolicy: { default: "claude-sonnet" } },
    { id: "reviewer", name: "Reviewer", capabilities: ["review", "approve"], modelPolicy: { default: "claude-opus" } },
  ],
  providers: [
    { id: "anthropic", name: "Anthropic", models: ["claude-sonnet", "claude-opus"], apiKeyEnv: "ANTHROPIC_API_KEY" },
    { id: "openai", name: "OpenAI", models: ["gpt-4o"], apiKeyEnv: "OPENAI_API_KEY" },
  ],
  budget: { dailyLimit: 100, monthlyLimit: 2000 },
  governance: { policies: [] },
}, null, 2));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 43 — Model Routing Config + Contract Generator\x1b[0m\n");
console.log("  Routing policies, decision log, contract docs\n");

// ── Part 1: Model Routing Config ──────────────────────────────

console.log("\x1b[36m  Part 1: Model Routing Config\x1b[0m");

const routeLib = join(process.cwd(), "tools/ogu/commands/lib/model-routing-config.mjs");
assert("model-routing-config.mjs exists", () => {
  if (!existsSync(routeLib)) throw new Error("file missing");
});

const routeMod = await import(routeLib);

assert("ROUTING_STRATEGIES has defined strategies", () => {
  if (!routeMod.ROUTING_STRATEGIES) throw new Error("missing");
  if (!routeMod.ROUTING_STRATEGIES["cost-optimized"]) throw new Error("no cost-optimized");
  if (!routeMod.ROUTING_STRATEGIES["quality-first"]) throw new Error("no quality-first");
  if (!routeMod.ROUTING_STRATEGIES["balanced"]) throw new Error("no balanced");
});

assert("createRoutingConfig creates config file", () => {
  if (typeof routeMod.createRoutingConfig !== "function") throw new Error("missing");
  const config = routeMod.createRoutingConfig({
    root: tmp,
    strategy: "balanced",
  });
  if (!config.strategy) throw new Error("no strategy");
  if (!existsSync(join(tmp, ".ogu/model-config.json"))) throw new Error("config file not created");
});

assert("loadRoutingConfig reads config", () => {
  if (typeof routeMod.loadRoutingConfig !== "function") throw new Error("missing");
  const config = routeMod.loadRoutingConfig({ root: tmp });
  if (config.strategy !== "balanced") throw new Error("wrong strategy");
});

assert("logDecision appends to decision log", () => {
  if (typeof routeMod.logDecision !== "function") throw new Error("missing");
  routeMod.logDecision({
    root: tmp,
    taskId: "t1",
    roleId: "developer",
    selectedModel: "claude-sonnet",
    reason: "cost-optimized for code task",
    alternatives: ["claude-opus", "gpt-4o"],
  });
  const logPath = join(tmp, ".ogu/model-log.jsonl");
  if (!existsSync(logPath)) throw new Error("log file not created");
  const lines = readFileSync(logPath, "utf8").trim().split("\n");
  if (lines.length < 1) throw new Error("no log entries");
  const entry = JSON.parse(lines[0]);
  if (entry.selectedModel !== "claude-sonnet") throw new Error("wrong model");
});

assert("logDecision appends multiple entries", () => {
  routeMod.logDecision({
    root: tmp,
    taskId: "t2",
    roleId: "reviewer",
    selectedModel: "claude-opus",
    reason: "quality-first for review",
    alternatives: ["claude-sonnet"],
  });
  const logPath = join(tmp, ".ogu/model-log.jsonl");
  const lines = readFileSync(logPath, "utf8").trim().split("\n");
  if (lines.length < 2) throw new Error("expected at least 2 entries");
});

assert("getDecisionStats computes routing statistics", () => {
  if (typeof routeMod.getDecisionStats !== "function") throw new Error("missing");
  const stats = routeMod.getDecisionStats({ root: tmp });
  if (!stats.totalDecisions) throw new Error("no totalDecisions");
  if (!stats.modelCounts) throw new Error("no modelCounts");
  if (stats.totalDecisions < 2) throw new Error("expected at least 2 decisions");
});

// ── Part 2: Contract Generator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Contract Documentation Generator\x1b[0m");

const contractLib = join(process.cwd(), "tools/ogu/commands/lib/contract-generator.mjs");
assert("contract-generator.mjs exists", () => {
  if (!existsSync(contractLib)) throw new Error("file missing");
});

const contractMod = await import(contractLib);

assert("generateContract creates a .contract.md file", () => {
  if (typeof contractMod.generateContract !== "function") throw new Error("missing");
  const result = contractMod.generateContract({
    root: tmp,
    name: "Budget",
    invariants: [
      "Daily spending MUST NOT exceed dailyLimit",
      "All transactions MUST be append-only JSONL",
    ],
    interfaces: [
      { name: "budget:status", type: "cli", description: "Show current budget state" },
      { name: "budget:check", type: "cli", description: "Check if operation is within budget" },
    ],
    dataFiles: [".ogu/budget/budget-state.json", ".ogu/budget/transactions.jsonl"],
  });
  if (!result.path) throw new Error("no path");
  if (!existsSync(result.path)) throw new Error("file not created");
  const content = readFileSync(result.path, "utf8");
  if (!content.includes("Budget")) throw new Error("missing name");
  if (!content.includes("dailyLimit")) throw new Error("missing invariant");
});

assert("generateContract creates OrgSpec contract", () => {
  const result = contractMod.generateContract({
    root: tmp,
    name: "OrgSpec",
    invariants: [
      "OrgSpec.json MUST validate against Zod schema",
      "Every role MUST have a unique id",
    ],
    interfaces: [
      { name: "org:init", type: "cli", description: "Initialize OrgSpec" },
      { name: "org:show", type: "cli", description: "Show current OrgSpec" },
      { name: "org:validate", type: "cli", description: "Validate OrgSpec" },
    ],
    dataFiles: [".ogu/OrgSpec.json"],
  });
  if (!existsSync(result.path)) throw new Error("file not created");
});

assert("listContracts returns all generated contracts", () => {
  if (typeof contractMod.listContracts !== "function") throw new Error("missing");
  const contracts = contractMod.listContracts({ root: tmp });
  if (contracts.length < 2) throw new Error(`expected at least 2, got ${contracts.length}`);
});

assert("contract content has required sections", () => {
  const path = join(tmp, "docs/vault/02_Contracts/Budget.contract.md");
  const content = readFileSync(path, "utf8");
  if (!content.includes("# Contract:")) throw new Error("missing title");
  if (!content.includes("## Invariants")) throw new Error("missing invariants section");
  if (!content.includes("## Interfaces")) throw new Error("missing interfaces section");
  if (!content.includes("## Data Files")) throw new Error("missing data files section");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
