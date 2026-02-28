/**
 * Slice 141 — Dependency Injector + Service Registry
 *
 * Dependency Injector: wire dependencies for subsystem initialization.
 * Service Registry: register, discover, and health-check services.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 141 — Dependency Injector + Service Registry\x1b[0m\n");

// ── Part 1: Dependency Injector ──────────────────────────────

console.log("\x1b[36m  Part 1: Dependency Injector\x1b[0m");

const diLib = join(process.cwd(), "tools/ogu/commands/lib/dependency-injector.mjs");
assert("dependency-injector.mjs exists", () => {
  if (!existsSync(diLib)) throw new Error("file missing");
});

const diMod = await import(diLib);

assert("createContainer returns container", () => {
  if (typeof diMod.createContainer !== "function") throw new Error("missing");
  const container = diMod.createContainer();
  if (typeof container.register !== "function") throw new Error("missing register");
  if (typeof container.resolve !== "function") throw new Error("missing resolve");
});

assert("register and resolve a value", () => {
  const c = diMod.createContainer();
  c.register("config", () => ({ port: 3000 }));
  const config = c.resolve("config");
  if (config.port !== 3000) throw new Error("wrong value");
});

assert("resolve with dependencies", () => {
  const c = diMod.createContainer();
  c.register("db", () => ({ url: "postgres://localhost" }));
  c.register("repo", (deps) => ({ db: deps.db, find: () => "found" }), ["db"]);
  const repo = c.resolve("repo");
  if (repo.db.url !== "postgres://localhost") throw new Error("wrong db");
  if (repo.find() !== "found") throw new Error("wrong find");
});

assert("singleton returns same instance", () => {
  const c = diMod.createContainer();
  let calls = 0;
  c.register("svc", () => { calls++; return { id: calls }; }, [], { singleton: true });
  const a = c.resolve("svc");
  const b = c.resolve("svc");
  if (a !== b) throw new Error("should be same instance");
  if (calls !== 1) throw new Error("factory should be called once");
});

assert("resolve unknown throws", () => {
  const c = diMod.createContainer();
  let threw = false;
  try { c.resolve("nope"); } catch { threw = true; }
  if (!threw) throw new Error("should throw");
});

// ── Part 2: Service Registry ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Service Registry\x1b[0m");

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
