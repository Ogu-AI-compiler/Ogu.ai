/**
 * Slice 181 — Budget Tracker
 *
 * Budget Tracker: track spending against budgets.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 181 — Budget Tracker\x1b[0m\n");

console.log("\x1b[36m  Part 1: Budget Tracker\x1b[0m");
const btLib = join(process.cwd(), "tools/ogu/commands/lib/budget-tracker.mjs");
assert("budget-tracker.mjs exists", () => { if (!existsSync(btLib)) throw new Error("file missing"); });
const btMod = await import(btLib);

assert("createBudgetTracker returns tracker", () => {
  if (typeof btMod.createBudgetTracker !== "function") throw new Error("missing");
  const bt = btMod.createBudgetTracker({ budget: 100 });
  if (typeof bt.spend !== "function") throw new Error("missing spend");
  if (typeof bt.getRemaining !== "function") throw new Error("missing getRemaining");
});

assert("spend deducts from budget", () => {
  const bt = btMod.createBudgetTracker({ budget: 100 });
  bt.spend(30, "llm");
  if (bt.getRemaining() !== 70) throw new Error(`expected 70, got ${bt.getRemaining()}`);
});

assert("isOverBudget detects overspend", () => {
  const bt = btMod.createBudgetTracker({ budget: 50 });
  bt.spend(60, "compute");
  if (!bt.isOverBudget()) throw new Error("should be over budget");
});

assert("getBreakdown shows by category", () => {
  const bt = btMod.createBudgetTracker({ budget: 100 });
  bt.spend(20, "llm");
  bt.spend(15, "storage");
  bt.spend(10, "llm");
  const breakdown = bt.getBreakdown();
  if (breakdown.llm !== 30) throw new Error(`expected llm=30, got ${breakdown.llm}`);
  if (breakdown.storage !== 15) throw new Error(`expected storage=15, got ${breakdown.storage}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
