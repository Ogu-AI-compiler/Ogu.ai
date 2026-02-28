/**
 * Slice 169 — Markdown Parser + AST Walker
 *
 * Markdown Parser: parse markdown to AST nodes.
 * AST Walker: traverse AST with visitor pattern.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 169 — Markdown Parser + AST Walker\x1b[0m\n");

// ── Part 1: Markdown Parser ──────────────────────────────

console.log("\x1b[36m  Part 1: Markdown Parser\x1b[0m");

const mpLib = join(process.cwd(), "tools/ogu/commands/lib/markdown-parser.mjs");
assert("markdown-parser.mjs exists", () => {
  if (!existsSync(mpLib)) throw new Error("file missing");
});

const mpMod = await import(mpLib);

assert("parse returns AST", () => {
  if (typeof mpMod.parse !== "function") throw new Error("missing");
  const ast = mpMod.parse("# Hello\n\nWorld");
  if (!ast || !ast.children) throw new Error("missing children");
  if (ast.type !== "document") throw new Error(`expected document, got ${ast.type}`);
});

assert("parses headings", () => {
  const ast = mpMod.parse("# H1\n## H2\n### H3");
  const headings = ast.children.filter(n => n.type === "heading");
  if (headings.length !== 3) throw new Error(`expected 3 headings, got ${headings.length}`);
  if (headings[0].level !== 1) throw new Error("first should be level 1");
  if (headings[2].level !== 3) throw new Error("third should be level 3");
});

assert("parses paragraphs", () => {
  const ast = mpMod.parse("Hello world\n\nSecond paragraph");
  const paragraphs = ast.children.filter(n => n.type === "paragraph");
  if (paragraphs.length !== 2) throw new Error(`expected 2, got ${paragraphs.length}`);
});

assert("parses code blocks", () => {
  const ast = mpMod.parse("```js\nconst x = 1;\n```");
  const code = ast.children.find(n => n.type === "code_block");
  if (!code) throw new Error("missing code block");
  if (code.lang !== "js") throw new Error(`expected js, got ${code.lang}`);
});

assert("parses frontmatter", () => {
  const ast = mpMod.parse("---\ntitle: Test\n---\n\n# Content");
  if (!ast.frontmatter) throw new Error("missing frontmatter");
  if (ast.frontmatter.title !== "Test") throw new Error("wrong frontmatter");
});

// ── Part 2: AST Walker ──────────────────────────────

console.log("\n\x1b[36m  Part 2: AST Walker\x1b[0m");

const awLib = join(process.cwd(), "tools/ogu/commands/lib/ast-walker.mjs");
assert("ast-walker.mjs exists", () => {
  if (!existsSync(awLib)) throw new Error("file missing");
});

const awMod = await import(awLib);

assert("walk visits all nodes", () => {
  if (typeof awMod.walk !== "function") throw new Error("missing");
  const ast = {
    type: "document",
    children: [
      { type: "heading", level: 1, text: "Hi", children: [] },
      { type: "paragraph", text: "Hello", children: [] },
    ],
  };
  const visited = [];
  awMod.walk(ast, { enter: (node) => visited.push(node.type) });
  if (visited.length !== 3) throw new Error(`expected 3, got ${visited.length}`);
});

assert("walk supports enter and leave", () => {
  const ast = {
    type: "root",
    children: [{ type: "child", children: [] }],
  };
  const events = [];
  awMod.walk(ast, {
    enter: (node) => events.push(`enter:${node.type}`),
    leave: (node) => events.push(`leave:${node.type}`),
  });
  if (events[0] !== "enter:root") throw new Error("first should be enter:root");
  if (events[events.length - 1] !== "leave:root") throw new Error("last should be leave:root");
});

assert("walk supports type-specific visitors", () => {
  const ast = {
    type: "document",
    children: [
      { type: "heading", level: 1, text: "H", children: [] },
      { type: "paragraph", text: "P", children: [] },
    ],
  };
  const headings = [];
  awMod.walk(ast, {
    enter: (node) => {
      if (node.type === "heading") headings.push(node.text);
    },
  });
  if (headings.length !== 1) throw new Error(`expected 1, got ${headings.length}`);
});

assert("collect collects nodes by type", () => {
  if (typeof awMod.collect !== "function") throw new Error("missing");
  const ast = {
    type: "document",
    children: [
      { type: "heading", level: 1, text: "A", children: [] },
      { type: "paragraph", text: "B", children: [] },
      { type: "heading", level: 2, text: "C", children: [] },
    ],
  };
  const headings = awMod.collect(ast, "heading");
  if (headings.length !== 2) throw new Error(`expected 2, got ${headings.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
