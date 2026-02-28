/**
 * Slice 210 — Cron Expression Parser + Scheduled Task Manager
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 210 — Cron Expression Parser + Scheduled Task Manager\x1b[0m\n");

console.log("\x1b[36m  Part 1: Cron Expression Parser\x1b[0m");
const cpLib = join(process.cwd(), "tools/ogu/commands/lib/cron-expression-parser.mjs");
assert("cron-expression-parser.mjs exists", () => { if (!existsSync(cpLib)) throw new Error("missing"); });
const cpMod = await import(cpLib);
assert("parse standard 5-field cron", () => {
  const parsed = cpMod.parse("*/5 * * * *");
  if (parsed.minute !== "*/5") throw new Error("wrong minute");
  if (parsed.hour !== "*") throw new Error("wrong hour");
});
assert("matches date against expression", () => {
  const date = new Date(2026, 0, 1, 12, 0); // Jan 1 2026, 12:00
  if (!cpMod.matches("0 12 * * *", date)) throw new Error("should match noon");
  if (cpMod.matches("0 13 * * *", date)) throw new Error("should not match 1pm");
});
assert("parse handles all fields", () => {
  const parsed = cpMod.parse("30 4 1 6 3");
  if (parsed.minute !== "30") throw new Error("wrong minute");
  if (parsed.hour !== "4") throw new Error("wrong hour");
  if (parsed.dayOfMonth !== "1") throw new Error("wrong day");
  if (parsed.month !== "6") throw new Error("wrong month");
  if (parsed.dayOfWeek !== "3") throw new Error("wrong dow");
});

console.log("\n\x1b[36m  Part 2: Scheduled Task Manager\x1b[0m");
const stLib = join(process.cwd(), "tools/ogu/commands/lib/scheduled-task-manager.mjs");
assert("scheduled-task-manager.mjs exists", () => { if (!existsSync(stLib)) throw new Error("missing"); });
const stMod = await import(stLib);
assert("schedule and list tasks", () => {
  const sm = stMod.createScheduledTaskManager();
  sm.schedule("backup", "0 2 * * *", () => {});
  const tasks = sm.list();
  if (tasks.length !== 1) throw new Error("expected 1 task");
  if (tasks[0].name !== "backup") throw new Error("wrong name");
});
assert("cancel removes task", () => {
  const sm = stMod.createScheduledTaskManager();
  sm.schedule("cleanup", "0 * * * *", () => {});
  sm.cancel("cleanup");
  if (sm.list().length !== 0) throw new Error("should be empty");
});
assert("getDue returns tasks due at given time", () => {
  const sm = stMod.createScheduledTaskManager();
  let ran = false;
  sm.schedule("noon-task", "0 12 * * *", () => { ran = true; });
  const date = new Date(2026, 0, 1, 12, 0);
  const due = sm.getDue(date);
  if (due.length !== 1) throw new Error(`expected 1 due, got ${due.length}`);
});
assert("getStats returns count", () => {
  const sm = stMod.createScheduledTaskManager();
  sm.schedule("a", "* * * * *", () => {});
  sm.schedule("b", "* * * * *", () => {});
  if (sm.getStats().total !== 2) throw new Error("expected 2");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
