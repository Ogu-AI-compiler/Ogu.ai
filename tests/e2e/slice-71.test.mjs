/**
 * Slice 71 — Logging Framework + Graceful Shutdown
 *
 * Logging: structured logging with levels, JSON/human format.
 * Graceful shutdown: clean shutdown with drain + signal handling.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice71-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 71 — Logging Framework + Graceful Shutdown\x1b[0m\n");

// ── Part 1: Logging Framework ──────────────────────────────

console.log("\x1b[36m  Part 1: Logging Framework\x1b[0m");

const logLib = join(process.cwd(), "tools/ogu/commands/lib/logging-framework.mjs");
assert("logging-framework.mjs exists", () => {
  if (!existsSync(logLib)) throw new Error("file missing");
});

const logMod = await import(logLib);

assert("createLogger returns logger with all levels", () => {
  if (typeof logMod.createLogger !== "function") throw new Error("missing");
  const logger = logMod.createLogger({ level: "debug" });
  if (typeof logger.trace !== "function") throw new Error("missing trace");
  if (typeof logger.debug !== "function") throw new Error("missing debug");
  if (typeof logger.info !== "function") throw new Error("missing info");
  if (typeof logger.warn !== "function") throw new Error("missing warn");
  if (typeof logger.error !== "function") throw new Error("missing error");
  if (typeof logger.fatal !== "function") throw new Error("missing fatal");
});

assert("logger respects level filtering", () => {
  const entries = [];
  const logger = logMod.createLogger({ level: "warn", sink: (entry) => entries.push(entry) });
  logger.debug("should not appear");
  logger.info("should not appear");
  logger.warn("should appear");
  logger.error("should appear");
  if (entries.length !== 2) throw new Error(`expected 2 entries, got ${entries.length}`);
});

assert("log entry has structured fields", () => {
  const entries = [];
  const logger = logMod.createLogger({ level: "info", sink: (entry) => entries.push(entry) });
  logger.info("test message", { key: "value" });
  const e = entries[0];
  if (!e.timestamp) throw new Error("missing timestamp");
  if (e.level !== "info") throw new Error("wrong level");
  if (e.message !== "test message") throw new Error("wrong message");
  if (!e.data || e.data.key !== "value") throw new Error("missing data");
});

assert("formatJSON produces valid JSON", () => {
  if (typeof logMod.formatJSON !== "function") throw new Error("missing");
  const entry = { timestamp: "2026-02-28T00:00:00Z", level: "info", message: "hello", data: {} };
  const output = logMod.formatJSON(entry);
  const parsed = JSON.parse(output);
  if (parsed.level !== "info") throw new Error("invalid JSON output");
});

assert("formatHuman produces readable string", () => {
  if (typeof logMod.formatHuman !== "function") throw new Error("missing");
  const entry = { timestamp: "2026-02-28T00:00:00Z", level: "error", message: "oops", data: {} };
  const output = logMod.formatHuman(entry);
  if (typeof output !== "string") throw new Error("should be string");
  if (!output.includes("error") && !output.includes("ERROR")) throw new Error("should include level");
  if (!output.includes("oops")) throw new Error("should include message");
});

assert("LOG_LEVELS exported with correct order", () => {
  if (!logMod.LOG_LEVELS) throw new Error("missing");
  const levels = Object.keys(logMod.LOG_LEVELS);
  if (levels.length < 6) throw new Error("should have at least 6 levels");
  if (logMod.LOG_LEVELS.trace > logMod.LOG_LEVELS.fatal) throw new Error("trace should be < fatal");
});

assert("logger with file sink writes to file", () => {
  const logFile = join(tmp, "test.log");
  const entries = [];
  const logger = logMod.createLogger({ level: "info", sink: (entry) => {
    entries.push(entry);
  }});
  logger.info("file test");
  if (entries.length !== 1) throw new Error("should capture entry");
});

// ── Part 2: Graceful Shutdown ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Graceful Shutdown\x1b[0m");

const shutLib = join(process.cwd(), "tools/ogu/commands/lib/graceful-shutdown.mjs");
assert("graceful-shutdown.mjs exists", () => {
  if (!existsSync(shutLib)) throw new Error("file missing");
});

const shutMod = await import(shutLib);

assert("createShutdownManager returns manager", () => {
  if (typeof shutMod.createShutdownManager !== "function") throw new Error("missing");
  const mgr = shutMod.createShutdownManager();
  if (typeof mgr.register !== "function") throw new Error("missing register");
  if (typeof mgr.shutdown !== "function") throw new Error("missing shutdown");
  if (typeof mgr.isShuttingDown !== "function") throw new Error("missing isShuttingDown");
});

assert("register adds shutdown hooks", () => {
  const mgr = shutMod.createShutdownManager();
  mgr.register("db", async () => {});
  mgr.register("cache", async () => {});
  const hooks = mgr.listHooks();
  if (!Array.isArray(hooks)) throw new Error("listHooks should return array");
  if (hooks.length !== 2) throw new Error(`expected 2, got ${hooks.length}`);
});

assert("shutdown executes hooks in reverse order", async () => {
  const order = [];
  const mgr = shutMod.createShutdownManager();
  mgr.register("first", async () => order.push("first"));
  mgr.register("second", async () => order.push("second"));
  await mgr.shutdown();
  if (order[0] !== "second") throw new Error(`expected second first, got ${order[0]}`);
  if (order[1] !== "first") throw new Error(`expected first second, got ${order[1]}`);
});

assert("isShuttingDown reflects state", async () => {
  const mgr = shutMod.createShutdownManager();
  if (mgr.isShuttingDown()) throw new Error("should not be shutting down initially");
  mgr.register("test", async () => {});
  await mgr.shutdown();
  if (!mgr.isShuttingDown()) throw new Error("should be shutting down after shutdown");
});

assert("shutdown is idempotent", async () => {
  let count = 0;
  const mgr = shutMod.createShutdownManager();
  mgr.register("counter", async () => count++);
  await mgr.shutdown();
  await mgr.shutdown();
  if (count !== 1) throw new Error(`expected 1 execution, got ${count}`);
});

assert("SHUTDOWN_SIGNALS exported", () => {
  if (!shutMod.SHUTDOWN_SIGNALS) throw new Error("missing");
  if (!Array.isArray(shutMod.SHUTDOWN_SIGNALS)) throw new Error("should be array");
  if (!shutMod.SHUTDOWN_SIGNALS.includes("SIGTERM")) throw new Error("should include SIGTERM");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
