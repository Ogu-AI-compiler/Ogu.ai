/**
 * Slice 139 — Notification Router
 *
 * Notification Router: route notifications to channels by type and severity.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 139 — Notification Router\x1b[0m\n");

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

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
