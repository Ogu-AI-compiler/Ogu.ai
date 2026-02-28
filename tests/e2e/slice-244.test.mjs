/**
 * Slice 244 — Branch Predictor + Speculative Executor
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 244 — Branch Predictor + Speculative Executor\x1b[0m\n");
console.log("\x1b[36m  Part 1: Branch Predictor\x1b[0m");
const bpLib = join(process.cwd(), "tools/ogu/commands/lib/branch-predictor.mjs");
assert("branch-predictor.mjs exists", () => { if (!existsSync(bpLib)) throw new Error("missing"); });
const bpMod = await import(bpLib);
assert("predict returns boolean", () => {
  const bp = bpMod.createBranchPredictor();
  const p = bp.predict("branch1");
  if (typeof p!=="boolean") throw new Error("should be boolean");
});
assert("update improves prediction", () => {
  const bp = bpMod.createBranchPredictor();
  for (let i = 0; i < 10; i++) { bp.predict("b1"); bp.update("b1", true); }
  if (!bp.predict("b1")) throw new Error("should predict taken after 10 taken");
});
assert("getStats returns accuracy", () => {
  const bp = bpMod.createBranchPredictor();
  bp.predict("b1"); bp.update("b1", true);
  const s = bp.getStats();
  if (typeof s.accuracy!=="number") throw new Error("missing accuracy");
});
console.log("\n\x1b[36m  Part 2: Speculative Executor\x1b[0m");
const seLib = join(process.cwd(), "tools/ogu/commands/lib/speculative-executor.mjs");
assert("speculative-executor.mjs exists", () => { if (!existsSync(seLib)) throw new Error("missing"); });
const seMod = await import(seLib);
assert("speculate and commit", () => {
  const se = seMod.createSpeculativeExecutor();
  se.speculate("task1", () => 42);
  se.commit("task1");
  if (se.getResult("task1")!==42) throw new Error("expected 42");
});
assert("rollback discards result", () => {
  const se = seMod.createSpeculativeExecutor();
  se.speculate("task1", () => 99);
  se.rollback("task1");
  if (se.getResult("task1")!==null) throw new Error("should be null after rollback");
});
console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
