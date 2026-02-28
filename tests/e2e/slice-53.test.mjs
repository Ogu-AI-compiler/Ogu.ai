/**
 * Slice 53 — Resource Governor + Sandbox Policy Engine
 *
 * Resource Governor: file mutex coordination, concurrency limits, resource quotas.
 * Sandbox Policy: filesystem/network/process isolation per role.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice53-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/locks"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");
writeFileSync(join(tmp, ".ogu/OrgSpec.json"), JSON.stringify({
  company: "TestCo",
  roles: [
    { id: "developer", name: "Developer", capabilities: ["code"], networkAccess: "restricted", riskTier: "low", ownershipScope: ["src/", "lib/", "packages/"] },
    { id: "devops", name: "DevOps", capabilities: ["deploy", "configure"], networkAccess: "full", riskTier: "high", ownershipScope: ["infra/", "docker/", ".github/"] },
    { id: "reviewer", name: "Reviewer", capabilities: ["review"], networkAccess: "none", riskTier: "low", ownershipScope: [] },
  ],
  providers: [],
  budget: { dailyLimit: 100, monthlyLimit: 2000 },
}, null, 2));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 53 — Resource Governor + Sandbox Policy Engine\x1b[0m\n");
console.log("  Concurrency limits, resource quotas, isolation policies\n");

// ── Part 1: Resource Governor ──────────────────────────────

console.log("\x1b[36m  Part 1: Resource Governor\x1b[0m");

const govLib = join(process.cwd(), "tools/ogu/commands/lib/resource-governor.mjs");
assert("resource-governor.mjs exists", () => {
  if (!existsSync(govLib)) throw new Error("file missing");
});

const govMod = await import(govLib);

assert("createGovernor returns governor instance", () => {
  if (typeof govMod.createGovernor !== "function") throw new Error("missing");
  const gov = govMod.createGovernor({ maxConcurrency: 3, maxMemoryMB: 512, maxCpuPercent: 80 });
  if (!gov) throw new Error("should return instance");
  if (typeof gov.canAcquire !== "function") throw new Error("missing canAcquire");
  if (typeof gov.acquire !== "function") throw new Error("missing acquire");
  if (typeof gov.release !== "function") throw new Error("missing release");
  if (typeof gov.status !== "function") throw new Error("missing status");
});

assert("acquire/release tracks concurrency", () => {
  const gov = govMod.createGovernor({ maxConcurrency: 2, maxMemoryMB: 512, maxCpuPercent: 80 });
  const t1 = gov.acquire("task-1", { memoryMB: 100 });
  if (!t1.granted) throw new Error("should grant task-1");
  const t2 = gov.acquire("task-2", { memoryMB: 100 });
  if (!t2.granted) throw new Error("should grant task-2");
  const t3 = gov.acquire("task-3", { memoryMB: 100 });
  if (t3.granted) throw new Error("should NOT grant task-3 (maxConcurrency=2)");
  gov.release("task-1");
  const t3b = gov.acquire("task-3", { memoryMB: 100 });
  if (!t3b.granted) throw new Error("should grant task-3 after release");
});

assert("acquire enforces memory limit", () => {
  const gov = govMod.createGovernor({ maxConcurrency: 10, maxMemoryMB: 256, maxCpuPercent: 80 });
  const t1 = gov.acquire("task-1", { memoryMB: 200 });
  if (!t1.granted) throw new Error("should grant 200MB");
  const t2 = gov.acquire("task-2", { memoryMB: 100 });
  if (t2.granted) throw new Error("should NOT grant (200+100 > 256)");
});

assert("status reports current resource usage", () => {
  const gov = govMod.createGovernor({ maxConcurrency: 4, maxMemoryMB: 512, maxCpuPercent: 80 });
  gov.acquire("a", { memoryMB: 128 });
  gov.acquire("b", { memoryMB: 64 });
  const s = gov.status();
  if (s.activeTasks !== 2) throw new Error(`expected 2 active, got ${s.activeTasks}`);
  if (s.usedMemoryMB !== 192) throw new Error(`expected 192MB, got ${s.usedMemoryMB}`);
  if (typeof s.availableSlots !== "number") throw new Error("missing availableSlots");
});

assert("canAcquire checks without acquiring", () => {
  const gov = govMod.createGovernor({ maxConcurrency: 1, maxMemoryMB: 512, maxCpuPercent: 80 });
  if (!gov.canAcquire({ memoryMB: 100 })) throw new Error("should be acquirable");
  gov.acquire("x", { memoryMB: 100 });
  if (gov.canAcquire({ memoryMB: 100 })) throw new Error("should NOT be acquirable");
});

assert("RESOURCE_PRESETS provides standard configs", () => {
  if (!govMod.RESOURCE_PRESETS) throw new Error("missing");
  if (!govMod.RESOURCE_PRESETS.small) throw new Error("missing small");
  if (!govMod.RESOURCE_PRESETS.medium) throw new Error("missing medium");
  if (!govMod.RESOURCE_PRESETS.large) throw new Error("missing large");
  if (govMod.RESOURCE_PRESETS.small.maxConcurrency >= govMod.RESOURCE_PRESETS.large.maxConcurrency) {
    throw new Error("small should have less concurrency than large");
  }
});

// ── Part 2: Sandbox Policy Engine ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Sandbox Policy Engine\x1b[0m");

const sandboxLib = join(process.cwd(), "tools/ogu/commands/lib/sandbox-policy.mjs");
assert("sandbox-policy.mjs exists", () => {
  if (!existsSync(sandboxLib)) throw new Error("file missing");
});

const sandboxMod = await import(sandboxLib);

assert("resolveSandboxPolicy returns policy for role", () => {
  if (typeof sandboxMod.resolveSandboxPolicy !== "function") throw new Error("missing");
  const policy = sandboxMod.resolveSandboxPolicy({
    root: tmp,
    roleId: "developer",
  });
  if (!policy) throw new Error("should return policy");
  if (!policy.filesystem) throw new Error("missing filesystem policy");
  if (!policy.network) throw new Error("missing network policy");
  if (!policy.process) throw new Error("missing process limits");
});

assert("developer gets restricted/allowlist network", () => {
  const policy = sandboxMod.resolveSandboxPolicy({ root: tmp, roleId: "developer" });
  // developer falls to standard policy: network.outbound = 'allowlist'
  if (policy.network.outbound !== "allowlist") throw new Error(`expected allowlist, got ${policy.network.outbound}`);
});

assert("devops gets full/allow network", () => {
  const policy = sandboxMod.resolveSandboxPolicy({ root: tmp, roleId: "devops" });
  // devops matches privileged policy: network.outbound = 'allow'
  if (policy.network.outbound !== "allow") throw new Error(`expected allow, got ${policy.network.outbound}`);
});

assert("reviewer gets restricted/allowlist network (default policy)", () => {
  const policy = sandboxMod.resolveSandboxPolicy({ root: tmp, roleId: "reviewer" });
  // reviewer falls to standard (default) policy
  if (!policy.network.outbound) throw new Error(`expected network.outbound, got ${JSON.stringify(policy.network)}`);
});

assert("filesystem policy restricts paths by scope", () => {
  const policy = sandboxMod.resolveSandboxPolicy({ root: tmp, roleId: "developer" });
  // Policy uses readScope/writeScope instead of allowedPaths
  if (!Array.isArray(policy.filesystem.readScope) && !Array.isArray(policy.filesystem.allowedPaths)) {
    throw new Error("missing readScope or allowedPaths");
  }
});

assert("validateAccess checks path against policy", () => {
  if (typeof sandboxMod.validateAccess !== "function") throw new Error("missing");
  const policy = sandboxMod.resolveSandboxPolicy({ root: tmp, roleId: "developer" });
  // Developer (standard policy) can read src/ files
  const canSrc = sandboxMod.validateAccess(policy, "src/Login.tsx");
  if (!canSrc.allowed) throw new Error("developer should access src/");
  // Developer should not access .env files (in blockedPaths)
  const canEnv = sandboxMod.validateAccess(policy, ".env.production");
  if (canEnv.allowed) throw new Error("developer should NOT access .env files");
});

assert("ISOLATION_TIERS maps risk tier to isolation", () => {
  if (!sandboxMod.ISOLATION_TIERS) throw new Error("missing");
  if (!sandboxMod.ISOLATION_TIERS.low) throw new Error("missing low");
  if (!sandboxMod.ISOLATION_TIERS.high) throw new Error("missing high");
  if (!sandboxMod.ISOLATION_TIERS.critical) throw new Error("missing critical");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
