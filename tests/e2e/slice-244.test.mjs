/**
 * Slice 244 — Speculative Executor
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 244 — Speculative Executor\x1b[0m\n");
console.log("\x1b[36m  Part 1: Speculative Executor\x1b[0m");
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
