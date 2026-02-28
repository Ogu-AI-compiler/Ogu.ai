/**
 * Slice 116 — Stream Cursor Manager + Event Replay
 *
 * Stream cursor manager: track client position in event streams for resume.
 * Event replay: replay missed events from a given seq number.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 116 — Stream Cursor Manager + Event Replay\x1b[0m\n");

// ── Part 1: Stream Cursor Manager ──────────────────────────────

console.log("\x1b[36m  Part 1: Stream Cursor Manager\x1b[0m");

const scLib = join(process.cwd(), "tools/ogu/commands/lib/stream-cursor-manager.mjs");
assert("stream-cursor-manager.mjs exists", () => {
  if (!existsSync(scLib)) throw new Error("file missing");
});

const scMod = await import(scLib);

assert("createStreamCursorManager returns manager", () => {
  if (typeof scMod.createStreamCursorManager !== "function") throw new Error("missing");
  const cm = scMod.createStreamCursorManager();
  if (typeof cm.setCursor !== "function") throw new Error("missing setCursor");
  if (typeof cm.getCursor !== "function") throw new Error("missing getCursor");
});

assert("setCursor stores client position per stream", () => {
  const cm = scMod.createStreamCursorManager();
  cm.setCursor("client-1", "feature:auth", 42);
  cm.setCursor("client-1", "feature:payments", 10);
  const pos = cm.getCursor("client-1", "feature:auth");
  if (pos !== 42) throw new Error(`expected 42, got ${pos}`);
});

assert("getCursor returns 0 for unknown client/stream", () => {
  const cm = scMod.createStreamCursorManager();
  if (cm.getCursor("x", "y") !== 0) throw new Error("should return 0 for unknown");
});

assert("getAllCursors returns all cursors for a client", () => {
  const cm = scMod.createStreamCursorManager();
  cm.setCursor("c1", "s1", 10);
  cm.setCursor("c1", "s2", 20);
  const cursors = cm.getAllCursors("c1");
  if (Object.keys(cursors).length !== 2) throw new Error("expected 2 cursors");
  if (cursors.s1 !== 10) throw new Error("wrong s1 cursor");
});

assert("removeCursors cleans up disconnected client", () => {
  const cm = scMod.createStreamCursorManager();
  cm.setCursor("c1", "s1", 10);
  cm.removeCursors("c1");
  if (cm.getCursor("c1", "s1") !== 0) throw new Error("should return 0 after removal");
});

// ── Part 2: Event Replay ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Event Replay\x1b[0m");

const erLib = join(process.cwd(), "tools/ogu/commands/lib/event-replay.mjs");
assert("event-replay.mjs exists", () => {
  if (!existsSync(erLib)) throw new Error("file missing");
});

const erMod = await import(erLib);

assert("createEventReplayBuffer returns buffer", () => {
  if (typeof erMod.createEventReplayBuffer !== "function") throw new Error("missing");
  const rb = erMod.createEventReplayBuffer({ maxSize: 1000 });
  if (typeof rb.append !== "function") throw new Error("missing append");
  if (typeof rb.replaySince !== "function") throw new Error("missing replaySince");
});

assert("append stores events with seq", () => {
  const rb = erMod.createEventReplayBuffer({ maxSize: 100 });
  rb.append({ seq: 1, type: "A", payload: {} });
  rb.append({ seq: 2, type: "B", payload: {} });
  rb.append({ seq: 3, type: "C", payload: {} });
  if (rb.size() !== 3) throw new Error(`expected 3, got ${rb.size()}`);
});

assert("replaySince returns events after given seq", () => {
  const rb = erMod.createEventReplayBuffer({ maxSize: 100 });
  rb.append({ seq: 1, type: "A" });
  rb.append({ seq: 2, type: "B" });
  rb.append({ seq: 3, type: "C" });
  rb.append({ seq: 4, type: "D" });
  const events = rb.replaySince(2);
  if (events.length !== 2) throw new Error(`expected 2, got ${events.length}`);
  if (events[0].seq !== 3) throw new Error("first should be seq 3");
  if (events[1].seq !== 4) throw new Error("second should be seq 4");
});

assert("replaySince returns empty for current position", () => {
  const rb = erMod.createEventReplayBuffer({ maxSize: 100 });
  rb.append({ seq: 1, type: "A" });
  const events = rb.replaySince(1);
  if (events.length !== 0) throw new Error(`expected 0, got ${events.length}`);
});

assert("buffer evicts old events when full", () => {
  const rb = erMod.createEventReplayBuffer({ maxSize: 3 });
  rb.append({ seq: 1, type: "A" });
  rb.append({ seq: 2, type: "B" });
  rb.append({ seq: 3, type: "C" });
  rb.append({ seq: 4, type: "D" }); // evicts seq 1
  if (rb.size() !== 3) throw new Error(`expected 3, got ${rb.size()}`);
  const events = rb.replaySince(0);
  if (events[0].seq !== 2) throw new Error("oldest should be seq 2 after eviction");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
