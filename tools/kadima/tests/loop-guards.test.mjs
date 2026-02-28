/**
 * Loop Guards Test — verifies halt/freeze blocks scheduler and state-machine loops.
 *
 * Run: node tools/kadima/tests/loop-guards.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
async function asyncTest(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── Setup ──

mkdirSync(join(root, '.ogu/state'), { recursive: true });
mkdirSync(join(root, '.ogu/state/features'), { recursive: true });

const schedulerStatePath = join(root, '.ogu/state/scheduler-state.json');
const haltPath = join(root, '.ogu/state/system-halt.json');
const freezePath = join(root, '.ogu/state/company-freeze.json');

const backupScheduler = existsSync(schedulerStatePath) ? readFileSync(schedulerStatePath, 'utf8') : null;
const backupHalt = existsSync(haltPath) ? readFileSync(haltPath, 'utf8') : null;
const backupFreeze = existsSync(freezePath) ? readFileSync(freezePath, 'utf8') : null;

function resetState() {
  writeFileSync(schedulerStatePath, JSON.stringify({
    version: 2,
    queue: [
      { taskId: 'guard-task-1', featureSlug: 'test', status: 'pending', priority: 50, blockedBy: [], enqueuedAt: new Date().toISOString(), promotions: 0, resourceType: 'model_call', estimatedCost: 0, teamId: null, taskSpec: null },
    ],
    virtualClocks: {},
    updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');
}

console.log('\nLoop Guards Tests\n');

// ── Scheduler Loop ──

const { createSchedulerLoop } = await import('../loops/scheduler.mjs');

const auditEvents = [];
const dispatched = [];

function makeRunnerPool() {
  return {
    active: new Map(),
    availableSlots() { return 4; },
    status() { return { maxConcurrent: 4, active: 0, available: 4, tasks: [] }; },
    async dispatch(task) { dispatched.push(task.taskId); return { taskId: task.taskId, pid: 0 }; },
  };
}

await asyncTest('1. Scheduler dispatches when system is normal', async () => {
  resetState();
  dispatched.length = 0;
  // Ensure no halt/freeze
  writeFileSync(haltPath, JSON.stringify({ halted: false }), 'utf8');
  writeFileSync(freezePath, JSON.stringify({ frozen: false }), 'utf8');

  const loop = createSchedulerLoop({
    root,
    intervalMs: 999999, // Don't auto-tick
    runnerPool: makeRunnerPool(),
    emitAudit: (type, payload) => auditEvents.push({ type, payload }),
  });

  await loop.forceTick();
  loop.stop();

  assert(dispatched.length === 1, `Expected 1 dispatch, got ${dispatched.length}`);
  assert(dispatched[0] === 'guard-task-1', `Expected guard-task-1, got ${dispatched[0]}`);
});

await asyncTest('2. Scheduler skips dispatch when system is halted', async () => {
  resetState();
  dispatched.length = 0;
  writeFileSync(haltPath, JSON.stringify({ halted: true, reason: 'test halt' }), 'utf8');

  const loop = createSchedulerLoop({
    root,
    intervalMs: 999999,
    runnerPool: makeRunnerPool(),
    emitAudit: () => {},
  });

  await loop.forceTick();
  loop.stop();

  assert(dispatched.length === 0, `Expected 0 dispatches when halted, got ${dispatched.length}`);

  // Task should still be pending
  const state = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  assert(state.queue[0].status === 'pending', 'Task should remain pending');
});

await asyncTest('3. Scheduler skips dispatch when system is frozen', async () => {
  resetState();
  dispatched.length = 0;
  writeFileSync(haltPath, JSON.stringify({ halted: false }), 'utf8');
  writeFileSync(freezePath, JSON.stringify({ frozen: true, reason: 'test freeze' }), 'utf8');

  const loop = createSchedulerLoop({
    root,
    intervalMs: 999999,
    runnerPool: makeRunnerPool(),
    emitAudit: () => {},
  });

  await loop.forceTick();
  loop.stop();

  assert(dispatched.length === 0, `Expected 0 dispatches when frozen, got ${dispatched.length}`);
});

await asyncTest('4. Scheduler resumes after halt is cleared', async () => {
  // Already frozen from test 3 — clear both
  writeFileSync(haltPath, JSON.stringify({ halted: false }), 'utf8');
  writeFileSync(freezePath, JSON.stringify({ frozen: false }), 'utf8');

  resetState();
  dispatched.length = 0;

  const loop = createSchedulerLoop({
    root,
    intervalMs: 999999,
    runnerPool: makeRunnerPool(),
    emitAudit: () => {},
  });

  await loop.forceTick();
  loop.stop();

  assert(dispatched.length === 1, `Expected 1 dispatch after resume, got ${dispatched.length}`);
});

// ── State Machine Loop ──

const { createStateMachineLoop } = await import('../loops/state-machine.mjs');

await asyncTest('5. State machine skips transitions when halted', async () => {
  // Create a feature in "building" state with all tasks completed
  const featureStatePath = join(root, '.ogu/state/features/guard-test.state.json');
  writeFileSync(featureStatePath, JSON.stringify({
    slug: 'guard-test',
    currentState: 'building',
    version: 1,
    tasks: [{ taskId: 't1', status: 'completed' }],
    updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  writeFileSync(haltPath, JSON.stringify({ halted: true, reason: 'test' }), 'utf8');

  const smLoop = createStateMachineLoop({
    root,
    intervalMs: 999999,
    emitAudit: () => {},
  });

  await smLoop.forceTick();
  smLoop.stop();

  // Should NOT have transitioned to "built"
  const state = JSON.parse(readFileSync(featureStatePath, 'utf8'));
  assert(state.currentState === 'building', `Expected building, got ${state.currentState}`);

  // Cleanup
  writeFileSync(haltPath, JSON.stringify({ halted: false }), 'utf8');
});

await asyncTest('6. State machine transitions when system is normal', async () => {
  const featureStatePath = join(root, '.ogu/state/features/guard-test.state.json');
  writeFileSync(freezePath, JSON.stringify({ frozen: false }), 'utf8');

  const smLoop = createStateMachineLoop({
    root,
    intervalMs: 999999,
    emitAudit: () => {},
  });

  await smLoop.forceTick();
  smLoop.stop();

  const state = JSON.parse(readFileSync(featureStatePath, 'utf8'));
  assert(state.currentState === 'built', `Expected built, got ${state.currentState}`);

  // Cleanup
  const { unlinkSync } = await import('node:fs');
  unlinkSync(featureStatePath);
});

// ── Restore ──

if (backupScheduler) writeFileSync(schedulerStatePath, backupScheduler, 'utf8');
else writeFileSync(schedulerStatePath, JSON.stringify({ version: 2, queue: [], virtualClocks: {}, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
if (backupHalt) writeFileSync(haltPath, backupHalt, 'utf8');
else if (existsSync(haltPath)) writeFileSync(haltPath, JSON.stringify({ halted: false }), 'utf8');
if (backupFreeze) writeFileSync(freezePath, backupFreeze, 'utf8');
else if (existsSync(freezePath)) writeFileSync(freezePath, JSON.stringify({ frozen: false }), 'utf8');

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
