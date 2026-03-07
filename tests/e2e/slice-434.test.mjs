/**
 * Slice 434 — Execution Event Stream
 * Tests lifecycle event emission, history, stats, and formatting.
 */
import { strict as assert } from 'node:assert';
import {
  createExecutionStream,
  EXECUTION_EVENTS,
  formatEventForLog,
} from '../../tools/ogu/commands/lib/execution-event-stream.mjs';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 434: Execution Event Stream ===\n');

// ── EXECUTION_EVENTS constants ───────────────────────────────────────────────

test('EXECUTION_EVENTS has all 14 event types', () => {
  const types = Object.values(EXECUTION_EVENTS);
  assert.equal(types.length, 14);
  assert.ok(types.includes('task.started'));
  assert.ok(types.includes('task.completed'));
  assert.ok(types.includes('task.failed'));
  assert.ok(types.includes('gate.checking'));
  assert.ok(types.includes('gate.passed'));
  assert.ok(types.includes('gate.failed'));
  assert.ok(types.includes('retry.started'));
  assert.ok(types.includes('retry.exhausted'));
  assert.ok(types.includes('compile.started'));
  assert.ok(types.includes('compile.gate'));
  assert.ok(types.includes('compile.finished'));
  assert.ok(types.includes('escalation.triggered'));
  assert.ok(types.includes('feedback.created'));
  assert.ok(types.includes('learning.candidate'));
});

// ── createExecutionStream ────────────────────────────────────────────────────

test('createExecutionStream returns all expected methods', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  assert.ok(typeof stream.emit === 'function');
  assert.ok(typeof stream.taskStarted === 'function');
  assert.ok(typeof stream.taskCompleted === 'function');
  assert.ok(typeof stream.taskFailed === 'function');
  assert.ok(typeof stream.gateChecking === 'function');
  assert.ok(typeof stream.gatePassed === 'function');
  assert.ok(typeof stream.gateFailed === 'function');
  assert.ok(typeof stream.retryStarted === 'function');
  assert.ok(typeof stream.retryExhausted === 'function');
  assert.ok(typeof stream.compileStarted === 'function');
  assert.ok(typeof stream.compileGate === 'function');
  assert.ok(typeof stream.compileFinished === 'function');
  assert.ok(typeof stream.escalationTriggered === 'function');
  assert.ok(typeof stream.feedbackCreated === 'function');
  assert.ok(typeof stream.learningCandidate === 'function');
  assert.ok(typeof stream.on === 'function');
  assert.ok(typeof stream.once === 'function');
  assert.ok(typeof stream.off === 'function');
  assert.ok(typeof stream.getHistory === 'function');
  assert.ok(typeof stream.getStats === 'function');
});

// ── Task lifecycle events ────────────────────────────────────────────────────

test('taskStarted emits event with correct type and taskId', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.taskStarted('T1', { roleId: 'backend_engineer' });
  assert.equal(event.type, 'task.started');
  assert.equal(event.taskId, 'T1');
  assert.equal(event.roleId, 'backend_engineer');
  assert.ok(event.timestamp);
});

test('taskCompleted emits event with durationMs', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.taskCompleted('T1', { durationMs: 3500, cost: 0.02 });
  assert.equal(event.type, 'task.completed');
  assert.equal(event.durationMs, 3500);
});

test('taskFailed emits event with error string', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.taskFailed('T1', new Error('type error'), { attempt: 2 });
  assert.equal(event.type, 'task.failed');
  assert.ok(event.error.includes('type error'));
  assert.equal(event.attempt, 2);
});

// ── Gate events ──────────────────────────────────────────────────────────────

test('gateChecking emits gate name', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.gateChecking('T1', 'type-check');
  assert.equal(event.type, 'gate.checking');
  assert.equal(event.gate, 'type-check');
});

test('gatePassed sets passed=true', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.gatePassed('T1', 'tests-pass');
  assert.equal(event.passed, true);
  assert.equal(event.gate, 'tests-pass');
});

test('gateFailed sets passed=false with structured data', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.gateFailed('T1', 'type-check', {
    structured: { errors: [{ file: 'a.ts', line: 5, code: 'TS2304', message: 'not found' }] },
  });
  assert.equal(event.passed, false);
  assert.equal(event.structured.errors.length, 1);
});

// ── Retry & escalation events ────────────────────────────────────────────────

test('retryStarted tracks attempt number', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.retryStarted('T1', 2, { tier: 'standard' });
  assert.equal(event.type, 'retry.started');
  assert.equal(event.attempt, 2);
});

test('retryExhausted tracks total attempts', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.retryExhausted('T1', 3);
  assert.equal(event.type, 'retry.exhausted');
  assert.equal(event.attempts, 3);
});

test('escalationTriggered tracks tier change', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.escalationTriggered('T1', 'standard', 'advanced');
  assert.equal(event.fromTier, 'standard');
  assert.equal(event.toTier, 'advanced');
});

// ── Compile events ───────────────────────────────────────────────────────────

test('compileStarted emits with feature slug', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.compileStarted('auth-flow');
  assert.equal(event.featureSlug, 'auth-flow');
});

test('compileGate tracks gate name and result', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.compileGate('auth-flow', 'no_todos', true);
  assert.equal(event.gate, 'no_todos');
  assert.equal(event.passed, true);
});

test('compileFinished tracks final result', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.compileFinished('auth-flow', false, { errors: 3 });
  assert.equal(event.passed, false);
  assert.equal(event.errors, 3);
});

// ── Feedback & learning events ───────────────────────────────────────────────

test('feedbackCreated tracks recordId', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.feedbackCreated('T1', 'rec-123', { gate: 'type-check' });
  assert.equal(event.recordId, 'rec-123');
  assert.equal(event.gate, 'type-check');
});

test('learningCandidate tracks trigger', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const event = stream.learningCandidate('T1', 'evt-456', 'gate_failure');
  assert.equal(event.eventId, 'evt-456');
  assert.equal(event.trigger, 'gate_failure');
});

// ── Subscriber API ───────────────────────────────────────────────────────────

test('on() receives emitted events', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const received = [];
  stream.on('task.started', (e) => received.push(e));
  stream.taskStarted('T1');
  stream.taskStarted('T2');
  assert.equal(received.length, 2);
  assert.equal(received[0].taskId, 'T1');
  assert.equal(received[1].taskId, 'T2');
});

test('once() receives only first event', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const received = [];
  stream.once('task.completed', (e) => received.push(e));
  stream.taskCompleted('T1');
  stream.taskCompleted('T2');
  assert.equal(received.length, 1);
});

test('wildcard * receives all events', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const received = [];
  stream.on('*', (e) => received.push(e));
  stream.taskStarted('T1');
  stream.gatePassed('T1', 'g1');
  stream.taskCompleted('T1');
  assert.equal(received.length, 3);
});

test('off() removes listener', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  const received = [];
  const handler = (e) => received.push(e);
  stream.on('task.started', handler);
  stream.taskStarted('T1');
  stream.off('task.started', handler);
  stream.taskStarted('T2');
  assert.equal(received.length, 1);
});

// ── History ──────────────────────────────────────────────────────────────────

test('getHistory returns all events', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  stream.taskStarted('T1');
  stream.gatePassed('T1', 'g1');
  stream.taskCompleted('T1');
  const history = stream.getHistory();
  assert.equal(history.length, 3);
});

test('getHistory filters by type', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  stream.taskStarted('T1');
  stream.gatePassed('T1', 'g1');
  stream.gateFailed('T1', 'g2');
  stream.taskCompleted('T1');
  const gateEvents = stream.getHistory({ type: 'gate.passed' });
  assert.equal(gateEvents.length, 1);
});

test('getHistory filters by taskId', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  stream.taskStarted('T1');
  stream.taskStarted('T2');
  stream.taskCompleted('T1');
  const t1Events = stream.getHistory({ taskId: 'T1' });
  assert.equal(t1Events.length, 2);
});

test('getHistory with limit returns last N', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  for (let i = 0; i < 10; i++) stream.taskStarted(`T${i}`);
  const last3 = stream.getHistory({ limit: 3 });
  assert.equal(last3.length, 3);
  assert.equal(last3[0].taskId, 'T7');
});

// ── Stats ────────────────────────────────────────────────────────────────────

test('getStats counts events by type', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  stream.taskStarted('T1');
  stream.gatePassed('T1', 'g1');
  stream.gateFailed('T1', 'g2');
  stream.taskCompleted('T1');
  const stats = stream.getStats();
  assert.equal(stats.total, 4);
  assert.equal(stats.byType['task.started'], 1);
  assert.equal(stats.byType['gate.passed'], 1);
  assert.equal(stats.byType['gate.failed'], 1);
});

// ── Default featureSlug ──────────────────────────────────────────────────────

test('default featureSlug applied to all events', () => {
  const stream = createExecutionStream({ persistToAudit: false, featureSlug: 'auth-flow' });
  const event = stream.taskStarted('T1');
  assert.equal(event.featureSlug, 'auth-flow');
});

test('per-event featureSlug overrides default', () => {
  const stream = createExecutionStream({ persistToAudit: false, featureSlug: 'default' });
  const event = stream.compileStarted('custom-slug');
  assert.equal(event.featureSlug, 'custom-slug');
});

// ── formatEventForLog ────────────────────────────────────────────────────────

test('formatEventForLog produces readable one-liner', () => {
  const event = { type: 'gate.failed', timestamp: '2026-03-04T14:30:15.000Z', taskId: 'T1', gate: 'type-check', passed: false };
  const line = formatEventForLog(event);
  assert.ok(line.includes('14:30:15'));
  assert.ok(line.includes('gate.failed'));
  assert.ok(line.includes('T1'));
  assert.ok(line.includes('type-check'));
  assert.ok(line.includes('FAIL'));
});

test('formatEventForLog handles null gracefully', () => {
  assert.ok(formatEventForLog(null).includes('empty'));
});

test('formatEventForLog shows duration and error', () => {
  const event = { type: 'task.failed', timestamp: '2026-03-04T10:00:00Z', taskId: 'X', durationMs: 1200, error: 'timeout' };
  const line = formatEventForLog(event);
  assert.ok(line.includes('1200ms'));
  assert.ok(line.includes('timeout'));
});

// ── Ring buffer cap ──────────────────────────────────────────────────────────

test('history caps at 500 events', () => {
  const stream = createExecutionStream({ persistToAudit: false });
  for (let i = 0; i < 600; i++) stream.taskStarted(`T${i}`);
  const history = stream.getHistory();
  assert.equal(history.length, 500);
  assert.equal(history[0].taskId, 'T100');
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
