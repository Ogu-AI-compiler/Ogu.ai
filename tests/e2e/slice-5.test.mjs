#!/usr/bin/env node

/**
 * Slice 5 — Dog-Food E2E Test
 *
 * Proves: The system can build a feature using itself.
 *
 * Flow:
 *   1. Define a feature with Plan.json (3 tasks with dependencies)
 *   2. ogu build:dispatch reads Plan.json → builds DAG → enqueues to Kadima
 *   3. Kadima daemon dispatches tasks to runners
 *   4. Runners read task instructions and produce real file changes
 *   5. Feature auto-transitions: building → built
 *   6. ogu build:status shows progress
 *   7. Verify: files exist, feature is built, audit trail is complete
 *
 * Plan.json for this test describes a mini "greeting-module" feature:
 *   task-1: Create src/greeting/index.mjs (no deps)
 *   task-2: Create src/greeting/format.mjs (no deps)
 *   task-3: Create src/greeting/main.mjs  (depends on task-1 + task-2)
 *
 * Depends on: Slices 1-4
 *
 * Run: node tests/e2e/slice-5.test.mjs
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
      timeout: 15000,
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

// ── Fixture: Plan.json for "greeting-module" ──

const FEATURE = 'greeting-module';
const FEATURE_DIR = `docs/vault/features/${FEATURE}`;

const PLAN_JSON = {
  featureSlug: FEATURE,
  version: 1,
  tasks: [
    {
      id: 'greeting-task-1',
      name: 'Create greeting index',
      description: 'Create src/greeting/index.mjs that exports greet()',
      output: {
        files: [
          {
            path: 'src/greeting/index.mjs',
            action: 'create',
            content: `export { greet } from './format.mjs';\nexport { main } from './main.mjs';\n`,
          },
        ],
      },
      dependsOn: [],
    },
    {
      id: 'greeting-task-2',
      name: 'Create greeting formatter',
      description: 'Create src/greeting/format.mjs with greet() function',
      output: {
        files: [
          {
            path: 'src/greeting/format.mjs',
            action: 'create',
            content: `export function greet(name) {\n  return \`Hello, \${name}!\`;\n}\n`,
          },
        ],
      },
      dependsOn: [],
    },
    {
      id: 'greeting-task-3',
      name: 'Create greeting main',
      description: 'Create src/greeting/main.mjs that ties it together',
      output: {
        files: [
          {
            path: 'src/greeting/main.mjs',
            action: 'create',
            content: `import { greet } from './format.mjs';\n\nexport function main() {\n  console.log(greet('World'));\n}\n`,
          },
        ],
      },
      dependsOn: ['greeting-task-1', 'greeting-task-2'],
    },
  ],
};

// ── Setup ──

function setup() {
  ogu('org:init', ['--minimal']);

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

  // Create feature directory with Plan.json
  mkdirSync(join(ROOT, FEATURE_DIR), { recursive: true });
  writeJSON(`${FEATURE_DIR}/Plan.json`, PLAN_JSON);

  // Clean previous scheduler entries for this feature
  const schedulerPath = join(ROOT, '.ogu/state/scheduler-state.json');
  if (existsSync(schedulerPath)) {
    const state = readJSON('.ogu/state/scheduler-state.json');
    state.queue = state.queue.filter(t => !t.taskId.startsWith('greeting-'));
    writeJSON('.ogu/state/scheduler-state.json', state);
  }

  // Clean previous runner artifacts
  const runnersDir = join(ROOT, '.ogu/runners');
  if (existsSync(runnersDir)) {
    for (const f of readdirSync(runnersDir)) {
      if (f.startsWith('greeting-')) rmSync(join(runnersDir, f));
    }
  }

  // Clean previous output files
  const greetingDir = join(ROOT, 'src/greeting');
  if (existsSync(greetingDir)) rmSync(greetingDir, { recursive: true });

  // Clean previous feature state
  const featureState = join(ROOT, `.ogu/state/features/${FEATURE}.state.json`);
  if (existsSync(featureState)) rmSync(featureState);
}

function cleanup() {
  ogu('kadima:stop');

  // Clean generated source files
  const greetingDir = join(ROOT, 'src/greeting');
  if (existsSync(greetingDir)) rmSync(greetingDir, { recursive: true });

  // Clean feature state
  const featureState = join(ROOT, `.ogu/state/features/${FEATURE}.state.json`);
  if (existsSync(featureState)) rmSync(featureState);

  // Clean runner artifacts
  const runnersDir = join(ROOT, '.ogu/runners');
  if (existsSync(runnersDir)) {
    for (const f of readdirSync(runnersDir)) {
      if (f.startsWith('greeting-')) rmSync(join(runnersDir, f));
    }
  }
}

// ── Ensure clean start ──
ogu('kadima:stop');

// ── Tests ──

console.log('\n\x1b[1mSlice 5 — Dog-Food E2E Test\x1b[0m\n');
console.log('  The system builds a feature using itself.\n');

setup();

// ── Part 1: Plan.json Validation ──

console.log('\x1b[36m  Part 1: Plan.json\x1b[0m');

await test('Plan.json exists and has tasks', async () => {
  assert(fileExists(`${FEATURE_DIR}/Plan.json`), 'Plan.json should exist');
  const plan = readJSON(`${FEATURE_DIR}/Plan.json`);
  assertEqual(plan.featureSlug, FEATURE, 'Feature slug should match');
  assertEqual(plan.tasks.length, 3, 'Should have 3 tasks');
});

await test('Plan.json task dependencies form valid DAG', async () => {
  const result = ogu('dag:validate', [
    '--tasks', 'greeting-task-1,greeting-task-2,greeting-task-3',
    '--deps', 'greeting-task-3:greeting-task-1+greeting-task-2',
    '--json',
  ]);
  assertEqual(result.exitCode, 0, 'DAG should be valid');
  const dag = JSON.parse(result.stdout);
  assert(dag.valid, 'DAG should be valid');
  assertEqual(dag.waves.length, 2, 'Should have 2 waves');
});

// ── Part 2: build:dispatch ──

console.log('\n\x1b[36m  Part 2: build:dispatch\x1b[0m');

await test('create feature state at building phase', async () => {
  for (const state of ['idea', 'specifying', 'specified', 'planning', 'planned', 'building']) {
    ogu('feature:state', [FEATURE, state]);
  }
  const state = readJSON(`.ogu/state/features/${FEATURE}.state.json`);
  assertEqual(state.currentState, 'building', 'Feature should be building');
});

await test('start Kadima daemon', async () => {
  const result = ogu('kadima:start');
  assertEqual(result.exitCode, 0, 'kadima:start should exit 0');
  await sleep(1000);
});

await test('build:dispatch reads Plan.json and enqueues all tasks', async () => {
  const result = ogu('build:dispatch', [FEATURE]);
  assertEqual(result.exitCode, 0, `build:dispatch should exit 0, got: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('Dispatched') || result.stdout.includes('enqueued') || result.stdout.includes('3 tasks'),
    `Should confirm tasks dispatched: ${result.stdout.trim()}`
  );
});

await test('scheduler queue has all 3 tasks with correct dependencies', async () => {
  const state = readJSON('.ogu/state/scheduler-state.json');
  const tasks = state.queue.filter(t => t.taskId.startsWith('greeting-'));
  assertEqual(tasks.length, 3, `Should have 3 greeting tasks, got ${tasks.length}`);

  const task3 = tasks.find(t => t.taskId === 'greeting-task-3');
  assert(task3, 'task-3 should be in queue');
  assert(task3.blockedBy.includes('greeting-task-1'), 'task-3 should be blocked by task-1');
  assert(task3.blockedBy.includes('greeting-task-2'), 'task-3 should be blocked by task-2');
});

// ── Part 3: Execution — Runners produce real files ──

console.log('\n\x1b[36m  Part 3: Runners Produce Real Files\x1b[0m');

await test('all tasks execute within timeout', async () => {
  const found = await pollUntil(() => {
    return fileExists('.ogu/runners/greeting-task-1.output.json') &&
           fileExists('.ogu/runners/greeting-task-2.output.json') &&
           fileExists('.ogu/runners/greeting-task-3.output.json');
  }, 25000, 500);
  assert(found, 'All 3 tasks should produce output envelopes');
});

await test('runner created src/greeting/index.mjs', async () => {
  assert(fileExists('src/greeting/index.mjs'), 'index.mjs should exist');
  const content = readFileSync(join(ROOT, 'src/greeting/index.mjs'), 'utf8');
  assert(content.includes('greet'), 'index.mjs should export greet');
});

await test('runner created src/greeting/format.mjs', async () => {
  assert(fileExists('src/greeting/format.mjs'), 'format.mjs should exist');
  const content = readFileSync(join(ROOT, 'src/greeting/format.mjs'), 'utf8');
  assert(content.includes('function greet'), 'format.mjs should define greet()');
});

await test('runner created src/greeting/main.mjs', async () => {
  assert(fileExists('src/greeting/main.mjs'), 'main.mjs should exist');
  const content = readFileSync(join(ROOT, 'src/greeting/main.mjs'), 'utf8');
  assert(content.includes('import'), 'main.mjs should import from format');
});

await test('output envelopes list created files', async () => {
  const output1 = readJSON('.ogu/runners/greeting-task-1.output.json');
  assert(output1.status === 'success', 'task-1 should succeed');
  assert(output1.files && output1.files.length > 0, 'task-1 should list created files');
  assert(output1.files[0].path === 'src/greeting/index.mjs', 'task-1 should list index.mjs');
});

// ── Part 4: Auto-Transition ──

console.log('\n\x1b[36m  Part 4: Feature Auto-Transition\x1b[0m');

await test('feature auto-transitions to "built"', async () => {
  const found = await pollUntil(() => {
    const state = readJSON(`.ogu/state/features/${FEATURE}.state.json`);
    return state.currentState === 'built';
  }, 15000, 500);
  assert(found, 'Feature should auto-transition to "built"');
});

// ── Part 5: build:status ──

console.log('\n\x1b[36m  Part 5: build:status\x1b[0m');

await test('build:status shows completed feature', async () => {
  const result = ogu('build:status', [FEATURE]);
  assertEqual(result.exitCode, 0, 'build:status should exit 0');
  assert(
    result.stdout.includes('built') || result.stdout.includes('completed') || result.stdout.includes('3/3'),
    `Should show completion: ${result.stdout.trim()}`
  );
});

await test('build:status lists produced files', async () => {
  const result = ogu('build:status', [FEATURE, '--json']);
  assertEqual(result.exitCode, 0, 'build:status --json should exit 0');
  const status = JSON.parse(result.stdout);
  assert(status.tasks, 'Should have tasks');
  assertEqual(status.tasks.length, 3, 'Should have 3 tasks');
  assert(status.tasks.every(t => t.status === 'completed'), 'All tasks should be completed');
  assert(status.filesCreated >= 3, `Should report at least 3 files created, got ${status.filesCreated}`);
});

// ── Part 6: Audit Trail ──

console.log('\n\x1b[36m  Part 6: Complete Audit Trail\x1b[0m');

await test('audit trail has build:dispatch event', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const dispatch = events.find(e =>
    e.type === 'build.dispatch' && e.payload?.featureSlug === FEATURE
  );
  assert(dispatch, 'Should have build.dispatch audit event');
});

await test('audit trail has all scheduler.dispatch events for this feature', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const dispatches = events.filter(e =>
    e.type === 'scheduler.dispatch' && e.payload?.featureSlug === FEATURE
  );
  assert(dispatches.length >= 3, `Should have at least 3 dispatch events, got ${dispatches.length}`);
});

await test('audit trail has runner.completed events with file counts', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const completed = events.filter(e =>
    e.type === 'runner.completed' && e.payload?.featureSlug === FEATURE
  );
  assert(completed.length >= 3, `Should have at least 3 runner.completed events, got ${completed.length}`);
});

await test('audit trail has auto-transition to built', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const transition = events.find(e =>
    e.type === 'feature.auto_transition' &&
    e.payload?.slug === FEATURE &&
    e.payload?.to === 'built'
  );
  assert(transition, 'Should have auto-transition audit event');
});

// ── Part 7: Generated code actually works ──

console.log('\n\x1b[36m  Part 7: Generated Code Works\x1b[0m');

await test('generated module can be imported and executed', async () => {
  const { greet } = await import('../../src/greeting/format.mjs');
  assertEqual(typeof greet, 'function', 'greet should be a function');
  assertEqual(greet('Ogu'), 'Hello, Ogu!', 'greet("Ogu") should return "Hello, Ogu!"');
});

// ── Cleanup and report ──

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
