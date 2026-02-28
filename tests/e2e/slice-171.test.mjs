/**
 * Slice 171 — Garbage Collector + Resource Reclaimer
 *
 * Garbage Collector: mark-sweep unused resources.
 * Resource Reclaimer: reclaim leaked resources.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 171 — Garbage Collector + Resource Reclaimer\x1b[0m\n");

// ── Part 1: Garbage Collector ──────────────────────────────

console.log("\x1b[36m  Part 1: Garbage Collector\x1b[0m");

const gcLib = join(process.cwd(), "tools/ogu/commands/lib/garbage-collector.mjs");
assert("garbage-collector.mjs exists", () => {
  if (!existsSync(gcLib)) throw new Error("file missing");
});

const gcMod = await import(gcLib);

assert("createGC returns collector", () => {
  if (typeof gcMod.createGC !== "function") throw new Error("missing");
  const gc = gcMod.createGC();
  if (typeof gc.allocate !== "function") throw new Error("missing allocate");
  if (typeof gc.mark !== "function") throw new Error("missing mark");
  if (typeof gc.sweep !== "function") throw new Error("missing sweep");
});

assert("allocate creates resource", () => {
  const gc = gcMod.createGC();
  const id = gc.allocate({ type: "buffer", size: 1024 });
  if (!id) throw new Error("should return id");
  if (gc.getStats().allocated !== 1) throw new Error("should have 1 allocated");
});

assert("mark + sweep collects unmarked", () => {
  const gc = gcMod.createGC();
  const id1 = gc.allocate({ type: "a" });
  const id2 = gc.allocate({ type: "b" });
  gc.mark(id1); // mark id1 as in-use
  const swept = gc.sweep();
  if (swept !== 1) throw new Error(`expected 1 swept, got ${swept}`);
  if (gc.getStats().allocated !== 1) throw new Error("should have 1 remaining");
});

assert("sweep without mark collects all", () => {
  const gc = gcMod.createGC();
  gc.allocate({ type: "x" });
  gc.allocate({ type: "y" });
  const swept = gc.sweep();
  if (swept !== 2) throw new Error(`expected 2, got ${swept}`);
});

assert("getStats tracks collections", () => {
  const gc = gcMod.createGC();
  gc.allocate({ type: "a" });
  gc.sweep();
  const stats = gc.getStats();
  if (stats.totalCollected !== 1) throw new Error(`expected 1 collected, got ${stats.totalCollected}`);
  if (stats.sweepCount !== 1) throw new Error(`expected 1 sweep, got ${stats.sweepCount}`);
});

// ── Part 2: Resource Reclaimer ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Resource Reclaimer\x1b[0m");

const rrLib = join(process.cwd(), "tools/ogu/commands/lib/resource-reclaimer.mjs");
assert("resource-reclaimer.mjs exists", () => {
  if (!existsSync(rrLib)) throw new Error("file missing");
});

const rrMod = await import(rrLib);

assert("createResourceReclaimer returns reclaimer", () => {
  if (typeof rrMod.createResourceReclaimer !== "function") throw new Error("missing");
  const rr = rrMod.createResourceReclaimer();
  if (typeof rr.track !== "function") throw new Error("missing track");
  if (typeof rr.release !== "function") throw new Error("missing release");
  if (typeof rr.reclaimExpired !== "function") throw new Error("missing reclaimExpired");
});

assert("track registers resource", () => {
  const rr = rrMod.createResourceReclaimer();
  rr.track("res-1", { type: "conn", ttlMs: 60000 });
  const tracked = rr.getTracked();
  if (tracked.length !== 1) throw new Error(`expected 1, got ${tracked.length}`);
});

assert("release removes resource", () => {
  const rr = rrMod.createResourceReclaimer();
  rr.track("res-1", { type: "conn", ttlMs: 60000 });
  rr.release("res-1");
  if (rr.getTracked().length !== 0) throw new Error("should be empty");
});

assert("reclaimExpired reclaims old resources", () => {
  const rr = rrMod.createResourceReclaimer();
  rr.track("old", { type: "conn", ttlMs: 0 }); // already expired
  rr.track("fresh", { type: "conn", ttlMs: 999999 });
  const reclaimed = rr.reclaimExpired();
  if (reclaimed !== 1) throw new Error(`expected 1, got ${reclaimed}`);
  if (rr.getTracked().length !== 1) throw new Error("should have 1 remaining");
});

assert("getStats returns reclaim count", () => {
  const rr = rrMod.createResourceReclaimer();
  rr.track("x", { type: "a", ttlMs: 0 });
  rr.reclaimExpired();
  const stats = rr.getStats();
  if (stats.totalReclaimed !== 1) throw new Error(`expected 1, got ${stats.totalReclaimed}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
