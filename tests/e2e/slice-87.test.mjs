/**
 * Slice 87 — Snapshot Diff
 *
 * Snapshot diff: compare two system snapshots for drift.

 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 87 — Snapshot Diff\x1b[0m\n");

// ── Part 1: Snapshot Diff ──────────────────────────────

console.log("\x1b[36m  Part 1: Snapshot Diff\x1b[0m");

const sdLib = join(process.cwd(), "tools/ogu/commands/lib/snapshot-diff.mjs");
assert("snapshot-diff.mjs exists", () => {
  if (!existsSync(sdLib)) throw new Error("file missing");
});

const sdMod = await import(sdLib);

assert("diffSnapshots compares two snapshots", () => {
  if (typeof sdMod.diffSnapshots !== "function") throw new Error("missing");
  const before = { state: "building", gates: 5, files: ["a.mjs", "b.mjs"] };
  const after = { state: "testing", gates: 8, files: ["a.mjs", "b.mjs", "c.mjs"] };
  const diff = sdMod.diffSnapshots(before, after);
  if (!diff.changes || diff.changes.length === 0) throw new Error("should detect changes");
});

assert("diffSnapshots detects added/removed/changed fields", () => {
  const before = { a: 1, b: 2, c: 3 };
  const after = { a: 1, b: 5, d: 4 };
  const diff = sdMod.diffSnapshots(before, after);
  const types = diff.changes.map(c => c.type);
  if (!types.includes("changed")) throw new Error("should detect changed");
  if (!types.includes("removed")) throw new Error("should detect removed");
  if (!types.includes("added")) throw new Error("should detect added");
});

assert("identical snapshots show no drift", () => {
  const snap = { state: "done", gates: 14 };
  const diff = sdMod.diffSnapshots(snap, { ...snap });
  if (diff.changes.length !== 0) throw new Error("identical should have no changes");
  if (diff.drifted) throw new Error("should not be drifted");
});
