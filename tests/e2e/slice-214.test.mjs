/**
 * Slice 214 — Suffix Array + Suffix Tree
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 214 — Suffix Array + Suffix Tree\x1b[0m\n");

console.log("\x1b[36m  Part 1: Suffix Array\x1b[0m");
const saLib = join(process.cwd(), "tools/ogu/commands/lib/suffix-array.mjs");
assert("suffix-array.mjs exists", () => { if (!existsSync(saLib)) throw new Error("missing"); });
const saMod = await import(saLib);
assert("build returns sorted suffix indices", () => {
  const sa = saMod.buildSuffixArray("banana");
  if (sa.length !== 6) throw new Error(`expected 6, got ${sa.length}`);
  if (sa[0] !== 5) throw new Error("first suffix should be 'a' at index 5");
});
assert("search finds substring", () => {
  const sa = saMod.buildSuffixArray("banana");
  const found = saMod.search("banana", sa, "ana");
  if (!found) throw new Error("should find ana");
});
assert("search returns false for missing", () => {
  const sa = saMod.buildSuffixArray("banana");
  if (saMod.search("banana", sa, "xyz")) throw new Error("should not find xyz");
});

console.log("\n\x1b[36m  Part 2: Suffix Tree\x1b[0m");
const stLib = join(process.cwd(), "tools/ogu/commands/lib/suffix-tree.mjs");
assert("suffix-tree.mjs exists", () => { if (!existsSync(stLib)) throw new Error("missing"); });
const stMod = await import(stLib);
assert("contains finds substrings", () => {
  const st = stMod.createSuffixTree("banana");
  if (!st.contains("ban")) throw new Error("should find ban");
  if (!st.contains("ana")) throw new Error("should find ana");
  if (st.contains("xyz")) throw new Error("should not find xyz");
});
assert("countOccurrences counts correctly", () => {
  const st = stMod.createSuffixTree("banana");
  const count = st.countOccurrences("an");
  if (count !== 2) throw new Error(`expected 2, got ${count}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
