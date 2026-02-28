/**
 * Slice 146 — Prompt Builder + Context Window Manager
 *
 * Prompt Builder: construct LLM prompts from structured parts.
 * Context Window Manager: track and manage context window budget.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 146 — Prompt Builder + Context Window Manager\x1b[0m\n");

// ── Part 1: Prompt Builder ──────────────────────────────

console.log("\x1b[36m  Part 1: Prompt Builder\x1b[0m");

const pbLib = join(process.cwd(), "tools/ogu/commands/lib/prompt-builder.mjs");
assert("prompt-builder.mjs exists", () => {
  if (!existsSync(pbLib)) throw new Error("file missing");
});

const pbMod = await import(pbLib);

assert("createPromptBuilder returns builder", () => {
  if (typeof pbMod.createPromptBuilder !== "function") throw new Error("missing");
  const builder = pbMod.createPromptBuilder();
  if (typeof builder.addSystem !== "function") throw new Error("missing addSystem");
  if (typeof builder.addUser !== "function") throw new Error("missing addUser");
  if (typeof builder.build !== "function") throw new Error("missing build");
});

assert("build creates messages array", () => {
  const builder = pbMod.createPromptBuilder();
  builder.addSystem("You are a code reviewer.");
  builder.addUser("Review this code: function foo() {}");
  const messages = builder.build();
  if (messages.length !== 2) throw new Error(`expected 2 messages, got ${messages.length}`);
  if (messages[0].role !== "system") throw new Error("first should be system");
  if (messages[1].role !== "user") throw new Error("second should be user");
});

assert("addContext inserts context before user message", () => {
  const builder = pbMod.createPromptBuilder();
  builder.addSystem("You are helpful.");
  builder.addContext("File content: const x = 1;");
  builder.addUser("What does x equal?");
  const messages = builder.build();
  if (messages.length !== 3) throw new Error(`expected 3, got ${messages.length}`);
});

assert("estimateTokens returns token count", () => {
  const builder = pbMod.createPromptBuilder();
  builder.addSystem("short");
  builder.addUser("also short");
  const tokens = builder.estimateTokens();
  if (typeof tokens !== "number") throw new Error("should return number");
  if (tokens <= 0) throw new Error("should be positive");
});

// ── Part 2: Context Window Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Context Window Manager\x1b[0m");

const cwmLib = join(process.cwd(), "tools/ogu/commands/lib/context-window-manager.mjs");
assert("context-window-manager.mjs exists", () => {
  if (!existsSync(cwmLib)) throw new Error("file missing");
});

const cwmMod = await import(cwmLib);

assert("createContextWindowManager returns manager", () => {
  if (typeof cwmMod.createContextWindowManager !== "function") throw new Error("missing");
  const mgr = cwmMod.createContextWindowManager({ maxTokens: 100000 });
  if (typeof mgr.allocate !== "function") throw new Error("missing allocate");
  if (typeof mgr.getRemaining !== "function") throw new Error("missing getRemaining");
});

assert("allocate reduces remaining tokens", () => {
  const mgr = cwmMod.createContextWindowManager({ maxTokens: 10000 });
  mgr.allocate("system", 2000);
  mgr.allocate("context", 3000);
  if (mgr.getRemaining() !== 5000) throw new Error(`expected 5000, got ${mgr.getRemaining()}`);
});

assert("allocate rejects when over budget", () => {
  const mgr = cwmMod.createContextWindowManager({ maxTokens: 5000 });
  mgr.allocate("system", 3000);
  const result = mgr.allocate("context", 3000);
  if (result.success) throw new Error("should reject over-budget allocation");
});

assert("release frees tokens", () => {
  const mgr = cwmMod.createContextWindowManager({ maxTokens: 10000 });
  mgr.allocate("context", 5000);
  mgr.release("context");
  if (mgr.getRemaining() !== 10000) throw new Error("should restore after release");
});

assert("getBreakdown shows per-section usage", () => {
  const mgr = cwmMod.createContextWindowManager({ maxTokens: 10000 });
  mgr.allocate("system", 1000);
  mgr.allocate("files", 4000);
  const breakdown = mgr.getBreakdown();
  if (breakdown.system !== 1000) throw new Error("wrong system allocation");
  if (breakdown.files !== 4000) throw new Error("wrong files allocation");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
