/**
 * Slice 115 — Studio Event Envelope + Event Batcher
 *
 * Studio event envelope: typed envelope for Studio WebSocket events.
 * Event batcher: batch and coalesce events for efficient transport.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 115 — Studio Event Envelope + Event Batcher\x1b[0m\n");

// ── Part 1: Studio Event Envelope ──────────────────────────────

console.log("\x1b[36m  Part 1: Studio Event Envelope\x1b[0m");

const seLib = join(process.cwd(), "tools/ogu/commands/lib/studio-event-typed.mjs");
assert("studio-event-typed.mjs exists", () => {
  if (!existsSync(seLib)) throw new Error("file missing");
});

const seMod = await import(seLib);

assert("createStudioEvent builds typed envelope", () => {
  if (typeof seMod.createStudioEvent !== "function") throw new Error("missing");
  const event = seMod.createStudioEvent({
    type: "TASK_STARTED",
    streamKey: "feature:auth",
    payload: { taskId: "t-1", agentId: "backend-dev" },
  });
  if (!event.eventId) throw new Error("missing eventId");
  if (event.type !== "TASK_STARTED") throw new Error("wrong type");
  if (!event.timestamp) throw new Error("missing timestamp");
  if (typeof event.seq !== "number") throw new Error("missing seq");
});

assert("sequential events have incrementing seq", () => {
  const e1 = seMod.createStudioEvent({ type: "A", streamKey: "s1", payload: {} });
  const e2 = seMod.createStudioEvent({ type: "B", streamKey: "s1", payload: {} });
  if (e2.seq <= e1.seq) throw new Error("seq should increment");
});

assert("STUDIO_EVENT_TYPES lists event types", () => {
  if (!Array.isArray(seMod.STUDIO_EVENT_TYPES)) throw new Error("missing");
  const expected = ["TASK_STARTED", "TASK_COMPLETED", "TASK_FAILED", "BUDGET_TICK", "GOV_BLOCKED", "SNAPSHOT_AVAILABLE"];
  for (const t of expected) {
    if (!seMod.STUDIO_EVENT_TYPES.includes(t)) throw new Error(`missing ${t}`);
  }
});

assert("event has correlationId and causationId", () => {
  const event = seMod.createStudioEvent({
    type: "TASK_COMPLETED",
    streamKey: "feature:auth",
    payload: {},
    correlationId: "corr-1",
    causationId: "cause-1",
  });
  if (event.correlationId !== "corr-1") throw new Error("wrong correlationId");
  if (event.causationId !== "cause-1") throw new Error("wrong causationId");
});

assert("CRITICAL_EVENTS defines bypass-batch events", () => {
  if (!Array.isArray(seMod.CRITICAL_EVENTS)) throw new Error("missing");
  if (!seMod.CRITICAL_EVENTS.includes("GOV_BLOCKED")) throw new Error("missing GOV_BLOCKED");
  if (!seMod.CRITICAL_EVENTS.includes("SNAPSHOT_AVAILABLE")) throw new Error("missing SNAPSHOT_AVAILABLE");
});

// ── Part 2: Event Batcher ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Event Batcher\x1b[0m");

const ebLib = join(process.cwd(), "tools/ogu/commands/lib/event-batcher.mjs");
assert("event-batcher.mjs exists", () => {
  if (!existsSync(ebLib)) throw new Error("file missing");
});

const ebMod = await import(ebLib);

assert("createEventBatcher returns batcher", () => {
  if (typeof ebMod.createEventBatcher !== "function") throw new Error("missing");
  const eb = ebMod.createEventBatcher({ batchIntervalMs: 100 });
  if (typeof eb.push !== "function") throw new Error("missing push");
  if (typeof eb.flush !== "function") throw new Error("missing flush");
});

assert("push buffers events", () => {
  const eb = ebMod.createEventBatcher({ batchIntervalMs: 100 });
  eb.push({ type: "TASK_STARTED", payload: {} });
  eb.push({ type: "BUDGET_TICK", payload: {} });
  const pending = eb.getPendingCount();
  if (pending !== 2) throw new Error(`expected 2, got ${pending}`);
});

assert("flush returns all buffered events", () => {
  const eb = ebMod.createEventBatcher({ batchIntervalMs: 100 });
  eb.push({ type: "A", payload: {} });
  eb.push({ type: "B", payload: {} });
  const batch = eb.flush();
  if (batch.length !== 2) throw new Error(`expected 2, got ${batch.length}`);
  if (eb.getPendingCount() !== 0) throw new Error("should be empty after flush");
});

assert("critical events bypass batching", () => {
  const bypassed = [];
  const eb = ebMod.createEventBatcher({
    batchIntervalMs: 100,
    criticalTypes: ["GOV_BLOCKED", "SNAPSHOT_AVAILABLE"],
    onCritical: (event) => bypassed.push(event),
  });
  eb.push({ type: "GOV_BLOCKED", payload: { reason: "policy" } });
  eb.push({ type: "TASK_STARTED", payload: {} });
  if (bypassed.length !== 1) throw new Error(`expected 1 bypassed, got ${bypassed.length}`);
  if (eb.getPendingCount() !== 1) throw new Error("non-critical should still be pending");
});

assert("coalesce merges same-type events", () => {
  const eb = ebMod.createEventBatcher({ batchIntervalMs: 100, coalesceTypes: ["BUDGET_TICK"] });
  eb.push({ type: "BUDGET_TICK", payload: { used: 100 } });
  eb.push({ type: "BUDGET_TICK", payload: { used: 200 } });
  eb.push({ type: "TASK_STARTED", payload: {} });
  const batch = eb.flush();
  // BUDGET_TICK should be coalesced to 1, TASK_STARTED stays
  if (batch.length !== 2) throw new Error(`expected 2, got ${batch.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
