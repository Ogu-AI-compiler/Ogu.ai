/**
 * Slice 435 — Studio Execution Feed
 * Tests execution feed API endpoints, WS event types, and SSE forwarding.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 435: Studio Execution Feed ===\n');

// ── Router imports execution-event-stream ────────────────────────────────────

test('router.ts imports createExecutionStream', () => {
  const routerSrc = readFileSync(join(process.cwd(), 'tools/studio/server/api/router.ts'), 'utf8');
  assert.ok(routerSrc.includes('createExecutionStream'));
  assert.ok(routerSrc.includes('EXECUTION_EVENTS'));
  assert.ok(routerSrc.includes('execution-event-stream'));
});

// ── Execution feed endpoints exist ───────────────────────────────────────────

test('router has GET /execution/feed endpoint', () => {
  const routerSrc = readFileSync(join(process.cwd(), 'tools/studio/server/api/router.ts'), 'utf8');
  assert.ok(routerSrc.includes('"/execution/feed"'));
});

test('router has GET /execution/stats endpoint', () => {
  const routerSrc = readFileSync(join(process.cwd(), 'tools/studio/server/api/router.ts'), 'utf8');
  assert.ok(routerSrc.includes('"/execution/stats"'));
});

test('router has GET /execution/events endpoint', () => {
  const routerSrc = readFileSync(join(process.cwd(), 'tools/studio/server/api/router.ts'), 'utf8');
  assert.ok(routerSrc.includes('"/execution/events"'));
});

test('router has POST /execution/emit endpoint', () => {
  const routerSrc = readFileSync(join(process.cwd(), 'tools/studio/server/api/router.ts'), 'utf8');
  assert.ok(routerSrc.includes('"/execution/emit"'));
});

// ── Feed endpoint supports filters ──────────────────────────────────────────

test('feed endpoint parses type, taskId, feature, since, limit filters', () => {
  const routerSrc = readFileSync(join(process.cwd(), 'tools/studio/server/api/router.ts'), 'utf8');
  // Find the execution/feed handler block
  const feedIdx = routerSrc.indexOf('"/execution/feed"');
  const block = routerSrc.slice(feedIdx, feedIdx + 500);
  assert.ok(block.includes('type'));
  assert.ok(block.includes('taskId'));
  assert.ok(block.includes('feature'));
  assert.ok(block.includes('since'));
  assert.ok(block.includes('limit'));
});

// ── SSE forwarding ───────────────────────────────────────────────────────────

test('executionStream forwards events to SSE via sseEmitter.broadcast', () => {
  const routerSrc = readFileSync(join(process.cwd(), 'tools/studio/server/api/router.ts'), 'utf8');
  assert.ok(routerSrc.includes('executionStream.on("*"'));
  assert.ok(routerSrc.includes('sseEmitter.broadcast'));
});

// ── WS event types include execution events ──────────────────────────────────

test('events.ts has execution:task.started type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:task.started"'));
});

test('events.ts has execution:task.completed type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:task.completed"'));
});

test('events.ts has execution:task.failed type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:task.failed"'));
});

test('events.ts has execution:gate.checking type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:gate.checking"'));
});

test('events.ts has execution:gate.passed type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:gate.passed"'));
});

test('events.ts has execution:gate.failed type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:gate.failed"'));
});

test('events.ts has execution:retry.started type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:retry.started"'));
});

test('events.ts has execution:compile.started type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:compile.started"'));
});

test('events.ts has execution:compile.finished type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:compile.finished"'));
});

test('events.ts has execution:escalation.triggered type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:escalation.triggered"'));
});

test('events.ts has execution:feedback.created type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:feedback.created"'));
});

test('events.ts has execution:learning.candidate type', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'tools/studio/server/ws/events.ts'), 'utf8');
  assert.ok(eventsSrc.includes('"execution:learning.candidate"'));
});

// ── Execution stream works in isolation ──────────────────────────────────────

import { createExecutionStream as createStream } from '../../tools/ogu/commands/lib/execution-event-stream.mjs';

test('createExecutionStream: feed returns emitted events', () => {
  const stream = createStream({ persistToAudit: false });

  stream.taskStarted('T1', { roleId: 'backend' });
  stream.gatePassed('T1', 'type-check');
  stream.taskCompleted('T1', { durationMs: 1000 });

  const feed = stream.getHistory();
  assert.equal(feed.length, 3);
  assert.equal(feed[0].type, 'task.started');
  assert.equal(feed[1].type, 'gate.passed');
  assert.equal(feed[2].type, 'task.completed');
});

test('createExecutionStream: filter by taskId', () => {
  const stream = createStream({ persistToAudit: false });

  stream.taskStarted('T1');
  stream.taskStarted('T2');
  stream.gatePassed('T1', 'g1');

  const t1Events = stream.getHistory({ taskId: 'T1' });
  assert.equal(t1Events.length, 2);
});

test('createExecutionStream: stats count by type', () => {
  const stream = createStream({ persistToAudit: false });

  stream.gateFailed('T1', 'type-check');
  stream.gateFailed('T1', 'tests-pass');
  stream.gatePassed('T1', 'lint-pass');

  const stats = stream.getStats();
  assert.equal(stats.byType['gate.failed'], 2);
  assert.equal(stats.byType['gate.passed'], 1);
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
