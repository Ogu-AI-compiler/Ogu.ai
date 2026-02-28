/**
 * Slice 235 — AST Optimizer + Dead Code Eliminator
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 235 — AST Optimizer + Dead Code Eliminator\x1b[0m\n");

console.log("\x1b[36m  Part 1: AST Optimizer\x1b[0m");
const aoLib = join(process.cwd(), "tools/ogu/commands/lib/ast-optimizer.mjs");
assert("ast-optimizer.mjs exists", () => { if (!existsSync(aoLib)) throw new Error("missing"); });
const aoMod = await import(aoLib);
assert("constant folding", () => {
  const ast = { type: "add", left: { type: "literal", value: 3 }, right: { type: "literal", value: 4 } };
  const optimized = aoMod.optimize(ast);
  if (optimized.type !== "literal" || optimized.value !== 7) throw new Error("should fold to 7");
});
assert("preserves non-foldable nodes", () => {
  const ast = { type: "add", left: { type: "variable", name: "x" }, right: { type: "literal", value: 1 } };
  const optimized = aoMod.optimize(ast);
  if (optimized.type !== "add") throw new Error("should remain add");
});
assert("nested folding", () => {
  const ast = { type: "multiply", left: { type: "add", left: { type: "literal", value: 2 }, right: { type: "literal", value: 3 } }, right: { type: "literal", value: 4 } };
  const optimized = aoMod.optimize(ast);
  if (optimized.type !== "literal" || optimized.value !== 20) throw new Error("should fold to 20");
});

console.log("\n\x1b[36m  Part 2: Dead Code Eliminator\x1b[0m");
const dceLib = join(process.cwd(), "tools/ogu/commands/lib/dead-code-eliminator.mjs");
assert("dead-code-eliminator.mjs exists", () => { if (!existsSync(dceLib)) throw new Error("missing"); });
const dceMod = await import(dceLib);
assert("removes unreachable code", () => {
  const ast = {
    type: "block",
    statements: [
      { type: "return", value: { type: "literal", value: 1 } },
      { type: "assign", name: "x", value: { type: "literal", value: 2 } }
    ]
  };
  const result = dceMod.eliminateDeadCode(ast);
  if (result.statements.length !== 1) throw new Error("should remove dead statement");
});
assert("keeps reachable code", () => {
  const ast = {
    type: "block",
    statements: [
      { type: "assign", name: "x", value: { type: "literal", value: 1 } },
      { type: "return", value: { type: "variable", name: "x" } }
    ]
  };
  const result = dceMod.eliminateDeadCode(ast);
  if (result.statements.length !== 2) throw new Error("should keep both");
});
assert("removes unused variables", () => {
  const ast = {
    type: "block",
    statements: [
      { type: "assign", name: "unused", value: { type: "literal", value: 0 } },
      { type: "return", value: { type: "literal", value: 42 } }
    ]
  };
  const result = dceMod.removeUnused(ast, ["unused"]);
  if (result.statements.length !== 1) throw new Error("should remove unused");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
