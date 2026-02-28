/**
 * Slice 180 — Event Sourcing Store + Projection Builder
 *
 * Event Sourcing Store: append-only event log with replay.
 * Projection Builder: build materialized views from events.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 180 — Event Sourcing Store + Projection Builder\x1b[0m\n");

console.log("\x1b[36m  Part 1: Event Sourcing Store\x1b[0m");

const esLib = join(process.cwd(), "tools/ogu/commands/lib/event-sourcing-store.mjs");
assert("event-sourcing-store.mjs exists", () => { if (!existsSync(esLib)) throw new Error("file missing"); });
const esMod = await import(esLib);

assert("createEventStore returns store", () => {
  if (typeof esMod.createEventStore !== "function") throw new Error("missing");
  const s = esMod.createEventStore();
  if (typeof s.append !== "function") throw new Error("missing append");
  if (typeof s.getEvents !== "function") throw new Error("missing getEvents");
  if (typeof s.replay !== "function") throw new Error("missing replay");
});

assert("append adds event with sequence", () => {
  const s = esMod.createEventStore();
  const e = s.append({ type: "UserCreated", data: { name: "Alice" } });
  if (e.sequence !== 1) throw new Error(`expected 1, got ${e.sequence}`);
});

assert("getEvents returns all events", () => {
  const s = esMod.createEventStore();
  s.append({ type: "A" });
  s.append({ type: "B" });
  if (s.getEvents().length !== 2) throw new Error("expected 2");
});

assert("replay applies events to reducer", () => {
  const s = esMod.createEventStore();
  s.append({ type: "add", data: { amount: 10 } });
  s.append({ type: "add", data: { amount: 20 } });
  s.append({ type: "sub", data: { amount: 5 } });
  const state = s.replay((acc, e) => {
    if (e.type === "add") return acc + e.data.amount;
    if (e.type === "sub") return acc - e.data.amount;
    return acc;
  }, 0);
  if (state !== 25) throw new Error(`expected 25, got ${state}`);
});

assert("getEvents supports from-sequence filter", () => {
  const s = esMod.createEventStore();
  s.append({ type: "A" }); s.append({ type: "B" }); s.append({ type: "C" });
  const events = s.getEvents({ fromSequence: 2 });
  if (events.length !== 2) throw new Error(`expected 2, got ${events.length}`);
  if (events[0].type !== "B") throw new Error("should start from B");
});

console.log("\n\x1b[36m  Part 2: Projection Builder\x1b[0m");

const pbLib = join(process.cwd(), "tools/ogu/commands/lib/projection-builder.mjs");
assert("projection-builder.mjs exists", () => { if (!existsSync(pbLib)) throw new Error("file missing"); });
const pbMod = await import(pbLib);

assert("createProjectionBuilder returns builder", () => {
  if (typeof pbMod.createProjectionBuilder !== "function") throw new Error("missing");
  const pb = pbMod.createProjectionBuilder();
  if (typeof pb.addHandler !== "function") throw new Error("missing addHandler");
  if (typeof pb.project !== "function") throw new Error("missing project");
  if (typeof pb.getState !== "function") throw new Error("missing getState");
});

assert("project applies events through handlers", () => {
  const pb = pbMod.createProjectionBuilder();
  pb.addHandler("UserCreated", (state, data) => ({
    ...state, users: [...(state.users || []), data.name]
  }));
  pb.project([
    { type: "UserCreated", data: { name: "Alice" } },
    { type: "UserCreated", data: { name: "Bob" } },
  ]);
  const state = pb.getState();
  if (state.users.length !== 2) throw new Error(`expected 2, got ${state.users.length}`);
});

assert("unhandled events are skipped", () => {
  const pb = pbMod.createProjectionBuilder();
  pb.addHandler("A", (state, data) => ({ ...state, count: (state.count || 0) + 1 }));
  pb.project([{ type: "A", data: {} }, { type: "B", data: {} }]);
  if (pb.getState().count !== 1) throw new Error("should only count A");
});

assert("reset clears projection state", () => {
  const pb = pbMod.createProjectionBuilder();
  pb.addHandler("X", (state) => ({ ...state, x: true }));
  pb.project([{ type: "X", data: {} }]);
  pb.reset();
  if (pb.getState().x) throw new Error("should be cleared");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
