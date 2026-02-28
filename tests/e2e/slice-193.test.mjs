/**
 * Slice 193 — Finite Automaton + Regex Engine
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 193 — Finite Automaton + Regex Engine\x1b[0m\n");

console.log("\x1b[36m  Part 1: Finite Automaton\x1b[0m");
const faLib = join(process.cwd(), "tools/ogu/commands/lib/finite-automaton.mjs");
assert("finite-automaton.mjs exists", () => { if (!existsSync(faLib)) throw new Error("missing"); });
const faMod = await import(faLib);
assert("createDFA accepts valid input", () => {
  const dfa = faMod.createDFA({
    states: ["q0", "q1", "q2"],
    initial: "q0",
    accepting: ["q2"],
    transitions: { q0: { a: "q1" }, q1: { b: "q2" } }
  });
  if (!dfa.accepts("ab")) throw new Error("should accept ab");
});
assert("rejects invalid input", () => {
  const dfa = faMod.createDFA({
    states: ["q0", "q1"], initial: "q0", accepting: ["q1"],
    transitions: { q0: { a: "q1" } }
  });
  if (dfa.accepts("b")) throw new Error("should reject b");
});
assert("getState returns current state after run", () => {
  const dfa = faMod.createDFA({
    states: ["q0", "q1"], initial: "q0", accepting: ["q1"],
    transitions: { q0: { a: "q1" } }
  });
  dfa.run("a");
  if (dfa.getState() !== "q1") throw new Error("should be q1");
});
assert("reset returns to initial", () => {
  const dfa = faMod.createDFA({
    states: ["q0", "q1"], initial: "q0", accepting: ["q1"],
    transitions: { q0: { a: "q1" } }
  });
  dfa.run("a"); dfa.reset();
  if (dfa.getState() !== "q0") throw new Error("should be q0");
});

console.log("\n\x1b[36m  Part 2: Regex Engine\x1b[0m");
const reLib = join(process.cwd(), "tools/ogu/commands/lib/regex-engine.mjs");
assert("regex-engine.mjs exists", () => { if (!existsSync(reLib)) throw new Error("missing"); });
const reMod = await import(reLib);
assert("createRegexEngine matches literal", () => {
  const re = reMod.createRegexEngine();
  if (!re.match("hello", "hello world")) throw new Error("should match");
});
assert("no match returns null", () => {
  const re = reMod.createRegexEngine();
  if (re.match("xyz", "hello world")) throw new Error("should not match");
});
assert("matchAll finds all occurrences", () => {
  const re = reMod.createRegexEngine();
  const results = re.matchAll("ab", "ababab");
  if (results.length !== 3) throw new Error(`expected 3, got ${results.length}`);
});
assert("replace works", () => {
  const re = reMod.createRegexEngine();
  const result = re.replace("cat", "dog", "the cat sat on the cat");
  if (result !== "the dog sat on the dog") throw new Error(`got: ${result}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
