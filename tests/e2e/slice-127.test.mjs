/**
 * Slice 127 — Token Counter + Cost Calculator
 *
 * Token counter: estimate token counts for text.
 * Cost calculator: calculate LLM costs from token usage and model pricing.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 127 — Token Counter + Cost Calculator\x1b[0m\n");

// ── Part 1: Token Counter ──────────────────────────────

console.log("\x1b[36m  Part 1: Token Counter\x1b[0m");

const tcLib = join(process.cwd(), "tools/ogu/commands/lib/token-counter.mjs");
assert("token-counter.mjs exists", () => {
  if (!existsSync(tcLib)) throw new Error("file missing");
});

const tcMod = await import(tcLib);

assert("estimateTokens returns count", () => {
  if (typeof tcMod.estimateTokens !== "function") throw new Error("missing");
  const count = tcMod.estimateTokens("Hello world, this is a test sentence.");
  if (typeof count !== "number") throw new Error("should return number");
  if (count < 5) throw new Error("too few tokens");
  if (count > 20) throw new Error("too many tokens");
});

assert("estimateTokens handles empty string", () => {
  if (tcMod.estimateTokens("") !== 0) throw new Error("empty string should be 0");
});

assert("estimateTokens handles code", () => {
  const code = `function hello() { console.log("Hello"); return true; }`;
  const count = tcMod.estimateTokens(code);
  if (count < 8) throw new Error("code should have more tokens");
});

assert("countMessages estimates message array tokens", () => {
  if (typeof tcMod.countMessages !== "function") throw new Error("missing");
  const count = tcMod.countMessages([
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there, how can I help?" },
  ]);
  if (count < 5) throw new Error("too few");
});

// ── Part 2: Cost Calculator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Cost Calculator\x1b[0m");

const ccLib = join(process.cwd(), "tools/ogu/commands/lib/cost-calculator.mjs");
assert("cost-calculator.mjs exists", () => {
  if (!existsSync(ccLib)) throw new Error("file missing");
});

const ccMod = await import(ccLib);

assert("calculateCost computes cost from tokens and model", () => {
  if (typeof ccMod.calculateCost !== "function") throw new Error("missing");
  const cost = ccMod.calculateCost({ model: "sonnet", tokensIn: 1000, tokensOut: 500 });
  if (typeof cost !== "number") throw new Error("should return number");
  if (cost <= 0) throw new Error("cost should be positive");
});

assert("calculateCost uses correct pricing per model", () => {
  const haikuCost = ccMod.calculateCost({ model: "haiku", tokensIn: 1000, tokensOut: 500 });
  const opusCost = ccMod.calculateCost({ model: "opus", tokensIn: 1000, tokensOut: 500 });
  if (haikuCost >= opusCost) throw new Error("haiku should be cheaper than opus");
});

assert("MODEL_PRICING exported", () => {
  if (!ccMod.MODEL_PRICING) throw new Error("missing");
  if (!ccMod.MODEL_PRICING.haiku) throw new Error("missing haiku pricing");
  if (!ccMod.MODEL_PRICING.sonnet) throw new Error("missing sonnet pricing");
  if (!ccMod.MODEL_PRICING.opus) throw new Error("missing opus pricing");
});

assert("estimateTaskCost estimates cost for a task description", () => {
  if (typeof ccMod.estimateTaskCost !== "function") throw new Error("missing");
  const estimate = ccMod.estimateTaskCost({
    model: "sonnet",
    promptLength: 2000,
    expectedOutputLength: 1000,
  });
  if (typeof estimate.cost !== "number") throw new Error("missing cost");
  if (typeof estimate.tokensIn !== "number") throw new Error("missing tokensIn");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
