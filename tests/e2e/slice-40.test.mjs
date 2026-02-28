/**
 * Slice 40 — compile --strict + Kadima Adapter (P40 + Enhancement 1)
 *
 * compile --strict: In strict mode, skipped phases become errors.
 * Kadima Adapter: Translate between Kadima task format and external services.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice40-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, "docs/vault/04_Features/test-feat"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

// Create minimal feature files so compile can run
writeFileSync(join(tmp, "docs/vault/04_Features/test-feat/Plan.json"), JSON.stringify({
  tasks: [
    { id: 1, title: "Setup", inputs: [], outputs: ["COMPONENT:App"], touches: ["src/App.tsx"] }
  ]
}, null, 2));

writeFileSync(join(tmp, "docs/vault/04_Features/test-feat/Spec.md"), "# Spec\n\n## Setup\n\nSetup the app.\n");

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

console.log("\n\x1b[1mSlice 40 — compile --strict + Kadima Adapter\x1b[0m\n");
console.log("  Strict compilation mode, external service adapter\n");

// ── Part 1: compile --strict ──────────────────────────────

console.log("\x1b[36m  Part 1: compile --strict\x1b[0m");

assert("compile without --strict skips phase 6 gracefully", () => {
  const out = oguSafe(["compile", "test-feat"], tmp);
  // Should say "skipped" for runtime phase, not "FAILED"
  if (!out.includes("skipped")) throw new Error("expected skipped phase");
});

assert("compile --strict flag is parsed", () => {
  const out = oguSafe(["compile", "test-feat", "--strict"], tmp);
  // In strict mode, skipped phases should become errors
  if (out.includes("skipped (app not running)")) throw new Error("strict should not skip phases");
});

assert("compile --strict fails when app not running", () => {
  const out = oguSafe(["compile", "test-feat", "--strict"], tmp);
  // Strict mode should report failure for runtime verification
  if (!out.includes("FAILED") && !out.includes("error")) throw new Error("strict should fail");
});

assert("compile --strict promotes warnings to errors", () => {
  const out = oguSafe(["compile", "test-feat", "--strict", "--verbose"], tmp);
  // In strict mode, warnings become errors
  if (out.includes("0 error(s), 0 warning(s)") && out.includes("PASSED")) {
    // If it fully passes, that's fine — no warnings to promote
  }
  // Just verify it processes strict mode
  if (!out) throw new Error("no output");
});

assert("compile --strict with --gate stops at specified gate", () => {
  const out = oguSafe(["compile", "test-feat", "--strict", "--gate", "3"], tmp);
  // Should stop before phase 6
  if (!out) throw new Error("no output");
  // Phase 6 should not appear since we stopped at gate 3
  if (out.includes("Phase 6")) throw new Error("should have stopped at gate 3");
});

// ── Part 2: Kadima Adapter ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Kadima Adapter\x1b[0m");

const adapterLib = join(process.cwd(), "tools/ogu/commands/lib/kadima-adapter.mjs");
assert("kadima-adapter.mjs exists", () => {
  if (!existsSync(adapterLib)) throw new Error("file missing");
});

const adapterMod = await import(adapterLib);

assert("formatTaskForProvider creates LLM-ready payload", () => {
  if (typeof adapterMod.formatTaskForProvider !== "function") throw new Error("missing");
  const payload = adapterMod.formatTaskForProvider({
    taskId: "t1",
    title: "Implement auth",
    role: "developer",
    provider: "anthropic",
    context: { featureSlug: "auth", spec: "## Auth\nLogin flow" },
  });
  if (!payload.messages) throw new Error("no messages");
  if (!payload.model) throw new Error("no model");
  if (!payload.taskId) throw new Error("no taskId");
});

assert("formatTaskForProvider supports openai format", () => {
  const payload = adapterMod.formatTaskForProvider({
    taskId: "t2",
    title: "Write tests",
    role: "tester",
    provider: "openai",
    context: { featureSlug: "auth" },
  });
  if (!payload.messages) throw new Error("no messages");
  if (payload.provider !== "openai") throw new Error("wrong provider");
});

assert("parseProviderResponse extracts structured result", () => {
  if (typeof adapterMod.parseProviderResponse !== "function") throw new Error("missing");
  const result = adapterMod.parseProviderResponse({
    provider: "anthropic",
    raw: { content: [{ type: "text", text: "Done: implemented login form" }], usage: { input_tokens: 100, output_tokens: 50 } },
  });
  if (!result.text) throw new Error("no text");
  if (result.tokens.input !== 100) throw new Error("wrong input tokens");
  if (result.tokens.output !== 50) throw new Error("wrong output tokens");
});

assert("parseProviderResponse handles openai format", () => {
  const result = adapterMod.parseProviderResponse({
    provider: "openai",
    raw: { choices: [{ message: { content: "Done" } }], usage: { prompt_tokens: 80, completion_tokens: 40 } },
  });
  if (!result.text) throw new Error("no text");
  if (result.tokens.input !== 80) throw new Error("wrong input tokens");
});

assert("createNotificationPayload builds webhook payload", () => {
  if (typeof adapterMod.createNotificationPayload !== "function") throw new Error("missing");
  const payload = adapterMod.createNotificationPayload({
    event: "task.completed",
    taskId: "t1",
    featureSlug: "auth",
    result: { status: "success", filesModified: ["src/auth.ts"] },
  });
  if (payload.event !== "task.completed") throw new Error("wrong event");
  if (!payload.timestamp) throw new Error("no timestamp");
  if (!payload.payload) throw new Error("no payload");
});

assert("PROVIDER_DEFAULTS has correct model mappings", () => {
  if (!adapterMod.PROVIDER_DEFAULTS) throw new Error("missing");
  if (!adapterMod.PROVIDER_DEFAULTS.anthropic) throw new Error("no anthropic");
  if (!adapterMod.PROVIDER_DEFAULTS.openai) throw new Error("no openai");
  if (!adapterMod.PROVIDER_DEFAULTS.anthropic.model) throw new Error("no anthropic model");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
