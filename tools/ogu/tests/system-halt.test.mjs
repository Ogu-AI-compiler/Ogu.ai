import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TMP = join(tmpdir(), `system-halt-test-${randomUUID().slice(0, 8)}`);

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, '.ogu/state'), { recursive: true });
  mkdirSync(join(TMP, '.ogu/audit'), { recursive: true });
  // Write valid STATE.json (not halted)
  writeFileSync(join(TMP, '.ogu/STATE.json'), JSON.stringify({ halted: false }), 'utf8');
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

const origRoot = process.env.OGU_ROOT;
process.env.OGU_ROOT = TMP;

const { halt, resume, getSystemHealth, getHaltLog } = await import('../commands/lib/system-halt.mjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    setup();
    fn();
    teardown();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    teardown();
  }
}

console.log('\n  system-halt.mjs\n');

// ── halt ──

test('halt marks STATE.json as halted', () => {
  const result = halt(TMP, { reason: 'test halt', actor: 'test-user' });
  assert.equal(result.halted, true);

  const state = JSON.parse(readFileSync(join(TMP, '.ogu/STATE.json'), 'utf8'));
  assert.equal(state.halted, true);
  assert.equal(state.frozen, true);
  assert.equal(state.haltRecord.reason, 'test halt');
  assert.equal(state.haltRecord.actor, 'test-user');
  assert.ok(state.haltRecord.haltedAt);
});

test('halt checkpoints dispatched tasks', () => {
  // Create scheduler state with dispatched task
  writeFileSync(join(TMP, '.ogu/state/scheduler-state.json'), JSON.stringify({
    version: 2,
    queue: [
      { taskId: 'task-1', featureSlug: 'auth', status: 'dispatched', scheduledAt: '2026-02-28T10:00:00Z' },
      { taskId: 'task-2', featureSlug: 'auth', status: 'pending' },
    ],
  }), 'utf8');

  const result = halt(TMP, { reason: 'test', actor: 'user' });
  assert.equal(result.halted, true);
  assert.equal(result.checkpoints, 1);

  // Check checkpoint file was created
  assert.ok(existsSync(join(TMP, '.ogu/checkpoints/task-1.checkpoint.json')));
  const checkpoint = JSON.parse(readFileSync(join(TMP, '.ogu/checkpoints/task-1.checkpoint.json'), 'utf8'));
  assert.equal(checkpoint.taskId, 'task-1');
  assert.equal(checkpoint.reason, 'system_halt');
  assert.equal(checkpoint.previousStatus, 'dispatched');

  // Check scheduler state is halted
  const schedulerState = JSON.parse(readFileSync(join(TMP, '.ogu/state/scheduler-state.json'), 'utf8'));
  assert.equal(schedulerState.halted, true);
  const task1 = schedulerState.queue.find(t => t.taskId === 'task-1');
  assert.equal(task1.status, 'halted');
});

test('halt releases resource slots', () => {
  mkdirSync(join(TMP, '.ogu/locks'), { recursive: true });
  writeFileSync(join(TMP, '.ogu/locks/active.json'), JSON.stringify({
    slots: [{ taskId: 'task-1', resource: 'model_call' }, { taskId: 'task-2', resource: 'file_write' }],
  }), 'utf8');

  const result = halt(TMP, { reason: 'test', actor: 'user' });
  assert.equal(result.resourcesReleased, 2);

  const active = JSON.parse(readFileSync(join(TMP, '.ogu/locks/active.json'), 'utf8'));
  assert.deepEqual(active.slots, []);
});

test('halt writes halt log entry', () => {
  halt(TMP, { reason: 'logged halt', actor: 'user', domain: 'FD-AUDIT' });
  const log = getHaltLog(TMP);
  assert.equal(log.length, 1);
  assert.equal(log[0].action, 'halt');
  assert.equal(log[0].reason, 'logged halt');
  assert.equal(log[0].domain, 'FD-AUDIT');
});

test('halt emits audit event', () => {
  halt(TMP, { reason: 'audit test', actor: 'user' });
  const auditFile = join(TMP, '.ogu/audit/current.jsonl');
  assert.ok(existsSync(auditFile));
  const content = readFileSync(auditFile, 'utf8');
  assert.ok(content.includes('system.halt'));
});

test('halt is idempotent (cannot halt twice)', () => {
  halt(TMP, { reason: 'first halt', actor: 'user' });
  const result = halt(TMP, { reason: 'second halt', actor: 'user' });
  assert.equal(result.halted, false);
  assert.ok(result.reason.includes('already halted'));
});

test('halt with domain context', () => {
  halt(TMP, { reason: 'filesystem failure', actor: 'circuit-breaker', domain: 'FD-FILESYSTEM' });
  const state = JSON.parse(readFileSync(join(TMP, '.ogu/STATE.json'), 'utf8'));
  assert.equal(state.haltRecord.domain, 'FD-FILESYSTEM');
});

// ── resume ──

test('resume requires system to be halted', () => {
  const result = resume(TMP, { actor: 'user' });
  assert.equal(result.resumed, false);
  assert.ok(result.reason.includes('not halted'));
});

test('resume requires actor', () => {
  halt(TMP, { reason: 'test', actor: 'user' });
  const result = resume(TMP, {});
  assert.equal(result.resumed, false);
  assert.ok(result.reason.includes('actor'));
});

test('resume restores system after halt', () => {
  halt(TMP, { reason: 'test', actor: 'user' });
  const result = resume(TMP, { actor: 'admin' });
  assert.equal(result.resumed, true);

  const state = JSON.parse(readFileSync(join(TMP, '.ogu/STATE.json'), 'utf8'));
  assert.equal(state.halted, false);
  assert.equal(state.frozen, false);
  assert.equal(state.haltRecord.resumedBy, 'admin');
  assert.ok(state.haltRecord.resumedAt);
});

test('resume restores halted tasks to pending', () => {
  writeFileSync(join(TMP, '.ogu/state/scheduler-state.json'), JSON.stringify({
    version: 2,
    queue: [
      { taskId: 'task-1', status: 'dispatched' },
      { taskId: 'task-2', status: 'pending' },
    ],
  }), 'utf8');

  halt(TMP, { reason: 'test', actor: 'user' });
  resume(TMP, { actor: 'admin' });

  const schedulerState = JSON.parse(readFileSync(join(TMP, '.ogu/state/scheduler-state.json'), 'utf8'));
  assert.equal(schedulerState.halted, false);
  const task1 = schedulerState.queue.find(t => t.taskId === 'task-1');
  assert.equal(task1.status, 'pending');
});

test('resume writes halt log entry', () => {
  halt(TMP, { reason: 'test', actor: 'user' });
  resume(TMP, { actor: 'admin', approvalRecord: 'APPROVAL-001' });
  const log = getHaltLog(TMP);
  assert.equal(log.length, 2);
  assert.equal(log[1].action, 'resume');
  assert.equal(log[1].actor, 'admin');
  assert.equal(log[1].approvalRecord, 'APPROVAL-001');
});

test('resume emits audit event', () => {
  halt(TMP, { reason: 'test', actor: 'user' });
  resume(TMP, { actor: 'admin' });
  const content = readFileSync(join(TMP, '.ogu/audit/current.jsonl'), 'utf8');
  assert.ok(content.includes('system.resume'));
});

test('resume fails if STATE.json is corrupted', () => {
  halt(TMP, { reason: 'test', actor: 'user' });
  writeFileSync(join(TMP, '.ogu/STATE.json'), '{bad-json', 'utf8');
  const result = resume(TMP, { actor: 'admin' });
  // Cannot read halted state from corrupt file
  assert.equal(result.resumed, false);
});

// ── getSystemHealth ──

test('getSystemHealth returns HEALTHY when system is normal', () => {
  const health = getSystemHealth(TMP);
  assert.equal(health.overallHealth, 'HEALTHY');
  assert.equal(health.halted, false);
  assert.equal(health.frozen, false);
});

test('getSystemHealth returns HALTED when system is halted', () => {
  halt(TMP, { reason: 'test', actor: 'user' });
  const health = getSystemHealth(TMP);
  assert.equal(health.overallHealth, 'HALTED');
  assert.equal(health.halted, true);
  assert.ok(health.haltRecord);
  assert.equal(health.haltRecord.reason, 'test');
});

test('getSystemHealth includes freeze and domain fields', () => {
  const health = getSystemHealth(TMP);
  // Structure check — frozen/domains are present regardless of value
  assert.equal(typeof health.frozen, 'boolean');
  assert.ok(Array.isArray(health.activeDegradedModes));
  assert.ok(Array.isArray(health.domains));
});

// ── getHaltLog ──

test('getHaltLog returns empty when no log', () => {
  const log = getHaltLog(TMP);
  assert.deepEqual(log, []);
});

test('getHaltLog returns all entries in order', () => {
  halt(TMP, { reason: 'first', actor: 'user' });
  resume(TMP, { actor: 'admin' });
  halt(TMP, { reason: 'second', actor: 'user' });

  const log = getHaltLog(TMP);
  assert.equal(log.length, 3);
  assert.equal(log[0].action, 'halt');
  assert.equal(log[0].reason, 'first');
  assert.equal(log[1].action, 'resume');
  assert.equal(log[2].action, 'halt');
  assert.equal(log[2].reason, 'second');
});

// Cleanup
if (origRoot === undefined) delete process.env.OGU_ROOT;
else process.env.OGU_ROOT = origRoot;

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
