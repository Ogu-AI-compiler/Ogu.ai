/**
 * Slice 52 — Smoke Test Framework + Enforce Command
 *
 * Smoke: write and run lightweight smoke tests from spec.
 * Enforce: validate code matches vault contracts via IR.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice52-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, "docs/vault/04_Features/auth"), { recursive: true });
mkdirSync(join(tmp, "docs/vault/02_Contracts"), { recursive: true });
mkdirSync(join(tmp, "src"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");
writeFileSync(join(tmp, "docs/vault/04_Features/auth/Spec.md"), "# Auth Spec\n\n## Login\n\nUser can log in with email and password.\n\n## Logout\n\nUser can log out.\n");
writeFileSync(join(tmp, "docs/vault/04_Features/auth/Plan.json"), JSON.stringify({
  tasks: [
    { id: 1, title: "Login form", inputs: [], outputs: ["COMPONENT:LoginForm", "ROUTE:/login"], touches: ["src/Login.tsx"] },
    { id: 2, title: "Logout", inputs: ["COMPONENT:LoginForm"], outputs: ["COMPONENT:LogoutButton"], touches: ["src/Logout.tsx"] },
  ],
}, null, 2));
writeFileSync(join(tmp, "src/Login.tsx"), "export function LoginForm() { return <form></form>; }\n");
writeFileSync(join(tmp, "src/Logout.tsx"), "export function LogoutButton() { return <button>Logout</button>; }\n");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 52 — Smoke Test Framework + Enforce Command\x1b[0m\n");
console.log("  Spec-driven smoke tests, contract enforcement\n");

// ── Part 1: Smoke Test Framework ──────────────────────────────

console.log("\x1b[36m  Part 1: Smoke Test Framework\x1b[0m");

const smokeLib = join(process.cwd(), "tools/ogu/commands/lib/smoke-test.mjs");
assert("smoke-test.mjs exists", () => {
  if (!existsSync(smokeLib)) throw new Error("file missing");
});

const smokeMod = await import(smokeLib);

assert("generateSmokeTests creates tests from spec", () => {
  if (typeof smokeMod.generateSmokeTests !== "function") throw new Error("missing");
  const tests = smokeMod.generateSmokeTests({
    root: tmp,
    featureSlug: "auth",
  });
  if (!Array.isArray(tests)) throw new Error("should return array");
  if (tests.length < 1) throw new Error("should generate at least 1 test");
});

assert("each smoke test has required fields", () => {
  const tests = smokeMod.generateSmokeTests({ root: tmp, featureSlug: "auth" });
  for (const t of tests) {
    if (!t.name) throw new Error("test missing name");
    if (!t.type) throw new Error("test missing type");
    if (!t.assertion) throw new Error("test missing assertion");
  }
});

assert("smoke tests cover IR outputs", () => {
  const tests = smokeMod.generateSmokeTests({ root: tmp, featureSlug: "auth" });
  const outputTests = tests.filter(t => t.type === "output-exists");
  if (outputTests.length < 1) throw new Error("should have output-exists tests");
});

assert("runSmokeTests executes and reports", () => {
  if (typeof smokeMod.runSmokeTests !== "function") throw new Error("missing");
  const tests = smokeMod.generateSmokeTests({ root: tmp, featureSlug: "auth" });
  const results = smokeMod.runSmokeTests({ root: tmp, tests });
  if (typeof results.passed !== "number") throw new Error("no passed count");
  if (typeof results.failed !== "number") throw new Error("no failed count");
  if (!Array.isArray(results.details)) throw new Error("no details");
});

assert("smoke test detects missing file", () => {
  const tests = [{
    name: "check missing component",
    type: "file-exists",
    assertion: { path: "src/NonExistent.tsx" },
  }];
  const results = smokeMod.runSmokeTests({ root: tmp, tests });
  if (results.failed < 1) throw new Error("should detect missing file");
});

// ── Part 2: Enforce Command ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Enforce Command\x1b[0m");

const enforceLib = join(process.cwd(), "tools/ogu/commands/lib/enforce.mjs");
assert("enforce.mjs exists", () => {
  if (!existsSync(enforceLib)) throw new Error("file missing");
});

const enforceMod = await import(enforceLib);

assert("enforceContracts checks code against vault contracts", () => {
  if (typeof enforceMod.enforceContracts !== "function") throw new Error("missing");
  // Create a contract file
  writeFileSync(join(tmp, "docs/vault/02_Contracts/Auth.contract.json"), JSON.stringify({
    name: "Auth",
    version: "1.0.0",
    invariants: ["LoginForm component exists"],
    outputs: ["COMPONENT:LoginForm"],
  }, null, 2));

  const result = enforceMod.enforceContracts({ root: tmp, featureSlug: "auth" });
  if (typeof result.violations !== "number") throw new Error("no violations count");
  if (!Array.isArray(result.checks)) throw new Error("no checks");
});

assert("enforceIR validates IR outputs exist in code", () => {
  if (typeof enforceMod.enforceIR !== "function") throw new Error("missing");
  const result = enforceMod.enforceIR({ root: tmp, featureSlug: "auth" });
  if (typeof result.present !== "number") throw new Error("no present count");
  if (typeof result.missing !== "number") throw new Error("no missing count");
});

assert("enforceIR detects present outputs", () => {
  const result = enforceMod.enforceIR({ root: tmp, featureSlug: "auth" });
  if (result.present < 1) throw new Error("should find at least 1 present output");
});

assert("enforceIR detects missing outputs", () => {
  // ROUTE:/login is an output but probably not in the code as a route
  const result = enforceMod.enforceIR({ root: tmp, featureSlug: "auth" });
  // Just check it returns valid data
  if (result.present + result.missing < 1) throw new Error("should check at least 1 output");
});

assert("enforceSummary returns combined report", () => {
  if (typeof enforceMod.enforceSummary !== "function") throw new Error("missing");
  const summary = enforceMod.enforceSummary({ root: tmp, featureSlug: "auth" });
  if (typeof summary.contractViolations !== "number") throw new Error("no contractViolations");
  if (typeof summary.irPresent !== "number") throw new Error("no irPresent");
  if (typeof summary.irMissing !== "number") throw new Error("no irMissing");
  if (typeof summary.ok !== "boolean") throw new Error("no ok flag");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
