/**
 * Slice 87 — Snapshot Diff + Version Tracker
 *
 * Snapshot diff: compare two system snapshots for drift.
 * Version tracker: semantic versioning with changelog generation.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 87 — Snapshot Diff + Version Tracker\x1b[0m\n");

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

// ── Part 2: Version Tracker ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Version Tracker\x1b[0m");

const vtLib = join(process.cwd(), "tools/ogu/commands/lib/version-tracker.mjs");
assert("version-tracker.mjs exists", () => {
  if (!existsSync(vtLib)) throw new Error("file missing");
});

const vtMod = await import(vtLib);

assert("createVersionTracker returns tracker", () => {
  if (typeof vtMod.createVersionTracker !== "function") throw new Error("missing");
  const vt = vtMod.createVersionTracker({ initial: "1.0.0" });
  if (typeof vt.bump !== "function") throw new Error("missing bump");
  if (typeof vt.getVersion !== "function") throw new Error("missing getVersion");
  if (typeof vt.getChangelog !== "function") throw new Error("missing getChangelog");
});

assert("bump patch increments patch version", () => {
  const vt = vtMod.createVersionTracker({ initial: "1.0.0" });
  vt.bump("patch", "fix typo");
  if (vt.getVersion() !== "1.0.1") throw new Error(`expected 1.0.1, got ${vt.getVersion()}`);
});

assert("bump minor increments minor, resets patch", () => {
  const vt = vtMod.createVersionTracker({ initial: "1.2.3" });
  vt.bump("minor", "add feature");
  if (vt.getVersion() !== "1.3.0") throw new Error(`expected 1.3.0, got ${vt.getVersion()}`);
});

assert("bump major increments major, resets rest", () => {
  const vt = vtMod.createVersionTracker({ initial: "1.2.3" });
  vt.bump("major", "breaking change");
  if (vt.getVersion() !== "2.0.0") throw new Error(`expected 2.0.0, got ${vt.getVersion()}`);
});

assert("getChangelog returns all bumps", () => {
  const vt = vtMod.createVersionTracker({ initial: "0.1.0" });
  vt.bump("patch", "fix a");
  vt.bump("minor", "add b");
  const log = vt.getChangelog();
  if (log.length !== 2) throw new Error(`expected 2, got ${log.length}`);
  if (log[0].version !== "0.1.1") throw new Error("wrong first version");
  if (log[1].version !== "0.2.0") throw new Error("wrong second version");
});

assert("parseVersion breaks version string", () => {
  if (typeof vtMod.parseVersion !== "function") throw new Error("missing");
  const v = vtMod.parseVersion("3.14.159");
  if (v.major !== 3 || v.minor !== 14 || v.patch !== 159) throw new Error("wrong parse");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
