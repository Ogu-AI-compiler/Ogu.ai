/**
 * Slice 236 — Trie Autocomplete + Fuzzy Matcher
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 236 — Trie Autocomplete + Fuzzy Matcher\x1b[0m\n");
console.log("\x1b[36m  Part 1: Trie Autocomplete\x1b[0m");
const taLib = join(process.cwd(), "tools/ogu/commands/lib/trie-autocomplete.mjs");
assert("trie-autocomplete.mjs exists", () => { if (!existsSync(taLib)) throw new Error("missing"); });
const taMod = await import(taLib);
assert("addWord and suggest", () => {
  const ac = taMod.createTrieAutocomplete();
  ac.addWord("apple"); ac.addWord("application"); ac.addWord("banana");
  const s = ac.suggest("app");
  if (s.length !== 2) throw new Error(`expected 2, got ${s.length}`);
});
assert("empty prefix returns all", () => {
  const ac = taMod.createTrieAutocomplete();
  ac.addWord("a"); ac.addWord("b");
  if (ac.suggest("").length !== 2) throw new Error("expected 2");
});
console.log("\n\x1b[36m  Part 2: Fuzzy Matcher\x1b[0m");
const fmLib = join(process.cwd(), "tools/ogu/commands/lib/fuzzy-matcher.mjs");
assert("fuzzy-matcher.mjs exists", () => { if (!existsSync(fmLib)) throw new Error("missing"); });
const fmMod = await import(fmLib);
assert("exact match scores highest", () => {
  const results = fmMod.fuzzyMatch("hello", ["hello", "hell", "world"]);
  if (results[0].item !== "hello") throw new Error("exact should be first");
});
assert("levenshteinDistance works", () => {
  const d = fmMod.levenshteinDistance("kitten", "sitting");
  if (d !== 3) throw new Error(`expected 3, got ${d}`);
});
console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
