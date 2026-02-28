/**
 * Slice 26 — Execution Snapshots + Capability Registry (Fix 3 + Fix 6)
 *
 * Execution Snapshots: capture/restore full execution state.
 * Capability Registry: role → capability → model routing chain.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice26-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

// Minimal .ogu scaffold
mkdirSync(join(tmp, ".ogu/state/features"), { recursive: true });
mkdirSync(join(tmp, ".ogu/snapshots"), { recursive: true });
mkdirSync(join(tmp, ".ogu/agents"), { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
mkdirSync(join(tmp, ".ogu/policies"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({
  currentFeature: "snap-test",
  phase: "build",
  gatesPassed: [1, 2, 3],
}));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context\nTest context");
writeFileSync(join(tmp, ".ogu/budget/budget-state.json"), JSON.stringify({
  daily: { limit: 50, costUsed: 12.5, tokenCount: 10000 },
  monthly: { limit: 500, costUsed: 100 },
  byFeature: { "snap-test": { cost: 12.5, tokens: 10000 } },
}));

// OrgSpec with capabilities
const orgSpec = {
  version: "1.0.0",
  org: { name: "SnapCo" },
  roles: [
    {
      id: "developer",
      name: "Developer",
      department: "engineering",
      enabled: true,
      capabilities: ["code", "test", "debug"],
      riskTier: "standard",
      maxTokensPerTask: 8000,
      sandbox: { allowNetwork: false, allowShell: false },
      escalationPath: "architect",
      modelPolicy: { default: "claude-sonnet-4-20250514", escalationChain: ["claude-opus-4-20250514"] },
    },
    {
      id: "architect",
      name: "Architect",
      department: "architecture",
      enabled: true,
      capabilities: ["design", "review", "code", "plan"],
      riskTier: "elevated",
      maxTokensPerTask: 16000,
      sandbox: { allowNetwork: false, allowShell: false },
      escalationPath: "tech-lead",
      modelPolicy: { default: "claude-opus-4-20250514", escalationChain: [] },
    },
    {
      id: "qa",
      name: "QA Engineer",
      department: "testing",
      enabled: true,
      capabilities: ["test", "verify", "review"],
      riskTier: "standard",
      maxTokensPerTask: 6000,
      sandbox: { allowNetwork: false, allowShell: false },
      escalationPath: "developer",
      modelPolicy: { default: "claude-haiku-4-5-20251001", escalationChain: ["claude-sonnet-4-20250514"] },
    },
  ],
  providers: [
    { id: "anthropic", type: "anthropic", models: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"] },
  ],
  budget: { dailyLimit: 50, monthlyLimit: 500 },
  governance: { requireApproval: [] },
};
writeFileSync(join(tmp, ".ogu/OrgSpec.json"), JSON.stringify(orgSpec, null, 2));

// Feature state
writeFileSync(join(tmp, ".ogu/state/features/snap-test.json"), JSON.stringify({
  slug: "snap-test",
  phase: "build",
  createdAt: new Date().toISOString(),
}));

// Audit trail
const auditEvents = [
  { id: "ev1", type: "task.started", timestamp: new Date().toISOString(), severity: "info" },
  { id: "ev2", type: "task.completed", timestamp: new Date().toISOString(), severity: "info" },
];
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), auditEvents.map(e => JSON.stringify(e)).join("\n") + "\n");

// Git init for repoRoot
execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

const CLI = join(process.cwd(), "tools/ogu/cli.mjs");
const ogu = (cmd, args = []) =>
  execFileSync("node", [CLI, cmd, ...args], {
    cwd: tmp,
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env, HOME: tmp },
  });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 26 — Execution Snapshots + Capability Registry (Fix 3 + Fix 6)\x1b[0m\n");
console.log("  Execution state capture/restore, role→capability→model chain\n");

// ── Part 1: Execution Snapshot Library ──────────────────────────────

console.log("\x1b[36m  Part 1: Execution Snapshot Library\x1b[0m");

const snapshotLib = join(process.cwd(), "tools/ogu/commands/lib/execution-snapshot.mjs");
assert("execution-snapshot.mjs exports core functions", () => {
  if (!existsSync(snapshotLib)) throw new Error("file missing");
});

const snapshotMod = await import(snapshotLib);
assert("captureSnapshot creates a snapshot of current state", () => {
  if (typeof snapshotMod.captureSnapshot !== "function") throw new Error("captureSnapshot missing");
  if (typeof snapshotMod.loadSnapshot !== "function") throw new Error("loadSnapshot missing");
  if (typeof snapshotMod.listSnapshots !== "function") throw new Error("listSnapshots missing");
});

assert("captureSnapshot includes all state components", () => {
  const snap = snapshotMod.captureSnapshot({ root: tmp, label: "pre-build" });
  if (!snap.id) throw new Error("no id");
  if (!snap.timestamp) throw new Error("no timestamp");
  if (snap.label !== "pre-build") throw new Error("wrong label");
  if (!snap.state) throw new Error("no state component");
  if (!snap.budget) throw new Error("no budget component");
  if (!snap.features) throw new Error("no features component");
  if (typeof snap.hash !== "string") throw new Error("no hash");
});

assert("snapshot is saved to .ogu/snapshots/", () => {
  const snap = snapshotMod.captureSnapshot({ root: tmp, label: "test-save" });
  const snapFile = join(tmp, `.ogu/snapshots/${snap.id}.json`);
  if (!existsSync(snapFile)) throw new Error("snapshot file not saved");
  const loaded = JSON.parse(readFileSync(snapFile, "utf8"));
  if (loaded.id !== snap.id) throw new Error("loaded id mismatch");
});

assert("loadSnapshot retrieves saved snapshot", () => {
  const snaps = snapshotMod.listSnapshots({ root: tmp });
  if (snaps.length < 1) throw new Error("no snapshots found");
  const loaded = snapshotMod.loadSnapshot({ root: tmp, snapshotId: snaps[0].id });
  if (!loaded.state) throw new Error("loaded snapshot missing state");
});

assert("listSnapshots returns all snapshots sorted by time", () => {
  const list = snapshotMod.listSnapshots({ root: tmp });
  if (list.length < 2) throw new Error(`expected at least 2, got ${list.length}`);
  // Should be sorted newest first
  if (new Date(list[0].timestamp) < new Date(list[1].timestamp)) throw new Error("not sorted newest first");
});

// ── Part 2: Snapshot CLI ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Snapshot CLI\x1b[0m");

assert("snapshot:create captures state via CLI", () => {
  const out = ogu("snapshot:create", ["--label", "cli-test"]);
  if (!out.includes("Snapshot created")) throw new Error(`unexpected: ${out}`);
});

assert("snapshot:list shows snapshots via CLI", () => {
  const out = ogu("snapshot:list");
  if (!out.includes("cli-test")) throw new Error(`missing label: ${out}`);
});

assert("snapshot:list --json returns structured data", () => {
  const out = ogu("snapshot:list", ["--json"]);
  const data = JSON.parse(out);
  if (!Array.isArray(data)) throw new Error("not array");
  if (data.length < 1) throw new Error("empty");
  if (!data[0].id) throw new Error("no id in json");
});

// ── Part 3: Capability Registry Library ──────────────────────────────

console.log("\n\x1b[36m  Part 3: Capability Registry Library\x1b[0m");

const capLib = join(process.cwd(), "tools/ogu/commands/lib/capability-registry.mjs");
assert("capability-registry.mjs exports core functions", () => {
  if (!existsSync(capLib)) throw new Error("file missing");
});

const capMod = await import(capLib);
assert("resolveChain returns role → model for a capability", () => {
  if (typeof capMod.resolveChain !== "function") throw new Error("resolveChain missing");
  const chain = capMod.resolveChain({ capability: "code", root: tmp });
  if (!chain.roleId) throw new Error("no roleId");
  if (!chain.model) throw new Error("no model");
  if (!chain.capability) throw new Error("no capability");
});

assert("resolveChain picks lowest risk role for standard capability", () => {
  const chain = capMod.resolveChain({ capability: "code", root: tmp });
  // developer has "code" and is standard risk — should be preferred over architect
  if (chain.roleId !== "developer") throw new Error(`expected developer, got ${chain.roleId}`);
});

assert("resolveChain picks architect for design capability", () => {
  const chain = capMod.resolveChain({ capability: "design", root: tmp });
  if (chain.roleId !== "architect") throw new Error(`expected architect, got ${chain.roleId}`);
});

assert("resolveChain with riskTier override picks elevated role", () => {
  const chain = capMod.resolveChain({ capability: "code", riskTier: "elevated", root: tmp });
  if (chain.roleId !== "architect") throw new Error(`expected architect, got ${chain.roleId}`);
});

assert("listCapabilities returns all unique capabilities", () => {
  if (typeof capMod.listCapabilities !== "function") throw new Error("listCapabilities missing");
  const caps = capMod.listCapabilities({ root: tmp });
  if (!Array.isArray(caps)) throw new Error("not array");
  // Should have multiple capabilities
  if (caps.length < 5) throw new Error(`expected at least 5 caps, got ${caps.length}`);
  // listCapabilities returns objects with id field or plain strings
  const capIds = caps.map(c => typeof c === 'string' ? c : c.id);
  if (!capIds.some(id => id.includes("code"))) throw new Error("missing code");
  if (!capIds.some(id => id.includes("design"))) throw new Error("missing design");
});

assert("getEscalationChain returns model escalation for a role", () => {
  if (typeof capMod.getEscalationChain !== "function") throw new Error("getEscalationChain missing");
  const chain = capMod.getEscalationChain({ roleId: "developer", root: tmp });
  if (!chain.defaultModel) throw new Error("no defaultModel");
  if (!Array.isArray(chain.escalation)) throw new Error("escalation not array");
});

// ── Part 4: Capability CLI ──────────────────────────────

console.log("\n\x1b[36m  Part 4: Capability CLI\x1b[0m");

assert("capability:resolve shows chain for a capability", () => {
  const out = ogu("capability:resolve", ["--capability", "code"]);
  if (!out.includes("developer")) throw new Error(`missing developer: ${out}`);
});

assert("capability:list shows all capabilities", () => {
  const out = ogu("capability:list");
  if (!out.includes("code")) throw new Error(`missing code: ${out}`);
  if (!out.includes("design")) throw new Error(`missing design: ${out}`);
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
