/**
 * Slice 165 — Protocol Factory + Protocol Handler
 *
 * Protocol Factory: create protocol instances via pluggable factory.
 * Protocol Handler: handle protocol-specific operations.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 165 — Protocol Factory + Protocol Handler\x1b[0m\n");

// ── Part 1: Protocol Factory ──────────────────────────────

console.log("\x1b[36m  Part 1: Protocol Factory\x1b[0m");

const pfLib = join(process.cwd(), "tools/ogu/commands/lib/protocol-factory.mjs");
assert("protocol-factory.mjs exists", () => {
  if (!existsSync(pfLib)) throw new Error("file missing");
});

const pfMod = await import(pfLib);

assert("createProtocolFactory returns factory", () => {
  if (typeof pfMod.createProtocolFactory !== "function") throw new Error("missing");
  const factory = pfMod.createProtocolFactory();
  if (typeof factory.register !== "function") throw new Error("missing register");
  if (typeof factory.create !== "function") throw new Error("missing create");
  if (typeof factory.listProtocols !== "function") throw new Error("missing listProtocols");
});

assert("register and create protocol", () => {
  const factory = pfMod.createProtocolFactory();
  factory.register("http", (opts) => ({ type: "http", ...opts }));
  const proto = factory.create("http", { port: 80 });
  if (proto.type !== "http") throw new Error("type mismatch");
  if (proto.port !== 80) throw new Error("port mismatch");
});

assert("create unknown protocol throws", () => {
  const factory = pfMod.createProtocolFactory();
  let threw = false;
  try { factory.create("unknown", {}); } catch { threw = true; }
  if (!threw) throw new Error("should throw for unknown protocol");
});

assert("listProtocols returns registered names", () => {
  const factory = pfMod.createProtocolFactory();
  factory.register("ws", () => ({}));
  factory.register("grpc", () => ({}));
  const list = factory.listProtocols();
  if (list.length !== 2) throw new Error(`expected 2, got ${list.length}`);
  if (!list.includes("ws")) throw new Error("missing ws");
});

assert("can override registered protocol", () => {
  const factory = pfMod.createProtocolFactory();
  factory.register("http", () => ({ version: 1 }));
  factory.register("http", () => ({ version: 2 }));
  const proto = factory.create("http", {});
  if (proto.version !== 2) throw new Error("should use latest registration");
});

// ── Part 2: Protocol Handler ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Protocol Handler\x1b[0m");

const phLib = join(process.cwd(), "tools/ogu/commands/lib/protocol-handler.mjs");
assert("protocol-handler.mjs exists", () => {
  if (!existsSync(phLib)) throw new Error("file missing");
});

const phMod = await import(phLib);

assert("createProtocolHandler returns handler", () => {
  if (typeof phMod.createProtocolHandler !== "function") throw new Error("missing");
  const handler = phMod.createProtocolHandler({ protocol: "http" });
  if (typeof handler.onMessage !== "function") throw new Error("missing onMessage");
  if (typeof handler.send !== "function") throw new Error("missing send");
});

assert("onMessage registers handler", () => {
  const handler = phMod.createProtocolHandler({ protocol: "http" });
  const received = [];
  handler.onMessage("request", (msg) => received.push(msg));
  handler.receive("request", { url: "/api" });
  if (received.length !== 1) throw new Error(`expected 1, got ${received.length}`);
});

assert("send encodes and records outgoing", () => {
  const handler = phMod.createProtocolHandler({ protocol: "ws" });
  const result = handler.send("message", { data: "hello" });
  if (!result.encoded) throw new Error("missing encoded");
  if (result.type !== "message") throw new Error("type mismatch");
});

assert("getStats tracks message counts", () => {
  const handler = phMod.createProtocolHandler({ protocol: "http" });
  handler.onMessage("req", () => {});
  handler.receive("req", {});
  handler.receive("req", {});
  handler.send("res", {});
  const stats = handler.getStats();
  if (stats.received !== 2) throw new Error(`expected 2 received, got ${stats.received}`);
  if (stats.sent !== 1) throw new Error(`expected 1 sent, got ${stats.sent}`);
});

assert("unhandled message type is ignored", () => {
  const handler = phMod.createProtocolHandler({ protocol: "http" });
  // no handler registered for "unknown"
  handler.receive("unknown", { x: 1 });
  const stats = handler.getStats();
  if (stats.received !== 1) throw new Error("should still count");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
