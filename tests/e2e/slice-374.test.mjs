/**
 * Slice 374 — reflector.mjs
 * Tests: abstractCandidate strips identifying info, sanitize removes paths,
 *        buildContextSignature returns tags, findSimilarPattern detects duplicates.
 */

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}
async function assertAsync(label, fn) {
  try { await fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 374 — reflector\x1b[0m\n");

const mod = await import(join(process.cwd(), "tools/ogu/commands/lib/reflector.mjs"));
const { sanitize, buildContextSignature, abstractCandidate, processCandidates } = mod;

const patternMod = await import(join(process.cwd(), "tools/ogu/commands/lib/pattern-store.mjs"));
const { findSimilarPattern, savePattern } = patternMod;

function makeRoot() {
  const root = join(tmpdir(), `ogu-e2e-374-${randomUUID().slice(0,8)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

// sanitize tests
assert("sanitize removes file paths", () => {
  const result = sanitize("Error at /home/user/project/src/app.ts line 42");
  if (result.includes("/home/user/project/src/app.ts")) throw new Error(`path not removed: ${result}`);
});

assert("sanitize keeps non-path content", () => {
  const result = sanitize("Type error in authentication module");
  if (!result.includes("authentication")) throw new Error(`content lost: ${result}`);
});

assert("sanitize handles empty string", () => {
  const r = sanitize("");
  if (r !== "") throw new Error(`expected empty string, got: ${r}`);
});

// buildContextSignature tests
assert("buildContextSignature extracts framework tag", () => {
  const candidate = {
    context_signature: { framework: "react", runtime: "node" },
    task_type:         "build",
    trigger:           "gate_failure",
  };
  const tags = buildContextSignature(candidate);
  if (!tags.includes("framework:react")) throw new Error(`missing framework:react in: ${tags}`);
  if (!tags.includes("runtime:node"))    throw new Error(`missing runtime:node in: ${tags}`);
  if (!tags.includes("task_type:build")) throw new Error(`missing task_type:build in: ${tags}`);
});

assert("buildContextSignature includes trigger tag", () => {
  const tags = buildContextSignature({
    context_signature: {},
    task_type: "test",
    trigger: "excessive_iterations",
  });
  if (!tags.includes("trigger:excessive_iterations")) throw new Error(`missing trigger tag: ${tags}`);
});

// abstractCandidate tests
assert("abstractCandidate strips agent_id", () => {
  const candidate = {
    event_id:          "some-uuid",
    agent_id:          "agent_0001",
    task_type:         "code-gen",
    context_signature: { framework: "express" },
    failure_signals:   ["timeout"],
    resolution_summary: "Increased timeout",
    iteration_count:   2,
    trigger:           "excessive_iterations",
  };
  const pattern = abstractCandidate(candidate);
  if (pattern.agent_id) throw new Error("agent_id should not be in pattern");
  if (pattern.event_id) throw new Error("event_id should not be in pattern");
});

assert("abstractCandidate sets confidence=0.5", () => {
  const pattern = abstractCandidate({
    event_id: "x", agent_id: "a", task_type: "deploy",
    context_signature: {}, failure_signals: [], resolution_summary: "",
    iteration_count: 0, trigger: null,
  });
  if (pattern.confidence !== 0.5) throw new Error(`expected 0.5, got ${pattern.confidence}`);
});

assert("abstractCandidate sets success_count=0 and failure_count=0", () => {
  const pattern = abstractCandidate({
    event_id: "x2", agent_id: "a", task_type: "test",
    context_signature: {}, failure_signals: [], resolution_summary: "",
    iteration_count: 0, trigger: null,
  });
  if (pattern.success_count !== 0) throw new Error(`success_count=${pattern.success_count}`);
  if (pattern.failure_count !== 0) throw new Error(`failure_count=${pattern.failure_count}`);
});

assert("abstractCandidate sanitizes resolution_summary", () => {
  const pattern = abstractCandidate({
    event_id: "x3", agent_id: "a", task_type: "fix",
    context_signature: {},
    failure_signals: [],
    resolution_summary: "Fixed error in /home/user/project/src/index.ts",
    iteration_count: 1,
    trigger: "gate_failure",
  });
  if (pattern.resolution_summary.includes("/home/user/project")) {
    throw new Error("path not sanitized in resolution_summary");
  }
});

assert("abstractCandidate produces pattern_id", () => {
  const pattern = abstractCandidate({
    event_id: "x4", agent_id: "a", task_type: "review",
    context_signature: {}, failure_signals: [], resolution_summary: "",
    iteration_count: 0, trigger: null,
  });
  if (!pattern.pattern_id) throw new Error("missing pattern_id");
});

// findSimilarPattern tests
await assertAsync("findSimilarPattern returns null when no patterns exist", async () => {
  const root = makeRoot();
  const result = await findSimilarPattern(root, ["framework:react","task_type:build"]);
  if (result !== null) throw new Error(`expected null, got ${JSON.stringify(result)}`);
  rmSync(root, { recursive: true, force: true });
});

await assertAsync("findSimilarPattern detects duplicate with >0.8 similarity", async () => {
  const root = makeRoot();
  const pattern = {
    pattern_id:       randomUUID(),
    task_type:        "build",
    context_signature:["framework:react","task_type:build","runtime:node"],
    failure_signals:  [],
    resolution_summary: "fixed",
    confidence:       0.7,
    success_count:    0,
    failure_count:    0,
    active:           true,
    created_at:       new Date().toISOString(),
    last_used_at:     null,
  };
  savePattern(root, pattern);

  const similar = await findSimilarPattern(root, ["framework:react","task_type:build","runtime:node"]);
  if (!similar) throw new Error("should find similar pattern");
  if (similar.pattern_id !== pattern.pattern_id) throw new Error("wrong pattern returned");
  rmSync(root, { recursive: true, force: true });
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
