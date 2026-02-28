/**
 * Slice 181 — Cost Estimator + Budget Tracker
 *
 * Cost Estimator: estimate costs for operations.
 * Budget Tracker: track spending against budgets.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 181 — Cost Estimator + Budget Tracker\x1b[0m\n");

console.log("\x1b[36m  Part 1: Cost Estimator\x1b[0m");
const ceLib = join(process.cwd(), "tools/ogu/commands/lib/cost-estimator.mjs");
assert("cost-estimator.mjs exists", () => { if (!existsSync(ceLib)) throw new Error("file missing"); });
const ceMod = await import(ceLib);

assert("createCostEstimator returns estimator", () => {
  if (typeof ceMod.createCostEstimator !== "function") throw new Error("missing");
  const ce = ceMod.createCostEstimator();
  if (typeof ce.addRate !== "function") throw new Error("missing addRate");
  if (typeof ce.estimate !== "function") throw new Error("missing estimate");
});

assert("estimate uses registered rates", () => {
  const ce = ceMod.createCostEstimator();
  ce.addRate("llm-call", 0.03);
  ce.addRate("storage-gb", 0.10);
  const cost = ce.estimate([{ type: "llm-call", quantity: 10 }, { type: "storage-gb", quantity: 5 }]);
  if (Math.abs(cost - 0.80) > 0.001) throw new Error(`expected 0.80, got ${cost}`);
});

assert("estimate returns 0 for empty", () => {
  const ce = ceMod.createCostEstimator();
  if (ce.estimate([]) !== 0) throw new Error("should be 0");
});

assert("estimate throws for unknown type", () => {
  const ce = ceMod.createCostEstimator();
  let threw = false;
  try { ce.estimate([{ type: "unknown", quantity: 1 }]); } catch { threw = true; }
  if (!threw) throw new Error("should throw");
});

console.log("\n\x1b[36m  Part 2: Budget Tracker\x1b[0m");
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
