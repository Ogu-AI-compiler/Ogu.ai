/**
 * Slice 129 — Studio Event Stream + IndexedDB Sync
 *
 * Studio Event Stream: formal SSE-style event stream with sequence tracking.
 * IndexedDB Sync: client-side state replica with sync cursors.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 129 — Studio Event Stream + IndexedDB Sync\x1b[0m\n");

// ── Part 1: Studio Event Stream ──────────────────────────────

console.log("\x1b[36m  Part 1: Studio Event Stream\x1b[0m");

const sesLib = join(process.cwd(), "tools/ogu/commands/lib/studio-event-stream.mjs");
assert("studio-event-stream.mjs exists", () => {
  if (!existsSync(sesLib)) throw new Error("file missing");
});

const sesMod = await import(sesLib);

assert("createEventStream returns stream", () => {
  if (typeof sesMod.createEventStream !== "function") throw new Error("missing");
  const stream = sesMod.createEventStream();
  if (typeof stream.publish !== "function") throw new Error("missing publish");
  if (typeof stream.subscribe !== "function") throw new Error("missing subscribe");
  if (typeof stream.getSequence !== "function") throw new Error("missing getSequence");
});

assert("publish assigns sequential IDs", () => {
  const stream = sesMod.createEventStream();
  const e1 = stream.publish({ type: "task.started", data: { taskId: "t1" } });
  const e2 = stream.publish({ type: "task.completed", data: { taskId: "t1" } });
  if (e1.seq !== 1) throw new Error(`expected seq 1, got ${e1.seq}`);
  if (e2.seq !== 2) throw new Error(`expected seq 2, got ${e2.seq}`);
});

assert("subscribe receives published events", () => {
  const stream = sesMod.createEventStream();
  const received = [];
  stream.subscribe((event) => received.push(event));
  stream.publish({ type: "agent.spawned", data: { agentId: "dev" } });
  stream.publish({ type: "agent.stopped", data: { agentId: "dev" } });
  if (received.length !== 2) throw new Error(`expected 2 events, got ${received.length}`);
});

assert("getHistory returns events since sequence", () => {
  const stream = sesMod.createEventStream();
  stream.publish({ type: "a", data: {} });
  stream.publish({ type: "b", data: {} });
  stream.publish({ type: "c", data: {} });
  const history = stream.getHistory(2);
  if (history.length !== 1) throw new Error(`expected 1 event after seq 2, got ${history.length}`);
  if (history[0].type !== "c") throw new Error(`expected type c, got ${history[0].type}`);
});

assert("unsubscribe stops delivery", () => {
  const stream = sesMod.createEventStream();
  const received = [];
  const unsub = stream.subscribe((e) => received.push(e));
  stream.publish({ type: "x", data: {} });
  unsub();
  stream.publish({ type: "y", data: {} });
  if (received.length !== 1) throw new Error(`expected 1, got ${received.length}`);
});

// ── Part 2: IndexedDB Sync ──────────────────────────────

console.log("\n\x1b[36m  Part 2: IndexedDB Sync\x1b[0m");

const idbLib = join(process.cwd(), "tools/ogu/commands/lib/state-sync-client.mjs");
assert("state-sync-client.mjs exists", () => {
  if (!existsSync(idbLib)) throw new Error("file missing");
});

const idbMod = await import(idbLib);

assert("createStateSyncClient returns client", () => {
  if (typeof idbMod.createStateSyncClient !== "function") throw new Error("missing");
  const client = idbMod.createStateSyncClient({ clientId: "browser-1" });
  if (typeof client.applyEvent !== "function") throw new Error("missing applyEvent");
  if (typeof client.getState !== "function") throw new Error("missing getState");
  if (typeof client.getCursor !== "function") throw new Error("missing getCursor");
});

assert("applyEvent updates state and cursor", () => {
  const client = idbMod.createStateSyncClient({ clientId: "b1" });
  client.applyEvent({ seq: 1, type: "dag.updated", data: { phase: "build", status: "running" } });
  const state = client.getState();
  if (!state.dag) throw new Error("missing dag state");
  if (client.getCursor() !== 1) throw new Error(`expected cursor 1, got ${client.getCursor()}`);
});

assert("applyEvents handles batch", () => {
  const client = idbMod.createStateSyncClient({ clientId: "b2" });
  client.applyEvents([
    { seq: 1, type: "dag.updated", data: { phase: "build", status: "running" } },
    { seq: 2, type: "budget.updated", data: { role: "dev", spent: 0.5 } },
    { seq: 3, type: "agent.updated", data: { agentId: "a1", status: "running" } },
  ]);
  if (client.getCursor() !== 3) throw new Error(`expected cursor 3, got ${client.getCursor()}`);
});

assert("getState returns current snapshot", () => {
  const client = idbMod.createStateSyncClient({ clientId: "b3" });
  client.applyEvent({ seq: 1, type: "agent.updated", data: { agentId: "a1", status: "running" } });
  client.applyEvent({ seq: 2, type: "agent.updated", data: { agentId: "a2", status: "idle" } });
  const state = client.getState();
  if (!state.agents) throw new Error("missing agents");
  if (Object.keys(state.agents).length !== 2) throw new Error("expected 2 agents");
});

assert("reset clears state and cursor", () => {
  const client = idbMod.createStateSyncClient({ clientId: "b4" });
  client.applyEvent({ seq: 1, type: "dag.updated", data: { phase: "x", status: "y" } });
  client.reset();
  if (client.getCursor() !== 0) throw new Error("cursor should be 0 after reset");
  const state = client.getState();
  if (Object.keys(state).length !== 0) throw new Error("state should be empty after reset");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
