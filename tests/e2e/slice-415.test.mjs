/**
 * Slice 415 — Skill Script Executor (Level 3 progressive loading)
 * Tests: parseScriptRefs, resolveScriptPath, loadScriptContent,
 *        executeSkillScript, selectRuntime, runSkillScripts,
 *        buildScriptContext, buildScriptOutputContext
 */

import { join } from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 415 — Skill Script Executor\x1b[0m\n");

const exec = await import(join(process.cwd(), "tools/ogu/commands/lib/skill-script-executor.mjs"));
const {
  parseScriptRefs, resolveScriptPath, loadScriptContent,
  executeSkillScript, selectRuntime, runSkillScripts,
  buildScriptContext, buildScriptOutputContext,
} = exec;

function makeTmpSkillsDir() {
  return mkdtempSync(join(tmpdir(), "slice415-"));
}

const SAMPLE_BODY_WITH_SCRIPTS = `# My Skill

## When to Use
Use when needed.

## Workflow
1. Run analyze script.

## Quality Bar
- Tests pass.

## Scripts

- \`scripts/analyze.mjs\` — analyzes artifacts and reports issues
- \`scripts/fix.py\` — applies automated fixes for Python errors
- \`scripts/report.sh\` — generates summary report

## Related Skills
See others.`;

const SAMPLE_BODY_NO_SCRIPTS = `# My Skill

## Workflow
1. Do the thing.

## Quality Bar
- Tests pass.`;

// ── parseScriptRefs ───────────────────────────────────────────────────────────
console.log("\n  parseScriptRefs()");

assert("returns empty array when no ## Scripts section", () => {
  const refs = parseScriptRefs(SAMPLE_BODY_NO_SCRIPTS);
  if (!Array.isArray(refs) || refs.length !== 0) throw new Error(`expected empty: ${JSON.stringify(refs)}`);
});
assert("parses all script refs from ## Scripts section", () => {
  const refs = parseScriptRefs(SAMPLE_BODY_WITH_SCRIPTS);
  if (refs.length !== 3) throw new Error(`expected 3, got ${refs.length}: ${JSON.stringify(refs)}`);
});
assert("extracts path correctly", () => {
  const refs = parseScriptRefs(SAMPLE_BODY_WITH_SCRIPTS);
  const paths = refs.map(r => r.path);
  if (!paths.includes("scripts/analyze.mjs")) throw new Error(`missing analyze: ${JSON.stringify(paths)}`);
  if (!paths.includes("scripts/fix.py")) throw new Error(`missing fix: ${JSON.stringify(paths)}`);
});
assert("extracts description from — separator", () => {
  const refs = parseScriptRefs(SAMPLE_BODY_WITH_SCRIPTS);
  const analyze = refs.find(r => r.path === "scripts/analyze.mjs");
  if (!analyze?.description?.includes("analyzes artifacts")) throw new Error(`desc: ${analyze?.description}`);
});
assert("detects extension correctly", () => {
  const refs = parseScriptRefs(SAMPLE_BODY_WITH_SCRIPTS);
  const py = refs.find(r => r.path === "scripts/fix.py");
  if (py?.extension !== ".py") throw new Error(`ext: ${py?.extension}`);
});
assert("handles null/undefined gracefully", () => {
  if (parseScriptRefs(null).length !== 0) throw new Error("null not handled");
  if (parseScriptRefs(undefined).length !== 0) throw new Error("undefined not handled");
  if (parseScriptRefs("").length !== 0) throw new Error("empty string not handled");
});

// ── resolveScriptPath ─────────────────────────────────────────────────────────
console.log("\n  resolveScriptPath()");

assert("resolves path relative to skill directory", () => {
  const skillsDir = makeTmpSkillsDir();
  mkdirSync(join(skillsDir, "my-skill", "scripts"), { recursive: true });
  writeFileSync(join(skillsDir, "my-skill", "scripts", "analyze.mjs"), "// analyze", "utf-8");
  const resolved = resolveScriptPath("scripts/analyze.mjs", skillsDir, "my-skill");
  if (!resolved) throw new Error("not resolved");
  if (!resolved.includes("my-skill")) throw new Error(`wrong path: ${resolved}`);
});
assert("resolves path relative to skills root", () => {
  const skillsDir = makeTmpSkillsDir();
  mkdirSync(join(skillsDir, "shared"), { recursive: true });
  writeFileSync(join(skillsDir, "shared", "util.mjs"), "// util", "utf-8");
  const resolved = resolveScriptPath("shared/util.mjs", skillsDir, null);
  if (!resolved) throw new Error("not resolved");
});
assert("returns null when script not found", () => {
  const skillsDir = makeTmpSkillsDir();
  const resolved = resolveScriptPath("nonexistent/script.mjs", skillsDir, "my-skill");
  if (resolved !== null) throw new Error(`expected null: ${resolved}`);
});
assert("returns null for null input", () => {
  const skillsDir = makeTmpSkillsDir();
  if (resolveScriptPath(null, skillsDir, "my-skill") !== null) throw new Error("expected null");
});

// ── loadScriptContent ─────────────────────────────────────────────────────────
console.log("\n  loadScriptContent()");

assert("loads script content from file", () => {
  const dir = makeTmpSkillsDir();
  const scriptPath = join(dir, "analyze.mjs");
  writeFileSync(scriptPath, "console.log('hello');", "utf-8");
  const { content, found } = loadScriptContent(scriptPath);
  if (!found) throw new Error("not found");
  if (!content.includes("hello")) throw new Error(`content: ${content}`);
});
assert("returns found: false for missing file", () => {
  const { content, found } = loadScriptContent("/tmp/nonexistent-xyz-415.mjs");
  if (found) throw new Error("should not be found");
  if (content !== null) throw new Error("content should be null");
});
assert("truncates very large files", () => {
  const dir = makeTmpSkillsDir();
  const scriptPath = join(dir, "large.mjs");
  writeFileSync(scriptPath, "x".repeat(100 * 1024), "utf-8"); // 100 KB
  const { content } = loadScriptContent(scriptPath, { maxBytes: 1024 });
  if (!content || content.length > 1100) throw new Error(`too long: ${content?.length}`);
  if (!content.includes("[truncated]")) throw new Error("missing truncation marker");
});
assert("handles null gracefully", () => {
  const { found } = loadScriptContent(null);
  if (found) throw new Error("expected found: false");
});

// ── selectRuntime ─────────────────────────────────────────────────────────────
console.log("\n  selectRuntime()");

assert(".mjs → node", () => {
  const [rt] = selectRuntime(".mjs", "script.mjs");
  if (rt !== "node") throw new Error(rt);
});
assert(".js → node", () => {
  const [rt] = selectRuntime(".js", "script.js");
  if (rt !== "node") throw new Error(rt);
});
assert(".py → python3", () => {
  const [rt] = selectRuntime(".py", "script.py");
  if (rt !== "python3") throw new Error(rt);
});
assert(".sh → bash", () => {
  const [rt] = selectRuntime(".sh", "script.sh");
  if (rt !== "bash") throw new Error(rt);
});

// ── executeSkillScript ────────────────────────────────────────────────────────
console.log("\n  executeSkillScript()");

assert("executes a simple Node.js script and captures stdout", () => {
  const dir = makeTmpSkillsDir();
  const scriptPath = join(dir, "hello.mjs");
  writeFileSync(scriptPath, "console.log('skill output: ok');", "utf-8");
  const result = executeSkillScript(scriptPath);
  if (!result.success) throw new Error(`failed: ${result.stderr}`);
  if (!result.stdout.includes("skill output: ok")) throw new Error(`stdout: ${result.stdout}`);
  if (result.exitCode !== 0) throw new Error(`exitCode: ${result.exitCode}`);
});
assert("returns exitCode=1 for script not found", () => {
  const result = executeSkillScript("/tmp/nonexistent-xyz-415.mjs");
  if (result.success) throw new Error("should have failed");
  if (result.exitCode !== 1) throw new Error(`exitCode: ${result.exitCode}`);
});
assert("captures non-zero exit code", () => {
  const dir = makeTmpSkillsDir();
  const scriptPath = join(dir, "fail.mjs");
  writeFileSync(scriptPath, "process.exit(2);", "utf-8");
  const result = executeSkillScript(scriptPath);
  if (result.success) throw new Error("should not be success");
  if (result.exitCode !== 2) throw new Error(`exitCode: ${result.exitCode}`);
});

// ── runSkillScripts ───────────────────────────────────────────────────────────
console.log("\n  runSkillScripts()");

assert("returns empty array when no ## Scripts section", () => {
  const skillsDir = makeTmpSkillsDir();
  const results = runSkillScripts(SAMPLE_BODY_NO_SCRIPTS, skillsDir, "my-skill");
  if (!Array.isArray(results) || results.length !== 0) throw new Error("expected empty");
});
assert("returns result per script ref", () => {
  const skillsDir = makeTmpSkillsDir();
  mkdirSync(join(skillsDir, "my-skill", "scripts"), { recursive: true });
  writeFileSync(join(skillsDir, "my-skill", "scripts", "analyze.mjs"),
    "console.log('analyzed');", "utf-8");
  // Only the .mjs script will be found; py and sh will report not found
  const body = `## Scripts\n- \`scripts/analyze.mjs\` — analysis\n`;
  const results = runSkillScripts(body, skillsDir, "my-skill");
  if (results.length !== 1) throw new Error(`expected 1, got ${results.length}`);
  if (!results[0].success) throw new Error(`failed: ${results[0].stderr}`);
  if (!results[0].stdout.includes("analyzed")) throw new Error(`stdout: ${results[0].stdout}`);
});
assert("reports not-found for missing scripts", () => {
  const skillsDir = makeTmpSkillsDir();
  const body = `## Scripts\n- \`scripts/missing.mjs\` — not there\n`;
  const results = runSkillScripts(body, skillsDir, "my-skill");
  if (results.length !== 1) throw new Error(`expected 1, got ${results.length}`);
  if (results[0].success) throw new Error("should be failure");
  if (results[0].resolvedPath !== null) throw new Error("resolvedPath should be null");
});

// ── buildScriptContext ────────────────────────────────────────────────────────
console.log("\n  buildScriptContext()");

assert("returns empty string when no ## Scripts section", () => {
  const skillsDir = makeTmpSkillsDir();
  const ctx = buildScriptContext(SAMPLE_BODY_NO_SCRIPTS, skillsDir, "my-skill");
  if (ctx !== "") throw new Error(`expected empty: ${ctx}`);
});
assert("includes script content in context", () => {
  const skillsDir = makeTmpSkillsDir();
  mkdirSync(join(skillsDir, "my-skill", "scripts"), { recursive: true });
  writeFileSync(join(skillsDir, "my-skill", "scripts", "analyze.mjs"),
    "// my analysis script\nconsole.log('done');", "utf-8");
  const body = `## Scripts\n- \`scripts/analyze.mjs\` — analysis\n`;
  const ctx = buildScriptContext(body, skillsDir, "my-skill");
  if (!ctx.includes("my analysis script")) throw new Error("script content missing");
  if (!ctx.includes("## Script Context")) throw new Error("missing header");
});
assert("notes missing scripts gracefully", () => {
  const skillsDir = makeTmpSkillsDir();
  const body = `## Scripts\n- \`scripts/missing.mjs\` — not there\n`;
  const ctx = buildScriptContext(body, skillsDir, "my-skill");
  if (!ctx.includes("not found")) throw new Error("missing 'not found' note");
});

// ── buildScriptOutputContext ──────────────────────────────────────────────────
console.log("\n  buildScriptOutputContext()");

assert("returns empty string for empty results", () => {
  if (buildScriptOutputContext([]) !== "") throw new Error("expected empty");
});
assert("includes ## Script Execution Results header", () => {
  const results = [{
    ref: { path: "scripts/analyze.mjs" },
    resolvedPath: "/tmp/analyze.mjs",
    stdout: "Analysis complete.\n",
    stderr: "",
    exitCode: 0,
    success: true,
  }];
  const ctx = buildScriptOutputContext(results);
  if (!ctx.includes("## Script Execution Results")) throw new Error("missing header");
  if (!ctx.includes("Analysis complete")) throw new Error("missing stdout");
});
assert("marks failed scripts clearly", () => {
  const results = [{
    ref: { path: "scripts/fail.mjs" },
    resolvedPath: "/tmp/fail.mjs",
    stdout: "",
    stderr: "Error: something broke",
    exitCode: 1,
    success: false,
  }];
  const ctx = buildScriptOutputContext(results);
  if (!ctx.includes("✗") && !ctx.includes("exit code 1")) throw new Error("missing failure marker");
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
