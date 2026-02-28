#!/usr/bin/env node

/**
 * Slice 8 — Compile Pipeline + Gate Verification + Drift Detection
 *
 * Proves: The full compiler loop works end-to-end.
 *   1. compile:run reads Plan.json → dispatches to Kadima → waits for build
 *   2. After build: runs verification gates (file existence, content checks)
 *   3. Drift detection: compares built output against spec expectations
 *   4. Compile report: JSON summary with pass/fail per gate, timing, cost
 *   5. Feature lifecycle: building → built → verifying → verified
 *   6. All events in audit trail
 *
 * Scenario: compile the "greeting-module" feature from Slice 5
 *   - Plan.json with 3 tasks producing src/greeting/*.mjs
 *   - Spec says: must export greet(), must have 3 files
 *   - Gates: file-exists, exports-check, no-todos
 *
 * Depends on: Slices 1-7
 *
 * Run: node tests/e2e/slice-8.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ── Test harness ──

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err.message}`);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Helpers ──

const CLI = join(import.meta.dirname, '../../tools/ogu/cli.mjs');
const ROOT = join(import.meta.dirname, '../../');

function ogu(command, args = []) {
  const allArgs = [CLI, command, ...args];
  try {
    const output = execFileSync('node', allArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, OGU_ROOT: ROOT, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    };
  }
}

function readJSON(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

function writeJSON(relPath, data) {
  const fullPath = join(ROOT, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

function readJSONL(relPath) {
  const fp = join(ROOT, relPath);
  if (!existsSync(fp)) return [];
  return readFileSync(fp, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

async function pollUntil(fn, timeoutMs = 25000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await sleep(intervalMs);
  }
  return false;
}

// ── Fixture ──

const FEATURE = 'compile-test-mod';
const FEATURE_DIR = `docs/vault/features/${FEATURE}`;

const PLAN_JSON = {
  featureSlug: FEATURE,
  version: 1,
  tasks: [
    {
      id: 'ct-task-1',
      name: 'Create utils module',
      description: 'Create src/compile-test/utils.mjs',
      requiredRole: 'developer',
      output: {
        files: [{
          path: 'src/compile-test/utils.mjs',
          action: 'create',
          content: `export function add(a, b) {\n  return a + b;\n}\n\nexport function multiply(a, b) {\n  return a * b;\n}\n`,
        }],
      },
      dependsOn: [],
    },
    {
      id: 'ct-task-2',
      name: 'Create main module',
      description: 'Create src/compile-test/index.mjs',
      requiredRole: 'developer',
      output: {
        files: [{
          path: 'src/compile-test/index.mjs',
          action: 'create',
          content: `import { add, multiply } from './utils.mjs';\n\nexport function calculate(a, b) {\n  return { sum: add(a, b), product: multiply(a, b) };\n}\n`,
        }],
      },
      dependsOn: ['ct-task-1'],
    },
  ],
};

// Spec expectations for drift detection
const SPEC_JSON = {
  featureSlug: FEATURE,
  expectations: [
    { type: 'file-exists', path: 'src/compile-test/utils.mjs' },
    { type: 'file-exists', path: 'src/compile-test/index.mjs' },
    { type: 'export-exists', path: 'src/compile-test/utils.mjs', export: 'add' },
    { type: 'export-exists', path: 'src/compile-test/utils.mjs', export: 'multiply' },
    { type: 'export-exists', path: 'src/compile-test/index.mjs', export: 'calculate' },
    { type: 'no-pattern', path: 'src/compile-test/**', pattern: 'TODO' },
  ],
};

// ── Setup ──

function setup() {
  ogu('org:init', ['--minimal', '--force']);

  // Write fast daemon config
  writeJSON('.ogu/kadima.config.json', {
    version: 1,
    loops: {
      scheduler: { intervalMs: 500, enabled: true },
      stateMachine: { intervalMs: 500, enabled: true },
    },
    api: { host: '127.0.0.1', port: 4200, metricsPort: 4201 },
    runners: { maxConcurrent: 4, spawnMode: 'local', timeoutMs: 30000 },
  });

  // Create feature directory with Plan.json and Spec
  mkdirSync(join(ROOT, FEATURE_DIR), { recursive: true });
  writeJSON(`${FEATURE_DIR}/Plan.json`, PLAN_JSON);
  writeJSON(`${FEATURE_DIR}/Spec.json`, SPEC_JSON);

  // Clean previous scheduler entries
  const schedulerPath = join(ROOT, '.ogu/state/scheduler-state.json');
  if (existsSync(schedulerPath)) {
    const state = readJSON('.ogu/state/scheduler-state.json');
    state.queue = state.queue.filter(t => !t.taskId.startsWith('ct-'));
    writeJSON('.ogu/state/scheduler-state.json', state);
  }

  // Clean runner artifacts
  const runnersDir = join(ROOT, '.ogu/runners');
  if (existsSync(runnersDir)) {
    for (const f of readdirSync(runnersDir)) {
      if (f.startsWith('ct-')) rmSync(join(runnersDir, f));
    }
  }

  // Clean output files
  const testDir = join(ROOT, 'src/compile-test');
  if (existsSync(testDir)) rmSync(testDir, { recursive: true });

  // Clean feature state
  const featureState = join(ROOT, `.ogu/state/features/${FEATURE}.state.json`);
  if (existsSync(featureState)) rmSync(featureState);

  // Clean compile reports
  const reportPath = join(ROOT, `.ogu/reports/${FEATURE}.compile.json`);
  if (existsSync(reportPath)) rmSync(reportPath);

  // Reset budget
  const today = new Date().toISOString().slice(0, 10);
  writeJSON('.ogu/budget/budget-state.json', {
    version: 1,
    daily: { [today]: { spent: 0, transactions: [] } },
    monthly: { [today.slice(0, 7)]: { spent: 0, transactions: [] } },
    byFeature: {},
    byModel: {},
    updatedAt: new Date().toISOString(),
  });
}

function cleanup() {
  ogu('kadima:stop');
  const testDir = join(ROOT, 'src/compile-test');
  if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  const featureState = join(ROOT, `.ogu/state/features/${FEATURE}.state.json`);
  if (existsSync(featureState)) rmSync(featureState);
}

// ── Ensure clean ──
ogu('kadima:stop');

// ── Tests ──

console.log('\n\x1b[1mSlice 8 — Compile Pipeline E2E Test\x1b[0m\n');
console.log('  compile:run → build → verify gates → drift check → report\n');

setup();

// ── Part 1: compile:run ──

console.log('\x1b[36m  Part 1: compile:run orchestrates full pipeline\x1b[0m');

await test('compile:run dispatches build and waits for completion', async () => {
  // Start daemon first
  ogu('kadima:start');
  await sleep(1000);

  // Set feature to building state
  for (const state of ['idea', 'specifying', 'specified', 'planning', 'planned', 'building']) {
    ogu('feature:state', [FEATURE, state]);
  }

  const result = ogu('compile:run', [FEATURE]);
  assertEqual(result.exitCode, 0, `compile:run should exit 0: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('compiled') || result.stdout.includes('PASS') || result.stdout.includes('verified'),
    `Should confirm compilation: ${result.stdout.trim()}`
  );
});

await test('build produced the expected files', async () => {
  assert(fileExists('src/compile-test/utils.mjs'), 'utils.mjs should exist');
  assert(fileExists('src/compile-test/index.mjs'), 'index.mjs should exist');
});

// ── Part 2: Gate Verification ──

console.log('\n\x1b[36m  Part 2: Gate Verification\x1b[0m');

await test('compile report exists', async () => {
  assert(fileExists(`.ogu/reports/${FEATURE}.compile.json`), 'Compile report should exist');
});

await test('compile report has gate results', async () => {
  const report = readJSON(`.ogu/reports/${FEATURE}.compile.json`);
  assert(report.gates, 'Report should have gates');
  assert(report.gates.length >= 3, `Should have at least 3 gate checks, got ${report.gates.length}`);
});

await test('all gates passed', async () => {
  const report = readJSON(`.ogu/reports/${FEATURE}.compile.json`);
  const failed = report.gates.filter(g => !g.passed);
  assertEqual(failed.length, 0, `All gates should pass. Failed: ${failed.map(g => g.name).join(', ')}`);
});

await test('gates include file-exists checks', async () => {
  const report = readJSON(`.ogu/reports/${FEATURE}.compile.json`);
  const fileGates = report.gates.filter(g => g.type === 'file-exists');
  assert(fileGates.length >= 2, `Should have at least 2 file-exists gates, got ${fileGates.length}`);
});

await test('gates include export-exists checks', async () => {
  const report = readJSON(`.ogu/reports/${FEATURE}.compile.json`);
  const exportGates = report.gates.filter(g => g.type === 'export-exists');
  assert(exportGates.length >= 2, `Should have at least 2 export-exists gates, got ${exportGates.length}`);
});

// ── Part 3: Drift Detection ──

console.log('\n\x1b[36m  Part 3: Drift Detection\x1b[0m');

await test('compile report includes drift check', async () => {
  const report = readJSON(`.ogu/reports/${FEATURE}.compile.json`);
  assert(report.drift !== undefined, 'Report should have drift section');
  assertEqual(report.drift.drifted, false, 'Should have no drift');
});

await test('no-pattern gate detects absence of TODOs', async () => {
  const report = readJSON(`.ogu/reports/${FEATURE}.compile.json`);
  const noTodo = report.gates.find(g => g.type === 'no-pattern');
  assert(noTodo, 'Should have no-pattern gate');
  assertEqual(noTodo.passed, true, 'No TODOs should be found');
});

// ── Part 4: Feature Lifecycle ──

console.log('\n\x1b[36m  Part 4: Feature Lifecycle\x1b[0m');

await test('feature transitions to verified after compile', async () => {
  const state = readJSON(`.ogu/state/features/${FEATURE}.state.json`);
  assert(
    state.currentState === 'verified' || state.currentState === 'built',
    `Feature should be verified or built, got: ${state.currentState}`
  );
});

// ── Part 5: Compile Report Summary ──

console.log('\n\x1b[36m  Part 5: Compile Report Summary\x1b[0m');

await test('compile report has timing info', async () => {
  const report = readJSON(`.ogu/reports/${FEATURE}.compile.json`);
  assert(report.timing, 'Report should have timing');
  assert(typeof report.timing.totalMs === 'number', 'Should have totalMs');
});

await test('compile report has task summary', async () => {
  const report = readJSON(`.ogu/reports/${FEATURE}.compile.json`);
  assert(report.tasks, 'Report should have tasks summary');
  assertEqual(report.tasks.total, 2, 'Should have 2 tasks');
  assertEqual(report.tasks.completed, 2, 'All 2 should be completed');
});

await test('compile report has overall pass/fail', async () => {
  const report = readJSON(`.ogu/reports/${FEATURE}.compile.json`);
  assertEqual(report.result, 'PASS', 'Overall result should be PASS');
});

// ── Part 6: Audit Trail ──

console.log('\n\x1b[36m  Part 6: Compile Audit Trail\x1b[0m');

await test('audit trail has compile.start event', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const start = events.find(e =>
    e.type === 'compile.start' && e.payload?.featureSlug === FEATURE
  );
  assert(start, 'Should have compile.start audit event');
});

await test('audit trail has compile.gates event', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const gates = events.find(e =>
    e.type === 'compile.gates' && e.payload?.featureSlug === FEATURE
  );
  assert(gates, 'Should have compile.gates audit event');
});

await test('audit trail has compile.complete event', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const complete = events.find(e =>
    e.type === 'compile.complete' && e.payload?.featureSlug === FEATURE
  );
  assert(complete, 'Should have compile.complete audit event');
  assertEqual(complete.payload.result, 'PASS', 'compile.complete should be PASS');
});

// ── Part 7: Generated code works ──

console.log('\n\x1b[36m  Part 7: Generated Code Works\x1b[0m');

await test('generated module can be imported and executed', async () => {
  const { calculate } = await import('../../src/compile-test/index.mjs');
  const result = calculate(3, 4);
  assertEqual(result.sum, 7, 'add(3,4) should be 7');
  assertEqual(result.product, 12, 'multiply(3,4) should be 12');
});

// ── Cleanup ──

cleanup();

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
