/**
 * Slice 28 — Agent Identity Runtime + Company Snapshot (P17 + P18)
 *
 * Agent Identity: session binding, capability validation at execution time.
 * Company Snapshot: full org state capture and comparison.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice28-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

// Minimal .ogu scaffold
mkdirSync(join(tmp, ".ogu/state/features"), { recursive: true });
mkdirSync(join(tmp, ".ogu/snapshots"), { recursive: true });
mkdirSync(join(tmp, ".ogu/agents"), { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
mkdirSync(join(tmp, ".ogu/policies"), { recursive: true });
mkdirSync(join(tmp, ".ogu/overrides"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({
  currentFeature: "identity-test",
  phase: "build",
}));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context\nIdentity test");
writeFileSync(join(tmp, ".ogu/budget/budget-state.json"), JSON.stringify({
  daily: { limit: 50, costUsed: 5, tokenCount: 5000 },
  monthly: { limit: 500, costUsed: 50 },
}));

const orgSpec = {
  version: "1.0.0",
  org: { name: "IdentityCo" },
  roles: [
    {
      id: "developer",
      name: "Developer",
      department: "engineering",
      enabled: true,
      capabilities: ["code", "test"],
      riskTier: "standard",
      maxTokensPerTask: 8000,
      sandbox: { allowNetwork: false, allowShell: false },
      escalationPath: "architect",
    },
    {
      id: "architect",
      name: "Architect",
      department: "architecture",
      enabled: true,
      capabilities: ["design", "review", "code"],
      riskTier: "elevated",
      maxTokensPerTask: 16000,
      sandbox: { allowNetwork: false, allowShell: false },
      escalationPath: "cto",
    },
  ],
  providers: [{ id: "anthropic", type: "anthropic", models: ["claude-sonnet-4-20250514"] }],
  budget: { dailyLimit: 50, monthlyLimit: 500 },
  governance: { requireApproval: [] },
};
writeFileSync(join(tmp, ".ogu/OrgSpec.json"), JSON.stringify(orgSpec, null, 2));

writeFileSync(join(tmp, ".ogu/state/features/identity-test.json"), JSON.stringify({
  slug: "identity-test",
  phase: "build",
  createdAt: new Date().toISOString(),
}));
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

// Policy rules
writeFileSync(join(tmp, ".ogu/policies/rules.json"), JSON.stringify({
  rules: [{ id: "r1", when: { action: "test" }, then: [{ effect: "ALLOW" }], enabled: true }],
}));

// Git init
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

console.log("\n\x1b[1mSlice 28 — Agent Identity Runtime + Company Snapshot (P17 + P18)\x1b[0m\n");
console.log("  Session binding, capability validation, full org state capture\n");

// ── Part 1: Agent Identity Runtime ──────────────────────────────

console.log("\x1b[36m  Part 1: Agent Identity Runtime\x1b[0m");

const identLib = join(process.cwd(), "tools/ogu/commands/lib/agent-identity.mjs");
assert("agent-identity.mjs exists", () => {
  if (!existsSync(identLib)) throw new Error("file missing");
});

const idMod = await import(identLib);

let devSession;
assert("createSession returns a valid session", () => {
  if (typeof idMod.createSession !== "function") throw new Error("missing");
  devSession = idMod.createSession({
    roleId: "developer",
    featureSlug: "identity-test",
    taskId: "task-1",
    root: tmp,
  });
  if (!devSession.sessionId) throw new Error("no sessionId");
  if (devSession.roleId !== "developer") throw new Error("wrong role");
  if (devSession.status !== "active") throw new Error("wrong status");
});

assert("validateCapability checks session role capabilities", () => {
  if (typeof idMod.validateCapability !== "function") throw new Error("missing");
  // Use the session created above (still active)
  const ok = idMod.validateCapability({ session: devSession, capability: "code", root: tmp });
  if (!ok.valid) throw new Error("code should be valid for developer");

  // developer does NOT have "design" capability
  const bad = idMod.validateCapability({ session: devSession, capability: "design", root: tmp });
  if (bad.valid) throw new Error("design should not be valid for developer");
});

assert("endSession marks session as completed", () => {
  if (typeof idMod.endSession !== "function") throw new Error("missing");
  const ended = idMod.endSession({ sessionId: devSession.sessionId, root: tmp });
  if (ended.status !== "completed") throw new Error("not completed");
  if (!ended.endedAt) throw new Error("no endedAt");
});

assert("getActiveSession returns current session for a role", () => {
  if (typeof idMod.getActiveSession !== "function") throw new Error("missing");
  const session = idMod.createSession({
    roleId: "architect",
    featureSlug: "identity-test",
    taskId: "task-4",
    root: tmp,
  });
  const active = idMod.getActiveSession({ roleId: "architect", root: tmp });
  if (!active) throw new Error("no active session");
  if (active.sessionId !== session.sessionId) throw new Error("wrong session");
});

assert("duplicate session for same role rejects", () => {
  let threw = false;
  try {
    // architect already has an active session from previous test
    idMod.createSession({
      roleId: "architect",
      featureSlug: "identity-test",
      taskId: "task-5",
      root: tmp,
    });
  } catch (e) {
    threw = true;
  }
  if (!threw) throw new Error("should reject duplicate session");
});

// ── Part 2: Company Snapshot ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Company Snapshot\x1b[0m");

const compSnapLib = join(process.cwd(), "tools/ogu/commands/lib/company-snapshot.mjs");
assert("company-snapshot.mjs exists", () => {
  if (!existsSync(compSnapLib)) throw new Error("file missing");
});

const csMod = await import(compSnapLib);

assert("captureCompanySnapshot captures full org state", () => {
  if (typeof csMod.captureCompanySnapshot !== "function") throw new Error("missing");
  const snap = csMod.captureCompanySnapshot({ root: tmp });
  if (!snap.id) throw new Error("no id");
  if (!snap.timestamp) throw new Error("no timestamp");
  if (!snap.orgSpec) throw new Error("no orgSpec");
  if (!snap.state) throw new Error("no state");
  if (typeof snap.budget === "undefined") throw new Error("no budget");
  if (typeof snap.hash === "undefined") throw new Error("no hash");
});

assert("company snapshot includes all components", () => {
  const snap = csMod.captureCompanySnapshot({ root: tmp, label: "full" });
  // orgSpec is wrapped: { hash, version, roles, teams, data }
  const orgData = snap.orgSpec.data || snap.orgSpec;
  if (orgData.org.name !== "IdentityCo") throw new Error("wrong org");
  if (!Array.isArray(snap.features)) throw new Error("no features");
  if (typeof snap.auditCount !== "number") throw new Error("no auditCount");
  if (typeof snap.overrideCount !== "number") throw new Error("no overrideCount");
});

assert("compareSnapshots detects differences", () => {
  if (typeof csMod.compareSnapshots !== "function") throw new Error("missing");
  const snap1 = csMod.captureCompanySnapshot({ root: tmp, label: "before" });

  // Change state
  writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({
    currentFeature: "identity-test",
    phase: "verify",
  }));
  writeFileSync(join(tmp, ".ogu/budget/budget-state.json"), JSON.stringify({
    daily: { limit: 50, costUsed: 25, tokenCount: 20000 },
    monthly: { limit: 500, costUsed: 100 },
  }));

  const snap2 = csMod.captureCompanySnapshot({ root: tmp, label: "after" });

  const diff = csMod.compareSnapshots(snap1, snap2);
  if (!diff.changed) throw new Error("should detect changes");
  if (diff.changes.length < 1) throw new Error("no changes listed");
});

// ── Part 3: Company Snapshot CLI ──────────────────────────────

console.log("\n\x1b[36m  Part 3: Company Snapshot CLI\x1b[0m");

assert("company:snapshot captures state via CLI", () => {
  const out = ogu("company:snapshot", ["--label", "cli-snap"]);
  if (!out.includes("snapshot") && !out.includes("Snapshot")) throw new Error(`unexpected: ${out}`);
});

assert("company:snapshot --json returns structured data", () => {
  const out = ogu("company:snapshot", ["--json"]);
  const data = JSON.parse(out);
  if (!data.id) throw new Error("no id");
  if (!data.orgSpec) throw new Error("no orgSpec");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
