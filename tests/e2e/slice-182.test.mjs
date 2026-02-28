/**
 * Slice 182 — Constraint Solver + Rule Engine
 *
 * Constraint Solver: solve constraints over variables.
 * Rule Engine: evaluate and execute conditional rules.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 182 — Constraint Solver + Rule Engine\x1b[0m\n");

console.log("\x1b[36m  Part 1: Constraint Solver\x1b[0m");
const csLib = join(process.cwd(), "tools/ogu/commands/lib/constraint-solver.mjs");
assert("constraint-solver.mjs exists", () => { if (!existsSync(csLib)) throw new Error("file missing"); });
const csMod = await import(csLib);

assert("createConstraintSolver returns solver", () => {
  if (typeof csMod.createConstraintSolver !== "function") throw new Error("missing");
  const s = csMod.createConstraintSolver();
  if (typeof s.addConstraint !== "function") throw new Error("missing addConstraint");
  if (typeof s.solve !== "function") throw new Error("missing solve");
});

assert("solve satisfies all constraints", () => {
  const s = csMod.createConstraintSolver();
  s.addConstraint((vars) => vars.x > 0);
  s.addConstraint((vars) => vars.x < 10);
  const result = s.solve({ x: 5 });
  if (!result.satisfied) throw new Error("should satisfy");
});

assert("solve detects violation", () => {
  const s = csMod.createConstraintSolver();
  s.addConstraint((vars) => vars.x > 0);
  const result = s.solve({ x: -1 });
  if (result.satisfied) throw new Error("should not satisfy");
});

assert("solve reports which constraint failed", () => {
  const s = csMod.createConstraintSolver();
  s.addConstraint((vars) => vars.a > 0, "a-positive");
  s.addConstraint((vars) => vars.b > 0, "b-positive");
  const result = s.solve({ a: 5, b: -1 });
  if (result.satisfied) throw new Error("should fail");
  if (result.failedConstraint !== "b-positive") throw new Error(`expected b-positive, got ${result.failedConstraint}`);
});

console.log("\n\x1b[36m  Part 2: Rule Engine\x1b[0m");
const reLib = join(process.cwd(), "tools/ogu/commands/lib/rule-engine.mjs");
assert("rule-engine.mjs exists", () => { if (!existsSync(reLib)) throw new Error("file missing"); });
const reMod = await import(reLib);

assert("createRuleEngine returns engine", () => {
  if (typeof reMod.createRuleEngine !== "function") throw new Error("missing");
  const e = reMod.createRuleEngine();
  if (typeof e.addRule !== "function") throw new Error("missing addRule");
  if (typeof e.evaluate !== "function") throw new Error("missing evaluate");
});

assert("evaluate fires matching rules", () => {
  const e = reMod.createRuleEngine();
  const actions = [];
  e.addRule({
    name: "high-value",
    condition: (ctx) => ctx.amount > 1000,
    action: (ctx) => actions.push("flagged"),
  });
  e.evaluate({ amount: 1500 });
  if (actions.length !== 1) throw new Error("should fire");
});

assert("evaluate skips non-matching rules", () => {
  const e = reMod.createRuleEngine();
  const actions = [];
  e.addRule({ name: "r1", condition: () => false, action: () => actions.push("a") });
  e.evaluate({});
  if (actions.length !== 0) throw new Error("should not fire");
});

assert("evaluate fires multiple matching rules", () => {
  const e = reMod.createRuleEngine();
  const actions = [];
  e.addRule({ name: "r1", condition: () => true, action: () => actions.push("a") });
  e.addRule({ name: "r2", condition: () => true, action: () => actions.push("b") });
  e.evaluate({});
  if (actions.length !== 2) throw new Error(`expected 2, got ${actions.length}`);
});

assert("listRules returns rule names", () => {
  const e = reMod.createRuleEngine();
  e.addRule({ name: "x", condition: () => true, action: () => {} });
  e.addRule({ name: "y", condition: () => true, action: () => {} });
  const names = e.listRules();
  if (names.length !== 2) throw new Error(`expected 2, got ${names.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
