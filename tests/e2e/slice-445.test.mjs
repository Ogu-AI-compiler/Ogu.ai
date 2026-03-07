/**
 * Slice 445 — Orchestration Invariant Test
 *
 * DAG: A → B → D
 *      A → C → D
 *
 * B fails on first attempt (gate failure), succeeds on retry.
 * C always succeeds.
 * D must wait for BOTH B and C to complete.
 *
 * Invariants tested across 200 iterations:
 *   1. D never runs before B completes
 *   2. D never runs before C completes
 *   3. A always runs first
 *   4. B failure does not cause C to be skipped
 *   5. Final result is always: A=completed, B=completed, C=completed, D=completed
 *   6. Event ordering is always consistent
 *
 * Uses getReadyTaskIds (pure function) + simulated execution loop.
 */
import { strict as assert } from 'node:assert';
import {
  getReadyTaskIds,
} from '../../tools/ogu/commands/lib/task-graph-executor.mjs';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 445: Orchestration Invariant Test ===\n');

// ── DAG definition ──────────────────────────────────────────────────────────

function makeTasks() {
  return [
    { id: 'A', dependsOn: [] },
    { id: 'B', dependsOn: ['A'] },
    { id: 'C', dependsOn: ['A'] },
    { id: 'D', dependsOn: ['B', 'C'] },
  ];
}

// ── Pure scheduling simulation ──────────────────────────────────────────────

/**
 * Simulate the scheduling loop using getReadyTaskIds.
 * `bFailsOnce` — if true, B's first execution fails, then succeeds on retry.
 * Returns execution log: array of { step, readyIds, executed, events }.
 */
function simulateExecution(opts = {}) {
  const { bFailsOnce = false, seed = 0 } = opts;
  const tasks = makeTasks();

  const completed = new Set();
  const taskFailed = new Set();
  const skipped = new Set();
  const log = [];
  let bAttempts = 0;
  let step = 0;

  while (step < 20) { // safety valve
    step++;

    const readyIds = getReadyTaskIds(tasks, completed, taskFailed, skipped);
    if (readyIds.length === 0) {
      // Check if pending tasks remain
      const pendingCount = tasks.filter(t =>
        !completed.has(t.id) && !taskFailed.has(t.id) && !skipped.has(t.id)
      ).length;
      if (pendingCount === 0) break;

      // Blocked tasks remain — skip them
      for (const t of tasks) {
        if (!completed.has(t.id) && !taskFailed.has(t.id) && !skipped.has(t.id)) {
          skipped.add(t.id);
        }
      }
      break;
    }

    const stepLog = { step, readyIds: [...readyIds], executed: [], events: [] };

    // Execute all ready tasks (parallel within wave)
    for (const taskId of readyIds) {
      if (taskId === 'B' && bFailsOnce && bAttempts === 0) {
        // B fails on first attempt — but this is a gate retry, not a permanent failure.
        // In the real executor, gate retries happen within the same task execution.
        // So we simulate: B executes, gate fails, retries, then succeeds.
        bAttempts++;
        stepLog.events.push({ type: 'task.gate_failed', taskId: 'B', iteration: 1 });
        stepLog.events.push({ type: 'task.completed', taskId: 'B' });
        completed.add(taskId);
      } else {
        stepLog.events.push({ type: 'task.completed', taskId });
        completed.add(taskId);
      }
      stepLog.executed.push(taskId);
    }

    log.push(stepLog);
  }

  return {
    log,
    completed: [...completed],
    failed: [...taskFailed],
    skipped: [...skipped],
  };
}

// ── Test: getReadyTaskIds basic invariants ───────────────────────────────────

test('getReadyTaskIds: initially only A is ready', () => {
  const tasks = makeTasks();
  const ready = getReadyTaskIds(tasks, new Set(), new Set(), new Set());
  assert.deepEqual(ready, ['A']);
});

test('getReadyTaskIds: after A completes, B and C are ready', () => {
  const tasks = makeTasks();
  const ready = getReadyTaskIds(tasks, new Set(['A']), new Set(), new Set());
  assert.ok(ready.includes('B'));
  assert.ok(ready.includes('C'));
  assert.ok(!ready.includes('D'));
  assert.ok(!ready.includes('A'));
});

test('getReadyTaskIds: D is ready only when both B and C are complete', () => {
  const tasks = makeTasks();

  // Only B complete (not C)
  const r1 = getReadyTaskIds(tasks, new Set(['A', 'B']), new Set(), new Set());
  assert.ok(!r1.includes('D'), 'D should not be ready when C is not complete');
  assert.ok(r1.includes('C'), 'C should be ready');

  // Only C complete (not B)
  const r2 = getReadyTaskIds(tasks, new Set(['A', 'C']), new Set(), new Set());
  assert.ok(!r2.includes('D'), 'D should not be ready when B is not complete');
  assert.ok(r2.includes('B'), 'B should be ready');

  // Both complete
  const r3 = getReadyTaskIds(tasks, new Set(['A', 'B', 'C']), new Set(), new Set());
  assert.ok(r3.includes('D'), 'D should be ready when both B and C are complete');
});

test('getReadyTaskIds: if B fails, D is blocked (not ready)', () => {
  const tasks = makeTasks();
  const ready = getReadyTaskIds(tasks, new Set(['A', 'C']), new Set(['B']), new Set());
  assert.ok(!ready.includes('D'), 'D should be blocked when B has failed');
});

test('getReadyTaskIds: B failure does NOT block C', () => {
  const tasks = makeTasks();
  // B failed, C not yet run
  const ready = getReadyTaskIds(tasks, new Set(['A']), new Set(['B']), new Set());
  assert.ok(ready.includes('C'), 'C should still be ready even if B failed');
  assert.ok(!ready.includes('D'), 'D should be blocked');
});

// ── Test: full simulation without failures ──────────────────────────────────

test('simulation: happy path completes all 4 tasks', () => {
  const result = simulateExecution({ bFailsOnce: false });
  assert.equal(result.completed.length, 4);
  assert.deepEqual(result.completed.sort(), ['A', 'B', 'C', 'D']);
  assert.equal(result.failed.length, 0);
  assert.equal(result.skipped.length, 0);
});

test('simulation: A executes in step 1', () => {
  const result = simulateExecution({ bFailsOnce: false });
  assert.ok(result.log[0].executed.includes('A'));
  assert.ok(!result.log[0].executed.includes('B'));
  assert.ok(!result.log[0].executed.includes('C'));
  assert.ok(!result.log[0].executed.includes('D'));
});

test('simulation: B and C execute in step 2', () => {
  const result = simulateExecution({ bFailsOnce: false });
  const step2 = result.log[1];
  assert.ok(step2.executed.includes('B'));
  assert.ok(step2.executed.includes('C'));
  assert.ok(!step2.executed.includes('D'));
});

test('simulation: D executes after B and C', () => {
  const result = simulateExecution({ bFailsOnce: false });
  // D should be in the last step
  const lastStep = result.log[result.log.length - 1];
  assert.ok(lastStep.executed.includes('D'));
});

// ── Test: simulation with B failing once (gate retry) ───────────────────────

test('simulation with B gate-retry: all 4 tasks complete', () => {
  const result = simulateExecution({ bFailsOnce: true });
  assert.equal(result.completed.length, 4);
  assert.deepEqual(result.completed.sort(), ['A', 'B', 'C', 'D']);
});

test('simulation with B gate-retry: gate failure event is logged', () => {
  const result = simulateExecution({ bFailsOnce: true });
  const allEvents = result.log.flatMap(s => s.events);
  const gateFailed = allEvents.filter(e => e.type === 'task.gate_failed');
  assert.ok(gateFailed.length > 0, 'Should have at least one gate_failed event');
  assert.equal(gateFailed[0].taskId, 'B');
});

test('simulation with B gate-retry: C is not affected by B gate failure', () => {
  const result = simulateExecution({ bFailsOnce: true });
  assert.ok(result.completed.includes('C'));
  assert.ok(!result.skipped.includes('C'));
  assert.ok(!result.failed.includes('C'));
});

// ── Test: 200 iteration invariant check ─────────────────────────────────────

test('invariant: 200 iterations all produce correct completion', () => {
  const violations = [];

  for (let seed = 0; seed < 200; seed++) {
    const result = simulateExecution({ bFailsOnce: seed % 2 === 0, seed });

    // Invariant 1: all 4 complete
    if (result.completed.length !== 4) {
      violations.push(`seed=${seed}: only ${result.completed.length} tasks completed`);
      continue;
    }

    // Invariant 2: no failures/skips in final state
    if (result.failed.length > 0 || result.skipped.length > 0) {
      violations.push(`seed=${seed}: failed=${result.failed.length} skipped=${result.skipped.length}`);
      continue;
    }

    // Invariant 3: A is always in step 1
    if (!result.log[0].executed.includes('A')) {
      violations.push(`seed=${seed}: A not in step 1`);
      continue;
    }

    // Invariant 4: D never appears in a step before B and C are complete
    let bComplete = false;
    let cComplete = false;
    for (const step of result.log) {
      if (step.executed.includes('D') && (!bComplete || !cComplete)) {
        violations.push(`seed=${seed}: D ran before B(${bComplete})/C(${cComplete}) complete`);
        break;
      }
      if (step.executed.includes('B')) bComplete = true;
      if (step.executed.includes('C')) cComplete = true;
    }
  }

  if (violations.length > 0) {
    assert.fail(`${violations.length} violations out of 200:\n  ${violations.slice(0, 5).join('\n  ')}`);
  }
});

test('invariant: event ordering never shows D.started before B.completed and C.completed', () => {
  for (let seed = 0; seed < 200; seed++) {
    const result = simulateExecution({ bFailsOnce: seed % 3 === 0, seed });
    const allEvents = result.log.flatMap(s => s.events);

    const bCompletedIdx = allEvents.findIndex(e => e.type === 'task.completed' && e.taskId === 'B');
    const cCompletedIdx = allEvents.findIndex(e => e.type === 'task.completed' && e.taskId === 'C');
    const dCompletedIdx = allEvents.findIndex(e => e.type === 'task.completed' && e.taskId === 'D');

    if (dCompletedIdx >= 0) {
      assert.ok(bCompletedIdx < dCompletedIdx, `seed=${seed}: B must complete before D`);
      assert.ok(cCompletedIdx < dCompletedIdx, `seed=${seed}: C must complete before D`);
    }
  }
});

// ── Test: permanent B failure blocks D but not C ────────────────────────────

function simulatePermanentFailure() {
  const tasks = makeTasks();
  const completed = new Set();
  const taskFailed = new Set();
  const skipped = new Set();
  let step = 0;

  while (step < 20) {
    step++;
    const readyIds = getReadyTaskIds(tasks, completed, taskFailed, skipped);
    if (readyIds.length === 0) {
      for (const t of tasks) {
        if (!completed.has(t.id) && !taskFailed.has(t.id) && !skipped.has(t.id)) {
          skipped.add(t.id);
        }
      }
      break;
    }
    for (const taskId of readyIds) {
      if (taskId === 'B') {
        taskFailed.add(taskId); // B permanently fails
      } else {
        completed.add(taskId);
      }
    }
  }

  return { completed: [...completed], failed: [...taskFailed], skipped: [...skipped] };
}

test('permanent B failure: C still completes', () => {
  const result = simulatePermanentFailure();
  assert.ok(result.completed.includes('A'));
  assert.ok(result.completed.includes('C'));
  assert.ok(result.failed.includes('B'));
});

test('permanent B failure: D is skipped (not failed, not completed)', () => {
  const result = simulatePermanentFailure();
  assert.ok(result.skipped.includes('D'));
  assert.ok(!result.completed.includes('D'));
  assert.ok(!result.failed.includes('D'));
});

// ── Test: larger DAG invariant ──────────────────────────────────────────────

test('larger DAG: 6-task diamond with fan-out', () => {
  // A → B, C, E
  // B → D
  // C → D
  // E → F
  // D → F
  const tasks = [
    { id: 'A', dependsOn: [] },
    { id: 'B', dependsOn: ['A'] },
    { id: 'C', dependsOn: ['A'] },
    { id: 'E', dependsOn: ['A'] },
    { id: 'D', dependsOn: ['B', 'C'] },
    { id: 'F', dependsOn: ['D', 'E'] },
  ];

  for (let i = 0; i < 100; i++) {
    const completed = new Set();
    const taskFailed = new Set();
    const skipped = new Set();
    let step = 0;

    while (step < 20) {
      step++;
      const ready = getReadyTaskIds(tasks, completed, taskFailed, skipped);
      if (ready.length === 0) break;
      for (const tid of ready) completed.add(tid);
    }

    assert.equal(completed.size, 6, `iteration ${i}: should complete all 6`);
  }
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
