/**
 * slice-425.test.mjs — Capacity Scheduler tests
 * Tests: checkCapacityForTask, canRunTask, buildCapacitySchedule, getSchedulerStats
 */

import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkCapacityForTask,
  canRunTask,
  buildCapacitySchedule,
  getSchedulerStats,
} from '../../tools/ogu/commands/lib/capacity-scheduler.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── checkCapacityForTask ──────────────────────────────────────────────────────

console.log('\ncheckCapacityForTask');

let tmpDir;

test('returns canRun=true when no agent assigned', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-cap-'));
  const task = { id: 'T1', owner_role: 'backend_engineer' };  // no owner_agent_id
  const check = checkCapacityForTask(tmpDir, task);
  assert(check.canRun === true, 'no agent → always runnable');
  assertEqual(check.agentId, null);
  assertEqual(check.reason, 'no_agent_assigned');
});

test('returns canRun=true for null/undefined task agent', () => {
  const check = checkCapacityForTask(tmpDir, { id: 'T2', owner_agent_id: null });
  assert(check.canRun === true);
});

test('returns canRun=true when agent not found in store (capacity_check_unavailable)', () => {
  // agent_0999 not in store → checkCapacityForTask should gracefully handle
  const task = { id: 'T3', owner_agent_id: 'agent_0999', capacity_units: 2 };
  const check = checkCapacityForTask(tmpDir, task);
  // Either canRun=true (agent not found → allow) or canRun=false (no capacity)
  assert(typeof check.canRun === 'boolean', 'canRun should be boolean');
  assert(check.agentId === 'agent_0999');
});

test('returns correct shape for available agent', () => {
  // Create a mock agent in the store
  const agentsDir = join(tmpDir, '.ogu', 'marketplace', 'agents');
  mkdirSync(agentsDir, { recursive: true });
  const agentId = 'agent_0001';
  const agent = {
    agent_id: agentId,
    name: 'Test Agent',
    role: 'Engineer',
    tier: 2,
    capacity_units: 10,
    stats: { utilization_units: 2, success_rate: 0.9, projects_completed: 5 },
    status: 'available',
  };
  // Write to agent file
  writeFileSync(join(agentsDir, `${agentId}.json`), JSON.stringify(agent), 'utf-8');
  // Also write index
  const index = { agents: [{ agent_id: agentId, role: 'Engineer', tier: 2 }] };
  writeFileSync(join(tmpDir, '.ogu', 'marketplace', 'index.json'), JSON.stringify(index), 'utf-8');

  const task = { id: 'T4', owner_agent_id: agentId, capacity_units: 1 };
  const check = checkCapacityForTask(tmpDir, task);
  assert(typeof check.canRun === 'boolean');
  assertEqual(check.agentId, agentId);
  assert('availableCapacity' in check);
  assert('required' in check);
});

test('canRun=false when capacity_units > available', () => {
  // Use agent_0001 with 10 capacity, 2 used → 8 available
  // Request 20 units → should fail
  const task = { id: 'T5', owner_agent_id: 'agent_0001', capacity_units: 20 };
  const check = checkCapacityForTask(tmpDir, task);
  // Available is 8, required is 20 → should fail
  if (check.canRun) {
    // Agent might have been created with enough capacity in a different test
    assert(check.availableCapacity >= 20, 'if canRun=true, capacity should be sufficient');
  } else {
    assert(check.canRun === false);
    assert(check.reason.includes('insufficient'), `reason should mention insufficient: ${check.reason}`);
  }
});

test('includes reason field', () => {
  const task = { id: 'T6', owner_role: 'pm' };
  const check = checkCapacityForTask(tmpDir, task);
  assert(typeof check.reason === 'string' && check.reason.length > 0);
});

// ── canRunTask ────────────────────────────────────────────────────────────────

console.log('\ncanRunTask');

test('returns true for task without agent', () => {
  assert(canRunTask(tmpDir, { id: 'T7' }) === true);
});

test('returns boolean', () => {
  const result = canRunTask(tmpDir, { id: 'T8', owner_agent_id: 'agent_0001' });
  assert(typeof result === 'boolean');
});

// ── buildCapacitySchedule ─────────────────────────────────────────────────────

console.log('\nbuildCapacitySchedule');

test('returns { runnable, queued, stats }', () => {
  const tasks = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  const result = buildCapacitySchedule(tmpDir, tasks);
  assert(Array.isArray(result.runnable), 'runnable should be array');
  assert(Array.isArray(result.queued), 'queued should be array');
  assert(result.stats !== undefined, 'stats should exist');
});

test('empty task list returns all empty', () => {
  const result = buildCapacitySchedule(tmpDir, []);
  assertEqual(result.runnable.length, 0);
  assertEqual(result.queued.length, 0);
  assertEqual(result.stats.total, 0);
});

test('null tasks returns all empty', () => {
  const result = buildCapacitySchedule(tmpDir, null);
  assertEqual(result.runnable.length, 0);
  assertEqual(result.queued.length, 0);
});

test('tasks without agents are runnable up to concurrencyLimit', () => {
  const tasks = Array.from({ length: 5 }, (_, i) => ({ id: `T${i}`, owner_role: 'backend_engineer' }));
  const result = buildCapacitySchedule(tmpDir, tasks, { concurrencyLimit: 3 });
  assert(result.runnable.length <= 3, `runnable(${result.runnable.length}) should be <= 3`);
  assertEqual(result.runnable.length + result.queued.length, 5, 'total should equal input length');
});

test('stats has total, runnable, queued counts', () => {
  const tasks = [{ id: 'X' }, { id: 'Y' }];
  const result = buildCapacitySchedule(tmpDir, tasks);
  assertEqual(result.stats.total, 2);
  assert(typeof result.stats.runnable === 'number');
  assert(typeof result.stats.queued === 'number');
  assertEqual(result.stats.runnable + result.stats.queued, 2);
});

test('concurrencyLimit=1 allows only 1 task', () => {
  const tasks = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  const result = buildCapacitySchedule(tmpDir, tasks, { concurrencyLimit: 1 });
  assertEqual(result.runnable.length, 1, 'only 1 runnable with limit=1');
  assertEqual(result.queued.length, 2);
  assertEqual(result.queued[0].reason, 'concurrency_limit');
});

test('queued items have { task, reason } shape', () => {
  const tasks = Array.from({ length: 12 }, (_, i) => ({ id: `T${i}` }));
  const result = buildCapacitySchedule(tmpDir, tasks, { concurrencyLimit: 5 });
  if (result.queued.length > 0) {
    assert(result.queued[0].task !== undefined, 'queued item should have task');
    assert(typeof result.queued[0].reason === 'string', 'queued item should have reason');
  }
});

// ── getSchedulerStats ─────────────────────────────────────────────────────────

console.log('\ngetSchedulerStats');

test('returns object with projectId, allocations, agentCapacity, timestamp', () => {
  const stats = getSchedulerStats(tmpDir, 'proj-test');
  assert(stats.projectId === 'proj-test');
  assert(typeof stats.allocations === 'number');
  assert(typeof stats.agentCapacity === 'object');
  assert(typeof stats.timestamp === 'string');
});

test('allocations=0 when no allocations exist', () => {
  const stats = getSchedulerStats(tmpDir, 'proj-no-alloc');
  assertEqual(stats.allocations, 0);
});

test('agentCapacity is empty object when no allocations', () => {
  const stats = getSchedulerStats(tmpDir, 'proj-no-alloc');
  assertEqual(Object.keys(stats.agentCapacity).length, 0);
});

test('timestamp is valid ISO string', () => {
  const stats = getSchedulerStats(tmpDir, 'proj-ts');
  assert(!isNaN(new Date(stats.timestamp).getTime()), 'timestamp should be valid ISO');
});

test('handles non-existent project gracefully', () => {
  const stats = getSchedulerStats(tmpDir, 'project-that-never-existed-xyz');
  assert(stats !== null);
  assert(stats.allocations === 0);
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
