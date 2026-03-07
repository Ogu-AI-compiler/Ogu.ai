/**
 * Slice 375 — pattern-store.mjs
 * Tests: savePattern + loadPattern, searchPatterns returns top 3 by confidence,
 *        recordOutcome updates confidence, deactivation below 0.2, injectIntoPrompt format.
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

console.log("\n\x1b[1mSlice 375 — pattern-store\x1b[0m\n");

const mod = await import(join(process.cwd(), "tools/ogu/commands/lib/pattern-store.mjs"));
const { savePattern, loadPattern, listPatterns, searchPatterns, recordOutcome, mergePattern, pruneDecayed, injectIntoPrompt } = mod;

function makeRoot() {
  const root = join(tmpdir(), `ogu-e2e-375-${randomUUID().slice(0,8)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function makePattern(overrides = {}) {
  return {
    pattern_id:        randomUUID(),
    task_type:         "code-gen",
    context_signature: ["framework:react","runtime:node"],
    failure_signals:   [],
    resolution_summary:"Use async/await",
    trigger:           null,
    confidence:        0.5,
    success_count:     0,
    failure_count:     0,
    active:            true,
    created_at:        new Date().toISOString(),
    last_used_at:      null,
    ...overrides,
  };
}

const root = makeRoot();

assert("savePattern writes file", () => {
  const p = makePattern();
  const saved = savePattern(root, p);
  if (saved.pattern_id !== p.pattern_id) throw new Error("pattern_id mismatch");
});

assert("loadPattern reads back pattern", () => {
  const p = makePattern({ task_type: "deploy" });
  savePattern(root, p);
  const loaded = loadPattern(root, p.pattern_id);
  if (!loaded) throw new Error("loadPattern returned null");
  if (loaded.task_type !== "deploy") throw new Error(`wrong task_type: ${loaded.task_type}`);
});

assert("loadPattern returns null for unknown id", () => {
  const r = loadPattern(root, "fake-id");
  if (r !== null) throw new Error("expected null");
});

assert("listPatterns returns all saved patterns", () => {
  const root2 = makeRoot();
  savePattern(root2, makePattern());
  savePattern(root2, makePattern());
  savePattern(root2, makePattern());
  const all = listPatterns(root2);
  if (all.length !== 3) throw new Error(`expected 3, got ${all.length}`);
  rmSync(root2, { recursive: true, force: true });
});

assert("searchPatterns returns top 3 by confidence", () => {
  const root3 = makeRoot();
  // Add 5 patterns with different confidences
  for (let i = 0; i < 5; i++) {
    savePattern(root3, makePattern({ confidence: i * 0.1 + 0.3 }));
  }
  const results = searchPatterns(root3, {}, 3);
  if (results.length !== 3) throw new Error(`expected 3, got ${results.length}`);
  // Top result should have higher confidence than last
  if (results[0].confidence < results[results.length - 1].confidence) {
    throw new Error("not sorted by confidence descending");
  }
  rmSync(root3, { recursive: true, force: true });
});

assert("searchPatterns boosts matching taskType", () => {
  const root4 = makeRoot();
  // Both at same base confidence — taskType boost should break tie
  savePattern(root4, makePattern({ task_type: "build", confidence: 0.5 }));
  savePattern(root4, makePattern({ task_type: "test",  confidence: 0.5 }));
  // "build" should come first with taskType filter (gets +0.2 boost)
  const results = searchPatterns(root4, { taskType: "build" }, 3);
  if (results[0].task_type !== "build") throw new Error(`expected build first, got ${results[0].task_type}`);
  rmSync(root4, { recursive: true, force: true });
});

assert("recordOutcome success increases confidence", () => {
  const root5 = makeRoot();
  // success_count=5, failure_count=0 → formula gives 5/(5+0+1)=0.833
  // stored at 0.5; after success: 6/(6+0+1)=0.857 → increases above 0.5
  const p = makePattern({ confidence: 0.5, success_count: 5, failure_count: 0 });
  savePattern(root5, p);
  const updated = recordOutcome(root5, p.pattern_id, true);
  if (updated.confidence <= 0.5) throw new Error(`confidence did not increase: ${updated.confidence}`);
  if (updated.success_count !== 6) throw new Error(`expected 6, got ${updated.success_count}`);
  rmSync(root5, { recursive: true, force: true });
});

assert("recordOutcome failure decreases confidence", () => {
  const root6 = makeRoot();
  const p = makePattern({ confidence: 0.8, success_count: 5, failure_count: 0 });
  savePattern(root6, p);
  const updated = recordOutcome(root6, p.pattern_id, false);
  if (updated.confidence >= 0.8) throw new Error(`confidence did not decrease: ${updated.confidence}`);
  rmSync(root6, { recursive: true, force: true });
});

assert("recordOutcome deactivates pattern when confidence < 0.2", () => {
  const root7 = makeRoot();
  // Start with mostly failures
  const p = makePattern({ confidence: 0.25, success_count: 0, failure_count: 4 });
  savePattern(root7, p);
  const updated = recordOutcome(root7, p.pattern_id, false);
  if (updated.active !== false) throw new Error(`expected inactive, still active=${updated.active}`);
  rmSync(root7, { recursive: true, force: true });
});

assert("recordOutcome throws for unknown pattern", () => {
  let threw = false;
  try { recordOutcome(root, "fake-pattern-id", true); }
  catch { threw = true; }
  if (!threw) throw new Error("should throw");
});

assert("mergePattern merges context signature tags", () => {
  const root8 = makeRoot();
  const p = makePattern({ context_signature: ["framework:react"] });
  savePattern(root8, p);
  const merged = mergePattern(root8, p.pattern_id, { context_signature: ["framework:react", "runtime:node"] });
  if (!merged.context_signature.includes("runtime:node")) throw new Error("merge failed");
  rmSync(root8, { recursive: true, force: true });
});

assert("injectIntoPrompt returns formatted string", () => {
  const patterns = [
    makePattern({ task_type: "build", resolution_summary: "Use incremental builds" }),
    makePattern({ task_type: "test",  resolution_summary: "Add integration tests" }),
  ];
  const prompt = injectIntoPrompt(patterns);
  if (!prompt.includes("## Learned Patterns")) throw new Error("missing section header");
  if (!prompt.includes("build"))             throw new Error("missing task type");
  if (!prompt.includes("Use incremental"))   throw new Error("missing resolution");
});

assert("injectIntoPrompt returns empty string for empty array", () => {
  const r = injectIntoPrompt([]);
  if (r !== "") throw new Error(`expected empty string, got: ${r}`);
});

assert("pruneDecayed deactivates old patterns", () => {
  const root9 = makeRoot();
  // Pattern created 100 days ago
  const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
  const p = makePattern({ created_at: oldDate, last_used_at: null });
  savePattern(root9, p);
  const count = pruneDecayed(root9, 90);
  if (count !== 1) throw new Error(`expected 1 pruned, got ${count}`);
  rmSync(root9, { recursive: true, force: true });
});

rmSync(root, { recursive: true, force: true });

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
