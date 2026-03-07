/**
 * Slice 160 — Snapshot Versioner
 *
 * Snapshot Versioner: version snapshots with diffs and changeset chains.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 160 — Snapshot Versioner\x1b[0m\n");

// ── Part 1: Snapshot Versioner ──────────────────────────────

console.log("\x1b[36m  Part 1: Snapshot Versioner\x1b[0m");

const svLib = join(process.cwd(), "tools/ogu/commands/lib/snapshot-versioner.mjs");
assert("snapshot-versioner.mjs exists", () => {
  if (!existsSync(svLib)) throw new Error("file missing");
});

const svMod = await import(svLib);

assert("createSnapshotVersioner returns versioner", () => {
  if (typeof svMod.createSnapshotVersioner !== "function") throw new Error("missing");
  const v = svMod.createSnapshotVersioner();
  if (typeof v.commit !== "function") throw new Error("missing commit");
  if (typeof v.getVersion !== "function") throw new Error("missing getVersion");
  if (typeof v.getDiff !== "function") throw new Error("missing getDiff");
});

assert("commit increments version", () => {
  const v = svMod.createSnapshotVersioner();
  const v1 = v.commit({ name: "Alice" });
  const v2 = v.commit({ name: "Bob" });
  if (v1 !== 1) throw new Error(`expected v1=1, got ${v1}`);
  if (v2 !== 2) throw new Error(`expected v2=2, got ${v2}`);
});

assert("getVersion returns snapshot at version", () => {
  const v = svMod.createSnapshotVersioner();
  v.commit({ x: 1 });
  v.commit({ x: 2 });
  const snap = v.getVersion(1);
  if (snap.x !== 1) throw new Error("should return v1 snapshot");
});

assert("getDiff returns changes between versions", () => {
  const v = svMod.createSnapshotVersioner();
  v.commit({ x: 1, y: 2 });
  v.commit({ x: 1, z: 3 });
  const diff = v.getDiff(1, 2);
  if (!Array.isArray(diff)) throw new Error("diff should be array");
  if (diff.length === 0) throw new Error("should have changes");
});

assert("getHistory returns all versions", () => {
  const v = svMod.createSnapshotVersioner();
  v.commit({ a: 1 });
  v.commit({ a: 2 });
  v.commit({ a: 3 });
  const history = v.getHistory();
  if (history.length !== 3) throw new Error(`expected 3, got ${history.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
