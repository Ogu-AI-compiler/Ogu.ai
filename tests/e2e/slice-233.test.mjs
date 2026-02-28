/**
 * Slice 233 — Tokenizer Pipeline + Lexer State Machine
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 233 — Tokenizer Pipeline + Lexer State Machine\x1b[0m\n");

console.log("\x1b[36m  Part 1: Tokenizer Pipeline\x1b[0m");
const tpLib = join(process.cwd(), "tools/ogu/commands/lib/tokenizer-pipeline.mjs");
assert("tokenizer-pipeline.mjs exists", () => { if (!existsSync(tpLib)) throw new Error("missing"); });
const tpMod = await import(tpLib);
assert("addStage and run", () => {
  const tp = tpMod.createTokenizerPipeline();
  tp.addStage(text => text.split(/\s+/));
  tp.addStage(tokens => tokens.map(t => t.toLowerCase()));
  const result = tp.run("Hello World");
  if (result[0] !== "hello" || result[1] !== "world") throw new Error("wrong");
});
assert("getStageCount returns count", () => {
  const tp = tpMod.createTokenizerPipeline();
  tp.addStage(t => t);
  tp.addStage(t => t);
  if (tp.getStageCount() !== 2) throw new Error("expected 2");
});

console.log("\n\x1b[36m  Part 2: Lexer State Machine\x1b[0m");
const lsmLib = join(process.cwd(), "tools/ogu/commands/lib/lexer-state-machine.mjs");
assert("lexer-state-machine.mjs exists", () => { if (!existsSync(lsmLib)) throw new Error("missing"); });
const lsmMod = await import(lsmLib);
assert("tokenize with states", () => {
  const lsm = lsmMod.createLexerStateMachine();
  lsm.addState("default", [
    { pattern: /\d+/, type: "number" },
    { pattern: /[a-z]+/i, type: "word" },
    { pattern: /\s+/, type: "whitespace", skip: true }
  ]);
  const tokens = lsm.tokenize("hello 42 world");
  if (tokens.length !== 3) throw new Error(`expected 3, got ${tokens.length}`);
  if (tokens[0].type !== "word") throw new Error("first should be word");
  if (tokens[1].type !== "number") throw new Error("second should be number");
});
assert("handles unknown characters", () => {
  const lsm = lsmMod.createLexerStateMachine();
  lsm.addState("default", [{ pattern: /[a-z]+/, type: "word" }]);
  const tokens = lsm.tokenize("abc");
  if (tokens.length !== 1) throw new Error("expected 1");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
