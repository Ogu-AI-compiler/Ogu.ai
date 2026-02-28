/**
 * Slice 158 — Token Lexer + Symbol Table
 *
 * Token Lexer: tokenize input into typed tokens.
 * Symbol Table: manage symbols with scope hierarchy.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 158 — Token Lexer + Symbol Table\x1b[0m\n");

// ── Part 1: Token Lexer ──────────────────────────────

console.log("\x1b[36m  Part 1: Token Lexer\x1b[0m");

const tlLib = join(process.cwd(), "tools/ogu/commands/lib/token-lexer.mjs");
assert("token-lexer.mjs exists", () => {
  if (!existsSync(tlLib)) throw new Error("file missing");
});

const tlMod = await import(tlLib);

assert("createLexer returns lexer", () => {
  if (typeof tlMod.createLexer !== "function") throw new Error("missing");
  const lexer = tlMod.createLexer();
  if (typeof lexer.addRule !== "function") throw new Error("missing addRule");
  if (typeof lexer.tokenize !== "function") throw new Error("missing tokenize");
});

assert("tokenize produces typed tokens", () => {
  const lexer = tlMod.createLexer();
  lexer.addRule({ type: "NUMBER", pattern: /\d+/ });
  lexer.addRule({ type: "PLUS", pattern: /\+/ });
  lexer.addRule({ type: "WS", pattern: /\s+/, skip: true });
  const tokens = lexer.tokenize("3 + 42");
  if (tokens.length !== 3) throw new Error(`expected 3 tokens, got ${tokens.length}`);
  if (tokens[0].type !== "NUMBER") throw new Error("first should be NUMBER");
  if (tokens[0].value !== "3") throw new Error("first value should be 3");
  if (tokens[1].type !== "PLUS") throw new Error("second should be PLUS");
  if (tokens[2].value !== "42") throw new Error("third value should be 42");
});

assert("tokenize handles keywords", () => {
  const lexer = tlMod.createLexer();
  lexer.addRule({ type: "KEYWORD", pattern: /if|else|return/ });
  lexer.addRule({ type: "IDENT", pattern: /[a-zA-Z_]\w*/ });
  lexer.addRule({ type: "WS", pattern: /\s+/, skip: true });
  const tokens = lexer.tokenize("if x else y");
  if (tokens[0].type !== "KEYWORD") throw new Error("if should be keyword");
  if (tokens[1].type !== "IDENT") throw new Error("x should be ident");
});

assert("tokenize returns position info", () => {
  const lexer = tlMod.createLexer();
  lexer.addRule({ type: "WORD", pattern: /\w+/ });
  lexer.addRule({ type: "WS", pattern: /\s+/, skip: true });
  const tokens = lexer.tokenize("hello world");
  if (tokens[0].offset !== 0) throw new Error("first offset should be 0");
  if (tokens[1].offset !== 6) throw new Error("second offset should be 6");
});

// ── Part 2: Symbol Table ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Symbol Table\x1b[0m");

const stLib = join(process.cwd(), "tools/ogu/commands/lib/symbol-table.mjs");
assert("symbol-table.mjs exists", () => {
  if (!existsSync(stLib)) throw new Error("file missing");
});

const stMod = await import(stLib);

assert("createSymbolTable returns table", () => {
  if (typeof stMod.createSymbolTable !== "function") throw new Error("missing");
  const st = stMod.createSymbolTable();
  if (typeof st.define !== "function") throw new Error("missing define");
  if (typeof st.lookup !== "function") throw new Error("missing lookup");
  if (typeof st.enterScope !== "function") throw new Error("missing enterScope");
  if (typeof st.exitScope !== "function") throw new Error("missing exitScope");
});

assert("define and lookup in global scope", () => {
  const st = stMod.createSymbolTable();
  st.define("x", { type: "number" });
  const sym = st.lookup("x");
  if (!sym) throw new Error("should find x");
  if (sym.type !== "number") throw new Error("type should be number");
});

assert("inner scope shadows outer", () => {
  const st = stMod.createSymbolTable();
  st.define("x", { type: "string" });
  st.enterScope("block");
  st.define("x", { type: "number" });
  if (st.lookup("x").type !== "number") throw new Error("should shadow");
  st.exitScope();
  if (st.lookup("x").type !== "string") throw new Error("should restore");
});

assert("lookup finds outer scope symbols", () => {
  const st = stMod.createSymbolTable();
  st.define("global", { type: "any" });
  st.enterScope("fn");
  if (!st.lookup("global")) throw new Error("should find outer scope symbol");
});

assert("lookup returns null for undefined", () => {
  const st = stMod.createSymbolTable();
  if (st.lookup("missing") !== null) throw new Error("should return null");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
