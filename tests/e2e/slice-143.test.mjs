/**
 * Slice 143 — Webhook Manager
 *
 * Webhook Manager: register and dispatch webhooks on events.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 143 — Webhook Manager\x1b[0m\n");

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

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
