/**
 * Slice 141 — Service Registry
 *
 * Service Registry: register, discover, and health-check services.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 141 — Service Registry\x1b[0m\n");

// ── Part 1: Service Registry ──────────────────────────────

console.log("\x1b[36m  Part 1: Service Registry\x1b[0m");

const srLib = join(process.cwd(), "tools/ogu/commands/lib/service-registry.mjs");
assert("service-registry.mjs exists", () => {
  if (!existsSync(srLib)) throw new Error("file missing");
});

const srMod = await import(srLib);

assert("createServiceRegistry returns registry", () => {
  if (typeof srMod.createServiceRegistry !== "function") throw new Error("missing");
  const reg = srMod.createServiceRegistry();
  if (typeof reg.register !== "function") throw new Error("missing register");
  if (typeof reg.discover !== "function") throw new Error("missing discover");
});

assert("register and discover service", () => {
  const reg = srMod.createServiceRegistry();
  reg.register({ name: "api-gateway", url: "http://localhost:3000", tags: ["http", "gateway"] });
  const found = reg.discover("api-gateway");
  if (!found) throw new Error("should find service");
  if (found.url !== "http://localhost:3000") throw new Error("wrong url");
});

assert("discover by tag", () => {
  const reg = srMod.createServiceRegistry();
  reg.register({ name: "svc-a", url: "http://a", tags: ["http"] });
  reg.register({ name: "svc-b", url: "http://b", tags: ["grpc"] });
  reg.register({ name: "svc-c", url: "http://c", tags: ["http"] });
  const httpServices = reg.discoverByTag("http");
  if (httpServices.length !== 2) throw new Error(`expected 2, got ${httpServices.length}`);
});

assert("deregister removes service", () => {
  const reg = srMod.createServiceRegistry();
  reg.register({ name: "temp", url: "http://temp", tags: [] });
  reg.deregister("temp");
  if (reg.discover("temp")) throw new Error("should be removed");
});

assert("listAll returns all registered", () => {
  const reg = srMod.createServiceRegistry();
  reg.register({ name: "a", url: "http://a", tags: [] });
  reg.register({ name: "b", url: "http://b", tags: [] });
  const all = reg.listAll();
  if (all.length !== 2) throw new Error(`expected 2, got ${all.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
