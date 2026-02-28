/**
 * Slice 89 — Command Dispatcher + Middleware Pipeline
 *
 * Command dispatcher: route commands to handlers with validation.
 * Middleware pipeline: composable middleware chain (like Express).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 89 — Command Dispatcher + Middleware Pipeline\x1b[0m\n");

// ── Part 1: Command Dispatcher ──────────────────────────────

console.log("\x1b[36m  Part 1: Command Dispatcher\x1b[0m");

const cdLib = join(process.cwd(), "tools/ogu/commands/lib/command-dispatcher.mjs");
assert("command-dispatcher.mjs exists", () => {
  if (!existsSync(cdLib)) throw new Error("file missing");
});

const cdMod = await import(cdLib);

assert("createDispatcher returns dispatcher", () => {
  if (typeof cdMod.createDispatcher !== "function") throw new Error("missing");
  const d = cdMod.createDispatcher();
  if (typeof d.register !== "function") throw new Error("missing register");
  if (typeof d.dispatch !== "function") throw new Error("missing dispatch");
  if (typeof d.listCommands !== "function") throw new Error("missing listCommands");
});

assert("register and dispatch a command", async () => {
  const d = cdMod.createDispatcher();
  d.register("greet", (args) => `Hello ${args.name}`);
  const result = await d.dispatch("greet", { name: "Ogu" });
  if (result !== "Hello Ogu") throw new Error(`expected Hello Ogu, got ${result}`);
});

assert("dispatch unknown command throws", async () => {
  const d = cdMod.createDispatcher();
  let threw = false;
  try { await d.dispatch("nope", {}); } catch (_) { threw = true; }
  if (!threw) throw new Error("should throw for unknown command");
});

assert("listCommands returns registered commands", () => {
  const d = cdMod.createDispatcher();
  d.register("a", () => {});
  d.register("b", () => {});
  const list = d.listCommands();
  if (list.length !== 2) throw new Error(`expected 2, got ${list.length}`);
});

assert("unregister removes command", () => {
  const d = cdMod.createDispatcher();
  d.register("temp", () => {});
  d.unregister("temp");
  if (d.listCommands().includes("temp")) throw new Error("should be removed");
});

// ── Part 2: Middleware Pipeline ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Middleware Pipeline\x1b[0m");

const mwLib = join(process.cwd(), "tools/ogu/commands/lib/middleware-pipeline.mjs");
assert("middleware-pipeline.mjs exists", () => {
  if (!existsSync(mwLib)) throw new Error("file missing");
});

const mwMod = await import(mwLib);

assert("createPipeline returns pipeline", () => {
  if (typeof mwMod.createPipeline !== "function") throw new Error("missing");
  const p = mwMod.createPipeline();
  if (typeof p.use !== "function") throw new Error("missing use");
  if (typeof p.execute !== "function") throw new Error("missing execute");
});

assert("middleware executes in order", async () => {
  const order = [];
  const p = mwMod.createPipeline();
  p.use(async (ctx, next) => { order.push("a"); await next(); });
  p.use(async (ctx, next) => { order.push("b"); await next(); });
  p.use(async (ctx, next) => { order.push("c"); await next(); });
  await p.execute({});
  if (order.join(",") !== "a,b,c") throw new Error(`wrong order: ${order.join(",")}`);
});

assert("middleware can modify context", async () => {
  const p = mwMod.createPipeline();
  p.use(async (ctx, next) => { ctx.user = "admin"; await next(); });
  p.use(async (ctx, next) => { ctx.role = "owner"; await next(); });
  const ctx = {};
  await p.execute(ctx);
  if (ctx.user !== "admin") throw new Error("user not set");
  if (ctx.role !== "owner") throw new Error("role not set");
});

assert("middleware can short-circuit by not calling next", async () => {
  const order = [];
  const p = mwMod.createPipeline();
  p.use(async (ctx, next) => { order.push("a"); /* no next() */ });
  p.use(async (ctx, next) => { order.push("b"); await next(); });
  await p.execute({});
  if (order.length !== 1 || order[0] !== "a") throw new Error("should stop at a");
});

assert("error in middleware propagates", async () => {
  const p = mwMod.createPipeline();
  p.use(async (ctx, next) => { throw new Error("boom"); });
  let threw = false;
  try { await p.execute({}); } catch (e) { threw = e.message === "boom"; }
  if (!threw) throw new Error("should propagate error");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
