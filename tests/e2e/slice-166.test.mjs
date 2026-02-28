/**
 * Slice 166 — Hierarchical State Machine + Guard Evaluator
 *
 * Hierarchical State Machine: nested states with substates.
 * Guard Evaluator: evaluate transition guards and conditions.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 166 — Hierarchical State Machine + Guard Evaluator\x1b[0m\n");

// ── Part 1: Hierarchical State Machine ──────────────────────────────

console.log("\x1b[36m  Part 1: Hierarchical State Machine\x1b[0m");

const hsmLib = join(process.cwd(), "tools/ogu/commands/lib/hierarchical-state-machine.mjs");
assert("hierarchical-state-machine.mjs exists", () => {
  if (!existsSync(hsmLib)) throw new Error("file missing");
});

const hsmMod = await import(hsmLib);

assert("createHSM returns state machine", () => {
  if (typeof hsmMod.createHSM !== "function") throw new Error("missing");
  const hsm = hsmMod.createHSM({
    initial: "idle",
    states: {
      idle: { on: { START: "running" } },
      running: {
        initial: "loading",
        states: {
          loading: { on: { LOADED: "executing" } },
          executing: { on: { DONE: "#idle" } },
        },
      },
    },
  });
  if (typeof hsm.send !== "function") throw new Error("missing send");
  if (typeof hsm.getState !== "function") throw new Error("missing getState");
});

assert("starts in initial state", () => {
  const hsm = hsmMod.createHSM({
    initial: "idle",
    states: { idle: {}, running: {} },
  });
  if (hsm.getState() !== "idle") throw new Error(`expected idle, got ${hsm.getState()}`);
});

assert("transitions on event", () => {
  const hsm = hsmMod.createHSM({
    initial: "off",
    states: {
      off: { on: { TOGGLE: "on" } },
      on: { on: { TOGGLE: "off" } },
    },
  });
  hsm.send("TOGGLE");
  if (hsm.getState() !== "on") throw new Error(`expected on, got ${hsm.getState()}`);
});

assert("enters substate initial", () => {
  const hsm = hsmMod.createHSM({
    initial: "idle",
    states: {
      idle: { on: { GO: "active" } },
      active: {
        initial: "step1",
        states: {
          step1: { on: { NEXT: "step2" } },
          step2: {},
        },
      },
    },
  });
  hsm.send("GO");
  if (hsm.getState() !== "active.step1") throw new Error(`expected active.step1, got ${hsm.getState()}`);
});

assert("transitions within substates", () => {
  const hsm = hsmMod.createHSM({
    initial: "idle",
    states: {
      idle: { on: { GO: "active" } },
      active: {
        initial: "step1",
        states: {
          step1: { on: { NEXT: "step2" } },
          step2: { on: { DONE: "#idle" } },
        },
      },
    },
  });
  hsm.send("GO");
  hsm.send("NEXT");
  if (hsm.getState() !== "active.step2") throw new Error(`expected active.step2, got ${hsm.getState()}`);
});

assert("# prefix exits to root state", () => {
  const hsm = hsmMod.createHSM({
    initial: "idle",
    states: {
      idle: { on: { GO: "active" } },
      active: {
        initial: "sub",
        states: {
          sub: { on: { RESET: "#idle" } },
        },
      },
    },
  });
  hsm.send("GO");
  hsm.send("RESET");
  if (hsm.getState() !== "idle") throw new Error(`expected idle, got ${hsm.getState()}`);
});

// ── Part 2: Guard Evaluator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Guard Evaluator\x1b[0m");

const geLib = join(process.cwd(), "tools/ogu/commands/lib/guard-evaluator.mjs");
assert("guard-evaluator.mjs exists", () => {
  if (!existsSync(geLib)) throw new Error("file missing");
});

const geMod = await import(geLib);

assert("createGuardEvaluator returns evaluator", () => {
  if (typeof geMod.createGuardEvaluator !== "function") throw new Error("missing");
  const ge = geMod.createGuardEvaluator();
  if (typeof ge.addGuard !== "function") throw new Error("missing addGuard");
  if (typeof ge.evaluate !== "function") throw new Error("missing evaluate");
});

assert("evaluate passes when guard returns true", () => {
  const ge = geMod.createGuardEvaluator();
  ge.addGuard("canTransition", (ctx) => ctx.role === "admin");
  const result = ge.evaluate("canTransition", { role: "admin" });
  if (!result.allowed) throw new Error("should allow");
});

assert("evaluate fails when guard returns false", () => {
  const ge = geMod.createGuardEvaluator();
  ge.addGuard("canTransition", (ctx) => ctx.role === "admin");
  const result = ge.evaluate("canTransition", { role: "viewer" });
  if (result.allowed) throw new Error("should deny");
});

assert("evaluateAll checks multiple guards", () => {
  const ge = geMod.createGuardEvaluator();
  ge.addGuard("isAdmin", (ctx) => ctx.role === "admin");
  ge.addGuard("isActive", (ctx) => ctx.active === true);
  const result = ge.evaluateAll(["isAdmin", "isActive"], { role: "admin", active: true });
  if (!result.allowed) throw new Error("all guards should pass");
});

assert("evaluateAll fails if any guard fails", () => {
  const ge = geMod.createGuardEvaluator();
  ge.addGuard("isAdmin", (ctx) => ctx.role === "admin");
  ge.addGuard("isActive", (ctx) => ctx.active === true);
  const result = ge.evaluateAll(["isAdmin", "isActive"], { role: "admin", active: false });
  if (result.allowed) throw new Error("should fail when one guard fails");
  if (!result.failedGuard) throw new Error("should report failed guard");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
