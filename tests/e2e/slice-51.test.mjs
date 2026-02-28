/**
 * Slice 51 — Generate 8 Formal Contracts + OrgSpec 10 Default Roles
 *
 * Contracts: Generate all 8 required .contract.md files.
 * OrgSpec: Provide 10 pre-built roles with full metadata.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice51-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, "docs/vault/02_Contracts"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

const ogu = join(process.cwd(), "tools/ogu/cli.mjs");
function oguSafe(args, cwd) {
  try {
    return execFileSync("node", [ogu, ...args], { cwd: cwd || tmp, encoding: "utf8", timeout: 15000 });
  } catch (e) {
    return e.stdout || e.stderr || e.message;
  }
}

console.log("\n\x1b[1mSlice 51 — Formal Contracts + OrgSpec Default Roles\x1b[0m\n");
console.log("  8 contracts, 10 pre-built roles\n");

// ── Part 1: Generate All 8 Contracts ──────────────────────────────

console.log("\x1b[36m  Part 1: Formal Contracts\x1b[0m");

const genLib = join(process.cwd(), "tools/ogu/commands/lib/contract-generator.mjs");
const genMod = await import(genLib);

const CONTRACTS = [
  {
    name: "OrgSpec",
    invariants: [
      "OrgSpec.json MUST validate against Zod schema",
      "Every role MUST have a unique id",
      "Every provider MUST have a unique id",
      "Budget limits MUST be positive numbers",
    ],
    interfaces: [
      { name: "org:init", type: "cli", description: "Initialize OrgSpec with default roles" },
      { name: "org:show", type: "cli", description: "Display current OrgSpec" },
      { name: "org:validate", type: "cli", description: "Validate OrgSpec against schema" },
    ],
    dataFiles: [".ogu/OrgSpec.json"],
  },
  {
    name: "Budget",
    invariants: [
      "Daily spending MUST NOT exceed dailyLimit",
      "Monthly spending MUST NOT exceed monthlyLimit",
      "All transactions MUST be append-only JSONL",
      "Budget state MUST be updated atomically",
    ],
    interfaces: [
      { name: "budget:status", type: "cli", description: "Show current budget state" },
      { name: "budget:check", type: "cli", description: "Check if operation is within budget" },
      { name: "budget:set", type: "cli", description: "Update daily/monthly limits" },
      { name: "budget:report", type: "cli", description: "Generate spending report" },
    ],
    dataFiles: [".ogu/budget/budget-state.json", ".ogu/budget/transactions.jsonl"],
  },
  {
    name: "Audit",
    invariants: [
      "Audit events are append-only and immutable",
      "Every event MUST have id, type, timestamp, severity",
      "Daily rotation MUST NOT lose events",
      "Replay chain MUST reconstruct consistent state",
    ],
    interfaces: [
      { name: "audit:show", type: "cli", description: "Show recent audit events" },
      { name: "audit:search", type: "cli", description: "Search audit by type, feature, date" },
      { name: "audit:export", type: "cli", description: "Export audit log to file" },
    ],
    dataFiles: [".ogu/audit/current.jsonl", ".ogu/audit/index.json"],
  },
  {
    name: "Governance",
    invariants: [
      "Policy rules MUST be evaluated before execution",
      "Approvals MUST have a unique id and status",
      "Denied actions MUST NOT proceed",
      "Override requires 'override' capability",
    ],
    interfaces: [
      { name: "governance:check", type: "cli", description: "Check action against policies" },
      { name: "approve", type: "cli", description: "Approve a pending governance request" },
      { name: "deny", type: "cli", description: "Deny a pending governance request" },
      { name: "governance:diff-check", type: "cli", description: "Check file diffs against policies" },
    ],
    dataFiles: [".ogu/policies/rules.json", ".ogu/approvals/"],
  },
  {
    name: "Kadima",
    invariants: [
      "Daemon MUST respond to /health within 3 seconds",
      "Task queue MUST be FIFO with priority override",
      "Graceful shutdown MUST drain queue before exit",
      "PID lock MUST prevent duplicate daemons",
    ],
    interfaces: [
      { name: "kadima:start", type: "cli", description: "Start Kadima daemon" },
      { name: "kadima:stop", type: "cli", description: "Stop Kadima daemon" },
      { name: "kadima:status", type: "cli", description: "Show daemon status" },
      { name: "kadima:enqueue", type: "cli", description: "Enqueue a task" },
    ],
    dataFiles: [".ogu/kadima/daemon.pid", ".ogu/kadima/state.json"],
  },
  {
    name: "Kadima_Ogu",
    invariants: [
      "InputEnvelope MUST contain taskId, roleId, featureSlug",
      "OutputEnvelope MUST contain status, artifacts, metrics",
      "ErrorEnvelope MUST contain code, severity, recoverable flag",
      "All communication MUST use typed envelopes",
    ],
    interfaces: [
      { name: "agent:run", type: "cli", description: "Execute agent task via envelope protocol" },
      { name: "compile:run", type: "cli", description: "Run task in compilation context" },
    ],
    dataFiles: [],
  },
  {
    name: "Override",
    invariants: [
      "Override MUST be created by an agent with 'override' capability",
      "Override MUST have an expiration time",
      "Override MUST be audited",
      "Revoked overrides MUST NOT grant access",
    ],
    interfaces: [
      { name: "override:create", type: "cli", description: "Create an override" },
      { name: "override:list", type: "cli", description: "List active overrides" },
      { name: "override:revoke", type: "cli", description: "Revoke an override" },
    ],
    dataFiles: [".ogu/overrides/"],
  },
  {
    name: "Sandbox",
    invariants: [
      "Agents MUST operate within their isolation level",
      "Filesystem access MUST respect feature boundaries",
      "Network access MUST match role networkAccess setting",
      "Process isolation MUST prevent cross-agent interference",
    ],
    interfaces: [
      { name: "isolation:resolve", type: "cli", description: "Resolve isolation level for a role" },
      { name: "isolation:levels", type: "cli", description: "List available isolation levels" },
    ],
    dataFiles: [],
  },
];

for (const c of CONTRACTS) {
  assert(`${c.name}.contract.md is generated`, () => {
    const result = genMod.generateContract({ root: tmp, ...c });
    if (!existsSync(result.path)) throw new Error("file not created");
    const content = readFileSync(result.path, "utf8");
    if (!content.includes("## Invariants")) throw new Error("missing invariants");
    if (!content.includes("## Interfaces")) throw new Error("missing interfaces");
  });
}

assert("all 8 contracts exist", () => {
  const contracts = genMod.listContracts({ root: tmp });
  if (contracts.length < 8) throw new Error(`expected 8, got ${contracts.length}`);
});

// ── Part 2: OrgSpec 10 Default Roles ──────────────────────────────

console.log("\n\x1b[36m  Part 2: OrgSpec Default Roles\x1b[0m");

const rolesLib = join(process.cwd(), "tools/ogu/commands/lib/default-roles.mjs");
assert("default-roles.mjs exists", () => {
  if (!existsSync(rolesLib)) throw new Error("file missing");
});

const rolesMod = await import(rolesLib);

assert("DEFAULT_ROLES has 10 roles", () => {
  if (!rolesMod.DEFAULT_ROLES) throw new Error("missing");
  if (rolesMod.DEFAULT_ROLES.length < 10) throw new Error(`expected 10, got ${rolesMod.DEFAULT_ROLES.length}`);
});

assert("each role has required fields", () => {
  for (const role of rolesMod.DEFAULT_ROLES) {
    if (!role.id) throw new Error(`role missing id`);
    if (!role.name) throw new Error(`${role.id} missing name`);
    if (!Array.isArray(role.capabilities)) throw new Error(`${role.id} missing capabilities`);
    if (!role.department) throw new Error(`${role.id} missing department`);
    if (!role.modelPolicy) throw new Error(`${role.id} missing modelPolicy`);
  }
});

assert("roles include expected types", () => {
  const ids = rolesMod.DEFAULT_ROLES.map(r => r.id);
  const required = ["developer", "architect", "reviewer", "tester", "designer", "pm"];
  for (const r of required) {
    if (!ids.includes(r)) throw new Error(`missing role: ${r}`);
  }
});

assert("each role has unique id", () => {
  const ids = rolesMod.DEFAULT_ROLES.map(r => r.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new Error("duplicate ids");
});

assert("roles have escalation paths", () => {
  const rolesWithEscalation = rolesMod.DEFAULT_ROLES.filter(r => r.escalationPath);
  if (rolesWithEscalation.length < 5) throw new Error("most roles should have escalation");
});

assert("applyDefaultRoles adds roles to OrgSpec", () => {
  if (typeof rolesMod.applyDefaultRoles !== "function") throw new Error("missing");
  writeFileSync(join(tmp, ".ogu/OrgSpec.json"), JSON.stringify({
    company: "TestCo",
    roles: [],
    providers: [{ id: "anthropic", name: "Anthropic", models: ["claude-sonnet"] }],
    budget: { dailyLimit: 100, monthlyLimit: 2000 },
  }, null, 2));
  const result = rolesMod.applyDefaultRoles({ root: tmp });
  if (result.added < 10) throw new Error(`expected at least 10 added, got ${result.added}`);
  const org = JSON.parse(readFileSync(join(tmp, ".ogu/OrgSpec.json"), "utf8"));
  if (org.roles.length < 10) throw new Error("roles not saved");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
