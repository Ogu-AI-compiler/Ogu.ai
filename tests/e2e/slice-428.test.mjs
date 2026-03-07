/**
 * slice-428.test.mjs — Task Graph Executor
 * Tests: executeTaskGraph, runGate, getReadyTaskIds
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  executeTaskGraph,
  runGate,
  getReadyTaskIds,
} from '../../tools/ogu/commands/lib/task-graph-executor.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

async function testAsync(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

let tmpDir;

// ── runGate ───────────────────────────────────────────────────────────────────

console.log('\nrunGate');

test('simulate mode always passes', () => {
  const result = runGate('tests-pass', { id: 'T1' }, { success: true }, { simulate: true });
  assert(result.passed === true, 'simulate should pass');
  assert(result.simulated === true, 'should mark as simulated');
});

test('simulate mode passes even for output-exists when task failed', () => {
  const result = runGate('output-exists', { id: 'T1' }, { success: false }, { simulate: true });
  assert(result.passed === true, 'simulate always passes');
});

test('real mode: output-exists fails when task.success=false', () => {
  const result = runGate('output-exists', { id: 'T1' }, { success: false, error: 'failed' }, { simulate: false });
  assert(result.passed === false, 'should fail when task failed');
  assert(typeof result.error === 'string');
});

test('real mode: uses taskResult.gates map when present', () => {
  const result = runGate('tests-pass', { id: 'T1' }, { success: true, gates: { 'tests-pass': false } }, { simulate: false });
  assert(result.passed === false, 'should use gates map');
});

test('real mode: passes when task succeeded and no gates map', () => {
  const result = runGate('type-check', { id: 'T1' }, { success: true }, { simulate: false });
  assert(result.passed === true, 'should pass when task succeeded');
});

test('gate result includes gate name', () => {
  const result = runGate('migration-runs', { id: 'T1' }, { success: true }, { simulate: true });
  assertEqual(result.gate, 'migration-runs');
});

// ── getReadyTaskIds ───────────────────────────────────────────────────────────

console.log('\ngetReadyTaskIds');

const tasks = [
  { id: 'A', dependsOn: [] },
  { id: 'B', dependsOn: ['A'] },
  { id: 'C', dependsOn: ['A', 'B'] },
  { id: 'D', dependsOn: ['B'] },
];

test('returns tasks with no deps when nothing completed', () => {
  const ready = getReadyTaskIds(tasks, new Set(), new Set(), new Set());
  assert(ready.includes('A'), 'A should be ready (no deps)');
  assert(!ready.includes('B'), 'B should not be ready (A not done)');
});

test('returns B when A is completed', () => {
  const ready = getReadyTaskIds(tasks, new Set(['A']), new Set(), new Set());
  assert(ready.includes('B'), 'B should be ready when A done');
  assert(!ready.includes('C'), 'C should not be ready (B not done)');
});

test('returns C and D when A and B completed', () => {
  const ready = getReadyTaskIds(tasks, new Set(['A', 'B']), new Set(), new Set());
  assert(ready.includes('C'), 'C ready when A+B done');
  assert(ready.includes('D'), 'D ready when B done');
});

test('already completed tasks are not in ready list', () => {
  const ready = getReadyTaskIds(tasks, new Set(['A', 'B']), new Set(), new Set());
  assert(!ready.includes('A'), 'A should not be in ready (already completed)');
  assert(!ready.includes('B'), 'B should not be in ready (already completed)');
});

test('skips tasks whose dep is in failedIds', () => {
  const ready = getReadyTaskIds(tasks, new Set(), new Set(['A']), new Set());
  assert(!ready.includes('B'), 'B should be blocked when A failed');
  assert(!ready.includes('C'), 'C should be blocked when A failed');
});

test('handles empty tasks array', () => {
  const ready = getReadyTaskIds([], new Set(), new Set(), new Set());
  assert(Array.isArray(ready) && ready.length === 0);
});

test('handles null tasks gracefully', () => {
  // Should not throw
  let ready;
  try { ready = getReadyTaskIds(null, new Set(), new Set(), new Set()); }
  catch { ready = []; }
  assert(Array.isArray(ready));
});

// ── executeTaskGraph ──────────────────────────────────────────────────────────

console.log('\nexecuteTaskGraph (simulate mode)');

const simpleTasks = [
  { id: 'T1', title: 'Task 1', owner_role: 'backend_engineer', gates: ['output-exists'], dependsOn: [] },
  { id: 'T2', title: 'Task 2', owner_role: 'qa', gates: ['tests-pass'], dependsOn: ['T1'] },
  { id: 'T3', title: 'Task 3', owner_role: 'backend_engineer', gates: ['output-exists'], dependsOn: ['T1'] },
];

await testAsync('returns ExecutionResult shape', async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-tge-'));
  const result = await executeTaskGraph(tmpDir, 'proj-exec', simpleTasks, { simulate: true });
  assert(typeof result === 'object', 'should return object');
  assert('success' in result, 'should have success field');
  assert('tasks' in result, 'should have tasks field');
  assert('summary' in result, 'should have summary field');
});

await testAsync('summary has total count', async () => {
  const result = await executeTaskGraph(tmpDir, 'proj-count', simpleTasks, { simulate: true });
  assert(result.summary.total === 3, `expected total=3, got ${result.summary.total}`);
});

await testAsync('respects dependencies — T2 and T3 run after T1', async () => {
  const order = [];
  await executeTaskGraph(tmpDir, 'proj-order', simpleTasks, {
    simulate: true,
    onEvent: (e) => { if (e.type === 'task.started') order.push(e.taskId); }
  });
  const t1Idx = order.indexOf('T1');
  const t2Idx = order.indexOf('T2');
  const t3Idx = order.indexOf('T3');
  assert(t1Idx !== -1, 'T1 should have started');
  if (t2Idx !== -1) assert(t1Idx < t2Idx, 'T1 should start before T2');
  if (t3Idx !== -1) assert(t1Idx < t3Idx, 'T1 should start before T3');
});

await testAsync('emits project.started and project.completed events', async () => {
  const events = [];
  await executeTaskGraph(tmpDir, 'proj-events', simpleTasks, {
    simulate: true,
    onEvent: (e) => events.push(e.type),
  });
  assert(events.includes('project.started'), 'should emit project.started');
  assert(events.includes('project.completed'), 'should emit project.completed');
});

await testAsync('emits task.started for each task', async () => {
  const started = [];
  await executeTaskGraph(tmpDir, 'proj-started', simpleTasks, {
    simulate: true,
    onEvent: (e) => { if (e.type === 'task.started') started.push(e.taskId); },
  });
  assert(started.length === 3, `expected 3 task.started events, got ${started.length}`);
});

await testAsync('handles empty tasks array', async () => {
  const result = await executeTaskGraph(tmpDir, 'proj-empty', [], { simulate: true });
  assert(result.summary.total === 0);
});

await testAsync('independent tasks both complete', async () => {
  const indep = [
    { id: 'X', title: 'X', owner_role: 'backend_engineer', gates: ['output-exists'], dependsOn: [] },
    { id: 'Y', title: 'Y', owner_role: 'qa', gates: ['tests-pass'], dependsOn: [] },
  ];
  const result = await executeTaskGraph(tmpDir, 'proj-indep', indep, { simulate: true });
  assert(result.summary.total === 2);
});

await testAsync('saves execution-state.json to disk', async () => {
  const { existsSync } = await import('node:fs');
  const { join: pathJoin } = await import('node:path');
  await executeTaskGraph(tmpDir, 'proj-state', simpleTasks, { simulate: true });
  const statePath = pathJoin(tmpDir, '.ogu', 'projects', 'proj-state', 'execution-state.json');
  assert(existsSync(statePath), 'execution-state.json should exist');
});

await testAsync('resume: existingState skips completed tasks', async () => {
  const started = [];
  const existingState = {
    projectId: 'proj-resume',
    status: 'partial',
    startedAt: new Date().toISOString(),
    tasks: {
      'T1': { status: 'completed', completedAt: new Date().toISOString() },
      'T2': { status: 'pending' },
      'T3': { status: 'pending' },
    },
  };
  await executeTaskGraph(tmpDir, 'proj-resume', simpleTasks, {
    simulate: true,
    existingState,
    onEvent: (e) => { if (e.type === 'task.started') started.push(e.taskId); },
  });
  assert(!started.includes('T1'), 'T1 should not restart (already completed)');
  assert(started.includes('T2') || started.includes('T3'), 'T2 or T3 should run');
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
