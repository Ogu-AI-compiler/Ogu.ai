/**
 * slice-429.test.mjs — Project Resume / Checkpoint
 * Tests: canResume, getResumePoint, getUnfinishedTasks, resumeProject
 */

import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  canResume,
  getResumePoint,
  getUnfinishedTasks,
  resumeProject,
} from '../../tools/ogu/commands/lib/project-resume.mjs';

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

function writeState(root, projectId, state) {
  const dir = join(root, '.ogu', 'projects', projectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'execution-state.json'), JSON.stringify(state), 'utf-8');
}

function writePlan(root, projectId, plan) {
  const dir = join(root, '.ogu', 'projects', projectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'plan.enriched.json'), JSON.stringify(plan), 'utf-8');
}

let tmpDir;

// ── canResume ─────────────────────────────────────────────────────────────────

console.log('\ncanResume');

test('returns false when no state exists', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-resume-'));
  assert(canResume(tmpDir, 'nonexistent-proj') === false);
});

test('returns false when status=completed', () => {
  writeState(tmpDir, 'proj-done', {
    status: 'completed',
    tasks: { T1: { status: 'completed' }, T2: { status: 'completed' } },
  });
  assert(canResume(tmpDir, 'proj-done') === false);
});

test('returns true when status=partial with pending tasks', () => {
  writeState(tmpDir, 'proj-partial', {
    status: 'partial',
    tasks: { T1: { status: 'completed' }, T2: { status: 'pending' } },
  });
  assert(canResume(tmpDir, 'proj-partial') === true);
});

test('returns true when status=failed', () => {
  writeState(tmpDir, 'proj-failed', {
    status: 'failed',
    tasks: { T1: { status: 'failed' }, T2: { status: 'pending' } },
  });
  assert(canResume(tmpDir, 'proj-failed') === true);
});

test('returns true when interrupted (running tasks exist)', () => {
  writeState(tmpDir, 'proj-interrupted', {
    status: 'running',
    tasks: { T1: { status: 'completed' }, T2: { status: 'running' } },
  });
  assert(canResume(tmpDir, 'proj-interrupted') === true);
});

// ── getResumePoint ────────────────────────────────────────────────────────────

console.log('\ngetResumePoint');

test('returns null for nonexistent project', () => {
  assert(getResumePoint(tmpDir, 'never-existed') === null);
});

test('returns correct counts for partial project', () => {
  const point = getResumePoint(tmpDir, 'proj-partial');
  assert(point !== null);
  assertEqual(point.completedCount, 1);
  assertEqual(point.pendingCount, 1);
  assertEqual(point.failedCount, 0);
});

test('classifies running tasks as pending', () => {
  const point = getResumePoint(tmpDir, 'proj-interrupted');
  assert(point !== null);
  // T2 was "running" → should appear in pendingTasks
  assert(point.pendingTasks.includes('T2'), 'interrupted task T2 should appear as pending');
});

test('includes all task id lists', () => {
  const point = getResumePoint(tmpDir, 'proj-partial');
  assert(Array.isArray(point.completedTasks), 'completedTasks should be array');
  assert(Array.isArray(point.failedTasks), 'failedTasks should be array');
  assert(Array.isArray(point.pendingTasks), 'pendingTasks should be array');
  assert(Array.isArray(point.skippedTasks), 'skippedTasks should be array');
});

test('returns projectId in resume point', () => {
  const point = getResumePoint(tmpDir, 'proj-partial');
  assertEqual(point.projectId, 'proj-partial');
});

test('resumeFrom is valid ISO timestamp', () => {
  const point = getResumePoint(tmpDir, 'proj-partial');
  assert(!isNaN(new Date(point.resumeFrom).getTime()), 'resumeFrom should be valid ISO');
});

// ── getUnfinishedTasks ────────────────────────────────────────────────────────

console.log('\ngetUnfinishedTasks');

const allTasks = [
  { id: 'T1', title: 'T1', owner_role: 'backend_engineer', gates: ['output-exists'], dependsOn: [] },
  { id: 'T2', title: 'T2', owner_role: 'qa', gates: ['tests-pass'], dependsOn: ['T1'] },
  { id: 'T3', title: 'T3', owner_role: 'backend_engineer', gates: ['output-exists'], dependsOn: ['T1'] },
];

test('returns all tasks when no state', () => {
  const result = getUnfinishedTasks(null, allTasks);
  assertEqual(result.length, 3);
});

test('excludes completed tasks', () => {
  const state = { tasks: { T1: { status: 'completed' } } };
  const result = getUnfinishedTasks(state, allTasks);
  assert(!result.some(t => t.id === 'T1'), 'T1 should be excluded');
  assert(result.some(t => t.id === 'T2'), 'T2 should be included');
  assert(result.some(t => t.id === 'T3'), 'T3 should be included');
});

test('includes failed tasks by default', () => {
  const state = { tasks: { T1: { status: 'completed' }, T2: { status: 'failed' } } };
  const result = getUnfinishedTasks(state, allTasks);
  assert(result.some(t => t.id === 'T2'), 'failed T2 should be included by default');
});

test('excludes failed tasks when skipFailed=true', () => {
  const state = { tasks: { T1: { status: 'completed' }, T2: { status: 'failed' } } };
  const result = getUnfinishedTasks(state, allTasks, { skipFailed: true });
  assert(!result.some(t => t.id === 'T2'), 'failed T2 should be excluded when skipFailed=true');
});

test('includes skipped tasks (for re-evaluation)', () => {
  const state = { tasks: { T1: { status: 'completed' }, T2: { status: 'skipped' } } };
  const result = getUnfinishedTasks(state, allTasks);
  assert(result.some(t => t.id === 'T2'), 'skipped T2 should be included for re-evaluation');
});

test('returns empty when all completed', () => {
  const state = { tasks: { T1: { status: 'completed' }, T2: { status: 'completed' }, T3: { status: 'completed' } } };
  const result = getUnfinishedTasks(state, allTasks);
  assertEqual(result.length, 0);
});

test('handles task not in state as pending', () => {
  const state = { tasks: {} };
  const result = getUnfinishedTasks(state, allTasks);
  assertEqual(result.length, 3, 'all tasks should be included when not in state');
});

// ── resumeProject ─────────────────────────────────────────────────────────────

console.log('\nresumeProject');

await testAsync('returns error when no state exists', async () => {
  const result = await resumeProject(tmpDir, 'proj-no-state');
  assert(result.success === false);
  assert(typeof result.error === 'string');
});

await testAsync('returns alreadyComplete when status=completed', async () => {
  writeState(tmpDir, 'proj-done', { status: 'completed', tasks: {}, summary: { total: 1, completed: 1, failed: 0, skipped: 0, success: true } });
  const result = await resumeProject(tmpDir, 'proj-done');
  assert(result.alreadyComplete === true);
});

await testAsync('returns error when no enriched plan', async () => {
  writeState(tmpDir, 'proj-noplan', { status: 'partial', tasks: { T1: { status: 'pending' } } });
  const result = await resumeProject(tmpDir, 'proj-noplan');
  assert(result.success === false);
  assert(typeof result.error === 'string' && result.error.includes('plan'));
});

await testAsync('resumes partial project skipping completed tasks', async () => {
  const plan = {
    tasks: [
      { id: 'R1', title: 'R1', owner_role: 'backend_engineer', gates: ['output-exists'], dependsOn: [] },
      { id: 'R2', title: 'R2', owner_role: 'qa', gates: ['tests-pass'], dependsOn: ['R1'] },
    ],
  };
  writePlan(tmpDir, 'proj-resume-real', plan);
  writeState(tmpDir, 'proj-resume-real', {
    status: 'partial',
    startedAt: new Date().toISOString(),
    tasks: {
      R1: { status: 'completed', completedAt: new Date().toISOString() },
      R2: { status: 'pending' },
    },
  });

  const started = [];
  await resumeProject(tmpDir, 'proj-resume-real', {
    simulate: true,
    onEvent: (e) => { if (e.type === 'task.started') started.push(e.taskId); },
  });

  assert(!started.includes('R1'), 'R1 already completed — should not re-run');
  assert(started.includes('R2'), 'R2 pending — should run');
});

await testAsync('resumeProject returns valid ExecutionResult shape', async () => {
  const plan = { tasks: [{ id: 'P1', title: 'P1', owner_role: 'backend_engineer', gates: ['output-exists'], dependsOn: [] }] };
  writePlan(tmpDir, 'proj-shape', plan);
  writeState(tmpDir, 'proj-shape', {
    status: 'partial',
    tasks: { P1: { status: 'pending' } },
  });
  const result = await resumeProject(tmpDir, 'proj-shape', { simulate: true });
  assert('success' in result, 'should have success');
  assert('summary' in result, 'should have summary');
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
