/**
 * Slice 60 — Plugin System + Hook Registry
 *
 * Plugin system: load, register, and execute plugins with lifecycle hooks.
 * Hook registry: before/after hooks for pipeline phases.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice60-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/plugins"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 60 — Plugin System + Hook Registry\x1b[0m\n");
console.log("  Plugin lifecycle, before/after hooks\n");

// ── Part 1: Plugin System ──────────────────────────────

console.log("\x1b[36m  Part 1: Plugin System\x1b[0m");

const pluginLib = join(process.cwd(), "tools/ogu/commands/lib/plugin-system.mjs");
assert("plugin-system.mjs exists", () => {
  if (!existsSync(pluginLib)) throw new Error("file missing");
});

const pluginMod = await import(pluginLib);

assert("createPluginManager returns manager", () => {
  if (typeof pluginMod.createPluginManager !== "function") throw new Error("missing");
  const mgr = pluginMod.createPluginManager();
  if (typeof mgr.register !== "function") throw new Error("missing register");
  if (typeof mgr.unregister !== "function") throw new Error("missing unregister");
  if (typeof mgr.execute !== "function") throw new Error("missing execute");
  if (typeof mgr.listPlugins !== "function") throw new Error("missing listPlugins");
});

assert("register adds plugin", () => {
  const mgr = pluginMod.createPluginManager();
  mgr.register({
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0",
    hooks: { "build:before": () => ({ ok: true }) },
  });
  const plugins = mgr.listPlugins();
  if (plugins.length !== 1) throw new Error(`expected 1, got ${plugins.length}`);
  if (plugins[0].id !== "test-plugin") throw new Error("wrong id");
});

assert("unregister removes plugin", () => {
  const mgr = pluginMod.createPluginManager();
  mgr.register({ id: "p1", name: "P1", version: "1.0", hooks: {} });
  mgr.register({ id: "p2", name: "P2", version: "1.0", hooks: {} });
  mgr.unregister("p1");
  const plugins = mgr.listPlugins();
  if (plugins.length !== 1) throw new Error(`expected 1, got ${plugins.length}`);
});

assert("execute runs hooks in order", () => {
  const mgr = pluginMod.createPluginManager();
  const order = [];
  mgr.register({
    id: "first",
    name: "First",
    version: "1.0",
    hooks: { "build:before": () => { order.push("first"); return { ok: true }; } },
  });
  mgr.register({
    id: "second",
    name: "Second",
    version: "1.0",
    hooks: { "build:before": () => { order.push("second"); return { ok: true }; } },
  });
  const results = mgr.execute("build:before", {});
  if (order.length !== 2) throw new Error(`expected 2 executions, got ${order.length}`);
  if (order[0] !== "first") throw new Error("wrong order");
  if (!Array.isArray(results)) throw new Error("should return array");
});

assert("execute passes context to hooks", () => {
  const mgr = pluginMod.createPluginManager();
  let received = null;
  mgr.register({
    id: "ctx-test",
    name: "Context Test",
    version: "1.0",
    hooks: { "compile:after": (ctx) => { received = ctx; return { ok: true }; } },
  });
  mgr.execute("compile:after", { feature: "auth", status: "pass" });
  if (!received) throw new Error("should receive context");
  if (received.feature !== "auth") throw new Error("wrong context");
});

assert("PLUGIN_HOOKS lists available hook points", () => {
  if (!pluginMod.PLUGIN_HOOKS) throw new Error("missing");
  if (!pluginMod.PLUGIN_HOOKS.includes("build:before")) throw new Error("missing build:before");
  if (!pluginMod.PLUGIN_HOOKS.includes("build:after")) throw new Error("missing build:after");
  if (!pluginMod.PLUGIN_HOOKS.includes("compile:before")) throw new Error("missing compile:before");
  if (!pluginMod.PLUGIN_HOOKS.includes("compile:after")) throw new Error("missing compile:after");
});

// ── Part 2: Hook Registry ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Hook Registry\x1b[0m");

const hookLib = join(process.cwd(), "tools/ogu/commands/lib/hook-registry.mjs");
assert("hook-registry.mjs exists", () => {
  if (!existsSync(hookLib)) throw new Error("file missing");
});

const hookMod = await import(hookLib);

assert("createHookRegistry returns registry", () => {
  if (typeof hookMod.createHookRegistry !== "function") throw new Error("missing");
  const reg = hookMod.createHookRegistry();
  if (typeof reg.before !== "function") throw new Error("missing before");
  if (typeof reg.after !== "function") throw new Error("missing after");
  if (typeof reg.run !== "function") throw new Error("missing run");
});

assert("before/after registers hooks", () => {
  const reg = hookMod.createHookRegistry();
  reg.before("build", () => "pre-build");
  reg.after("build", () => "post-build");
  const hooks = reg.getHooks("build");
  if (hooks.before.length !== 1) throw new Error("missing before hook");
  if (hooks.after.length !== 1) throw new Error("missing after hook");
});

assert("run executes before hooks, action, then after hooks", () => {
  const reg = hookMod.createHookRegistry();
  const order = [];
  reg.before("test", () => order.push("before"));
  reg.after("test", () => order.push("after"));
  reg.run("test", () => { order.push("action"); return "result"; });
  if (order.length !== 3) throw new Error(`expected 3, got ${order.length}`);
  if (order[0] !== "before") throw new Error("before should run first");
  if (order[1] !== "action") throw new Error("action should run second");
  if (order[2] !== "after") throw new Error("after should run third");
});

assert("run returns action result", () => {
  const reg = hookMod.createHookRegistry();
  const result = reg.run("test", () => 42);
  if (result !== 42) throw new Error(`expected 42, got ${result}`);
});

assert("multiple before hooks run in order", () => {
  const reg = hookMod.createHookRegistry();
  const order = [];
  reg.before("x", () => order.push(1));
  reg.before("x", () => order.push(2));
  reg.run("x", () => {});
  if (order[0] !== 1 || order[1] !== 2) throw new Error("wrong order");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
