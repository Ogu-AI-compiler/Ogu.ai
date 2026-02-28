/**
 * Slice 83 — Memory Fabric + AST Merge
 *
 * Memory fabric: knowledge graph with pattern indexing and context queries.
 * AST merge: AST-aware code merging for parallel agents.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 83 — Memory Fabric + AST Merge\x1b[0m\n");

// ── Part 1: Memory Fabric ──────────────────────────────

console.log("\x1b[36m  Part 1: Memory Fabric\x1b[0m");

const mfLib = join(process.cwd(), "tools/ogu/commands/lib/memory-fabric.mjs");
assert("memory-fabric.mjs exists", () => {
  if (!existsSync(mfLib)) throw new Error("file missing");
});

const mfMod = await import(mfLib);

assert("createMemoryFabric returns fabric", () => {
  if (typeof mfMod.createMemoryFabric !== "function") throw new Error("missing");
  const fabric = mfMod.createMemoryFabric();
  if (typeof fabric.indexPattern !== "function") throw new Error("missing indexPattern");
  if (typeof fabric.query !== "function") throw new Error("missing query");
  if (typeof fabric.getPatterns !== "function") throw new Error("missing getPatterns");
});

assert("indexPattern stores pattern with tags", () => {
  const fabric = mfMod.createMemoryFabric();
  fabric.indexPattern({
    name: "auth-jwt",
    description: "JWT authentication pattern",
    tags: ["auth", "security", "jwt"],
    content: "Use JWT tokens with refresh rotation",
  });
  const patterns = fabric.getPatterns();
  if (patterns.length !== 1) throw new Error(`expected 1, got ${patterns.length}`);
});

assert("query finds patterns by keyword", () => {
  const fabric = mfMod.createMemoryFabric();
  fabric.indexPattern({ name: "p1", description: "auth pattern", tags: ["auth"], content: "jwt" });
  fabric.indexPattern({ name: "p2", description: "cache pattern", tags: ["cache"], content: "redis" });
  fabric.indexPattern({ name: "p3", description: "auth guard", tags: ["auth", "guard"], content: "middleware" });
  const results = fabric.query("auth");
  if (results.length < 2) throw new Error(`expected at least 2, got ${results.length}`);
});

assert("mergeLearnings combines patterns", () => {
  if (typeof mfMod.createMemoryFabric !== "function") throw new Error("missing");
  const fabric = mfMod.createMemoryFabric();
  fabric.indexPattern({ name: "a", description: "d1", tags: ["t1"], content: "c1" });
  const other = mfMod.createMemoryFabric();
  other.indexPattern({ name: "b", description: "d2", tags: ["t2"], content: "c2" });
  fabric.mergeLearnings(other.getPatterns());
  if (fabric.getPatterns().length !== 2) throw new Error("should have 2 after merge");
});

assert("removePattern deletes by name", () => {
  const fabric = mfMod.createMemoryFabric();
  fabric.indexPattern({ name: "temp", description: "temp", tags: [], content: "" });
  fabric.removePattern("temp");
  if (fabric.getPatterns().length !== 0) throw new Error("should be empty");
});

// ── Part 2: AST Merge ──────────────────────────────

console.log("\n\x1b[36m  Part 2: AST Merge\x1b[0m");

const astLib = join(process.cwd(), "tools/ogu/commands/lib/ast-merge.mjs");
assert("ast-merge.mjs exists", () => {
  if (!existsSync(astLib)) throw new Error("file missing");
});

const astMod = await import(astLib);

assert("mergeCode merges non-conflicting changes", () => {
  if (typeof astMod.mergeCode !== "function") throw new Error("missing");
  const base = "line1\nline2\nline3\n";
  const branchA = "line1\nlineA\nline3\n"; // changed line 2
  const branchB = "line1\nline2\nlineB\n"; // changed line 3
  const result = astMod.mergeCode(base, branchA, branchB);
  if (!result.merged) throw new Error("should merge successfully");
  if (!result.content.includes("lineA")) throw new Error("should include branchA change");
  if (!result.content.includes("lineB")) throw new Error("should include branchB change");
});

assert("mergeCode detects conflicts", () => {
  const base = "line1\nline2\nline3\n";
  const branchA = "line1\nchangeA\nline3\n"; // changed line 2
  const branchB = "line1\nchangeB\nline3\n"; // also changed line 2
  const result = astMod.mergeCode(base, branchA, branchB);
  if (result.merged) throw new Error("should detect conflict");
  if (!result.conflicts || result.conflicts.length === 0) throw new Error("should have conflicts");
});

assert("detectSemanticConflicts identifies related edits", () => {
  if (typeof astMod.detectSemanticConflicts !== "function") throw new Error("missing");
  const changes = [
    { file: "src/auth.mjs", lines: [10, 11, 12] },
    { file: "src/auth.mjs", lines: [11, 12, 13] },
  ];
  const conflicts = astMod.detectSemanticConflicts(changes);
  if (!Array.isArray(conflicts)) throw new Error("should return array");
  if (conflicts.length === 0) throw new Error("should detect overlapping lines");
});

assert("detectSemanticConflicts passes non-overlapping", () => {
  const changes = [
    { file: "src/a.mjs", lines: [1, 2, 3] },
    { file: "src/b.mjs", lines: [1, 2, 3] },
  ];
  const conflicts = astMod.detectSemanticConflicts(changes);
  if (conflicts.length !== 0) throw new Error("different files should not conflict");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
