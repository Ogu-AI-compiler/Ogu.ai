/**
 * Slice 34 — ErrorEnvelope + Model CLI (Fix 1 + Model Router extension)
 *
 * ErrorEnvelope: structured error format for Kadima ↔ Ogu contract.
 * Model CLI: model:route, model:status, model:providers commands.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice34-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({ currentFeature: "env-test", phase: "build" }));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

const orgSpec = {
  version: "1.0.0",
  org: { name: "EnvCo" },
  roles: [
    { id: "developer", name: "Developer", department: "engineering", enabled: true, capabilities: ["code"], riskTier: "standard", maxTokensPerTask: 8000, sandbox: { allowNetwork: false, allowShell: false } },
  ],
  providers: [
    { id: "anthropic", type: "anthropic", models: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"], tiers: { opus: "critical", sonnet: "standard", haiku: "low" } },
  ],
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

console.log("\n\x1b[1mSlice 34 — ErrorEnvelope + Model CLI (Fix 1 + Model ext)\x1b[0m\n");
console.log("  Structured error format, model routing CLI\n");

// ── Part 1: Error Envelope ──────────────────────────────

console.log("\x1b[36m  Part 1: Error Envelope\x1b[0m");

const envLib = join(process.cwd(), "tools/ogu/commands/lib/error-envelope.mjs");
assert("error-envelope.mjs exists", () => {
  if (!existsSync(envLib)) throw new Error("file missing");
});

const envMod = await import(envLib);

assert("createErrorEnvelope produces structured error", () => {
  if (typeof envMod.createErrorEnvelope !== "function") throw new Error("missing");
  const env = envMod.createErrorEnvelope({
    code: "OGU0601",
    message: "Budget exceeded",
    source: "budget-tracker",
    severity: "error",
    taskId: "t1",
    featureSlug: "env-test",
  });
  if (!env.id) throw new Error("no id");
  if (env.code !== "OGU0601") throw new Error("wrong code");
  if (!env.timestamp) throw new Error("no timestamp");
  if (env.severity !== "error") throw new Error("wrong severity");
});

assert("createEscalation creates escalation record", () => {
  if (typeof envMod.createEscalation !== "function") throw new Error("missing");
  const esc = envMod.createEscalation({
    errorEnvelope: { id: "err-1", code: "OGU0601" },
    from: "developer",
    to: "architect",
    reason: "budget limit reached",
  });
  if (!esc.id) throw new Error("no id");
  if (esc.from !== "developer") throw new Error("wrong from");
  if (esc.to !== "architect") throw new Error("wrong to");
  if (esc.status !== "pending") throw new Error("wrong status");
});

assert("isRecoverable classifies error codes", () => {
  if (typeof envMod.isRecoverable !== "function") throw new Error("missing");
  // Transient errors should be recoverable
  if (!envMod.isRecoverable("OGU0606")) throw new Error("transient should be recoverable");
  // Permission errors should not be recoverable
  if (envMod.isRecoverable("OGU0603")) throw new Error("permission should not be recoverable");
});

assert("serializeEnvelope produces JSON-safe output", () => {
  if (typeof envMod.serializeEnvelope !== "function") throw new Error("missing");
  const env = envMod.createErrorEnvelope({
    code: "OGU0604",
    message: "Validation failed",
    source: "gates",
  });
  const json = envMod.serializeEnvelope(env);
  const parsed = JSON.parse(json);
  if (parsed.code !== "OGU0604") throw new Error("deserialization failed");
});

// ── Part 2: Model CLI ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Model CLI\x1b[0m");

assert("model:providers lists available providers", () => {
  const out = ogu("model:providers");
  if (!out.includes("anthropic")) throw new Error(`missing anthropic: ${out}`);
});

assert("model:providers --json returns structured data", () => {
  const out = ogu("model:providers", ["--json"]);
  const data = JSON.parse(out);
  if (!Array.isArray(data)) throw new Error("not array");
  if (data.length < 1) throw new Error("empty");
  if (data[0].id !== "anthropic") throw new Error("wrong provider");
});

assert("model:status shows router status", () => {
  const out = ogu("model:status");
  if (!out.includes("Model") && !out.includes("model") && !out.includes("Router") && !out.includes("router")) throw new Error(`unexpected: ${out}`);
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
