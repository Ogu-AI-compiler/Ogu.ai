/**
 * Slice 27 — Override Handling + Feature Isolation (Fix 5 + P16)
 *
 * Override Handling: formal override records with authority validation.
 * Feature Isolation: worktree-per-feature, filesystem boundaries.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice27-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

// Minimal .ogu scaffold
mkdirSync(join(tmp, ".ogu/state/features"), { recursive: true });
mkdirSync(join(tmp, ".ogu/overrides"), { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/agents"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
mkdirSync(join(tmp, ".ogu/policies"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({
  currentFeature: "override-test",
  phase: "build",
}));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context\nOverride test");

const orgSpec = {
  version: "1.0.0",
  org: { name: "OverrideCo" },
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
      escalationPath: "tech-lead",
    },
    {
      id: "tech-lead",
      name: "Tech Lead",
      department: "engineering",
      enabled: true,
      capabilities: ["code", "review", "override"],
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

writeFileSync(join(tmp, ".ogu/state/features/override-test.json"), JSON.stringify({
  slug: "override-test",
  phase: "build",
  createdAt: new Date().toISOString(),
}));

writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

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

console.log("\n\x1b[1mSlice 27 — Override Handling + Feature Isolation (Fix 5 + P16)\x1b[0m\n");
console.log("  Override records with authority, feature filesystem isolation\n");

// ── Part 1: Override Library ──────────────────────────────

console.log("\x1b[36m  Part 1: Override Library\x1b[0m");

const overrideLib = join(process.cwd(), "tools/ogu/commands/lib/override-handler.mjs");
assert("override-handler.mjs exists", () => {
  if (!existsSync(overrideLib)) throw new Error("file missing");
});

const ovMod = await import(overrideLib);

assert("createOverride produces a valid override record", () => {
  if (typeof ovMod.createOverride !== "function") throw new Error("missing");
  const rec = ovMod.createOverride({
    root: tmp,
    target: "gate:3",
    reason: "hotfix needed",
    authority: "tech-lead",
    featureSlug: "override-test",
  });
  if (!rec.id) throw new Error("no id");
  if (rec.target !== "gate:3") throw new Error("wrong target");
  // authority can be a string or { role: "tech-lead" } object
  const authRole = typeof rec.authority === 'object' ? rec.authority.role : rec.authority;
  if (authRole !== "tech-lead") throw new Error("wrong authority");
  if (rec.status !== "active") throw new Error("wrong status");
});

assert("override is persisted to .ogu/overrides/", () => {
  const overrides = ovMod.listOverrides({ root: tmp });
  if (overrides.length < 1) throw new Error("not persisted");
});

assert("createOverride rejects unauthorized role", () => {
  // developer doesn't have "override" capability
  let threw = false;
  try {
    ovMod.createOverride({
      root: tmp,
      target: "gate:5",
      reason: "test",
      authority: "developer",
      featureSlug: "override-test",
    });
  } catch (e) {
    threw = true;
    if (!e.message.includes("not authorized") && !e.message.includes("unauthorized") && !e.message.includes("authority")) {
      throw new Error(`wrong error: ${e.message}`);
    }
  }
  if (!threw) throw new Error("should have rejected unauthorized");
});

assert("revokeOverride marks override as revoked", () => {
  if (typeof ovMod.revokeOverride !== "function") throw new Error("missing");
  const overrides = ovMod.listOverrides({ root: tmp });
  const revoked = ovMod.revokeOverride({ root: tmp, overrideId: overrides[0].id });
  if (revoked.status !== "revoked") throw new Error("not revoked");
});

assert("listOverrides supports --active filter", () => {
  // Create another active one
  ovMod.createOverride({
    root: tmp,
    target: "gate:7",
    reason: "urgent",
    authority: "tech-lead",
    featureSlug: "override-test",
  });
  const all = ovMod.listOverrides({ root: tmp });
  const active = ovMod.listOverrides({ root: tmp, status: "active" });
  if (active.length >= all.length) throw new Error("filter not working");
});

// ── Part 2: Override CLI ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Override CLI\x1b[0m");

assert("override:create creates override via CLI", () => {
  const out = ogu("override:create", ["--target", "gate:10", "--reason", "cli-test", "--authority", "tech-lead", "--feature", "override-test"]);
  if (!out.includes("Override created")) throw new Error(`unexpected: ${out}`);
});

assert("override:list shows overrides via CLI", () => {
  const out = ogu("override:list");
  if (!out.includes("gate:10")) throw new Error(`missing: ${out}`);
});

assert("override:list --json returns structured data", () => {
  const out = ogu("override:list", ["--json"]);
  const data = JSON.parse(out);
  if (!Array.isArray(data)) throw new Error("not array");
  if (data.length < 1) throw new Error("empty");
});

// ── Part 3: Feature Isolation Library ──────────────────────────────

console.log("\n\x1b[36m  Part 3: Feature Isolation Library\x1b[0m");

const isoLib = join(process.cwd(), "tools/ogu/commands/lib/feature-isolation.mjs");
assert("feature-isolation.mjs exists", () => {
  if (!existsSync(isoLib)) throw new Error("file missing");
});

const isoMod = await import(isoLib);

assert("computeIsolationBoundary returns boundary for a feature", () => {
  if (typeof isoMod.computeIsolationBoundary !== "function") throw new Error("missing");
  const boundary = isoMod.computeIsolationBoundary({
    featureSlug: "override-test",
    root: tmp,
  });
  if (!boundary.featureSlug) throw new Error("no slug");
  if (!Array.isArray(boundary.allowedPaths)) throw new Error("no allowedPaths");
  if (typeof boundary.isolationLevel !== "string") throw new Error("no isolationLevel");
});

assert("checkPathAccess validates file within boundary", () => {
  if (typeof isoMod.checkPathAccess !== "function") throw new Error("missing");
  const boundary = isoMod.computeIsolationBoundary({
    featureSlug: "override-test",
    root: tmp,
  });
  // Feature's own directory should be allowed
  const allowed = isoMod.checkPathAccess({
    path: "docs/vault/features/override-test/Spec.md",
    boundary,
  });
  if (!allowed.permitted) throw new Error("feature's own files should be allowed");
});

assert("checkPathAccess blocks cross-feature access", () => {
  const boundary = isoMod.computeIsolationBoundary({
    featureSlug: "override-test",
    root: tmp,
  });
  const result = isoMod.checkPathAccess({
    path: "docs/vault/features/other-feature/Spec.md",
    boundary,
  });
  if (result.permitted) throw new Error("cross-feature access should be blocked");
});

assert("checkPathAccess allows shared paths (src/, package.json)", () => {
  const boundary = isoMod.computeIsolationBoundary({
    featureSlug: "override-test",
    root: tmp,
  });
  const src = isoMod.checkPathAccess({ path: "src/components/Button.tsx", boundary });
  if (!src.permitted) throw new Error("src/ should be allowed");
  const pkg = isoMod.checkPathAccess({ path: "package.json", boundary });
  if (!pkg.permitted) throw new Error("package.json should be allowed");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
