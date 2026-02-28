/**
 * Slice 59 — Template Engine + Report Generator
 *
 * Template engine: variable substitution, conditionals, loops for MD/JSON generation.
 * Report generator: produce compile reports, feature summaries, gate reports.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice59-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/reports"), { recursive: true });
mkdirSync(join(tmp, "docs/vault/04_Features/auth"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({ current_task: "auth" }));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");
writeFileSync(join(tmp, "docs/vault/04_Features/auth/Plan.json"), JSON.stringify({
  tasks: [
    { id: 1, title: "Login form", outputs: ["COMPONENT:LoginForm"], touches: ["src/Login.tsx"] },
    { id: 2, title: "Logout", outputs: ["COMPONENT:LogoutButton"], touches: ["src/Logout.tsx"] },
  ],
}, null, 2));
writeFileSync(join(tmp, ".ogu/GATE_STATE.json"), JSON.stringify({
  auth: {
    gates: {
      "01-vault": { status: "pass", ts: "2026-02-28T10:00:00Z" },
      "02-spec-ir": { status: "pass", ts: "2026-02-28T10:01:00Z" },
      "03-pre-build": { status: "fail", ts: "2026-02-28T10:02:00Z", errors: ["missing Plan.json"] },
    },
  },
}, null, 2));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 59 — Template Engine + Report Generator\x1b[0m\n");
console.log("  Variable substitution, compile & gate reports\n");

// ── Part 1: Template Engine ──────────────────────────────

console.log("\x1b[36m  Part 1: Template Engine\x1b[0m");

const tplLib = join(process.cwd(), "tools/ogu/commands/lib/template-engine.mjs");
assert("template-engine.mjs exists", () => {
  if (!existsSync(tplLib)) throw new Error("file missing");
});

const tplMod = await import(tplLib);

assert("render substitutes variables", () => {
  if (typeof tplMod.render !== "function") throw new Error("missing");
  const result = tplMod.render("Hello {{name}}, version {{version}}", { name: "Ogu", version: "4.0" });
  if (result !== "Hello Ogu, version 4.0") throw new Error(`got: ${result}`);
});

assert("render handles missing variables gracefully", () => {
  const result = tplMod.render("Hello {{name}}, {{missing}}", { name: "World" });
  if (!result.includes("World")) throw new Error("should keep known vars");
  // Missing vars should be replaced with empty string or kept as-is
  if (result.includes("{{name}}")) throw new Error("should have replaced name");
});

assert("render handles conditionals", () => {
  const tpl = "{{#if active}}Active{{/if}}{{#if inactive}}Inactive{{/if}}";
  const result = tplMod.render(tpl, { active: true, inactive: false });
  if (!result.includes("Active")) throw new Error("should include Active");
  if (result.includes("Inactive")) throw new Error("should not include Inactive");
});

assert("render handles each loops", () => {
  const tpl = "Items:{{#each items}} - {{.}}{{/each}}";
  const result = tplMod.render(tpl, { items: ["a", "b", "c"] });
  if (!result.includes("- a")) throw new Error("should include a");
  if (!result.includes("- b")) throw new Error("should include b");
  if (!result.includes("- c")) throw new Error("should include c");
});

assert("render handles nested properties", () => {
  const result = tplMod.render("{{user.name}} ({{user.role}})", { user: { name: "Alice", role: "dev" } });
  if (result !== "Alice (dev)") throw new Error(`got: ${result}`);
});

// ── Part 2: Report Generator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Report Generator\x1b[0m");

const reportLib = join(process.cwd(), "tools/ogu/commands/lib/report-generator.mjs");
assert("report-generator.mjs exists", () => {
  if (!existsSync(reportLib)) throw new Error("file missing");
});

const reportMod = await import(reportLib);

assert("generateGateReport returns markdown", () => {
  if (typeof reportMod.generateGateReport !== "function") throw new Error("missing");
  const report = reportMod.generateGateReport({ root: tmp, featureSlug: "auth" });
  if (typeof report !== "string") throw new Error("should return string");
  if (!report.includes("auth")) throw new Error("should mention feature");
  if (!report.includes("pass") || !report.includes("fail")) throw new Error("should show pass/fail status");
});

assert("generateFeatureSummary returns feature overview", () => {
  if (typeof reportMod.generateFeatureSummary !== "function") throw new Error("missing");
  const summary = reportMod.generateFeatureSummary({ root: tmp, featureSlug: "auth" });
  if (typeof summary !== "string") throw new Error("should return string");
  if (!summary.includes("auth")) throw new Error("should mention feature");
  if (!summary.includes("task") || !summary.includes("2")) throw new Error("should mention task count");
});

assert("generateCompileReport returns overall summary", () => {
  if (typeof reportMod.generateCompileReport !== "function") throw new Error("missing");
  const report = reportMod.generateCompileReport({ root: tmp, featureSlug: "auth" });
  if (typeof report !== "string") throw new Error("should return string");
  if (!report.includes("Compile Report")) throw new Error("should have title");
});

assert("REPORT_TYPES lists available report types", () => {
  if (!reportMod.REPORT_TYPES) throw new Error("missing");
  if (!reportMod.REPORT_TYPES.includes("gate")) throw new Error("missing gate");
  if (!reportMod.REPORT_TYPES.includes("feature")) throw new Error("missing feature");
  if (!reportMod.REPORT_TYPES.includes("compile")) throw new Error("missing compile");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
