/**
 * Slice 160 — Snapshot Versioner + Versioned Snapshots
 *
 * Snapshot Versioner: version snapshots with diffs and changeset chains.
 * Versioned Snapshots: query and restore historical snapshots.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 160 — Snapshot Versioner + Versioned Snapshots\x1b[0m\n");

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

// ── Part 2: Versioned Snapshots ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Versioned Snapshots\x1b[0m");

const vsLib = join(process.cwd(), "tools/ogu/commands/lib/versioned-snapshots.mjs");
assert("versioned-snapshots.mjs exists", () => {
  if (!existsSync(vsLib)) throw new Error("file missing");
});

const vsMod = await import(vsLib);

assert("createVersionedStore returns store", () => {
  if (typeof vsMod.createVersionedStore !== "function") throw new Error("missing");
  const store = vsMod.createVersionedStore();
  if (typeof store.save !== "function") throw new Error("missing save");
  if (typeof store.restore !== "function") throw new Error("missing restore");
  if (typeof store.listVersions !== "function") throw new Error("missing listVersions");
});

assert("save and restore roundtrip", () => {
  const store = vsMod.createVersionedStore();
  store.save("config", { theme: "dark", lang: "en" });
  const snap = store.restore("config", 1);
  if (snap.theme !== "dark") throw new Error("theme mismatch");
});

assert("multiple versions per key", () => {
  const store = vsMod.createVersionedStore();
  store.save("config", { v: 1 });
  store.save("config", { v: 2 });
  store.save("config", { v: 3 });
  if (store.restore("config", 1).v !== 1) throw new Error("v1 wrong");
  if (store.restore("config", 3).v !== 3) throw new Error("v3 wrong");
});

assert("listVersions returns version metadata", () => {
  const store = vsMod.createVersionedStore();
  store.save("state", { a: 1 });
  store.save("state", { a: 2 });
  const versions = store.listVersions("state");
  if (versions.length !== 2) throw new Error(`expected 2, got ${versions.length}`);
  if (versions[0].version !== 1) throw new Error("first version should be 1");
});

assert("restore latest returns most recent", () => {
  const store = vsMod.createVersionedStore();
  store.save("data", { n: 10 });
  store.save("data", { n: 20 });
  const latest = store.restore("data");
  if (latest.n !== 20) throw new Error("should return latest");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
