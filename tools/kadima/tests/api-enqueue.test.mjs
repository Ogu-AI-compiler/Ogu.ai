/**
 * Kadima API Enqueue Integration Test
 *
 * Tests the full chain:
 *   1. POST /api/enqueue → scheduler-state.json
 *   2. Scheduler tick picks task via WFQ
 *   3. GET /api/task/:taskId shows task details
 *   4. POST /api/task/:taskId/cancel cancels task
 *   5. System guards block enqueue when halted/frozen
 *   6. POST /api/scheduler/force-tick triggers immediate tick
 *
 * Run: node tools/kadima/tests/api-enqueue.test.mjs
 */

import http from 'node:http';
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

// ── HTTP helpers ──

function httpRequest(port, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1', port, path, method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(opts, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(responseBody) }); }
        catch { resolve({ status: res.statusCode, body: responseBody }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Setup ──

const schedulerStatePath = join(root, '.ogu/state/scheduler-state.json');
const backupState = existsSync(schedulerStatePath) ? readFileSync(schedulerStatePath, 'utf8') : null;

// Ensure state dir
mkdirSync(join(root, '.ogu/state'), { recursive: true });

// Reset scheduler state
function resetSchedulerState() {
  writeFileSync(schedulerStatePath, JSON.stringify({
    version: 2, queue: [], virtualClocks: {}, updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');
}

console.log('\nKadima API Enqueue Integration Tests\n');

// ── Part 1: Unit tests (file-based, no server) ──

test('1. File-based enqueue writes correct task structure', () => {
  resetSchedulerState();

  const state = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  state.queue.push({
    taskId: 'unit-task-1',
    featureSlug: 'test-feature',
    status: 'pending',
    priority: 70,
    estimatedCost: 5,
    resourceType: 'model_call',
    blockedBy: [],
    enqueuedAt: new Date().toISOString(),
    promotions: 0,
    teamId: null,
    taskSpec: { name: 'Unit Test Task' },
  });
  state.updatedAt = new Date().toISOString();
  writeFileSync(schedulerStatePath, JSON.stringify(state, null, 2), 'utf8');

  const after = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  assert(after.queue.length === 1, `Expected 1 task, got ${after.queue.length}`);
  assert(after.queue[0].taskId === 'unit-task-1', 'Wrong taskId');
  assert(after.queue[0].priority === 70, 'Wrong priority');
});

await asyncTest('2. WFQ scheduler picks highest-priority unblocked task', async () => {
  resetSchedulerState();

  // Enqueue 3 tasks: P0 (90), P2 (50, blocked), P3 (20)
  const state = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  state.queue.push(
    { taskId: 'wfq-high', featureSlug: 'f', status: 'pending', priority: 90, blockedBy: [], enqueuedAt: new Date().toISOString(), promotions: 0, resourceType: 'model_call', estimatedCost: 0, teamId: null, taskSpec: null },
    { taskId: 'wfq-mid', featureSlug: 'f', status: 'pending', priority: 50, blockedBy: ['wfq-high'], enqueuedAt: new Date().toISOString(), promotions: 0, resourceType: 'model_call', estimatedCost: 0, teamId: null, taskSpec: null },
    { taskId: 'wfq-low', featureSlug: 'f', status: 'pending', priority: 20, blockedBy: [], enqueuedAt: new Date().toISOString(), promotions: 0, resourceType: 'model_call', estimatedCost: 0, teamId: null, taskSpec: null },
  );
  writeFileSync(schedulerStatePath, JSON.stringify(state, null, 2), 'utf8');

  const { scheduleNext } = await import('../../ogu/commands/lib/scheduler.mjs');
  const picked = scheduleNext(root);
  assert(picked !== null, 'Should pick a task');
  assert(picked.taskId === 'wfq-high', `Expected wfq-high (P0), got ${picked.taskId}`);
});

test('3. Cancel marks task as cancelled in state file', () => {
  const state = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  const task = state.queue.find(t => t.taskId === 'wfq-low');
  assert(task, 'wfq-low should exist');
  task.status = 'cancelled';
  task.cancelledAt = new Date().toISOString();
  writeFileSync(schedulerStatePath, JSON.stringify(state, null, 2), 'utf8');

  const after = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  assert(after.queue.find(t => t.taskId === 'wfq-low').status === 'cancelled', 'Should be cancelled');
});

// ── Part 2: HTTP integration tests (real server) ──

await asyncTest('4. Router module imports without errors', async () => {
  const mod = await import('../api/router.mjs');
  assert(typeof mod.createApiRouter === 'function', 'createApiRouter should be a function');
});

// Create a test server
const { createApiRouter } = await import('../api/router.mjs');
const { createBroadcaster } = await import('../api/event-stream.mjs');

const broadcaster = createBroadcaster();
const auditEvents = [];

const mockRunnerPool = {
  active: new Map(),
  availableSlots() { return 4; },
  status() { return { maxConcurrent: 4, active: 0, available: 4, tasks: [] }; },
  async dispatch(task) { return { taskId: task.taskId, pid: 0 }; },
  async drainWithTimeout() {},
};

const mockLoops = [
  { name: 'scheduler', isRunning: true, lastTick: null, tickCount: 0, stop() {}, async forceTick() { this.tickCount++; this.lastTick = new Date().toISOString(); } },
  { name: 'state-machine', isRunning: true, lastTick: null, tickCount: 0, stop() {}, async forceTick() {} },
];

const emitAudit = (type, payload) => {
  auditEvents.push({ type, payload, timestamp: new Date().toISOString() });
};

resetSchedulerState();

const router = createApiRouter({
  root, runnerPool: mockRunnerPool, loops: mockLoops,
  emitAudit, config: {}, broadcaster,
});

const server = http.createServer(router);
const TEST_PORT = 14200; // Use a different port from real daemon

await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));

// ── HTTP Tests ──

await asyncTest('5. POST /api/enqueue — single task', async () => {
  resetSchedulerState();
  const res = await httpRequest(TEST_PORT, 'POST', '/api/enqueue', {
    taskId: 'http-task-1',
    featureSlug: 'http-feature',
    priority: 80,
  });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.accepted === 1, `Expected 1 accepted, got ${res.body.accepted}`);
  assert(res.body.results[0].enqueued === true, 'Should be enqueued');

  // Verify file state
  const state = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  assert(state.queue.length === 1, `Expected 1 task in state, got ${state.queue.length}`);
  assert(state.queue[0].taskId === 'http-task-1', 'Task should be in state file');
});

await asyncTest('6. POST /api/enqueue — duplicate rejected', async () => {
  const res = await httpRequest(TEST_PORT, 'POST', '/api/enqueue', {
    taskId: 'http-task-1',
    featureSlug: 'http-feature',
  });
  assert(res.body.accepted === 0, 'Duplicate should be rejected');
  assert(res.body.results[0].reason === 'already in queue', 'Should say already in queue');
});

await asyncTest('7. POST /api/enqueue — batch enqueue', async () => {
  const res = await httpRequest(TEST_PORT, 'POST', '/api/enqueue', {
    tasks: [
      { taskId: 'batch-a', featureSlug: 'feat', priority: 90 },
      { taskId: 'batch-b', featureSlug: 'feat', priority: 50, blockedBy: ['batch-a'] },
      { taskId: 'batch-c', featureSlug: 'feat', priority: 20 },
    ],
  });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.accepted === 3, `Expected 3 accepted, got ${res.body.accepted}`);

  const state = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  assert(state.queue.length === 4, `Expected 4 total tasks, got ${state.queue.length}`); // 1 + 3
});

await asyncTest('8. POST /api/enqueue — missing taskId returns 400', async () => {
  const res = await httpRequest(TEST_PORT, 'POST', '/api/enqueue', {
    featureSlug: 'no-id',
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(res.body.error.includes('taskId'), 'Should mention taskId');
});

await asyncTest('9. GET /api/task/:taskId — returns task details', async () => {
  const res = await httpRequest(TEST_PORT, 'GET', '/api/task/http-task-1');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.taskId === 'http-task-1', 'Should return correct task');
  assert(res.body.priority === 80, 'Should have correct priority');
  assert(res.body.status === 'pending', 'Should be pending');
});

await asyncTest('10. GET /api/task/:taskId — 404 for unknown task', async () => {
  const res = await httpRequest(TEST_PORT, 'GET', '/api/task/nonexistent');
  assert(res.status === 404, `Expected 404, got ${res.status}`);
});

await asyncTest('11. POST /api/task/:taskId/cancel — cancels pending task', async () => {
  const res = await httpRequest(TEST_PORT, 'POST', '/api/task/batch-c/cancel');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.cancelled === true, 'Should be cancelled');

  // Verify in state
  const state = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
  const task = state.queue.find(t => t.taskId === 'batch-c');
  assert(task.status === 'cancelled', 'State file should show cancelled');
});

await asyncTest('12. GET /api/scheduler/status — shows queue stats', async () => {
  const res = await httpRequest(TEST_PORT, 'GET', '/api/scheduler/status');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.total === 4, `Expected 4 total, got ${res.body.total}`);
  assert(res.body.cancelled === 1, `Expected 1 cancelled, got ${res.body.cancelled}`);
  assert(res.body.pending === 3, `Expected 3 pending, got ${res.body.pending}`);
});

await asyncTest('13. POST /api/scheduler/force-tick — triggers tick', async () => {
  const res = await httpRequest(TEST_PORT, 'POST', '/api/scheduler/force-tick');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.triggered === true, 'Should be triggered');
  assert(res.body.tickCount === 1, `Expected tickCount 1, got ${res.body.tickCount}`);
});

await asyncTest('14. POST /api/enqueue — blocked when system halted', async () => {
  // Set halt
  writeFileSync(join(root, '.ogu/state/system-halt.json'), JSON.stringify({ halted: true, reason: 'test' }), 'utf8');

  const res = await httpRequest(TEST_PORT, 'POST', '/api/enqueue', {
    taskId: 'should-fail', featureSlug: 'test',
  });
  assert(res.status === 503, `Expected 503, got ${res.status}`);
  assert(res.body.blocked === true, 'Should be blocked');

  // Clean up
  writeFileSync(join(root, '.ogu/state/system-halt.json'), JSON.stringify({ halted: false }), 'utf8');
});

await asyncTest('15. POST /api/enqueue — blocked when system frozen', async () => {
  writeFileSync(join(root, '.ogu/state/company-freeze.json'), JSON.stringify({ frozen: true, reason: 'test freeze' }), 'utf8');

  const res = await httpRequest(TEST_PORT, 'POST', '/api/enqueue', {
    taskId: 'should-fail-2', featureSlug: 'test',
  });
  assert(res.status === 503, `Expected 503, got ${res.status}`);
  assert(res.body.blocked === true, 'Should be blocked by freeze');

  writeFileSync(join(root, '.ogu/state/company-freeze.json'), JSON.stringify({ frozen: false }), 'utf8');
});

await asyncTest('16. POST /api/command — dispatches CLI command', async () => {
  const res = await httpRequest(TEST_PORT, 'POST', '/api/command', {
    command: 'validate',
    args: [],
  });
  assert(res.status === 202, `Expected 202, got ${res.status}`);
  assert(res.body.accepted === true, 'Should be accepted');
  assert(res.body.command === 'validate', 'Should echo command name');
  assert(typeof res.body.pid === 'number', 'Should return PID');
  assert(typeof res.body.requestId === 'string', 'Should return requestId');
});

await asyncTest('17. POST /api/command — missing command returns 400', async () => {
  const res = await httpRequest(TEST_PORT, 'POST', '/api/command', {});
  assert(res.status === 400, `Expected 400, got ${res.status}`);
});

await asyncTest('18. Audit trail captures enqueue events', async () => {
  const enqueueEvents = auditEvents.filter(e => e.type === 'api.task_enqueued');
  assert(enqueueEvents.length >= 4, `Expected >=4 enqueue audit events, got ${enqueueEvents.length}`);
  assert(enqueueEvents[0].payload.source === 'http', 'Source should be http');
});

// ── Cleanup ──

server.close();

if (backupState) {
  writeFileSync(schedulerStatePath, backupState, 'utf8');
} else {
  resetSchedulerState();
}

// Clean up halt/freeze test files
const haltPath = join(root, '.ogu/state/system-halt.json');
const freezePath = join(root, '.ogu/state/company-freeze.json');
if (existsSync(haltPath)) {
  const h = JSON.parse(readFileSync(haltPath, 'utf8'));
  if (h.halted) writeFileSync(haltPath, JSON.stringify({ halted: false }), 'utf8');
}
if (existsSync(freezePath)) {
  const f = JSON.parse(readFileSync(freezePath, 'utf8'));
  if (f.frozen) writeFileSync(freezePath, JSON.stringify({ frozen: false }), 'utf8');
}

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
