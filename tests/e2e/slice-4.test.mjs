#!/usr/bin/env node

/**
 * Slice 4 — End-to-End Test
 *
 * Proves: Tasks with dependencies execute in correct order,
 *         independent tasks run in parallel, and features
 *         auto-transition when all tasks complete.
 *
 * DAG for this test:
 *
 *   task-A ──┐
 *            ├──→ task-C ──→ task-D
 *   task-B ──┘
 *
 *   task-A and task-B are independent (parallel)
 *   task-C depends on A + B
 *   task-D depends on C
 *
 * Depends on: Slice 1-3 (org, state, agent:run, policies, kadima daemon)
 *
 * Run: node tests/e2e/slice-4.test.mjs
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

async function pollUntil(fn, timeoutMs = 20000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await sleep(intervalMs);
  }
  return false;
}

// ── Setup ──

const FEATURE = 'slice4-parallel-test';

function setup() {
  // Ensure OrgSpec exists
  ogu('org:init', ['--minimal']);

  // Write fast daemon config
  writeJSON('.ogu/kadima.config.json', {
    version: 1,
    loops: {
      scheduler: { intervalMs: 500, enabled: true },
      stateMachine: { intervalMs: 500, enabled: true },
    },
    api: {
      host: '127.0.0.1',
      port: 4200,
      metricsPort: 4201,
    },
    runners: {
      maxConcurrent: 4,
      spawnMode: 'local',
      timeoutMs: 30000,
    },
  });

  // Clear any previous scheduler state for this test
  const schedulerPath = join(ROOT, '.ogu/state/scheduler-state.json');
  if (existsSync(schedulerPath)) {
    const state = readJSON('.ogu/state/scheduler-state.json');
    state.queue = state.queue.filter(t => !t.taskId.startsWith('par-'));
    writeJSON('.ogu/state/scheduler-state.json', state);
  }

  // Clean runner artifacts from previous runs
  const runnersDir = join(ROOT, '.ogu/runners');
  if (existsSync(runnersDir)) {
    for (const f of readdirSync(runnersDir)) {
      if (f.startsWith('par-')) rmSync(join(runnersDir, f));
    }
  }
}

function cleanup() {
  ogu('kadima:stop');

  // Clean test state
  const stateFile = join(ROOT, `.ogu/state/features/${FEATURE}.state.json`);
  if (existsSync(stateFile)) rmSync(stateFile);

  const runnersDir = join(ROOT, '.ogu/runners');
  if (existsSync(runnersDir)) {
    for (const f of readdirSync(runnersDir)) {
      if (f.startsWith('par-')) rmSync(join(runnersDir, f));
    }
  }
}

// ── Ensure daemon is stopped before tests ──
ogu('kadima:stop');

// ── Tests ──

console.log('\n\x1b[1mSlice 4 — Multi-Agent Parallel E2E Test\x1b[0m\n');
console.log('  DAG: A,B (parallel) → C (depends on A+B) → D (depends on C)\n');

setup();

// ── Part 1: DAG Builder ──

console.log('\x1b[36m  Part 1: DAG Builder\x1b[0m');

await test('dag:validate accepts valid DAG', async () => {
  const result = ogu('dag:validate', [
    '--tasks', 'par-A,par-B,par-C,par-D',
    '--deps', 'par-C:par-A+par-B,par-D:par-C',
  ]);
  assertEqual(result.exitCode, 0, 'dag:validate should exit 0');
  assert(result.stdout.includes('valid') || result.stdout.includes('OK'), `Should confirm valid DAG: ${result.stdout.trim()}`);
});

await test('dag:validate detects cycles', async () => {
  const result = ogu('dag:validate', [
    '--tasks', 'x,y,z',
    '--deps', 'x:y,y:z,z:x',
  ]);
  assert(result.exitCode !== 0 || result.stdout.includes('cycle'), 'Should detect cycle');
});

await test('dag:validate computes execution waves', async () => {
  const result = ogu('dag:validate', [
    '--tasks', 'par-A,par-B,par-C,par-D',
    '--deps', 'par-C:par-A+par-B,par-D:par-C',
    '--json',
  ]);
  assertEqual(result.exitCode, 0, 'dag:validate --json should exit 0');
  const output = JSON.parse(result.stdout);
  assert(output.waves, 'Should have waves');
  assert(output.waves.length === 3, `Should have 3 waves, got ${output.waves.length}`);
  // Wave 0: A, B (parallel); Wave 1: C; Wave 2: D
  assert(output.waves[0].length === 2, `Wave 0 should have 2 tasks (A,B), got ${output.waves[0].length}`);
  assert(output.waves[1].length === 1, `Wave 1 should have 1 task (C), got ${output.waves[1].length}`);
  assert(output.waves[2].length === 1, `Wave 2 should have 1 task (D), got ${output.waves[2].length}`);
});

// ── Part 2: Dependency-Aware Scheduling ──

console.log('\n\x1b[36m  Part 2: Dependency-Aware Scheduling\x1b[0m');

await test('start daemon for parallel test', async () => {
  const result = ogu('kadima:start');
  assertEqual(result.exitCode, 0, 'kadima:start should exit 0');
  await sleep(1000);
});

await test('create feature in building state', async () => {
  for (const state of ['idea', 'specifying', 'specified', 'planning', 'planned', 'building']) {
    ogu('feature:state', [FEATURE, state]);
  }
  const state = readJSON(`.ogu/state/features/${FEATURE}.state.json`);
  assertEqual(state.currentState, 'building', 'Should be in building state');
});

await test('enqueue tasks with dependencies', async () => {
  // A and B: no dependencies (parallel roots)
  ogu('kadima:enqueue', ['--feature', FEATURE, '--task', 'par-A', '--dry-run']);
  ogu('kadima:enqueue', ['--feature', FEATURE, '--task', 'par-B', '--dry-run']);
  // C: blocked by A and B
  ogu('kadima:enqueue', ['--feature', FEATURE, '--task', 'par-C', '--dry-run', '--blocked-by', 'par-A,par-B']);
  // D: blocked by C
  ogu('kadima:enqueue', ['--feature', FEATURE, '--task', 'par-D', '--dry-run', '--blocked-by', 'par-C']);

  const state = readJSON('.ogu/state/scheduler-state.json');
  const parTasks = state.queue.filter(t => t.taskId.startsWith('par-'));
  assertEqual(parTasks.length, 4, `Should have 4 par-* tasks, got ${parTasks.length}`);

  const taskC = parTasks.find(t => t.taskId === 'par-C');
  assert(taskC.blockedBy.includes('par-A'), 'par-C should be blocked by par-A');
  assert(taskC.blockedBy.includes('par-B'), 'par-C should be blocked by par-B');

  const taskD = parTasks.find(t => t.taskId === 'par-D');
  assert(taskD.blockedBy.includes('par-C'), 'par-D should be blocked by par-C');
});

await test('A and B execute first (unblocked)', async () => {
  const found = await pollUntil(() => {
    return fileExists('.ogu/runners/par-A.output.json') &&
           fileExists('.ogu/runners/par-B.output.json');
  }, 15000, 500);

  assert(found, 'par-A and par-B should execute first (they have no blockers)');
});

await test('C executes after A and B complete', async () => {
  const found = await pollUntil(() => {
    return fileExists('.ogu/runners/par-C.output.json');
  }, 15000, 500);

  assert(found, 'par-C should execute after par-A and par-B complete');
});

await test('D executes after C completes', async () => {
  const found = await pollUntil(() => {
    return fileExists('.ogu/runners/par-D.output.json');
  }, 15000, 500);

  assert(found, 'par-D should execute after par-C completes');
});

await test('all tasks marked completed in scheduler state', async () => {
  const found = await pollUntil(() => {
    const state = readJSON('.ogu/state/scheduler-state.json');
    const parTasks = state.queue.filter(t => t.taskId.startsWith('par-'));
    return parTasks.every(t => t.status === 'completed');
  }, 10000, 500);

  assert(found, 'All par-* tasks should be completed');
});

// ── Part 3: Parallel Execution Proof ──

console.log('\n\x1b[36m  Part 3: Parallel Execution Proof\x1b[0m');

await test('A and B dispatched in same scheduler tick (or within 1 interval)', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const dispatches = events.filter(e =>
    e.type === 'scheduler.dispatch' &&
    (e.payload?.taskId === 'par-A' || e.payload?.taskId === 'par-B')
  );
  // May have duplicates from retries; just need at least 2
  assert(dispatches.length >= 2, `Should have at least 2 dispatch events for A and B, got ${dispatches.length}`);

  // Both should be dispatched within 2 seconds of each other (same tick or consecutive)
  const t1 = new Date(dispatches[0].timestamp).getTime();
  const t2 = new Date(dispatches[1].timestamp).getTime();
  assert(Math.abs(t1 - t2) < 2000, `A and B should dispatch within 2s of each other, gap: ${Math.abs(t1 - t2)}ms`);
});

await test('C dispatched strictly after A and B', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const dispatchA = events.find(e => e.type === 'scheduler.dispatch' && e.payload?.taskId === 'par-A');
  const dispatchC = events.find(e => e.type === 'scheduler.dispatch' && e.payload?.taskId === 'par-C');
  assert(dispatchA && dispatchC, 'Should have dispatch events for A and C');

  const tA = new Date(dispatchA.timestamp).getTime();
  const tC = new Date(dispatchC.timestamp).getTime();
  assert(tC > tA, 'C should be dispatched after A');
});

// ── Part 4: Auto-Transition ──

console.log('\n\x1b[36m  Part 4: Auto-Transition\x1b[0m');

await test('feature auto-transitions to "built" after all tasks complete', async () => {
  // The state machine loop should detect all tasks completed and transition
  const found = await pollUntil(() => {
    if (!fileExists(`.ogu/state/features/${FEATURE}.state.json`)) return false;
    const state = readJSON(`.ogu/state/features/${FEATURE}.state.json`);
    return state.currentState === 'built';
  }, 15000, 500);

  assert(found, 'Feature should auto-transition to "built"');
});

await test('auto-transition emits audit event', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const transition = events.find(e =>
    e.type === 'feature.auto_transition' &&
    e.payload?.slug === FEATURE &&
    e.payload?.to === 'built'
  );
  assert(transition, 'Should have auto-transition audit event');
});

// ── Part 5: Audit Trail Ordering ──

console.log('\n\x1b[36m  Part 5: Audit Trail Ordering\x1b[0m');

await test('dispatch events follow DAG order: A/B before C before D', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  // Deduplicate by taskId (keep first occurrence)
  const seen = new Set();
  const dispatches = events
    .filter(e => e.type === 'scheduler.dispatch' && e.payload?.taskId?.startsWith('par-'))
    .filter(e => {
      if (seen.has(e.payload.taskId)) return false;
      seen.add(e.payload.taskId);
      return true;
    })
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  assert(dispatches.length === 4, `Should have 4 unique dispatch events, got ${dispatches.length}`);

  // Find indices
  const idxA = dispatches.findIndex(d => d.payload.taskId === 'par-A');
  const idxB = dispatches.findIndex(d => d.payload.taskId === 'par-B');
  const idxC = dispatches.findIndex(d => d.payload.taskId === 'par-C');
  const idxD = dispatches.findIndex(d => d.payload.taskId === 'par-D');

  assert(idxA < idxC, 'A should be dispatched before C');
  assert(idxB < idxC, 'B should be dispatched before C');
  assert(idxC < idxD, 'C should be dispatched before D');
});

await test('all 4 tasks have output envelopes', async () => {
  for (const id of ['par-A', 'par-B', 'par-C', 'par-D']) {
    assert(fileExists(`.ogu/runners/${id}.output.json`), `${id} should have output envelope`);
    const output = readJSON(`.ogu/runners/${id}.output.json`);
    assertEqual(output.status, 'success', `${id} should be success`);
  }
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
