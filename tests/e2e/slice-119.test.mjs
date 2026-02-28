/**
 * Slice 119 — Snapshot Store + Time Travel Engine
 *
 * Snapshot store: persist and load system snapshots.
 * Time travel engine: restore state to any snapshot and replay deltas.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 119 — Snapshot Store + Time Travel Engine\x1b[0m\n");

// ── Part 1: Snapshot Store ──────────────────────────────

console.log("\x1b[36m  Part 1: Snapshot Store\x1b[0m");

const ssLib = join(process.cwd(), "tools/ogu/commands/lib/snapshot-store.mjs");
assert("snapshot-store.mjs exists", () => {
  if (!existsSync(ssLib)) throw new Error("file missing");
});

const ssMod = await import(ssLib);

assert("createSnapshotStore returns store", () => {
  if (typeof ssMod.createSnapshotStore !== "function") throw new Error("missing");
  const ss = ssMod.createSnapshotStore({ dir: "/tmp/test-snapshots-" + Date.now() });
  if (typeof ss.save !== "function") throw new Error("missing save");
  if (typeof ss.load !== "function") throw new Error("missing load");
  if (typeof ss.list !== "function") throw new Error("missing list");
});

assert("save and load roundtrip snapshot", async () => {
  const dir = "/tmp/test-snapshots-roundtrip-" + Date.now();
  const ss = ssMod.createSnapshotStore({ dir });
  const state = { tasks: { t1: "running" }, budget: 500 };
  const id = await ss.save("snap-1", state);
  if (!id) throw new Error("missing id");
  const loaded = await ss.load("snap-1");
  if (loaded.tasks.t1 !== "running") throw new Error("wrong task state");
  if (loaded.budget !== 500) throw new Error("wrong budget");
  rmSync(dir, { recursive: true });
});

assert("list returns all saved snapshots", async () => {
  const dir = "/tmp/test-snapshots-list-" + Date.now();
  const ss = ssMod.createSnapshotStore({ dir });
  await ss.save("s1", { a: 1 });
  await ss.save("s2", { b: 2 });
  const snaps = await ss.list();
  if (snaps.length !== 2) throw new Error(`expected 2, got ${snaps.length}`);
  rmSync(dir, { recursive: true });
});

assert("delete removes a snapshot", async () => {
  const dir = "/tmp/test-snapshots-del-" + Date.now();
  const ss = ssMod.createSnapshotStore({ dir });
  await ss.save("s1", { a: 1 });
  await ss.delete("s1");
  const snaps = await ss.list();
  if (snaps.length !== 0) throw new Error(`expected 0, got ${snaps.length}`);
  rmSync(dir, { recursive: true });
});

// ── Part 2: Time Travel Engine ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Time Travel Engine\x1b[0m");

const ttLib = join(process.cwd(), "tools/ogu/commands/lib/time-travel-engine.mjs");
assert("time-travel-engine.mjs exists", () => {
  if (!existsSync(ttLib)) throw new Error("file missing");
});

const ttMod = await import(ttLib);

assert("createTimeTravelEngine returns engine", () => {
  if (typeof ttMod.createTimeTravelEngine !== "function") throw new Error("missing");
  const tt = ttMod.createTimeTravelEngine();
  if (typeof tt.takeSnapshot !== "function") throw new Error("missing takeSnapshot");
  if (typeof tt.restoreTo !== "function") throw new Error("missing restoreTo");
  if (typeof tt.applyDelta !== "function") throw new Error("missing applyDelta");
});

assert("takeSnapshot records current state", () => {
  const tt = ttMod.createTimeTravelEngine();
  tt.setState({ count: 0 });
  const snapId = tt.takeSnapshot("initial");
  tt.setState({ count: 10 });
  const snapId2 = tt.takeSnapshot("after-work");
  const snaps = tt.listSnapshots();
  if (snaps.length !== 2) throw new Error(`expected 2, got ${snaps.length}`);
});

assert("restoreTo resets state to snapshot", () => {
  const tt = ttMod.createTimeTravelEngine();
  tt.setState({ count: 0 });
  const snapId = tt.takeSnapshot("start");
  tt.setState({ count: 50 });
  tt.restoreTo(snapId);
  const state = tt.getState();
  if (state.count !== 0) throw new Error(`expected 0, got ${state.count}`);
});

assert("applyDelta applies partial changes", () => {
  const tt = ttMod.createTimeTravelEngine();
  tt.setState({ a: 1, b: 2 });
  tt.applyDelta({ b: 3, c: 4 });
  const state = tt.getState();
  if (state.a !== 1) throw new Error("a should be preserved");
  if (state.b !== 3) throw new Error("b should be updated");
  if (state.c !== 4) throw new Error("c should be added");
});

assert("isReadOnly toggles after restore", () => {
  const tt = ttMod.createTimeTravelEngine();
  tt.setState({ x: 1 });
  const snapId = tt.takeSnapshot("base");
  tt.setState({ x: 2 });
  tt.restoreTo(snapId);
  if (!tt.isReadOnly()) throw new Error("should be read-only after restore");
  tt.exitReadOnly();
  if (tt.isReadOnly()) throw new Error("should not be read-only after exit");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
