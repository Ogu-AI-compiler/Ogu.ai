/**
 * Slice 143 — Webhook Manager + Event Bus Bridge
 *
 * Webhook Manager: register and dispatch webhooks on events.
 * Event Bus Bridge: bridge between internal event bus and external systems.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 143 — Webhook Manager + Event Bus Bridge\x1b[0m\n");

// ── Part 1: Webhook Manager ──────────────────────────────

console.log("\x1b[36m  Part 1: Webhook Manager\x1b[0m");

const wmLib = join(process.cwd(), "tools/ogu/commands/lib/webhook-manager.mjs");
assert("webhook-manager.mjs exists", () => {
  if (!existsSync(wmLib)) throw new Error("file missing");
});

const wmMod = await import(wmLib);

assert("createWebhookManager returns manager", () => {
  if (typeof wmMod.createWebhookManager !== "function") throw new Error("missing");
  const mgr = wmMod.createWebhookManager();
  if (typeof mgr.register !== "function") throw new Error("missing register");
  if (typeof mgr.dispatch !== "function") throw new Error("missing dispatch");
});

assert("register adds webhook", () => {
  const mgr = wmMod.createWebhookManager();
  const hook = mgr.register({ event: "build.complete", url: "https://hooks.example.com/build", secret: "abc" });
  if (!hook.id) throw new Error("missing id");
  const all = mgr.listWebhooks();
  if (all.length !== 1) throw new Error(`expected 1, got ${all.length}`);
});

assert("dispatch calls matching handlers", () => {
  const mgr = wmMod.createWebhookManager();
  const dispatched = [];
  mgr.register({
    event: "deploy.start",
    url: "https://a.com",
    handler: (payload) => dispatched.push(payload),
  });
  mgr.register({
    event: "build.done",
    url: "https://b.com",
    handler: (payload) => dispatched.push(payload),
  });
  mgr.dispatch("deploy.start", { env: "prod" });
  if (dispatched.length !== 1) throw new Error(`expected 1, got ${dispatched.length}`);
  if (dispatched[0].env !== "prod") throw new Error("wrong payload");
});

assert("unregister removes webhook", () => {
  const mgr = wmMod.createWebhookManager();
  const hook = mgr.register({ event: "x", url: "https://x.com" });
  mgr.unregister(hook.id);
  if (mgr.listWebhooks().length !== 0) throw new Error("should be empty");
});

// ── Part 2: Event Bus Bridge ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Event Bus Bridge\x1b[0m");

const ebbLib = join(process.cwd(), "tools/ogu/commands/lib/event-bus-bridge.mjs");
assert("event-bus-bridge.mjs exists", () => {
  if (!existsSync(ebbLib)) throw new Error("file missing");
});

const ebbMod = await import(ebbLib);

assert("createEventBusBridge returns bridge", () => {
  if (typeof ebbMod.createEventBusBridge !== "function") throw new Error("missing");
  const bridge = ebbMod.createEventBusBridge();
  if (typeof bridge.addAdapter !== "function") throw new Error("missing addAdapter");
  if (typeof bridge.forward !== "function") throw new Error("missing forward");
});

assert("forward sends event to all adapters", () => {
  const bridge = ebbMod.createEventBusBridge();
  const received = [];
  bridge.addAdapter({ name: "slack", handle: (e) => received.push({ to: "slack", ...e }) });
  bridge.addAdapter({ name: "log", handle: (e) => received.push({ to: "log", ...e }) });
  bridge.forward({ type: "gate.passed", data: { gate: 5 } });
  if (received.length !== 2) throw new Error(`expected 2, got ${received.length}`);
});

assert("addAdapter with filter only receives matching", () => {
  const bridge = ebbMod.createEventBusBridge();
  const received = [];
  bridge.addAdapter({
    name: "deploy-only",
    filter: (e) => e.type.startsWith("deploy."),
    handle: (e) => received.push(e),
  });
  bridge.forward({ type: "build.done", data: {} });
  bridge.forward({ type: "deploy.start", data: {} });
  if (received.length !== 1) throw new Error(`expected 1, got ${received.length}`);
});

assert("removeAdapter stops delivery", () => {
  const bridge = ebbMod.createEventBusBridge();
  const received = [];
  bridge.addAdapter({ name: "a", handle: (e) => received.push(e) });
  bridge.forward({ type: "x", data: {} });
  bridge.removeAdapter("a");
  bridge.forward({ type: "y", data: {} });
  if (received.length !== 1) throw new Error(`expected 1, got ${received.length}`);
});

assert("getStats tracks forwarded count", () => {
  const bridge = ebbMod.createEventBusBridge();
  bridge.addAdapter({ name: "a", handle: () => {} });
  bridge.forward({ type: "x", data: {} });
  bridge.forward({ type: "y", data: {} });
  const stats = bridge.getStats();
  if (stats.totalForwarded !== 2) throw new Error(`expected 2, got ${stats.totalForwarded}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
