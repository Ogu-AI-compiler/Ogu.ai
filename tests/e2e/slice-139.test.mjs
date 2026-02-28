/**
 * Slice 139 — Notification Router + Alert Manager
 *
 * Notification Router: route notifications to channels by type and severity.
 * Alert Manager: manage alert lifecycle (fire, acknowledge, resolve, silence).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 139 — Notification Router + Alert Manager\x1b[0m\n");

// ── Part 1: Notification Router ──────────────────────────────

console.log("\x1b[36m  Part 1: Notification Router\x1b[0m");

const nrLib = join(process.cwd(), "tools/ogu/commands/lib/notification-router.mjs");
assert("notification-router.mjs exists", () => {
  if (!existsSync(nrLib)) throw new Error("file missing");
});

const nrMod = await import(nrLib);

assert("createNotificationRouter returns router", () => {
  if (typeof nrMod.createNotificationRouter !== "function") throw new Error("missing");
  const router = nrMod.createNotificationRouter();
  if (typeof router.addRoute !== "function") throw new Error("missing addRoute");
  if (typeof router.route !== "function") throw new Error("missing route");
});

assert("route sends to correct channel", () => {
  const router = nrMod.createNotificationRouter();
  const delivered = [];
  router.addRoute({ type: "error", channel: "slack", handler: (msg) => delivered.push({ ch: "slack", msg }) });
  router.addRoute({ type: "info", channel: "log", handler: (msg) => delivered.push({ ch: "log", msg }) });
  router.route({ type: "error", message: "build failed" });
  if (delivered.length !== 1) throw new Error(`expected 1, got ${delivered.length}`);
  if (delivered[0].ch !== "slack") throw new Error("should route to slack");
});

assert("route to multiple channels for same type", () => {
  const router = nrMod.createNotificationRouter();
  const delivered = [];
  router.addRoute({ type: "critical", channel: "slack", handler: (msg) => delivered.push("slack") });
  router.addRoute({ type: "critical", channel: "email", handler: (msg) => delivered.push("email") });
  router.route({ type: "critical", message: "system down" });
  if (delivered.length !== 2) throw new Error(`expected 2, got ${delivered.length}`);
});

assert("unmatched type goes to default", () => {
  const router = nrMod.createNotificationRouter();
  const delivered = [];
  router.addRoute({ type: "*", channel: "log", handler: (msg) => delivered.push("default") });
  router.route({ type: "unknown", message: "something" });
  if (delivered.length !== 1) throw new Error("should use default route");
});

// ── Part 2: Alert Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Alert Manager\x1b[0m");

const amLib = join(process.cwd(), "tools/ogu/commands/lib/alert-manager.mjs");
assert("alert-manager.mjs exists", () => {
  if (!existsSync(amLib)) throw new Error("file missing");
});

const amMod = await import(amLib);

assert("createAlertManager returns manager", () => {
  if (typeof amMod.createAlertManager !== "function") throw new Error("missing");
  const mgr = amMod.createAlertManager();
  if (typeof mgr.fire !== "function") throw new Error("missing fire");
  if (typeof mgr.acknowledge !== "function") throw new Error("missing acknowledge");
  if (typeof mgr.resolve !== "function") throw new Error("missing resolve");
});

assert("fire creates active alert", () => {
  const mgr = amMod.createAlertManager();
  const alert = mgr.fire({ name: "high-cpu", severity: "warning", message: "CPU at 90%" });
  if (!alert.id) throw new Error("missing alert id");
  if (alert.status !== "firing") throw new Error(`expected firing, got ${alert.status}`);
});

assert("acknowledge transitions to acknowledged", () => {
  const mgr = amMod.createAlertManager();
  const alert = mgr.fire({ name: "disk-full", severity: "critical", message: "Disk 95%" });
  const acked = mgr.acknowledge(alert.id, { by: "ops" });
  if (acked.status !== "acknowledged") throw new Error(`expected acknowledged, got ${acked.status}`);
});

assert("resolve transitions to resolved", () => {
  const mgr = amMod.createAlertManager();
  const alert = mgr.fire({ name: "mem-leak", severity: "warning", message: "Memory growing" });
  mgr.acknowledge(alert.id, { by: "dev" });
  const resolved = mgr.resolve(alert.id, { by: "dev", resolution: "fixed leak" });
  if (resolved.status !== "resolved") throw new Error(`expected resolved, got ${resolved.status}`);
});

assert("silence suppresses alerts by name", () => {
  const mgr = amMod.createAlertManager();
  mgr.silence("noisy-alert", { duration: 60000 });
  const alert = mgr.fire({ name: "noisy-alert", severity: "info", message: "noise" });
  if (!alert.silenced) throw new Error("should be silenced");
});

assert("getActiveAlerts excludes resolved", () => {
  const mgr = amMod.createAlertManager();
  const a1 = mgr.fire({ name: "a", severity: "warning", message: "x" });
  const a2 = mgr.fire({ name: "b", severity: "critical", message: "y" });
  mgr.acknowledge(a1.id, { by: "x" });
  mgr.resolve(a1.id, { by: "x" });
  const active = mgr.getActiveAlerts();
  if (active.length !== 1) throw new Error(`expected 1 active, got ${active.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
