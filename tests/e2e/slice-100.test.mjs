/**
 * Slice 100 — System Bootstrap + Health Check Aggregator
 *
 * 🎯 THE CENTURY SLICE!
 *
 * System bootstrap: initialize all subsystems in dependency order.
 * Health check aggregator: aggregate health from all subsystems.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 100 — System Bootstrap + Health Check Aggregator\x1b[0m\n");

// ── Part 1: System Bootstrap ──────────────────────────────

console.log("\x1b[36m  Part 1: System Bootstrap\x1b[0m");

const sbLib = join(process.cwd(), "tools/ogu/commands/lib/system-bootstrap.mjs");
assert("system-bootstrap.mjs exists", () => {
  if (!existsSync(sbLib)) throw new Error("file missing");
});

const sbMod = await import(sbLib);

assert("createBootstrap returns bootstrap", () => {
  if (typeof sbMod.createBootstrap !== "function") throw new Error("missing");
  const bs = sbMod.createBootstrap();
  if (typeof bs.register !== "function") throw new Error("missing register");
  if (typeof bs.boot !== "function") throw new Error("missing boot");
  if (typeof bs.getStatus !== "function") throw new Error("missing getStatus");
});

assert("register adds subsystem with dependencies", () => {
  const bs = sbMod.createBootstrap();
  bs.register("logger", { init: () => "logger ready", deps: [] });
  bs.register("db", { init: () => "db ready", deps: ["logger"] });
  const systems = bs.listSystems();
  if (systems.length !== 2) throw new Error(`expected 2, got ${systems.length}`);
});

assert("boot initializes in dependency order", async () => {
  const order = [];
  const bs = sbMod.createBootstrap();
  bs.register("config", { init: () => order.push("config"), deps: [] });
  bs.register("logger", { init: () => order.push("logger"), deps: ["config"] });
  bs.register("db", { init: () => order.push("db"), deps: ["logger"] });
  await bs.boot();
  if (order[0] !== "config") throw new Error(`first should be config, got ${order[0]}`);
  if (order[1] !== "logger") throw new Error(`second should be logger, got ${order[1]}`);
  if (order[2] !== "db") throw new Error(`third should be db, got ${order[2]}`);
});

assert("getStatus shows all systems after boot", async () => {
  const bs = sbMod.createBootstrap();
  bs.register("a", { init: () => {}, deps: [] });
  bs.register("b", { init: () => {}, deps: ["a"] });
  await bs.boot();
  const status = bs.getStatus();
  if (status.booted !== 2) throw new Error(`expected 2 booted, got ${status.booted}`);
  if (status.state !== "ready") throw new Error(`expected ready, got ${status.state}`);
});

assert("boot handles failure gracefully", async () => {
  const bs = sbMod.createBootstrap();
  bs.register("ok", { init: () => {}, deps: [] });
  bs.register("fail", { init: () => { throw new Error("boom"); }, deps: ["ok"] });
  let threw = false;
  try { await bs.boot(); } catch (_) { threw = true; }
  if (!threw) throw new Error("should throw on subsystem failure");
  const status = bs.getStatus();
  if (status.state !== "failed") throw new Error(`expected failed, got ${status.state}`);
});

// ── Part 2: Health Check Aggregator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Health Check Aggregator\x1b[0m");

const hcLib = join(process.cwd(), "tools/ogu/commands/lib/health-check-aggregator.mjs");
assert("health-check-aggregator.mjs exists", () => {
  if (!existsSync(hcLib)) throw new Error("file missing");
});

const hcMod = await import(hcLib);

assert("createHealthAggregator returns aggregator", () => {
  if (typeof hcMod.createHealthAggregator !== "function") throw new Error("missing");
  const ha = hcMod.createHealthAggregator();
  if (typeof ha.addCheck !== "function") throw new Error("missing addCheck");
  if (typeof ha.runAll !== "function") throw new Error("missing runAll");
});

assert("addCheck registers health check", () => {
  const ha = hcMod.createHealthAggregator();
  ha.addCheck("db", () => ({ status: "healthy" }));
  ha.addCheck("cache", () => ({ status: "healthy" }));
  const checks = ha.listChecks();
  if (checks.length !== 2) throw new Error(`expected 2, got ${checks.length}`);
});

assert("runAll returns aggregate health", async () => {
  const ha = hcMod.createHealthAggregator();
  ha.addCheck("db", () => ({ status: "healthy" }));
  ha.addCheck("api", () => ({ status: "healthy" }));
  const result = await ha.runAll();
  if (result.overall !== "healthy") throw new Error(`expected healthy, got ${result.overall}`);
  if (result.checks.length !== 2) throw new Error(`expected 2 checks, got ${result.checks.length}`);
});

assert("overall is degraded when any check warns", async () => {
  const ha = hcMod.createHealthAggregator();
  ha.addCheck("db", () => ({ status: "healthy" }));
  ha.addCheck("cache", () => ({ status: "degraded" }));
  const result = await ha.runAll();
  if (result.overall !== "degraded") throw new Error(`expected degraded, got ${result.overall}`);
});

assert("overall is unhealthy when any check fails", async () => {
  const ha = hcMod.createHealthAggregator();
  ha.addCheck("db", () => ({ status: "healthy" }));
  ha.addCheck("api", () => { throw new Error("down"); });
  const result = await ha.runAll();
  if (result.overall !== "unhealthy") throw new Error(`expected unhealthy, got ${result.overall}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
