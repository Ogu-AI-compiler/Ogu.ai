/**
 * Slice 142 — Template Engine + Code Generator
 *
 * Template Engine: simple template rendering with variable substitution.
 * Code Generator: generate code files from templates and schemas.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 142 — Template Engine + Code Generator\x1b[0m\n");

// ── Part 1: Template Engine ──────────────────────────────

console.log("\x1b[36m  Part 1: Template Engine\x1b[0m");

const teLib = join(process.cwd(), "tools/ogu/commands/lib/template-engine.mjs");
assert("template-engine.mjs exists", () => {
  if (!existsSync(teLib)) throw new Error("file missing");
});

const teMod = await import(teLib);

assert("render substitutes variables", () => {
  if (typeof teMod.render !== "function") throw new Error("missing");
  const result = teMod.render("Hello, {{name}}!", { name: "World" });
  if (result !== "Hello, World!") throw new Error(`got: ${result}`);
});

assert("render handles multiple variables", () => {
  const result = teMod.render("{{greeting}}, {{name}}! You are {{age}}.", {
    greeting: "Hi", name: "Alice", age: "30"
  });
  if (result !== "Hi, Alice! You are 30.") throw new Error(`got: ${result}`);
});

assert("render handles missing variables gracefully", () => {
  const result = teMod.render("Hello, {{name}}!", { name: "Bob" });
  if (result !== "Hello, Bob!") throw new Error(`got: ${result}`);
});

assert("renderBlock handles conditional blocks", () => {
  if (typeof teMod.renderBlock !== "function") throw new Error("missing");
  const tmpl = "{{#if hasAuth}}auth enabled{{/if}}";
  const result = teMod.renderBlock(tmpl, { hasAuth: true });
  if (!result.includes("auth enabled")) throw new Error("should include block");
  const result2 = teMod.renderBlock(tmpl, { hasAuth: false });
  if (result2.includes("auth enabled")) throw new Error("should exclude block");
});

// ── Part 2: Code Generator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Code Generator\x1b[0m");

const cgLib = join(process.cwd(), "tools/ogu/commands/lib/code-generator.mjs");
assert("code-generator.mjs exists", () => {
  if (!existsSync(cgLib)) throw new Error("file missing");
});

const cgMod = await import(cgLib);

assert("generateInterface creates TS interface", () => {
  if (typeof cgMod.generateInterface !== "function") throw new Error("missing");
  const code = cgMod.generateInterface({
    name: "User",
    fields: [
      { name: "id", type: "string" },
      { name: "email", type: "string" },
      { name: "age", type: "number", optional: true },
    ],
  });
  if (!code.includes("interface User")) throw new Error("missing interface");
  if (!code.includes("id: string")) throw new Error("missing id");
  if (!code.includes("age?: number")) throw new Error("missing optional age");
});

assert("generateFunction creates function stub", () => {
  if (typeof cgMod.generateFunction !== "function") throw new Error("missing");
  const code = cgMod.generateFunction({
    name: "fetchUser",
    params: [{ name: "id", type: "string" }],
    returnType: "Promise<User>",
    body: "return await db.find(id);",
  });
  if (!code.includes("function fetchUser")) throw new Error("missing function name");
  if (!code.includes("id: string")) throw new Error("missing param");
  if (!code.includes("Promise<User>")) throw new Error("missing return type");
});

assert("generateModule creates full module", () => {
  if (typeof cgMod.generateModule !== "function") throw new Error("missing");
  const code = cgMod.generateModule({
    name: "UserService",
    imports: [{ from: "./types", names: ["User"] }],
    exports: ["createUserService"],
  });
  if (!code.includes("import")) throw new Error("missing imports");
  if (!code.includes("export")) throw new Error("missing exports");
});

assert("generateEnum creates enum", () => {
  if (typeof cgMod.generateEnum !== "function") throw new Error("missing");
  const code = cgMod.generateEnum({
    name: "Status",
    values: ["Active", "Inactive", "Pending"],
  });
  if (!code.includes("enum Status")) throw new Error("missing enum");
  if (!code.includes("Active")) throw new Error("missing value");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
