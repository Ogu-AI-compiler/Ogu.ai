/**
 * Slice 76 — Daemon Registry
 *

 * Daemon registry: service discovery for runners and daemons.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice76-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 76 — Daemon Registry\x1b[0m\n");

// ── Part 1: Daemon Registry ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Daemon Registry\x1b[0m");

const drLib = join(process.cwd(), "tools/ogu/commands/lib/daemon-registry.mjs");
assert("daemon-registry.mjs exists", () => {
  if (!existsSync(drLib)) throw new Error("file missing");
});

const drMod = await import(drLib);

assert("createDaemonRegistry returns registry", () => {
  if (typeof drMod.createDaemonRegistry !== "function") throw new Error("missing");
  const reg = drMod.createDaemonRegistry();
  if (typeof reg.register !== "function") throw new Error("missing register");
  if (typeof reg.unregister !== "function") throw new Error("missing unregister");
  if (typeof reg.discover !== "function") throw new Error("missing discover");
});

assert("register adds service", () => {
  const reg = drMod.createDaemonRegistry();
  reg.register({ name: "runner-1", type: "runner", host: "localhost", port: 8081 });
  const services = reg.listServices();
  if (services.length !== 1) throw new Error(`expected 1, got ${services.length}`);
  if (services[0].name !== "runner-1") throw new Error("wrong name");
});

assert("discover finds services by type", () => {
  const reg = drMod.createDaemonRegistry();
  reg.register({ name: "r1", type: "runner", host: "localhost", port: 8081 });
  reg.register({ name: "r2", type: "runner", host: "localhost", port: 8082 });
  reg.register({ name: "d1", type: "daemon", host: "localhost", port: 9000 });
  const runners = reg.discover("runner");
  if (runners.length !== 2) throw new Error(`expected 2 runners, got ${runners.length}`);
});

assert("unregister removes service", () => {
  const reg = drMod.createDaemonRegistry();
  reg.register({ name: "s1", type: "runner", host: "localhost", port: 8081 });
  reg.unregister("s1");
  const services = reg.listServices();
  if (services.length !== 0) throw new Error("should be empty after unregister");
});

assert("heartbeat updates last seen", () => {
  const reg = drMod.createDaemonRegistry();
  reg.register({ name: "s1", type: "runner", host: "localhost", port: 8081 });
  reg.heartbeat("s1");
  const svc = reg.getService("s1");
  if (!svc.lastSeen) throw new Error("should have lastSeen");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
