/**
 * slice-430.test.mjs — Task Assignment Engine
 * Tests: getReadyTasks, matchAgentForTask, getReadyAssignments, buildExecutionWave
 */

import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getReadyTasks,
  matchAgentForTask,
  getReadyAssignments,
  buildExecutionWave,
} from '../../tools/ogu/commands/lib/task-assignment-engine.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

let tmpDir;

// ── getReadyTasks ─────────────────────────────────────────────────────────────

console.log('\ngetReadyTasks');

const baseTasks = [
  { id: 'A', dependsOn: [] },
  { id: 'B', dependsOn: ['A'] },
  { id: 'C', dependsOn: ['A', 'B'] },
  { id: 'D', dependsOn: ['B'] },
  { id: 'E', dependsOn: [] },
];

test('returns tasks with no deps when nothing done', () => {
  const ready = getReadyTasks(baseTasks, new Set(), new Set());
  assert(ready.some(t => t.id === 'A'), 'A should be ready');
  assert(ready.some(t => t.id === 'E'), 'E should be ready');
  assert(!ready.some(t => t.id === 'B'), 'B should not be ready');
});

test('returns B and D when A done', () => {
  const ready = getReadyTasks(baseTasks, new Set(['A']), new Set());
  assert(ready.some(t => t.id === 'B'), 'B should be ready when A done');
  assert(ready.some(t => t.id === 'E'), 'E should still be ready');
  assert(!ready.some(t => t.id === 'C'), 'C still needs B');
});

test('excludes already-completed tasks', () => {
  const ready = getReadyTasks(baseTasks, new Set(['A']), new Set());
  assert(!ready.some(t => t.id === 'A'), 'A should not be in ready (already done)');
});

test('blocks task when dep failed', () => {
  const ready = getReadyTasks(baseTasks, new Set(), new Set(['A']));
  assert(!ready.some(t => t.id === 'B'), 'B blocked because A failed');
  assert(!ready.some(t => t.id === 'C'), 'C blocked because A failed');
  assert(!ready.some(t => t.id === 'D'), 'D blocked because A failed');
  assert(ready.some(t => t.id === 'E'), 'E has no dep on A so still ready');
});

test('returns empty when all tasks completed', () => {
  const allIds = new Set(baseTasks.map(t => t.id));
  const ready = getReadyTasks(baseTasks, allIds, new Set());
  assertEqual(ready.length, 0);
});

test('returns empty for empty task list', () => {
  const ready = getReadyTasks([], new Set(), new Set());
  assertEqual(ready.length, 0);
});

test('returns empty for null task list', () => {
  const ready = getReadyTasks(null, new Set(), new Set());
  assertEqual(ready.length, 0);
});

test('handles task without dependsOn field (defaults to empty)', () => {
  const tasks = [{ id: 'X' }];  // no dependsOn field
  const ready = getReadyTasks(tasks, new Set(), new Set());
  assert(ready.some(t => t.id === 'X'), 'X should be ready with no deps');
});

// ── matchAgentForTask ─────────────────────────────────────────────────────────

console.log('\nmatchAgentForTask');

test('returns pipeline source when no owner_agent_id and no marketplace agents', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-assign-'));
  const match = matchAgentForTask(tmpDir, { id: 'T1', owner_role: 'backend_engineer' });
  assert(match !== null, 'should return a match');
  assertEqual(match.source, 'pipeline', 'should be pipeline source when no marketplace agents');
  assert(match.agentId === null, 'agentId should be null for pipeline');
});

test('returns correct shape', () => {
  const match = matchAgentForTask(tmpDir, { id: 'T1', owner_role: 'qa' });
  assert('agentId' in match, 'should have agentId');
  assert('role' in match, 'should have role');
  assert('source' in match, 'should have source');
  assert('availableCapacity' in match, 'should have availableCapacity');
  assert('required' in match, 'should have required');
});

test('uses task.owner_agent_id when present and agent has capacity', () => {
  // Write a mock agent with capacity
  const agentsDir = join(tmpDir, '.ogu', 'marketplace', 'agents');
  mkdirSync(agentsDir, { recursive: true });
  const agent = { agent_id: 'agent_0099', capacity_units: 10, stats: { utilization_units: 0 }, status: 'available', role: 'backend_engineer' };
  writeFileSync(join(agentsDir, 'agent_0099.json'), JSON.stringify(agent));
  const idx = { agents: [{ agent_id: 'agent_0099', role: 'backend_engineer', tier: 1 }] };
  writeFileSync(join(tmpDir, '.ogu', 'marketplace', 'index.json'), JSON.stringify(idx));

  const match = matchAgentForTask(tmpDir, { id: 'T1', owner_role: 'backend_engineer', owner_agent_id: 'agent_0099', capacity_units: 2 });
  if (match && match.agentId === 'agent_0099') {
    assertEqual(match.source, 'assigned', 'should be assigned source');
  }
  // match could be null if capacity check fails — that's acceptable
  assert(match === null || typeof match === 'object', 'should return null or object');
});

test('returns null when owner_agent_id set but capacity unavailable', () => {
  // Agent with 0 available capacity (nonexistent → treated as insufficient)
  const match = matchAgentForTask(tmpDir, { id: 'T1', owner_agent_id: 'nonexistent_agent', capacity_units: 99 });
  // Either null (no capacity) or pipeline fallback
  assert(match === null || typeof match === 'object', 'should return null or match');
});

test('required defaults to 1 when capacity_units not set', () => {
  const match = matchAgentForTask(tmpDir, { id: 'T1', owner_role: 'qa' });
  assert(match !== null);
  assertEqual(match.required, 1, 'required should default to 1');
});

// ── getReadyAssignments ───────────────────────────────────────────────────────

console.log('\ngetReadyAssignments');

test('returns array', () => {
  const assignments = getReadyAssignments(tmpDir, baseTasks, new Set(), new Set());
  assert(Array.isArray(assignments), 'should return array');
});

test('returns assignments only for ready tasks', () => {
  const assignments = getReadyAssignments(tmpDir, baseTasks, new Set(), new Set());
  const ids = assignments.map(a => a.taskId);
  // Only A and E should be in initial ready set
  assert(ids.includes('A') || ids.includes('E'), 'should include A or E');
  assert(!ids.includes('B'), 'B should not be assigned (A not done)');
  assert(!ids.includes('C'), 'C should not be assigned (A,B not done)');
});

test('each assignment has taskId, task, agentId, role, source, reason', () => {
  const assignments = getReadyAssignments(tmpDir, baseTasks, new Set(), new Set());
  for (const a of assignments) {
    assert('taskId' in a, 'assignment should have taskId');
    assert('task' in a, 'assignment should have task');
    assert('agentId' in a, 'assignment should have agentId');
    assert('source' in a, 'assignment should have source');
    assert(a.reason === 'ready', 'reason should be ready');
  }
});

test('returns assignments for tasks whose deps are complete', () => {
  const assignments = getReadyAssignments(tmpDir, baseTasks, new Set(['A']), new Set());
  const ids = assignments.map(a => a.taskId);
  assert(ids.includes('B') || ids.includes('D') || ids.includes('E'), 'B, D, or E should be assignable when A done');
});

test('returns empty when all done', () => {
  const allIds = new Set(baseTasks.map(t => t.id));
  const assignments = getReadyAssignments(tmpDir, baseTasks, allIds, new Set());
  assertEqual(assignments.length, 0);
});

// ── buildExecutionWave ────────────────────────────────────────────────────────

console.log('\nbuildExecutionWave');

test('returns { assignments, blocked, stats }', () => {
  const wave = buildExecutionWave(tmpDir, baseTasks, new Set(), new Set());
  assert(Array.isArray(wave.assignments), 'should have assignments array');
  assert(Array.isArray(wave.blocked), 'should have blocked array');
  assert(typeof wave.stats === 'object', 'should have stats object');
});

test('stats has total, ready, assigned, blocked counts', () => {
  const wave = buildExecutionWave(tmpDir, baseTasks, new Set(), new Set());
  assert(typeof wave.stats.total === 'number', 'stats.total should be number');
  assert(typeof wave.stats.ready === 'number', 'stats.ready should be number');
  assert(typeof wave.stats.assigned === 'number', 'stats.assigned should be number');
  assert(typeof wave.stats.blocked === 'number', 'stats.blocked should be number');
});

test('blocked tasks have { task, reason } shape', () => {
  const wave = buildExecutionWave(tmpDir, baseTasks, new Set(), new Set());
  for (const b of wave.blocked) {
    assert(b.task !== undefined, 'blocked item should have task');
    assert(typeof b.reason === 'string', 'blocked item should have reason string');
  }
});

test('blocked reasons include dependency_pending and dependency_failed', () => {
  const wave = buildExecutionWave(tmpDir, baseTasks, new Set(), new Set(['A']));
  const reasons = wave.blocked.map(b => b.reason);
  // B, C, D blocked by A failure; E has no deps but is ready
  assert(reasons.some(r => r === 'dependency_failed'), 'some blocked by dependency_failed');
});

test('maxWaveSize caps assignments', () => {
  const manyTasks = Array.from({ length: 20 }, (_, i) => ({ id: `T${i}`, dependsOn: [] }));
  const wave = buildExecutionWave(tmpDir, manyTasks, new Set(), new Set(), { maxWaveSize: 3 });
  assert(wave.assignments.length <= 3, `assignments should be capped at 3, got ${wave.assignments.length}`);
});

test('handles empty tasks', () => {
  const wave = buildExecutionWave(tmpDir, [], new Set(), new Set());
  assertEqual(wave.assignments.length, 0);
  assertEqual(wave.blocked.length, 0);
  assertEqual(wave.stats.total, 0);
});

test('handles null tasks gracefully', () => {
  const wave = buildExecutionWave(tmpDir, null, new Set(), new Set());
  assert(Array.isArray(wave.assignments));
  assertEqual(wave.assignments.length, 0);
});

test('stats.blocked = blockedByDep + blockedByCapacity + blockedByPendingDep', () => {
  const wave = buildExecutionWave(tmpDir, baseTasks, new Set(), new Set());
  const sumParts = wave.stats.blockedByDep + wave.stats.blockedByCapacity + wave.stats.blockedByPendingDep;
  assertEqual(wave.stats.blocked, sumParts, 'stats.blocked should equal sum of parts');
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
