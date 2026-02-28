/**
 * Slice 62 — Prompt Builder + Cost Estimator
 *
 * Prompt builder: construct structured prompts from templates + context.
 * Cost estimator: estimate token costs before LLM calls.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice62-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
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

console.log("\n\x1b[1mSlice 62 — Prompt Builder + Cost Estimator\x1b[0m\n");
console.log("  Structured prompts, token cost estimation\n");

// ── Part 1: Prompt Builder ──────────────────────────────

console.log("\x1b[36m  Part 1: Prompt Builder\x1b[0m");

const promptLib = join(process.cwd(), "tools/ogu/commands/lib/prompt-builder.mjs");
assert("prompt-builder.mjs exists", () => {
  if (!existsSync(promptLib)) throw new Error("file missing");
});

const promptMod = await import(promptLib);

assert("buildPrompt creates structured prompt", () => {
  if (typeof promptMod.buildPrompt !== "function") throw new Error("missing");
  const prompt = promptMod.buildPrompt({
    system: "You are a code reviewer.",
    task: "Review this function",
    context: "Function: doStuff() { return 42; }",
    constraints: ["Be concise", "Focus on correctness"],
  });
  if (typeof prompt !== "object") throw new Error("should return object");
  if (!prompt.system) throw new Error("missing system");
  if (!prompt.messages || !Array.isArray(prompt.messages)) throw new Error("missing messages array");
});

assert("buildPrompt includes all sections", () => {
  const prompt = promptMod.buildPrompt({
    system: "System prompt",
    task: "Do the task",
    context: "Context here",
    constraints: ["Rule 1"],
    examples: ["Example 1"],
  });
  const userMsg = prompt.messages.find(m => m.role === "user");
  if (!userMsg) throw new Error("should have user message");
  if (!userMsg.content.includes("Do the task")) throw new Error("should include task");
  if (!userMsg.content.includes("Context here")) throw new Error("should include context");
});

assert("estimateTokens returns approximate count", () => {
  if (typeof promptMod.estimateTokens !== "function") throw new Error("missing");
  const count = promptMod.estimateTokens("Hello world, this is a test.");
  if (typeof count !== "number") throw new Error("should return number");
  if (count < 4) throw new Error("should be at least 4 tokens");
  if (count > 20) throw new Error("should be reasonable");
});

assert("buildPrompt respects maxTokens budget", () => {
  const prompt = promptMod.buildPrompt({
    system: "Short system",
    task: "A".repeat(10000),
    maxTokens: 100,
  });
  // Should truncate or warn
  if (typeof prompt.estimatedTokens !== "number") throw new Error("should estimate tokens");
  if (prompt.truncated === undefined) throw new Error("should indicate if truncated");
});

assert("PROMPT_TEMPLATES provides built-in templates", () => {
  if (!promptMod.PROMPT_TEMPLATES) throw new Error("missing");
  if (!promptMod.PROMPT_TEMPLATES.codeReview) throw new Error("missing codeReview");
  if (!promptMod.PROMPT_TEMPLATES.codeGeneration) throw new Error("missing codeGeneration");
});

// ── Part 2: Cost Estimator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Cost Estimator\x1b[0m");

const costLib = join(process.cwd(), "tools/ogu/commands/lib/cost-estimator.mjs");
assert("cost-estimator.mjs exists", () => {
  if (!existsSync(costLib)) throw new Error("file missing");
});

const costMod = await import(costLib);

assert("estimateCost computes cost from tokens and model", () => {
  if (typeof costMod.estimateCost !== "function") throw new Error("missing");
  const cost = costMod.estimateCost({ inputTokens: 1000, outputTokens: 500, model: "claude-sonnet" });
  if (typeof cost.totalCost !== "number") throw new Error("missing totalCost");
  if (cost.totalCost <= 0) throw new Error("cost should be positive");
  if (typeof cost.inputCost !== "number") throw new Error("missing inputCost");
  if (typeof cost.outputCost !== "number") throw new Error("missing outputCost");
});

assert("estimateCost varies by model", () => {
  const sonnet = costMod.estimateCost({ inputTokens: 1000, outputTokens: 500, model: "claude-sonnet" });
  const opus = costMod.estimateCost({ inputTokens: 1000, outputTokens: 500, model: "claude-opus" });
  if (opus.totalCost <= sonnet.totalCost) throw new Error("opus should cost more than sonnet");
});

assert("MODEL_PRICING has pricing for all models", () => {
  if (!costMod.MODEL_PRICING) throw new Error("missing");
  if (!costMod.MODEL_PRICING["claude-sonnet"]) throw new Error("missing claude-sonnet");
  if (!costMod.MODEL_PRICING["claude-opus"]) throw new Error("missing claude-opus");
  if (!costMod.MODEL_PRICING["claude-haiku"]) throw new Error("missing claude-haiku");
});

assert("estimateTaskCost estimates full task cost", () => {
  if (typeof costMod.estimateTaskCost !== "function") throw new Error("missing");
  const est = costMod.estimateTaskCost({
    taskDescription: "Implement login form with validation",
    model: "claude-sonnet",
  });
  if (typeof est.estimatedInputTokens !== "number") throw new Error("missing estimatedInputTokens");
  if (typeof est.estimatedOutputTokens !== "number") throw new Error("missing estimatedOutputTokens");
  if (typeof est.estimatedCost !== "number") throw new Error("missing estimatedCost");
});

assert("formatCost returns human-readable string", () => {
  if (typeof costMod.formatCost !== "function") throw new Error("missing");
  const str = costMod.formatCost(0.0345);
  if (typeof str !== "string") throw new Error("should return string");
  if (!str.includes("$")) throw new Error("should include $ sign");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
