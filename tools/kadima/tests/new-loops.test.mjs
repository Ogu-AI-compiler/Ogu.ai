/**
 * New Daemon Loops Test — consistency, metrics-aggregator, circuit-prober.
 *
 * Run: node tools/kadima/tests/new-loops.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

let passed = 0;
let failed = 0;

async function asyncTest(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

mkdirSync(join(root, '.ogu/state'), { recursive: true });
mkdirSync(join(root, '.ogu/state/features'), { recursive: true });
mkdirSync(join(root, '.ogu/budget'), { recursive: true });

const schedulerStatePath = join(root, '.ogu/state/scheduler-state.json');
const breakerPath = join(root, '.ogu/state/circuit-breakers.json');
const metricsSnapshotPath = join(root, '.ogu/state/metrics-snapshot.json');
const metricsHistoryPath = join(root, '.ogu/state/metrics-history.jsonl');

const backups = {};
for (const p of [schedulerStatePath, breakerPath, metricsSnapshotPath, metricsHistoryPath]) {
  if (existsSync(p)) backups[p] = readFileSync(p, 'utf8');
}

const auditEvents = [];
const emitAudit = (type, payload) => auditEvents.push({ type, payload });

const mockRunnerPool = {
  active: new Map(),
  availableSlots() { return 4; },
  status() { return { maxConcurrent: 4, active: 0, available: 4, tasks: [] }; },
};

console.log('\nNew Daemon Loops Tests\n');

// ── Consistency Loop ──

const { createConsistencyLoop } = await import('../loops/consistency.mjs');

await asyncTest('1. Consistency: detects orphaned dispatched task', async () => {
  auditEvents.length = 0;

  // Create a task that was dispatched 3 minutes ago but has no runner
  writeFileSync(schedulerStatePath, JSON.stringify({
    version: 2,
    queue: [{
      taskId: 'orphan-1',
      featureSlug: 'test',
      status: 'dispatched',
      dispatchedAt: new Date(Date.now() - 180000).toISOString(), // 3 min ago
      priority: 50, blockedBy: [], enqueuedAt: new Date().toISOString(), promotions: 0,
    }],
    virtualClocks: {},
    updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  const loop = createConsistencyLoop({ root, intervalMs: 999999, runnerPool: mockRunnerPool, emitAudit });
  await loop.forceTick();
  loop.stop();

  const state = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  assert(state.queue[0].status === 'pending', `Expected pending (recovered), got ${state.queue[0].status}`);
  assert(state.queue[0].orphanCount === 1, 'Should track orphan count');
});

await asyncTest('2. Consistency: archives old completed tasks', async () => {
  writeFileSync(schedulerStatePath, JSON.stringify({
    version: 2,
    queue: [
      { taskId: 'old-done', status: 'completed', completedAt: new Date(Date.now() - 7200000).toISOString(), featureSlug: 'test', priority: 50 },
      { taskId: 'fresh-done', status: 'completed', completedAt: new Date().toISOString(), featureSlug: 'test', priority: 50 },
      { taskId: 'still-pending', status: 'pending', featureSlug: 'test', priority: 50, blockedBy: [] },
    ],
    virtualClocks: {},
    updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  const loop = createConsistencyLoop({ root, intervalMs: 999999, runnerPool: mockRunnerPool, emitAudit });
  await loop.forceTick();
  loop.stop();

  const state = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  assert(state.queue.length === 2, `Expected 2 tasks (1 archived), got ${state.queue.length}`);
  assert(!state.queue.find(t => t.taskId === 'old-done'), 'old-done should be archived');
  assert(state.queue.find(t => t.taskId === 'fresh-done'), 'fresh-done should remain');

  // Check archive file
  const archivePath = join(root, '.ogu/state/scheduler-archive.jsonl');
  assert(existsSync(archivePath), 'Archive file should exist');
  const archived = readFileSync(archivePath, 'utf8').trim();
  assert(archived.includes('old-done'), 'Archive should contain old-done');
  unlinkSync(archivePath); // Clean up
});

await asyncTest('3. Consistency: detects stuck feature', async () => {
  auditEvents.length = 0;

  // Feature in "building" with failed task and no pending work
  writeFileSync(join(root, '.ogu/state/features/stuck-test.state.json'), JSON.stringify({
    slug: 'stuck-test',
    currentState: 'building',
    version: 1,
    tasks: [
      { taskId: 't1', status: 'completed' },
      { taskId: 't2', status: 'dispatch_failed' },
    ],
    updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  const loop = createConsistencyLoop({ root, intervalMs: 999999, runnerPool: mockRunnerPool, emitAudit });
  await loop.forceTick();
  loop.stop();

  const issueEvent = auditEvents.find(e => e.type === 'consistency.issues_found');
  assert(issueEvent, 'Should emit issues_found');
  const stuckIssue = issueEvent.payload.issues.find(i => i.type === 'stuck_feature');
  assert(stuckIssue, 'Should detect stuck_feature issue');
  assert(stuckIssue.slug === 'stuck-test', 'Should report correct slug');

  unlinkSync(join(root, '.ogu/state/features/stuck-test.state.json'));
});

// ── Metrics Aggregator Loop ──

const { createMetricsAggregatorLoop } = await import('../loops/metrics-aggregator.mjs');

await asyncTest('4. Metrics aggregator: computes and writes snapshot', async () => {
  writeFileSync(schedulerStatePath, JSON.stringify({
    version: 2,
    queue: [
      { taskId: 't1', status: 'completed', completedAt: new Date().toISOString() },
      { taskId: 't2', status: 'pending', priority: 50 },
      { taskId: 't3', status: 'dispatched', priority: 70 },
    ],
    virtualClocks: {},
    updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  // Clean previous snapshots
  if (existsSync(metricsSnapshotPath)) unlinkSync(metricsSnapshotPath);
  if (existsSync(metricsHistoryPath)) unlinkSync(metricsHistoryPath);

  const loop = createMetricsAggregatorLoop({ root, intervalMs: 999999, runnerPool: mockRunnerPool, emitAudit });
  await loop.forceTick();
  loop.stop();

  assert(existsSync(metricsSnapshotPath), 'Should write metrics-snapshot.json');
  const snapshot = JSON.parse(readFileSync(metricsSnapshotPath, 'utf8'));
  assert(snapshot.scheduler.total === 3, `Expected 3 total tasks, got ${snapshot.scheduler.total}`);
  assert(snapshot.scheduler.pending === 1, `Expected 1 pending, got ${snapshot.scheduler.pending}`);
  assert(snapshot.scheduler.dispatched === 1, `Expected 1 dispatched, got ${snapshot.scheduler.dispatched}`);
  assert(snapshot.runners.maxConcurrent === 4, 'Should show runner max');
  assert(typeof snapshot.health.score === 'number', 'Should have health score');
  assert(['healthy', 'degraded', 'critical'].includes(snapshot.health.status), 'Should have valid status');
});

await asyncTest('5. Metrics aggregator: appends to history', async () => {
  const loop = createMetricsAggregatorLoop({ root, intervalMs: 999999, runnerPool: mockRunnerPool, emitAudit });
  await loop.forceTick();
  await loop.forceTick();
  loop.stop();

  assert(existsSync(metricsHistoryPath), 'History file should exist');
  const lines = readFileSync(metricsHistoryPath, 'utf8').trim().split('\n');
  assert(lines.length >= 2, `Expected >=2 history entries, got ${lines.length}`);
});

// ── Circuit Breaker Prober Loop ──

const { createCircuitProberLoop } = await import('../loops/circuit-prober.mjs');

await asyncTest('6. Circuit prober: transitions open → half-open after cooldown', async () => {
  auditEvents.length = 0;

  writeFileSync(breakerPath, JSON.stringify({
    'FD-FILESYSTEM': {
      state: 'open',
      failureCount: 3,
      lastFailureAt: new Date(Date.now() - 120000).toISOString(), // 2 min ago
      cooldownMs: 60000, // 1 min cooldown
    },
    'FD-PROVIDER': {
      state: 'closed',
      failureCount: 0,
    },
  }, null, 2), 'utf8');

  const loop = createCircuitProberLoop({ root, intervalMs: 999999, emitAudit });
  await loop.forceTick();
  loop.stop();

  const breakers = JSON.parse(readFileSync(breakerPath, 'utf8'));
  // FD-FILESYSTEM should have gone open → half-open → probed → closed (filesystem is healthy)
  assert(breakers['FD-FILESYSTEM'].state === 'closed', `Expected closed, got ${breakers['FD-FILESYSTEM'].state}`);
  assert(breakers['FD-PROVIDER'].state === 'closed', 'Provider should stay closed');

  const closedEvent = auditEvents.find(e => e.type === 'circuit.closed' && e.payload.domainId === 'FD-FILESYSTEM');
  assert(closedEvent, 'Should emit circuit.closed event');
});

await asyncTest('7. Circuit prober: leaves closed breakers alone', async () => {
  auditEvents.length = 0;

  writeFileSync(breakerPath, JSON.stringify({
    'FD-PROVIDER': { state: 'closed', failureCount: 0 },
    'FD-SCHEDULER': { state: 'closed', failureCount: 0 },
  }, null, 2), 'utf8');

  const loop = createCircuitProberLoop({ root, intervalMs: 999999, emitAudit });
  await loop.forceTick();
  loop.stop();

  const breakers = JSON.parse(readFileSync(breakerPath, 'utf8'));
  assert(breakers['FD-PROVIDER'].state === 'closed', 'Should remain closed');
  assert(breakers['FD-SCHEDULER'].state === 'closed', 'Should remain closed');
  assert(auditEvents.length === 0, 'No events for closed breakers');
});

await asyncTest('8. Circuit prober: respects cooldown (does not transition too early)', async () => {
  writeFileSync(breakerPath, JSON.stringify({
    'FD-BUDGET': {
      state: 'open',
      failureCount: 2,
      lastFailureAt: new Date().toISOString(), // Just now
      cooldownMs: 60000, // 1 min cooldown
    },
  }, null, 2), 'utf8');

  const loop = createCircuitProberLoop({ root, intervalMs: 999999, emitAudit });
  await loop.forceTick();
  loop.stop();

  const breakers = JSON.parse(readFileSync(breakerPath, 'utf8'));
  assert(breakers['FD-BUDGET'].state === 'open', 'Should stay open (cooldown not elapsed)');
});

// ── Restore ──

for (const [p, content] of Object.entries(backups)) {
  writeFileSync(p, content, 'utf8');
}
// Clean up files that didn't exist before
for (const p of [metricsSnapshotPath, metricsHistoryPath]) {
  if (!backups[p] && existsSync(p)) unlinkSync(p);
}
if (!backups[schedulerStatePath]) {
  writeFileSync(schedulerStatePath, JSON.stringify({ version: 2, queue: [], virtualClocks: {}, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
}

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
