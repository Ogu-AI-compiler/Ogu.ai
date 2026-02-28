/**
 * Slice 85 — Dependency Injection + Service Locator
 *
 * DI container: register and resolve dependencies.
 * Service locator: global service discovery and lifecycle.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 85 — Dependency Injection + Service Locator\x1b[0m\n");

// ── Part 1: DI Container ──────────────────────────────

console.log("\x1b[36m  Part 1: DI Container\x1b[0m");

const diLib = join(process.cwd(), "tools/ogu/commands/lib/di-container.mjs");
assert("di-container.mjs exists", () => {
  if (!existsSync(diLib)) throw new Error("file missing");
});

const diMod = await import(diLib);

assert("createContainer returns container", () => {
  if (typeof diMod.createContainer !== "function") throw new Error("missing");
  const c = diMod.createContainer();
  if (typeof c.register !== "function") throw new Error("missing register");
  if (typeof c.resolve !== "function") throw new Error("missing resolve");
});

assert("register and resolve a value", () => {
  const c = diMod.createContainer();
  c.register("config", { port: 3000 });
  const val = c.resolve("config");
  if (val.port !== 3000) throw new Error("wrong value");
});

assert("register factory creates instance on resolve", () => {
  const c = diMod.createContainer();
  let count = 0;
  c.registerFactory("counter", () => ({ value: ++count }));
  const a = c.resolve("counter");
  const b = c.resolve("counter");
  if (a.value !== 1 || b.value !== 2) throw new Error("factory should create new each time");
});

assert("registerSingleton returns same instance", () => {
  const c = diMod.createContainer();
  let count = 0;
  c.registerSingleton("single", () => ({ value: ++count }));
  const a = c.resolve("single");
  const b = c.resolve("single");
  if (a !== b) throw new Error("singleton should return same ref");
});

assert("resolve throws for unknown dependency", () => {
  const c = diMod.createContainer();
  let threw = false;
  try { c.resolve("nope"); } catch (_) { threw = true; }
  if (!threw) throw new Error("should throw for unknown");
});

assert("has checks if dependency is registered", () => {
  const c = diMod.createContainer();
  c.register("db", {});
  if (!c.has("db")) throw new Error("should have db");
  if (c.has("missing")) throw new Error("should not have missing");
});

// ── Part 2: Service Locator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Service Locator\x1b[0m");

const slLib = join(process.cwd(), "tools/ogu/commands/lib/service-locator.mjs");
assert("service-locator.mjs exists", () => {
  if (!existsSync(slLib)) throw new Error("file missing");
});

const slMod = await import(slLib);

assert("createServiceLocator returns locator", () => {
  if (typeof slMod.createServiceLocator !== "function") throw new Error("missing");
  const loc = slMod.createServiceLocator();
  if (typeof loc.register !== "function") throw new Error("missing register");
  if (typeof loc.get !== "function") throw new Error("missing get");
  if (typeof loc.listServices !== "function") throw new Error("missing listServices");
});

assert("register and get a service", () => {
  const loc = slMod.createServiceLocator();
  loc.register("logger", { log: () => {} });
  const svc = loc.get("logger");
  if (typeof svc.log !== "function") throw new Error("wrong service");
});

assert("listServices returns registered names", () => {
  const loc = slMod.createServiceLocator();
  loc.register("a", {});
  loc.register("b", {});
  const list = loc.listServices();
  if (list.length !== 2) throw new Error(`expected 2, got ${list.length}`);
  if (!list.includes("a") || !list.includes("b")) throw new Error("missing service names");
});

assert("unregister removes service", () => {
  const loc = slMod.createServiceLocator();
  loc.register("temp", {});
  loc.unregister("temp");
  if (loc.get("temp") !== null && loc.get("temp") !== undefined) {
    // Check if it throws or returns null
    let threw = false;
    try { loc.get("temp"); } catch (_) { threw = true; }
  }
  if (loc.listServices().includes("temp")) throw new Error("should be removed");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
