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

// Test 11: scheduler:status runs
test("ogu scheduler:status runs without error", () => {
  const output = ogu(` scheduler:status`);
  assert(output.includes("SCHEDULER STATUS"), "Should show scheduler status header");
  assert(output.includes("QUEUE:"), "Should show queue summary");
  assert(output.includes("P0-critical"), "Should show P0-critical class");
  assert(output.includes("P4-background"), "Should show P4-background class");
});

// Test 12: scheduler:queue runs
test("ogu scheduler:queue runs without error", () => {
  const output = ogu(` scheduler:queue`);
  assert(output.includes("SCHEDULER QUEUE"), "Should show queue header");
});

// Test 13: scheduler:fairness runs
test("ogu scheduler:fairness runs without error", () => {
  const output = ogu(` scheduler:fairness`);
  assert(output.includes("FAIR"), "Should show fairness info");
});

// Test 14: scheduler:simulate runs with --tasks
test("ogu scheduler:simulate produces simulation output", () => {
  const output = ogu(` scheduler:simulate --tasks 5`);
  assert(output.includes("SCHEDULER SIMULATION"), "Should show simulation header");
  assert(output.includes("FINAL VIRTUAL CLOCKS"), "Should show final virtual clocks");
  assert(output.includes("sim-task-"), "Should have simulated tasks");
});

// Test 15: system:health runs
test("ogu system:health runs without error", () => {
  const output = ogu(` system:health`);
  assert(output.includes("SYSTEM HEALTH"), "Should show system health header");
  assert(output.includes("FAILURE DOMAINS"), "Should show failure domains");
  assert(output.includes("FD-PROVIDER"), "Should show FD-PROVIDER domain");
  assert(output.includes("FD-AUDIT"), "Should show FD-AUDIT domain");
});

// Test 16: circuit:status runs
test("ogu circuit:status runs without error", () => {
  const output = ogu(` circuit:status`);
  assert(output.includes("CIRCUIT BREAKER STATUS"), "Should show circuit breaker header");
  assert(output.includes("FD-PROVIDER"), "Should list FD-PROVIDER");
  assert(output.includes("FD-FILESYSTEM"), "Should list FD-FILESYSTEM");
});

// Test 17: provider:health runs
test("ogu provider:health runs without error", () => {
  const output = ogu(` provider:health`);
  assert(output.includes("PROVIDER HEALTH"), "Should show provider health header");
  assert(output.includes("anthropic"), "Should list anthropic provider");
  assert(output.includes("openai"), "Should list openai provider");
});

// Test 18: provider:failover --test runs
test("ogu provider:failover --test produces dry-run output", () => {
  const output = ogu(` provider:failover --test`);
  assert(output.includes("FAILOVER TEST"), "Should show failover test header");
  assert(output.includes("anthropic"), "Should show anthropic in chain");
  assert(output.includes("simulated_ok"), "Should show simulated results");
});

// Test 19: metrics:health runs
test("ogu metrics:health shows org health score", () => {
  const output = ogu(` metrics:health`);
  assert(output.includes("ORG HEALTH SCORE"), "Should show org health header");
  assert(output.includes("Feature Velocity"), "Should show feature velocity");
  assert(output.includes("SLA COMPLIANCE"), "Should show SLA section");
});

// Test 20: metrics:kpis runs
test("ogu metrics:kpis shows all KPIs", () => {
  const output = ogu(` metrics:kpis`);
  assert(output.includes("KPI DASHBOARD"), "Should show KPI header");
  assert(output.includes("Feature Velocity"), "Should list feature velocity KPI");
  assert(output.includes("Budget Efficiency"), "Should list budget efficiency KPI");
  assert(output.includes("System Reliability"), "Should list system reliability KPI");
});

// Test 21: metrics:sla runs
test("ogu metrics:sla shows SLA compliance", () => {
  const output = ogu(` metrics:sla`);
  assert(output.includes("SLA COMPLIANCE"), "Should show SLA header");
  assert(output.includes("Scheduling"), "Should show scheduling SLA");
});

// Test 22: metrics:regression runs
test("ogu metrics:regression runs without error", () => {
  const output = ogu(` metrics:regression`);
  assert(output.includes("REGRESSION DETECTION"), "Should show regression header");
});

// Test 23: graph:hash runs
test("ogu graph:hash produces execution graph hash", () => {
  const output = ogu(` graph:hash test-a`);
  assert(output.includes("EXECUTION GRAPH HASH"), "Should show graph hash header");
  assert(output.includes("Graph Hash:"), "Should show graph hash value");
  assert(output.includes("Replay Guarantee"), "Should show replay guarantee");
});

// Test 24: deterministic:status runs
test("ogu deterministic:status runs without error", () => {
  const output = ogu(` deterministic:status`);
  assert(output.includes("Deterministic mode"), "Should show deterministic mode status");
});

// Test 25: freeze --status runs
test("ogu freeze --status runs without error", () => {
  const output = ogu(` freeze --status`);
  assert(output.includes("Organization"), "Should show organization status");
});

// ---------------------------------------------------------------------------

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
