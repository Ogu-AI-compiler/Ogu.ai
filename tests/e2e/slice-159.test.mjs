/**
 * Slice 159 — Message Broker + Message Serializer
 *
 * Message Broker: pub-sub broker with topic routing.
 * Message Serializer: serialize/deserialize messages.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 159 — Message Broker + Message Serializer\x1b[0m\n");

// ── Part 1: Message Broker ──────────────────────────────

console.log("\x1b[36m  Part 1: Message Broker\x1b[0m");

const mbLib = join(process.cwd(), "tools/ogu/commands/lib/message-broker.mjs");
assert("message-broker.mjs exists", () => {
  if (!existsSync(mbLib)) throw new Error("file missing");
});

const mbMod = await import(mbLib);

assert("createMessageBroker returns broker", () => {
  if (typeof mbMod.createMessageBroker !== "function") throw new Error("missing");
  const broker = mbMod.createMessageBroker();
  if (typeof broker.subscribe !== "function") throw new Error("missing subscribe");
  if (typeof broker.publish !== "function") throw new Error("missing publish");
});

assert("publish delivers to subscribers", () => {
  const broker = mbMod.createMessageBroker();
  const received = [];
  broker.subscribe("orders", (msg) => received.push(msg));
  broker.publish("orders", { id: 1, total: 100 });
  if (received.length !== 1) throw new Error(`expected 1, got ${received.length}`);
  if (received[0].id !== 1) throw new Error("wrong message");
});

assert("wildcard subscription", () => {
  const broker = mbMod.createMessageBroker();
  const received = [];
  broker.subscribe("events.*", (msg) => received.push(msg));
  broker.publish("events.click", { x: 10 });
  broker.publish("events.scroll", { y: 20 });
  broker.publish("other.topic", { z: 30 });
  if (received.length !== 2) throw new Error(`expected 2, got ${received.length}`);
});

assert("unsubscribe stops delivery", () => {
  const broker = mbMod.createMessageBroker();
  const received = [];
  const unsub = broker.subscribe("topic", (msg) => received.push(msg));
  broker.publish("topic", { a: 1 });
  unsub();
  broker.publish("topic", { a: 2 });
  if (received.length !== 1) throw new Error(`expected 1, got ${received.length}`);
});

assert("getStats returns topic count", () => {
  const broker = mbMod.createMessageBroker();
  broker.subscribe("a", () => {});
  broker.subscribe("b", () => {});
  const stats = broker.getStats();
  if (stats.topicCount !== 2) throw new Error(`expected 2, got ${stats.topicCount}`);
});

// ── Part 2: Message Serializer ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Message Serializer\x1b[0m");

const msLib = join(process.cwd(), "tools/ogu/commands/lib/message-serializer.mjs");
assert("message-serializer.mjs exists", () => {
  if (!existsSync(msLib)) throw new Error("file missing");
});

const msMod = await import(msLib);

assert("createSerializer returns serializer", () => {
  if (typeof msMod.createSerializer !== "function") throw new Error("missing");
  const s = msMod.createSerializer({ format: "json" });
  if (typeof s.serialize !== "function") throw new Error("missing serialize");
  if (typeof s.deserialize !== "function") throw new Error("missing deserialize");
});

assert("json roundtrip works", () => {
  const s = msMod.createSerializer({ format: "json" });
  const msg = { type: "event", data: { x: 42 } };
  const encoded = s.serialize(msg);
  if (typeof encoded !== "string") throw new Error("should be string");
  const decoded = s.deserialize(encoded);
  if (decoded.type !== "event") throw new Error("type mismatch");
  if (decoded.data.x !== 42) throw new Error("data mismatch");
});

assert("envelope format wraps with metadata", () => {
  const s = msMod.createSerializer({ format: "envelope" });
  const encoded = s.serialize({ type: "cmd", payload: "go" });
  const decoded = s.deserialize(encoded);
  if (!decoded.timestamp) throw new Error("missing timestamp");
  if (decoded.payload.type !== "cmd") throw new Error("missing payload");
});

assert("deserialize invalid data throws", () => {
  const s = msMod.createSerializer({ format: "json" });
  let threw = false;
  try { s.deserialize("not valid json{{{"); } catch { threw = true; }
  if (!threw) throw new Error("should throw on invalid");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
