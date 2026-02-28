/**
 * Scheduler Tests — WFQ with Priority Classes.
 *
 * 30 tests covering:
 *   Section 1: State management (4 tests)
 *   Section 2: enqueueTask (4 tests)
 *   Section 3: scheduleNext — WFQ ordering (6 tests)
 *   Section 4: completeTask + unblocking (3 tests)
 *   Section 5: getPriorityClass (3 tests)
 *   Section 6: getSchedulerStatus + getSchedulerQueue (3 tests)
 *   Section 7: simulateScheduling (2 tests)
 *   Section 8: Legacy createScheduler + computeWFQWeights (5 tests)
 */

import {
  loadSchedulerState, saveSchedulerState,
  loadSchedulerPolicy, saveSchedulerPolicy,
  scheduleNext, enqueueTask, completeTask,
  getPriorityClass,
  getSchedulerStatus, getSchedulerQueue,
  simulateScheduling,
  createScheduler, computeWFQWeights, PRIORITY_CLASSES,
} from '../commands/lib/scheduler.mjs';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    results.push(`  PASS  ${passed + failed}. ${name}`);
  } else {
    failed++;
    results.push(`  FAIL  ${passed + failed}. ${name}`);
  }
}

function makeTmpRoot() {
  const root = join(tmpdir(), `ogu-sched-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(root, '.ogu/state'), { recursive: true });
  mkdirSync(join(root, '.ogu/audit'), { recursive: true });
  mkdirSync(join(root, '.ogu/locks'), { recursive: true });
  return root;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: State management
// ═══════════════════════════════════════════════════════════════════════

// 1. loadSchedulerState returns default when no state file
{
  const root = makeTmpRoot();
  const state = loadSchedulerState(root);
  assert(state.version === 2 && Array.isArray(state.queue) && state.queue.length === 0,
    'loadSchedulerState: returns default empty state');
  rmSync(root, { recursive: true, force: true });
}

// 2. saveSchedulerState persists state
{
  const root = makeTmpRoot();
  const state = { version: 2, queue: [{ taskId: 't1', status: 'pending' }], virtualClocks: {}, updatedAt: '' };
  saveSchedulerState(root, state);
  const loaded = loadSchedulerState(root);
  assert(loaded.queue.length === 1 && loaded.queue[0].taskId === 't1',
    'saveSchedulerState: persists state to disk');
  rmSync(root, { recursive: true, force: true });
}

// 3. loadSchedulerPolicy returns default when no policy file
{
  const root = makeTmpRoot();
  const policy = loadSchedulerPolicy(root);
  assert(policy.$schema === 'SchedulerPolicy/1.0' && policy.priorityClasses.length === 5,
    'loadSchedulerPolicy: returns default policy with 5 priority classes');
  rmSync(root, { recursive: true, force: true });
}

// 4. saveSchedulerPolicy + load roundtrip
{
  const root = makeTmpRoot();
  const custom = { $schema: 'SchedulerPolicy/1.0', priorityClasses: [], fairness: { algorithm: 'test' } };
  saveSchedulerPolicy(root, custom);
  const loaded = loadSchedulerPolicy(root);
  assert(loaded.fairness.algorithm === 'test', 'saveSchedulerPolicy: roundtrips custom policy');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: enqueueTask
// ═══════════════════════════════════════════════════════════════════════

// 5. enqueueTask adds task to queue
{
  const root = makeTmpRoot();
  const result = enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 50 });
  assert(result.enqueued === true && result.position === 1, 'enqueueTask: adds task, returns position');
  rmSync(root, { recursive: true, force: true });
}

// 6. enqueueTask prevents duplicates
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 50 });
  const result = enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 50 });
  assert(result.enqueued === false && result.reason === 'already in queue',
    'enqueueTask: rejects duplicate taskId');
  rmSync(root, { recursive: true, force: true });
}

// 7. enqueueTask sets defaults
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a' });
  const state = loadSchedulerState(root);
  const task = state.queue[0];
  assert(task.priority === 50 && task.estimatedCost === 0 && task.resourceType === 'model_call' &&
         task.status === 'pending' && task.promotions === 0,
    'enqueueTask: applies defaults (priority 50, cost 0, model_call)');
  rmSync(root, { recursive: true, force: true });
}

// 8. enqueueTask with blockedBy
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 50 });
  enqueueTask(root, { taskId: 't2', featureSlug: 'feat-a', priority: 50, blockedBy: ['t1'] });
  const state = loadSchedulerState(root);
  assert(state.queue[1].blockedBy.length === 1 && state.queue[1].blockedBy[0] === 't1',
    'enqueueTask: stores blockedBy dependencies');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: scheduleNext — WFQ ordering
// ═══════════════════════════════════════════════════════════════════════

// 9. scheduleNext returns null on empty queue
{
  const root = makeTmpRoot();
  const result = scheduleNext(root);
  assert(result === null, 'scheduleNext: returns null on empty queue');
  rmSync(root, { recursive: true, force: true });
}

// 10. scheduleNext picks highest priority first
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 'low', featureSlug: 'feat-a', priority: 10 });
  enqueueTask(root, { taskId: 'high', featureSlug: 'feat-b', priority: 95 });
  enqueueTask(root, { taskId: 'mid', featureSlug: 'feat-c', priority: 50 });

  const next = scheduleNext(root);
  assert(next !== null && next.taskId === 'high',
    'scheduleNext: picks highest priority task (P0-critical)');
  rmSync(root, { recursive: true, force: true });
}

// 11. Same priority → lowest virtual clock wins (WFQ fairness)
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 50 });
  enqueueTask(root, { taskId: 't2', featureSlug: 'feat-b', priority: 50 });

  // Both at virtual clock 0, alphabetical tiebreak → feat-a first
  const first = scheduleNext(root);
  assert(first.featureSlug === 'feat-a', 'scheduleNext: WFQ tiebreaker — alphabetical first');

  // Now feat-a has higher virtual clock, feat-b should go next
  enqueueTask(root, { taskId: 't3', featureSlug: 'feat-a', priority: 50 });
  const second = scheduleNext(root);
  assert(second.featureSlug === 'feat-b',
    'scheduleNext: WFQ fairness — lower virtual clock goes next');
  rmSync(root, { recursive: true, force: true });
}

// 12. scheduleNext skips blocked tasks
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 'blocker', featureSlug: 'feat-a', priority: 50 });
  enqueueTask(root, { taskId: 'blocked', featureSlug: 'feat-a', priority: 95, blockedBy: ['blocker'] });

  const next = scheduleNext(root);
  assert(next.taskId === 'blocker',
    'scheduleNext: skips blocked task, schedules blocker first');
  rmSync(root, { recursive: true, force: true });
}

// 13. scheduleNext advances virtual clock
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 50 });
  scheduleNext(root);

  const state = loadSchedulerState(root);
  assert(state.virtualClocks['feat-a'] === 1.0,
    'scheduleNext: advances virtual clock for scheduled feature');
  rmSync(root, { recursive: true, force: true });
}

// 14. scheduleNext marks task as scheduled
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 50 });
  scheduleNext(root);

  const state = loadSchedulerState(root);
  assert(state.queue[0].status === 'scheduled' && state.queue[0].scheduledAt !== undefined,
    'scheduleNext: marks task as scheduled with timestamp');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 4: completeTask + unblocking
// ═══════════════════════════════════════════════════════════════════════

// 15. completeTask marks task as completed
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 50 });
  completeTask(root, 't1');

  const state = loadSchedulerState(root);
  assert(state.queue[0].status === 'completed' && state.queue[0].completedAt !== undefined,
    'completeTask: marks task completed with timestamp');
  rmSync(root, { recursive: true, force: true });
}

// 16. completeTask unblocks dependents
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 50 });
  enqueueTask(root, { taskId: 't2', featureSlug: 'feat-a', priority: 50, blockedBy: ['t1'] });

  completeTask(root, 't1');
  const state = loadSchedulerState(root);
  assert(state.queue[1].blockedBy.length === 0,
    'completeTask: removes completed taskId from dependents blockedBy');
  rmSync(root, { recursive: true, force: true });
}

// 17. completeTask then scheduleNext picks unblocked task
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 50 });
  enqueueTask(root, { taskId: 't2', featureSlug: 'feat-a', priority: 95, blockedBy: ['t1'] });

  // t2 is blocked, only t1 can run
  scheduleNext(root);
  completeTask(root, 't1');

  // Now t2 should be unblocked and schedulable
  const next = scheduleNext(root);
  assert(next !== null && next.taskId === 't2',
    'completeTask → scheduleNext: unblocked task becomes schedulable');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 5: getPriorityClass
// ═══════════════════════════════════════════════════════════════════════

// 18. P0-critical for priority 90-100
{
  const cls = getPriorityClass(95);
  assert(cls.class === 'P0-critical', 'getPriorityClass: 95 → P0-critical');
}

// 19. P2-normal for priority 40-69
{
  const cls = getPriorityClass(50);
  assert(cls.class === 'P2-normal', 'getPriorityClass: 50 → P2-normal');
}

// 20. P4-background for priority 0-9
{
  const cls = getPriorityClass(5);
  assert(cls.class === 'P4-background', 'getPriorityClass: 5 → P4-background');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 6: getSchedulerStatus + getSchedulerQueue
// ═══════════════════════════════════════════════════════════════════════

// 21. getSchedulerStatus on empty queue
{
  const root = makeTmpRoot();
  const status = getSchedulerStatus(root);
  assert(status.totalPending === 0 && status.totalScheduled === 0 && status.totalCompleted === 0 &&
         status.algorithm.includes('Weighted Fair Queuing'),
    'getSchedulerStatus: empty queue returns zero counts');
  rmSync(root, { recursive: true, force: true });
}

// 22. getSchedulerStatus with mixed queue
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 't1', featureSlug: 'feat-a', priority: 95 });
  enqueueTask(root, { taskId: 't2', featureSlug: 'feat-b', priority: 50 });
  scheduleNext(root); // schedules t1 (highest priority)

  const status = getSchedulerStatus(root);
  assert(status.totalPending === 1 && status.totalScheduled === 1,
    'getSchedulerStatus: counts pending + scheduled correctly');
  rmSync(root, { recursive: true, force: true });
}

// 23. getSchedulerQueue returns pending tasks sorted by priority
{
  const root = makeTmpRoot();
  enqueueTask(root, { taskId: 'low', featureSlug: 'feat-a', priority: 10 });
  enqueueTask(root, { taskId: 'high', featureSlug: 'feat-b', priority: 80 });
  enqueueTask(root, { taskId: 'mid', featureSlug: 'feat-c', priority: 50 });

  const queue = getSchedulerQueue(root);
  assert(queue.length === 3 && queue[0].taskId === 'high' && queue[2].taskId === 'low',
    'getSchedulerQueue: returns pending tasks sorted by priority DESC');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 7: simulateScheduling
// ═══════════════════════════════════════════════════════════════════════

// 24. simulateScheduling produces scheduling order
{
  const root = makeTmpRoot();
  const result = simulateScheduling(root, { taskCount: 5 });
  assert(result.simulated === true && result.scheduledOrder.length === 5 &&
         result.taskCount === 5,
    'simulateScheduling: produces scheduled order for N tasks');
  rmSync(root, { recursive: true, force: true });
}

// 25. simulateScheduling distributes across features
{
  const root = makeTmpRoot();
  const result = simulateScheduling(root, { taskCount: 9 });
  const features = new Set(result.scheduledOrder.map(s => s.featureSlug));
  assert(features.size >= 2, 'simulateScheduling: distributes tasks across multiple features');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 8: Legacy createScheduler + computeWFQWeights
// ═══════════════════════════════════════════════════════════════════════

// 26. PRIORITY_CLASSES has 4 levels
{
  assert(Object.keys(PRIORITY_CLASSES).length === 4 &&
         PRIORITY_CLASSES.critical.level === 3 &&
         PRIORITY_CLASSES.low.level === 0,
    'Legacy: PRIORITY_CLASSES has 4 levels with correct weights');
}

// 27. createScheduler enqueue/dequeue
{
  const sched = createScheduler();
  sched.enqueue({ id: 'a', priority: 'low' });
  sched.enqueue({ id: 'b', priority: 'critical' });
  const next = sched.dequeue();
  assert(next.id === 'b', 'Legacy createScheduler: dequeues highest priority first');
}

// 28. createScheduler size
{
  const sched = createScheduler();
  sched.enqueue({ id: 'a' });
  sched.enqueue({ id: 'b' });
  assert(sched.size() === 2, 'Legacy createScheduler: size returns queue length');
  sched.dequeue();
  assert(sched.size() === 1, 'Legacy createScheduler: size decreases after dequeue');
}

// 29. createScheduler starvation prevention
{
  const sched = createScheduler({ starvationThreshold: 0 }); // 0 seconds threshold
  sched.enqueue({ id: 'a', priority: 'low', enqueuedAt: Date.now() - 5000 });
  sched.checkStarvation();
  const item = sched.peek();
  assert(item.priority === 'high' && item.promotedFrom === 'low',
    'Legacy createScheduler: starvation promotes low → high');
}

// 30. computeWFQWeights
{
  const weights = computeWFQWeights({ critical: 1, normal: 3, low: 2 });
  assert(typeof weights.critical === 'number' && weights.critical > weights.normal && weights.normal > weights.low,
    'computeWFQWeights: critical weight > normal > low');
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  assert(Math.abs(sum - 1.0) < 0.001, 'computeWFQWeights: weights sum to 1.0');
}

// ═══════════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════════

console.log('\nScheduler Tests\n');
for (const r of results) console.log(r);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
