/**
 * Slice 31 — Deterministic Mode + Company Freeze (P33 + P34)
 *
 * Deterministic Mode: flag + enforcement for reproducible execution.
 * Company Freeze: halt all agent activity, read-only mode.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice31-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/agents"), { recursive: true });
mkdirSync(join(tmp, ".ogu/state/features"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({ currentFeature: "det-test", phase: "build" }));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

const orgSpec = {
  version: "1.0.0",
  org: { name: "DetCo" },
  roles: [{ id: "developer", name: "Developer", department: "engineering", enabled: true, capabilities: ["code"], riskTier: "standard", maxTokensPerTask: 8000, sandbox: { allowNetwork: false, allowShell: false } }],
  providers: [{ id: "anthropic", type: "anthropic", models: ["claude-sonnet-4-20250514"] }],
  budget: { dailyLimit: 50, monthlyLimit: 500 },
  governance: { requireApproval: [] },
};
writeFileSync(join(tmp, ".ogu/OrgSpec.json"), JSON.stringify(orgSpec, null, 2));

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

console.log("\n\x1b[1mSlice 31 — Deterministic Mode + Company Freeze (P33 + P34)\x1b[0m\n");
console.log("  Reproducible execution, read-only freeze mode\n");

// ── Part 1: Deterministic Mode ──────────────────────────────

console.log("\x1b[36m  Part 1: Deterministic Mode\x1b[0m");

const detLib = join(process.cwd(), "tools/ogu/commands/lib/deterministic-mode.mjs");
assert("deterministic-mode.mjs exists", () => {
  if (!existsSync(detLib)) throw new Error("file missing");
});

const detMod = await import(detLib);

assert("enableDeterministic sets mode flag", () => {
  if (typeof detMod.enableDeterministic !== "function") throw new Error("missing");
  detMod.enableDeterministic({ root: tmp });
  const state = JSON.parse(readFileSync(join(tmp, ".ogu/STATE.json"), "utf8"));
  if (!state.deterministicMode) throw new Error("flag not set");
});

assert("isDeterministic reads mode from STATE", () => {
  if (typeof detMod.isDeterministic !== "function") throw new Error("missing");
  if (!detMod.isDeterministic({ root: tmp })) throw new Error("should be true");
});

assert("disableDeterministic clears the flag", () => {
  if (typeof detMod.disableDeterministic !== "function") throw new Error("missing");
  detMod.disableDeterministic({ root: tmp });
  if (detMod.isDeterministic({ root: tmp })) throw new Error("should be false");
});

assert("enforceDeterminism validates execution hash", () => {
  if (typeof detMod.enforceDeterminism !== "function") throw new Error("missing");
  detMod.enableDeterministic({ root: tmp, seed: 42 });
  const result = detMod.enforceDeterminism({
    root: tmp,
    executionHash: "abc123",
    expectedHash: "abc123",
  });
  if (!result.valid) throw new Error("should be valid");
});

assert("enforceDeterminism rejects mismatched hashes", () => {
  const result = detMod.enforceDeterminism({
    root: tmp,
    executionHash: "abc123",
    expectedHash: "xyz789",
  });
  if (result.valid) throw new Error("should be invalid");
  if (!result.reason) throw new Error("should have reason");
});

// ── Part 2: Company Freeze ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Company Freeze\x1b[0m");

const freezeLib = join(process.cwd(), "tools/ogu/commands/lib/company-freeze.mjs");
assert("company-freeze.mjs exists", () => {
  if (!existsSync(freezeLib)) throw new Error("file missing");
});

const freezeMod = await import(freezeLib);

assert("freeze sets org to frozen state", () => {
  if (typeof freezeMod.freeze !== "function") throw new Error("missing");
  freezeMod.freeze({ root: tmp, reason: "maintenance" });
  if (!freezeMod.isFrozen({ root: tmp })) throw new Error("should be frozen");
});

assert("isFrozen returns true when frozen", () => {
  if (typeof freezeMod.isFrozen !== "function") throw new Error("missing");
  if (!freezeMod.isFrozen({ root: tmp })) throw new Error("should be frozen");
});

assert("checkFreezeGuard rejects write operations when frozen", () => {
  if (typeof freezeMod.checkFreezeGuard !== "function") throw new Error("missing");
  const result = freezeMod.checkFreezeGuard({ root: tmp, operation: "write" });
  if (result.allowed) throw new Error("write should be blocked");
  if (!result.reason.includes("frozen")) throw new Error("wrong reason");
});

assert("checkFreezeGuard allows read operations when frozen", () => {
  const result = freezeMod.checkFreezeGuard({ root: tmp, operation: "read" });
  if (!result.allowed) throw new Error("read should be allowed");
});

assert("thaw unfreezes the org", () => {
  if (typeof freezeMod.thaw !== "function") throw new Error("missing");
  freezeMod.thaw({ root: tmp, actor: "test-admin" });
  if (freezeMod.isFrozen({ root: tmp })) throw new Error("should not be frozen");
});

assert("checkFreezeGuard allows writes when thawed", () => {
  const result = freezeMod.checkFreezeGuard({ root: tmp, operation: "write" });
  if (!result.allowed) throw new Error("write should be allowed after thaw");
});

// ── Part 3: CLI Commands ──────────────────────────────

console.log("\n\x1b[36m  Part 3: CLI Commands\x1b[0m");

assert("deterministic:enable via CLI", () => {
  // Disable first if still active from Part 1
  detMod.disableDeterministic({ root: tmp });
  const out = ogu("deterministic:enable");
  if (!out.includes("enabled") && !out.includes("Deterministic") && !out.includes("ACTIVATED")) throw new Error(`unexpected: ${out}`);
});

assert("deterministic:status via CLI", () => {
  const out = ogu("deterministic:status");
  if (!out.includes("enabled") && !out.includes("true") && !out.includes("ON")) throw new Error(`unexpected: ${out}`);
});

assert("freeze via CLI", () => {
  // Make sure it's not frozen from Part 2
  if (freezeMod.isFrozen({ root: tmp })) freezeMod.thaw({ root: tmp, actor: "cleanup" });
  const out = ogu("freeze", ["--reason", "test"]);
  if (!out.includes("frozen") && !out.includes("Frozen") && !out.includes("Freeze") && !out.includes("FROZEN")) throw new Error(`unexpected: ${out}`);
});

assert("thaw via CLI", () => {
  const out = ogu("thaw", ["--actor", "test-admin"]);
  if (!out.includes("thaw") && !out.includes("Thaw") && !out.includes("unfrozen") && !out.includes("UNFROZEN")) throw new Error(`unexpected: ${out}`);
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
