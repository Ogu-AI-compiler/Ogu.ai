/**
 * Slice 136 — Config Registry + Environment Resolver
 *
 * Config Registry: centralized configuration with layered overrides.
 * Environment Resolver: resolve environment-specific values.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 136 — Config Registry + Environment Resolver\x1b[0m\n");

// ── Part 1: Config Registry ──────────────────────────────

console.log("\x1b[36m  Part 1: Config Registry\x1b[0m");

const crLib = join(process.cwd(), "tools/ogu/commands/lib/config-registry.mjs");
assert("config-registry.mjs exists", () => {
  if (!existsSync(crLib)) throw new Error("file missing");
});

const crMod = await import(crLib);

assert("createConfigRegistry returns registry", () => {
  if (typeof crMod.createConfigRegistry !== "function") throw new Error("missing");
  const reg = crMod.createConfigRegistry();
  if (typeof reg.set !== "function") throw new Error("missing set");
  if (typeof reg.get !== "function") throw new Error("missing get");
  if (typeof reg.addLayer !== "function") throw new Error("missing addLayer");
});

assert("set and get basic values", () => {
  const reg = crMod.createConfigRegistry();
  reg.set("model.default", "sonnet");
  if (reg.get("model.default") !== "sonnet") throw new Error("wrong value");
});

assert("addLayer overrides base values", () => {
  const reg = crMod.createConfigRegistry();
  reg.set("model.default", "sonnet");
  reg.set("model.fallback", "haiku");
  reg.addLayer("production", { "model.default": "opus" });
  reg.activateLayer("production");
  if (reg.get("model.default") !== "opus") throw new Error("layer should override");
  if (reg.get("model.fallback") !== "haiku") throw new Error("non-overridden should stay");
});

assert("getAll returns merged config", () => {
  const reg = crMod.createConfigRegistry();
  reg.set("a", 1);
  reg.set("b", 2);
  const all = reg.getAll();
  if (all.a !== 1 || all.b !== 2) throw new Error("missing values");
});

assert("deactivateLayer restores base", () => {
  const reg = crMod.createConfigRegistry();
  reg.set("x", "base");
  reg.addLayer("dev", { x: "dev" });
  reg.activateLayer("dev");
  if (reg.get("x") !== "dev") throw new Error("should be dev");
  reg.deactivateLayer("dev");
  if (reg.get("x") !== "base") throw new Error("should revert to base");
});

// ── Part 2: Environment Resolver ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Environment Resolver\x1b[0m");

const erLib = join(process.cwd(), "tools/ogu/commands/lib/environment-resolver.mjs");
assert("environment-resolver.mjs exists", () => {
  if (!existsSync(erLib)) throw new Error("file missing");
});

const erMod = await import(erLib);

assert("createEnvironmentResolver returns resolver", () => {
  if (typeof erMod.createEnvironmentResolver !== "function") throw new Error("missing");
  const resolver = erMod.createEnvironmentResolver();
  if (typeof resolver.define !== "function") throw new Error("missing define");
  if (typeof resolver.resolve !== "function") throw new Error("missing resolve");
});

assert("define and resolve environment values", () => {
  const resolver = erMod.createEnvironmentResolver();
  resolver.define("development", { apiUrl: "http://localhost:3000", debug: true });
  resolver.define("production", { apiUrl: "https://api.prod.com", debug: false });
  const dev = resolver.resolve("development");
  if (dev.apiUrl !== "http://localhost:3000") throw new Error("wrong dev apiUrl");
  if (dev.debug !== true) throw new Error("wrong debug");
  const prod = resolver.resolve("production");
  if (prod.debug !== false) throw new Error("prod should not debug");
});

assert("resolve with defaults", () => {
  const resolver = erMod.createEnvironmentResolver({ defaults: { timeout: 5000, retries: 3 } });
  resolver.define("prod", { timeout: 10000 });
  const config = resolver.resolve("prod");
  if (config.timeout !== 10000) throw new Error("should override default");
  if (config.retries !== 3) throw new Error("should keep default");
});

assert("listEnvironments returns all defined", () => {
  const resolver = erMod.createEnvironmentResolver();
  resolver.define("dev", { a: 1 });
  resolver.define("staging", { a: 2 });
  resolver.define("prod", { a: 3 });
  const envs = resolver.listEnvironments();
  if (envs.length !== 3) throw new Error(`expected 3, got ${envs.length}`);
});

assert("resolve unknown env throws", () => {
  const resolver = erMod.createEnvironmentResolver();
  let threw = false;
  try { resolver.resolve("nonexistent"); } catch { threw = true; }
  if (!threw) throw new Error("should throw for unknown env");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
