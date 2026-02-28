/**
 * Slice 114 — WFQ Integration + Scheduling Policy Router
 *
 * WFQ integration: wire weighted fair queuing into task scheduling.
 * Scheduling policy router: select scheduling policy based on context.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 114 — WFQ Integration + Scheduling Policy Router\x1b[0m\n");

// ── Part 1: WFQ Integration ──────────────────────────────

console.log("\x1b[36m  Part 1: WFQ Integration\x1b[0m");

const wLib = join(process.cwd(), "tools/ogu/commands/lib/wfq-integration.mjs");
assert("wfq-integration.mjs exists", () => {
  if (!existsSync(wLib)) throw new Error("file missing");
});

const wMod = await import(wLib);

assert("createWFQIntegration returns integration", () => {
  if (typeof wMod.createWFQIntegration !== "function") throw new Error("missing");
  const wfq = wMod.createWFQIntegration();
  if (typeof wfq.addClass !== "function") throw new Error("missing addClass");
  if (typeof wfq.submit !== "function") throw new Error("missing submit");
  if (typeof wfq.next !== "function") throw new Error("missing next");
});

assert("addClass defines priority class with weight", () => {
  const wfq = wMod.createWFQIntegration();
  wfq.addClass("critical", { weight: 4 });
  wfq.addClass("normal", { weight: 2 });
  wfq.addClass("background", { weight: 1 });
  const classes = wfq.listClasses();
  if (classes.length !== 3) throw new Error(`expected 3, got ${classes.length}`);
});

assert("submit enqueues task to priority class", () => {
  const wfq = wMod.createWFQIntegration();
  wfq.addClass("critical", { weight: 4 });
  wfq.submit("task-1", "critical");
  wfq.submit("task-2", "critical");
  const stats = wfq.getStats();
  if (stats.totalPending !== 2) throw new Error(`expected 2, got ${stats.totalPending}`);
});

assert("next returns task from highest-weight class first", () => {
  const wfq = wMod.createWFQIntegration();
  wfq.addClass("critical", { weight: 10 });
  wfq.addClass("normal", { weight: 1 });
  wfq.submit("bg-task", "normal");
  wfq.submit("urgent-task", "critical");
  const task = wfq.next();
  if (task !== "urgent-task") throw new Error(`expected urgent-task, got ${task}`);
});

assert("next provides fair distribution across classes", () => {
  const wfq = wMod.createWFQIntegration();
  wfq.addClass("a", { weight: 2 });
  wfq.addClass("b", { weight: 1 });
  // Add enough tasks to see distribution
  for (let i = 0; i < 6; i++) wfq.submit(`a-${i}`, "a");
  for (let i = 0; i < 6; i++) wfq.submit(`b-${i}`, "b");
  const results = [];
  for (let i = 0; i < 6; i++) results.push(wfq.next());
  const aCount = results.filter(r => r && r.startsWith("a-")).length;
  const bCount = results.filter(r => r && r.startsWith("b-")).length;
  // With weight 2:1, should be roughly 4a:2b in 6 picks
  if (aCount < 3) throw new Error(`expected at least 3 from class a, got ${aCount}`);
});

// ── Part 2: Scheduling Policy Router ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Scheduling Policy Router\x1b[0m");

const spLib = join(process.cwd(), "tools/ogu/commands/lib/scheduling-policy-router.mjs");
assert("scheduling-policy-router.mjs exists", () => {
  if (!existsSync(spLib)) throw new Error("file missing");
});

const spMod = await import(spLib);

assert("createSchedulingRouter returns router", () => {
  if (typeof spMod.createSchedulingRouter !== "function") throw new Error("missing");
  const sr = spMod.createSchedulingRouter();
  if (typeof sr.addPolicy !== "function") throw new Error("missing addPolicy");
  if (typeof sr.selectPolicy !== "function") throw new Error("missing selectPolicy");
});

assert("addPolicy registers scheduling policy", () => {
  const sr = spMod.createSchedulingRouter();
  sr.addPolicy("fifo", { match: () => true, scheduler: () => "fifo-result" });
  sr.addPolicy("wfq", { match: (ctx) => ctx.multiAgent, scheduler: () => "wfq-result" });
  const policies = sr.listPolicies();
  if (policies.length !== 2) throw new Error(`expected 2, got ${policies.length}`);
});

assert("selectPolicy returns matching policy", () => {
  const sr = spMod.createSchedulingRouter();
  sr.addPolicy("fifo", { match: (ctx) => !ctx.multiAgent, scheduler: () => "fifo" });
  sr.addPolicy("wfq", { match: (ctx) => ctx.multiAgent, scheduler: () => "wfq" });
  const result = sr.selectPolicy({ multiAgent: true });
  if (result.name !== "wfq") throw new Error(`expected wfq, got ${result.name}`);
});

assert("selectPolicy returns default when no match", () => {
  const sr = spMod.createSchedulingRouter();
  sr.addPolicy("wfq", { match: (ctx) => ctx.multiAgent, scheduler: () => "wfq" });
  sr.setDefault("fifo", () => "fifo-default");
  const result = sr.selectPolicy({ multiAgent: false });
  if (result.name !== "fifo") throw new Error(`expected fifo, got ${result.name}`);
});

assert("SCHEDULING_POLICIES lists built-in policies", () => {
  if (!Array.isArray(spMod.SCHEDULING_POLICIES)) throw new Error("missing");
  if (!spMod.SCHEDULING_POLICIES.includes("fifo")) throw new Error("missing fifo");
  if (!spMod.SCHEDULING_POLICIES.includes("wfq")) throw new Error("missing wfq");
  if (!spMod.SCHEDULING_POLICIES.includes("priority")) throw new Error("missing priority");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
