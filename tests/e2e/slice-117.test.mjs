/**
 * Slice 117 — Materialized View Engine + View Reducer
 *
 * Materialized view engine: maintain derived state from event stream.
 * View reducer: reduce events into specific materialized views.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 117 — Materialized View Engine + View Reducer\x1b[0m\n");

// ── Part 1: Materialized View Engine ──────────────────────────────

console.log("\x1b[36m  Part 1: Materialized View Engine\x1b[0m");

const mvLib = join(process.cwd(), "tools/ogu/commands/lib/materialized-view-engine.mjs");
assert("materialized-view-engine.mjs exists", () => {
  if (!existsSync(mvLib)) throw new Error("file missing");
});

const mvMod = await import(mvLib);

assert("createMaterializedViewEngine returns engine", () => {
  if (typeof mvMod.createMaterializedViewEngine !== "function") throw new Error("missing");
  const mv = mvMod.createMaterializedViewEngine();
  if (typeof mv.registerView !== "function") throw new Error("missing registerView");
  if (typeof mv.processEvent !== "function") throw new Error("missing processEvent");
  if (typeof mv.getView !== "function") throw new Error("missing getView");
});

assert("registerView creates view with initial state", () => {
  const mv = mvMod.createMaterializedViewEngine();
  mv.registerView("taskCount", {
    initialState: { count: 0 },
    reducer: (state, event) => {
      if (event.type === "TASK_COMPLETED") return { count: state.count + 1 };
      return state;
    },
  });
  const view = mv.getView("taskCount");
  if (view.count !== 0) throw new Error(`expected 0, got ${view.count}`);
});

assert("processEvent updates registered views", () => {
  const mv = mvMod.createMaterializedViewEngine();
  mv.registerView("taskCount", {
    initialState: { count: 0 },
    reducer: (state, event) => {
      if (event.type === "TASK_COMPLETED") return { count: state.count + 1 };
      return state;
    },
  });
  mv.processEvent({ type: "TASK_COMPLETED", payload: {} });
  mv.processEvent({ type: "TASK_COMPLETED", payload: {} });
  mv.processEvent({ type: "OTHER", payload: {} });
  const view = mv.getView("taskCount");
  if (view.count !== 2) throw new Error(`expected 2, got ${view.count}`);
});

assert("multiple views updated independently", () => {
  const mv = mvMod.createMaterializedViewEngine();
  mv.registerView("tasks", {
    initialState: { completed: 0, failed: 0 },
    reducer: (state, event) => {
      if (event.type === "TASK_COMPLETED") return { ...state, completed: state.completed + 1 };
      if (event.type === "TASK_FAILED") return { ...state, failed: state.failed + 1 };
      return state;
    },
  });
  mv.registerView("budget", {
    initialState: { total: 0 },
    reducer: (state, event) => {
      if (event.type === "BUDGET_TICK") return { total: state.total + (event.payload.amount || 0) };
      return state;
    },
  });
  mv.processEvent({ type: "TASK_COMPLETED", payload: {} });
  mv.processEvent({ type: "BUDGET_TICK", payload: { amount: 100 } });
  if (mv.getView("tasks").completed !== 1) throw new Error("wrong task count");
  if (mv.getView("budget").total !== 100) throw new Error("wrong budget");
});

assert("listViews returns all registered views", () => {
  const mv = mvMod.createMaterializedViewEngine();
  mv.registerView("a", { initialState: {}, reducer: (s) => s });
  mv.registerView("b", { initialState: {}, reducer: (s) => s });
  const views = mv.listViews();
  if (views.length !== 2) throw new Error(`expected 2, got ${views.length}`);
});

// ── Part 2: View Reducer ──────────────────────────────

console.log("\n\x1b[36m  Part 2: View Reducer\x1b[0m");

const vrLib = join(process.cwd(), "tools/ogu/commands/lib/view-reducers.mjs");
assert("view-reducers.mjs exists", () => {
  if (!existsSync(vrLib)) throw new Error("file missing");
});

const vrMod = await import(vrLib);

assert("dagViewReducer tracks task states", () => {
  if (typeof vrMod.dagViewReducer !== "function") throw new Error("missing");
  let state = { tasks: {} };
  state = vrMod.dagViewReducer(state, { type: "TASK_STARTED", payload: { taskId: "t1", agentId: "dev" } });
  state = vrMod.dagViewReducer(state, { type: "TASK_COMPLETED", payload: { taskId: "t1" } });
  if (state.tasks.t1.status !== "completed") throw new Error("should be completed");
});

assert("budgetViewReducer tracks spending", () => {
  if (typeof vrMod.budgetViewReducer !== "function") throw new Error("missing");
  let state = { total: 0, byRole: {} };
  state = vrMod.budgetViewReducer(state, { type: "BUDGET_TICK", payload: { roleId: "dev", amount: 100 } });
  state = vrMod.budgetViewReducer(state, { type: "BUDGET_TICK", payload: { roleId: "dev", amount: 50 } });
  if (state.total !== 150) throw new Error(`expected 150, got ${state.total}`);
  if (state.byRole.dev !== 150) throw new Error(`expected dev=150, got ${state.byRole.dev}`);
});

assert("governanceViewReducer tracks pending approvals", () => {
  if (typeof vrMod.governanceViewReducer !== "function") throw new Error("missing");
  let state = { pendingApprovals: [], blockedTasks: 0 };
  state = vrMod.governanceViewReducer(state, { type: "GOV_BLOCKED", payload: { taskId: "t1", rule: "r1" } });
  if (state.blockedTasks !== 1) throw new Error(`expected 1, got ${state.blockedTasks}`);
  state = vrMod.governanceViewReducer(state, { type: "GOV_APPROVED", payload: { taskId: "t1" } });
  if (state.blockedTasks !== 0) throw new Error(`expected 0, got ${state.blockedTasks}`);
});

assert("VIEW_DEFINITIONS exports all standard views", () => {
  if (!Array.isArray(vrMod.VIEW_DEFINITIONS)) throw new Error("missing");
  const names = vrMod.VIEW_DEFINITIONS.map(v => v.name);
  if (!names.includes("dag")) throw new Error("missing dag view");
  if (!names.includes("budget")) throw new Error("missing budget view");
  if (!names.includes("governance")) throw new Error("missing governance view");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
