/**
 * Slice 174 — Middleware Chain Executor + Request Router
 *
 * Middleware Chain Executor: execute middleware pipeline with early exit.
 * Request Router: route requests to handlers by pattern.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 174 — Middleware Chain Executor + Request Router\x1b[0m\n");

// ── Part 1: Middleware Chain Executor ──────────────────────────────

console.log("\x1b[36m  Part 1: Middleware Chain Executor\x1b[0m");

const mceLib = join(process.cwd(), "tools/ogu/commands/lib/middleware-chain-executor.mjs");
assert("middleware-chain-executor.mjs exists", () => {
  if (!existsSync(mceLib)) throw new Error("file missing");
});

const mceMod = await import(mceLib);

assert("createMiddlewareChain returns chain", () => {
  if (typeof mceMod.createMiddlewareChain !== "function") throw new Error("missing");
  const chain = mceMod.createMiddlewareChain();
  if (typeof chain.use !== "function") throw new Error("missing use");
  if (typeof chain.execute !== "function") throw new Error("missing execute");
});

assert("execute runs all middleware in order", () => {
  const chain = mceMod.createMiddlewareChain();
  const order = [];
  chain.use((ctx, next) => { order.push("a"); next(); });
  chain.use((ctx, next) => { order.push("b"); next(); });
  chain.use((ctx, next) => { order.push("c"); next(); });
  chain.execute({});
  if (order.join(",") !== "a,b,c") throw new Error(`expected a,b,c, got ${order.join(",")}`);
});

assert("early exit stops chain", () => {
  const chain = mceMod.createMiddlewareChain();
  const order = [];
  chain.use((ctx, next) => { order.push("a"); next(); });
  chain.use((ctx, next) => { order.push("b"); /* no next() */ });
  chain.use((ctx, next) => { order.push("c"); next(); });
  chain.execute({});
  if (order.join(",") !== "a,b") throw new Error(`expected a,b, got ${order.join(",")}`);
});

assert("context is shared across middleware", () => {
  const chain = mceMod.createMiddlewareChain();
  chain.use((ctx, next) => { ctx.user = "Alice"; next(); });
  chain.use((ctx, next) => { ctx.greeting = `Hi ${ctx.user}`; next(); });
  const ctx = {};
  chain.execute(ctx);
  if (ctx.greeting !== "Hi Alice") throw new Error(`got: ${ctx.greeting}`);
});

assert("error in middleware is catchable", () => {
  const chain = mceMod.createMiddlewareChain();
  chain.use((ctx, next) => { throw new Error("fail"); });
  let caught = false;
  try { chain.execute({}); } catch { caught = true; }
  if (!caught) throw new Error("should throw");
});

// ── Part 2: Request Router ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Request Router\x1b[0m");

const rrLib = join(process.cwd(), "tools/ogu/commands/lib/request-router.mjs");
assert("request-router.mjs exists", () => {
  if (!existsSync(rrLib)) throw new Error("file missing");
});

const rrMod = await import(rrLib);

assert("createRouter returns router", () => {
  if (typeof rrMod.createRouter !== "function") throw new Error("missing");
  const router = rrMod.createRouter();
  if (typeof router.addRoute !== "function") throw new Error("missing addRoute");
  if (typeof router.route !== "function") throw new Error("missing route");
});

assert("routes to matching handler", () => {
  const router = rrMod.createRouter();
  let handled = null;
  router.addRoute("GET", "/users", (req) => { handled = req; });
  router.route("GET", "/users", { id: 1 });
  if (!handled) throw new Error("should have handled");
  if (handled.id !== 1) throw new Error("wrong request");
});

assert("returns 404 for unmatched route", () => {
  const router = rrMod.createRouter();
  const result = router.route("GET", "/unknown", {});
  if (result.status !== 404) throw new Error(`expected 404, got ${result.status}`);
});

assert("pattern matching with params", () => {
  const router = rrMod.createRouter();
  let captured = null;
  router.addRoute("GET", "/users/:id", (req, params) => { captured = params; });
  router.route("GET", "/users/42", {});
  if (!captured) throw new Error("should have captured");
  if (captured.id !== "42") throw new Error(`expected 42, got ${captured.id}`);
});

assert("method matching", () => {
  const router = rrMod.createRouter();
  let getHit = false, postHit = false;
  router.addRoute("GET", "/api", () => { getHit = true; });
  router.addRoute("POST", "/api", () => { postHit = true; });
  router.route("POST", "/api", {});
  if (getHit) throw new Error("GET should not hit");
  if (!postHit) throw new Error("POST should hit");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
