/**
 * slice-420.test.mjs — Project Executor tests
 * Tests: topologicalSort, getExecutionState, readProjectData, runProject (simulate)
 * All tests run without LLM (simulate=true or pure function tests).
 */

import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  topologicalSort,
  getExecutionState,
  readProjectData,
  runProject,
} from '../../tools/ogu/commands/lib/project-executor.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const r = fn();
    if (r instanceof Promise) {
      r.then(() => { console.log(`  ✓ ${name}`); passed++; })
       .catch(e => { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; });
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── topologicalSort ───────────────────────────────────────────────────────────

console.log('\ntopologicalSort');

test('empty array returns empty', () => {
  const result = topologicalSort([]);
  assert(Array.isArray(result) && result.length === 0);
});

test('single task returns it', () => {
  const result = topologicalSort([{ id: 'T1', dependsOn: [] }]);
  assertEqual(result.length, 1);
  assertEqual(result[0].id, 'T1');
});

test('independent tasks preserve relative order', () => {
  const tasks = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  const result = topologicalSort(tasks);
  assertEqual(result.length, 3);
  assert(new Set(result.map(t => t.id)).size === 3);
});

test('respects dependsOn — dep comes before dependant', () => {
  const tasks = [
    { id: 'B', dependsOn: ['A'] },
    { id: 'A', dependsOn: [] },
  ];
  const result = topologicalSort(tasks);
  const aIdx = result.findIndex(t => t.id === 'A');
  const bIdx = result.findIndex(t => t.id === 'B');
  assert(aIdx < bIdx, `A(${aIdx}) should be before B(${bIdx})`);
});

test('chain: A→B→C sorts correctly', () => {
  const tasks = [
    { id: 'C', dependsOn: ['B'] },
    { id: 'B', dependsOn: ['A'] },
    { id: 'A', dependsOn: [] },
  ];
  const result = topologicalSort(tasks);
  const ids = result.map(t => t.id);
  assert(ids.indexOf('A') < ids.indexOf('B'), 'A before B');
  assert(ids.indexOf('B') < ids.indexOf('C'), 'B before C');
});

test('diamond dependency: A → B,C → D', () => {
  const tasks = [
    { id: 'D', dependsOn: ['B', 'C'] },
    { id: 'C', dependsOn: ['A'] },
    { id: 'B', dependsOn: ['A'] },
    { id: 'A', dependsOn: [] },
  ];
  const result = topologicalSort(tasks);
  const ids = result.map(t => t.id);
  assert(ids.indexOf('A') < ids.indexOf('B'), 'A before B');
  assert(ids.indexOf('A') < ids.indexOf('C'), 'A before C');
  assert(ids.indexOf('B') < ids.indexOf('D'), 'B before D');
  assert(ids.indexOf('C') < ids.indexOf('D'), 'C before D');
});

test('ignores missing dependency ids', () => {
  const tasks = [
    { id: 'B', dependsOn: ['NONEXISTENT'] },
    { id: 'A', dependsOn: [] },
  ];
  const result = topologicalSort(tasks);
  assertEqual(result.length, 2, 'should return all 2 tasks');
});

test('cycle does not infinite loop — returns all tasks', () => {
  const tasks = [
    { id: 'A', dependsOn: ['B'] },
    { id: 'B', dependsOn: ['A'] },
  ];
  const result = topologicalSort(tasks);
  assertEqual(result.length, 2, 'should return both tasks despite cycle');
});

test('supports depends_on (snake_case) alias', () => {
  const tasks = [
    { id: 'B', depends_on: ['A'] },
    { id: 'A' },
  ];
  const result = topologicalSort(tasks);
  const ids = result.map(t => t.id);
  assert(ids.indexOf('A') < ids.indexOf('B'), 'A before B');
});

test('returns exact same task objects (not copies)', () => {
  const marker = {};
  const tasks = [{ id: 'X', _marker: marker }];
  const result = topologicalSort(tasks);
  assert(result[0]._marker === marker, 'should be same reference');
});

// ── getExecutionState ─────────────────────────────────────────────────────────

console.log('\ngetExecutionState');

let tmpDir;

test('returns null for missing project', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-exec-'));
  const state = getExecutionState(tmpDir, 'proj-nonexistent');
  assert(state === null);
});

test('returns null for invalid json', () => {
  const dir = join(tmpDir, '.ogu', 'projects', 'bad-proj');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'execution-state.json'), 'not json', 'utf-8');
  const state = getExecutionState(tmpDir, 'bad-proj');
  assert(state === null);
});

// ── readProjectData ───────────────────────────────────────────────────────────

console.log('\nreadProjectData');

test('returns null for missing project dir', () => {
  const data = readProjectData(tmpDir, 'no-such-project');
  assert(data === null);
});

test('returns projectId in result', () => {
  const dir = join(tmpDir, '.ogu', 'projects', 'proj-read');
  mkdirSync(dir, { recursive: true });
  const data = readProjectData(tmpDir, 'proj-read');
  assert(data !== null);
  assertEqual(data.projectId, 'proj-read');
});

test('all fields null when no files exist', () => {
  const dir = join(tmpDir, '.ogu', 'projects', 'proj-empty');
  mkdirSync(dir, { recursive: true });
  const data = readProjectData(tmpDir, 'proj-empty');
  assert(data.ctoPlan === null);
  assert(data.team === null);
  assert(data.prd === null);
  assert(data.enrichedPlan === null);
  assert(data.executionState === null);
});

test('reads ctoPlan from cto-plan.json', () => {
  const dir = join(tmpDir, '.ogu', 'projects', 'proj-cto');
  mkdirSync(dir, { recursive: true });
  const plan = { projectId: 'proj-cto', tier: 'medium' };
  writeFileSync(join(dir, 'cto-plan.json'), JSON.stringify(plan), 'utf-8');
  const data = readProjectData(tmpDir, 'proj-cto');
  assertEqual(data.ctoPlan.tier, 'medium');
});

test('reads team from team.json', () => {
  const dir = join(tmpDir, '.ogu', 'projects', 'proj-team');
  mkdirSync(dir, { recursive: true });
  const team = { members: [{ role_id: 'pm', status: 'active' }] };
  writeFileSync(join(dir, 'team.json'), JSON.stringify(team), 'utf-8');
  const data = readProjectData(tmpDir, 'proj-team');
  assertEqual(data.team.members.length, 1);
});

test('reads prd from prd.json', () => {
  const dir = join(tmpDir, '.ogu', 'projects', 'proj-prd');
  mkdirSync(dir, { recursive: true });
  const prd = { features: [{ id: 'feat-001', title: 'Auth' }] };
  writeFileSync(join(dir, 'prd.json'), JSON.stringify(prd), 'utf-8');
  const data = readProjectData(tmpDir, 'proj-prd');
  assertEqual(data.prd.features[0].title, 'Auth');
});

test('reads executionState from execution-state.json', () => {
  const dir = join(tmpDir, '.ogu', 'projects', 'proj-es');
  mkdirSync(dir, { recursive: true });
  const es = { status: 'completed', summary: { total: 3, completed: 3, failed: 0 } };
  writeFileSync(join(dir, 'execution-state.json'), JSON.stringify(es), 'utf-8');
  const data = readProjectData(tmpDir, 'proj-es');
  assertEqual(data.executionState.status, 'completed');
});

// ── runProject ────────────────────────────────────────────────────────────────

console.log('\nrunProject');

await testAsync('returns error when no plan exists', async () => {
  const dir = join(tmpDir, '.ogu', 'projects', 'proj-no-plan');
  mkdirSync(dir, { recursive: true });
  const result = await runProject(tmpDir, 'proj-no-plan', { simulate: true });
  assert(!result.success, 'should fail');
  assert(result.error.includes('plan.enriched.json'), 'error should mention plan');
});

await testAsync('runs tasks in simulate mode and saves state', async () => {
  const projId = 'proj-sim-run';
  const dir = join(tmpDir, '.ogu', 'projects', projId);
  mkdirSync(dir, { recursive: true });

  // Write a minimal enriched plan
  const plan = {
    tasks: [
      { id: 'T1', name: 'Setup', owner_role: 'backend_engineer', gates: ['output-exists'], input_artifacts: [], output_artifacts: [], definition_of_done: 'Setup complete' },
      { id: 'T2', name: 'Build', owner_role: 'backend_engineer', dependsOn: ['T1'], gates: ['output-exists'], input_artifacts: [], output_artifacts: [], definition_of_done: 'Build complete' },
    ],
    _enrichment: { total_tasks: 2 },
  };
  writeFileSync(join(dir, 'plan.enriched.json'), JSON.stringify(plan), 'utf-8');

  // Write minimal OrgSpec needed by executeAgentTaskCore
  const oguDir = join(tmpDir, '.ogu');
  mkdirSync(oguDir, { recursive: true });
  const orgSpec = {
    orgId: "test",
    roles: [{ roleId: "backend_engineer", enabled: true, name: "Backend", modelPreferences: { minimum: "fast" } }],
    providers: [{ id: "anthropic", enabled: true, models: [{ id: "claude-haiku", tier: "fast", costPer1kInput: 0.25 }] }],
    budget: { daily: 10 },
  };
  writeFileSync(join(oguDir, 'OrgSpec.json'), JSON.stringify(orgSpec), 'utf-8');

  const events = [];
  const result = await runProject(tmpDir, projId, {
    simulate: true,
    onEvent: (e) => events.push(e),
  });

  // State should be saved
  const state = getExecutionState(tmpDir, projId);
  assert(state !== null, 'execution state should be saved');
  assert(['completed', 'partial', 'failed'].includes(state.status), `state.status should be terminal: ${state.status}`);

  // Result has expected shape
  assert(typeof result.success === 'boolean', 'result.success should be boolean');
  assert(Array.isArray(result.tasks), 'result.tasks should be array');
  assert(result.summary !== undefined, 'result.summary should exist');
});

await testAsync('emits project.started and project.completed events', async () => {
  const projId = 'proj-events';
  const dir = join(tmpDir, '.ogu', 'projects', projId);
  mkdirSync(dir, { recursive: true });

  const plan = {
    tasks: [{ id: 'T1', name: 'Task', owner_role: 'backend_engineer', gates: ['output-exists'], input_artifacts: [], output_artifacts: [], definition_of_done: 'done' }],
  };
  writeFileSync(join(dir, 'plan.enriched.json'), JSON.stringify(plan), 'utf-8');

  const types = [];
  await runProject(tmpDir, projId, {
    simulate: true,
    onEvent: (e) => types.push(e.type),
  });

  assert(types.includes('project.started'), 'missing project.started');
  assert(types.includes('project.completed'), 'missing project.completed');
  assert(types.includes('task.started'), 'missing task.started');
});

await testAsync('execution state tracks tasks', async () => {
  const projId = 'proj-state-track';
  const dir = join(tmpDir, '.ogu', 'projects', projId);
  mkdirSync(dir, { recursive: true });

  const plan = {
    tasks: [
      { id: 'TA', name: 'TaskA', owner_role: 'backend_engineer', gates: ['output-exists'], input_artifacts: [], output_artifacts: [], definition_of_done: 'done' },
    ],
  };
  writeFileSync(join(dir, 'plan.enriched.json'), JSON.stringify(plan), 'utf-8');

  await runProject(tmpDir, projId, { simulate: true });

  const state = getExecutionState(tmpDir, projId);
  assert(state !== null);
  assert(state.tasks['TA'] !== undefined, 'TA should be in state.tasks');
  assert(['completed', 'failed'].includes(state.tasks['TA'].status), `TA.status: ${state.tasks['TA'].status}`);
});

await testAsync('summary has total/completed/failed fields', async () => {
  const projId = 'proj-summary';
  const dir = join(tmpDir, '.ogu', 'projects', projId);
  mkdirSync(dir, { recursive: true });

  const plan = {
    tasks: [{ id: 'T1', name: 'T', owner_role: 'backend_engineer', gates: ['output-exists'], input_artifacts: [], output_artifacts: [], definition_of_done: 'd' }],
  };
  writeFileSync(join(dir, 'plan.enriched.json'), JSON.stringify(plan), 'utf-8');

  const result = await runProject(tmpDir, projId, { simulate: true });

  assert(result.summary !== undefined);
  assert(typeof result.summary.total === 'number');
  assert(typeof result.summary.completed === 'number');
  assert(typeof result.summary.failed === 'number');
  assertEqual(result.summary.total, 1, 'total should be 1');
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

// ── Summary ───────────────────────────────────────────────────────────────────

await new Promise(r => setTimeout(r, 100));

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
