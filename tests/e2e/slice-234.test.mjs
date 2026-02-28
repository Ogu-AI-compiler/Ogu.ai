/**
 * Slice 234 — Parser Combinator + Grammar Rule Engine
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 234 — Parser Combinator + Grammar Rule Engine\x1b[0m\n");

console.log("\x1b[36m  Part 1: Parser Combinator\x1b[0m");
const pcLib = join(process.cwd(), "tools/ogu/commands/lib/parser-combinator.mjs");
assert("parser-combinator.mjs exists", () => { if (!existsSync(pcLib)) throw new Error("missing"); });
const pcMod = await import(pcLib);
assert("literal matches exact string", () => {
  const p = pcMod.literal("hello");
  const r = p("hello world");
  if (!r.success) throw new Error("should match");
  if (r.value !== "hello") throw new Error("wrong value");
});
assert("sequence combines parsers", () => {
  const p = pcMod.sequence([pcMod.literal("a"), pcMod.literal("b")]);
  const r = p("ab");
  if (!r.success) throw new Error("should match");
});
assert("choice tries alternatives", () => {
  const p = pcMod.choice([pcMod.literal("x"), pcMod.literal("y")]);
  if (!p("y").success) throw new Error("should match y");
  if (p("z").success) throw new Error("should not match z");
});

console.log("\n\x1b[36m  Part 2: Grammar Rule Engine\x1b[0m");
const grLib = join(process.cwd(), "tools/ogu/commands/lib/grammar-rule-engine.mjs");
assert("grammar-rule-engine.mjs exists", () => { if (!existsSync(grLib)) throw new Error("missing"); });
const grMod = await import(grLib);
assert("addRule and parse", () => {
  const ge = grMod.createGrammarRuleEngine();
  ge.addRule("greeting", input => input.startsWith("hello") ? { value: "greeting", rest: input.slice(5) } : null);
  const r = ge.parse("greeting", "hello world");
  if (!r) throw new Error("should parse");
  if (r.value !== "greeting") throw new Error("wrong value");
});
assert("returns null for no match", () => {
  const ge = grMod.createGrammarRuleEngine();
  ge.addRule("number", input => { const m = input.match(/^\d+/); return m ? { value: Number(m[0]), rest: input.slice(m[0].length) } : null; });
  if (ge.parse("number", "abc") !== null) throw new Error("should return null");
});
assert("listRules returns all", () => {
  const ge = grMod.createGrammarRuleEngine();
  ge.addRule("a", () => null);
  ge.addRule("b", () => null);
  if (ge.listRules().length !== 2) throw new Error("expected 2");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
