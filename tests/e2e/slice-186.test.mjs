/**
 * Slice 186 — Trie Index + Prefix Matcher
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}
console.log("\n\x1b[1mSlice 186 — Trie Index + Prefix Matcher\x1b[0m\n");

console.log("\x1b[36m  Part 1: Trie Index\x1b[0m");
const tLib = join(process.cwd(), "tools/ogu/commands/lib/trie-index.mjs");
assert("trie-index.mjs exists", () => { if (!existsSync(tLib)) throw new Error("file missing"); });
const tMod = await import(tLib);

assert("createTrie returns trie", () => {
  const t = tMod.createTrie();
  if (typeof t.insert !== "function") throw new Error("missing insert");
  if (typeof t.search !== "function") throw new Error("missing search");
  if (typeof t.startsWith !== "function") throw new Error("missing startsWith");
});
assert("insert and search", () => {
  const t = tMod.createTrie();
  t.insert("hello");
  if (!t.search("hello")) throw new Error("should find hello");
  if (t.search("hell")) throw new Error("hell is not a word");
});
assert("startsWith finds prefixes", () => {
  const t = tMod.createTrie();
  t.insert("apple"); t.insert("app"); t.insert("banana");
  const results = t.startsWith("app");
  if (results.length !== 2) throw new Error(`expected 2, got ${results.length}`);
});
assert("getWords returns all", () => {
  const t = tMod.createTrie();
  t.insert("a"); t.insert("b"); t.insert("c");
  if (t.getWords().length !== 3) throw new Error("expected 3");
});

console.log("\n\x1b[36m  Part 2: Prefix Matcher\x1b[0m");
const pmLib = join(process.cwd(), "tools/ogu/commands/lib/prefix-matcher.mjs");
assert("prefix-matcher.mjs exists", () => { if (!existsSync(pmLib)) throw new Error("file missing"); });
const pmMod = await import(pmLib);

assert("createPrefixMatcher returns matcher", () => {
  const m = pmMod.createPrefixMatcher();
  if (typeof m.addPattern !== "function") throw new Error("missing addPattern");
  if (typeof m.match !== "function") throw new Error("missing match");
});
assert("match returns longest prefix", () => {
  const m = pmMod.createPrefixMatcher();
  m.addPattern("/api", "api-handler");
  m.addPattern("/api/users", "users-handler");
  const r = m.match("/api/users/123");
  if (r.handler !== "users-handler") throw new Error(`expected users-handler, got ${r.handler}`);
});
assert("match returns null for no match", () => {
  const m = pmMod.createPrefixMatcher();
  m.addPattern("/api", "h");
  if (m.match("/other") !== null) throw new Error("should return null");
});
assert("matchAll returns all matching prefixes", () => {
  const m = pmMod.createPrefixMatcher();
  m.addPattern("/a", "h1");
  m.addPattern("/a/b", "h2");
  m.addPattern("/a/b/c", "h3");
  const results = m.matchAll("/a/b/c/d");
  if (results.length !== 3) throw new Error(`expected 3, got ${results.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
