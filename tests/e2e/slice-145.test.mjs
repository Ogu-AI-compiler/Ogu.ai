/**
 * Slice 145 — Plugin System
 *
 * Plugin System: load and manage plugins with lifecycle hooks.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 145 — Plugin System\x1b[0m\n");

// ── Part 1: Plugin System ──────────────────────────────

console.log("\x1b[36m  Part 1: Plugin System\x1b[0m");

const psLib = join(process.cwd(), "tools/ogu/commands/lib/plugin-system.mjs");
assert("plugin-system.mjs exists", () => {
  if (!existsSync(psLib)) throw new Error("file missing");
});

const psMod = await import(psLib);

assert("createPluginSystem returns system", () => {
  if (typeof psMod.createPluginSystem !== "function") throw new Error("missing");
  const sys = psMod.createPluginSystem();
  if (typeof sys.register !== "function") throw new Error("missing register");
  if (typeof sys.initialize !== "function") throw new Error("missing initialize");
  if (typeof sys.listPlugins !== "function") throw new Error("missing listPlugins");
});

assert("register adds plugin", () => {
  const sys = psMod.createPluginSystem();
  sys.register({ name: "my-plugin", version: "1.0", init: () => {} });
  const plugins = sys.listPlugins();
  if (plugins.length !== 1) throw new Error(`expected 1, got ${plugins.length}`);
  if (plugins[0].name !== "my-plugin") throw new Error("wrong name");
});

assert("initialize calls init on all plugins", () => {
  const sys = psMod.createPluginSystem();
  const initialized = [];
  sys.register({ name: "p1", version: "1.0", init: () => initialized.push("p1") });
  sys.register({ name: "p2", version: "2.0", init: () => initialized.push("p2") });
  sys.initialize();
  if (initialized.length !== 2) throw new Error(`expected 2, got ${initialized.length}`);
});

assert("disable prevents plugin from initializing", () => {
  const sys = psMod.createPluginSystem();
  const initialized = [];
  sys.register({ name: "p1", version: "1.0", init: () => initialized.push("p1") });
  sys.register({ name: "p2", version: "1.0", init: () => initialized.push("p2") });
  sys.disable("p2");
  sys.initialize();
  if (initialized.length !== 1) throw new Error("disabled should not init");
  if (initialized[0] !== "p1") throw new Error("wrong plugin init'd");
});

assert("getPlugin returns specific plugin", () => {
  const sys = psMod.createPluginSystem();
  sys.register({ name: "auth", version: "1.0", init: () => {} });
  const plugin = sys.getPlugin("auth");
  if (!plugin) throw new Error("should find plugin");
  if (plugin.version !== "1.0") throw new Error("wrong version");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
