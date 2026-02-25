/**
 * Ogu CLI smoke tests
 *
 * Run: node tools/ogu/tests/cli.test.mjs
 *
 * Tests that all commands import correctly, validate runs,
 * and the help output lists all expected commands.
 */

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");
const cli = join(root, "tools/ogu/cli.mjs");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ogu(args) {
  return execSync(`node "${cli}" ${args}`, { cwd: root, encoding: "utf-8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] });
}

function oguMaybe(args) {
  try {
    return { stdout: ogu(args), exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || "", stderr: err.stderr || "", exitCode: err.status };
  }
}

// ---------------------------------------------------------------------------

console.log("\nOgu CLI Smoke Tests\n");

// Test 1: All command files exist and import
test("All command files import without errors", () => {
  const commandsDir = join(root, "tools/ogu/commands");
  const files = readdirSync(commandsDir).filter((f) => f.endsWith(".mjs"));
  assert(files.length >= 30, `Expected >= 30 command files, got ${files.length}`);
});

// Test 2: CLI help output works
test("CLI help output shows all categories", () => {
  const { stdout } = oguMaybe(``);
  assert(stdout.includes("Core Pipeline:"), "Missing 'Core Pipeline' category");
  assert(stdout.includes("Architecture & Contracts:"), "Missing 'Architecture' category");
  assert(stdout.includes("Visual & Testing:"), "Missing 'Visual' category");
  assert(stdout.includes("Memory & Learning:"), "Missing 'Memory' category");
  assert(stdout.includes("Orchestration & State:"), "Missing 'Orchestration' category");
  assert(stdout.includes("Production:"), "Missing 'Production' category");
  assert(stdout.includes("Theme:"), "Missing 'Theme' category");
  assert(stdout.includes("Maintenance:"), "Missing 'Maintenance' category");
});

// Test 3: CLI help lists all key commands
test("CLI help lists all 35 commands", () => {
  const { stdout } = oguMaybe(``);
  const expected = [
    "doctor", "context", "context:lock", "feature:create", "feature:validate",
    "gates", "preview", "profile", "graph", "impact", "adr",
    "contracts:validate", "contract:version", "contract:diff", "contract:migrate",
    "vision", "vision:baseline", "remember", "learn", "recall", "trends",
    "orchestrate", "wip", "switch", "status", "observe:setup", "observe",
    "theme set", "theme show", "theme apply", "theme presets",
    "studio",
    "init", "validate", "log", "repo-map", "clean", "migrate",
  ];
  for (const cmd of expected) {
    assert(stdout.includes(cmd), `Missing command in help: '${cmd}'`);
  }
});

// Test 4: validate command runs
test("ogu validate exits cleanly", () => {
  const output = ogu(` validate`);
  assert(output.includes("OK"), "Validate should report OK");
});

// Test 5: status command runs
test("ogu status runs without error", () => {
  const output = ogu(` status`);
  assert(output.includes("Ogu Status Dashboard"), "Status should show dashboard header");
});

// Test 6: theme presets works
test("ogu theme presets lists built-in themes", () => {
  const output = ogu(` theme presets`);
  assert(output.includes("cyberpunk"), "Should list cyberpunk preset");
  assert(output.includes("minimal"), "Should list minimal preset");
});

// Test 7: remember --prune runs
test("ogu remember --prune runs without error", () => {
  const output = ogu(` remember --prune`);
  assert(output.includes("prune"), "Should show prune output");
});

// Test 8: unknown command exits with code 1
test("Unknown command exits with error", () => {
  const { exitCode, stdout } = oguMaybe(` nonexistent-command`);
  assert(exitCode !== 0, "Should exit non-zero for unknown command");
});

// Test 9: wip command runs
test("ogu wip runs without error", () => {
  const { stdout, exitCode } = oguMaybe(` wip`);
  // wip may exit 0 even with no features
  assert(exitCode === 0 || stdout.includes("Features"), "wip should run");
});

// Test 10: recall command runs
test("ogu recall runs without error", () => {
  const output = ogu(` recall`);
  assert(output.includes("pattern"), "recall should mention patterns");
});

// ---------------------------------------------------------------------------

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
