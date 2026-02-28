import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TMP = join(tmpdir(), `audit-test-${randomUUID().slice(0, 8)}`);
const AUDIT_DIR = join(TMP, '.ogu/audit');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(AUDIT_DIR, { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

function writeEvent(event) {
  appendFileSync(join(AUDIT_DIR, 'current.jsonl'), JSON.stringify(event) + '\n', 'utf8');
}

function makeEvent(overrides = {}) {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'test.event',
    severity: 'info',
    source: 'test',
    actor: { type: 'system', id: 'test-runner' },
    payload: {},
    ...overrides,
  };
}

const {
  loadAuditLog, loadDailyLog, loadIndex, queryAudit,
  analyzeAudit, replayAuditChain, archiveAuditLog, listAuditLogs,
} = await import('../lib/audit.mjs');

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
  }
}

console.log('\n  audit.mjs\n');

// ── loadAuditLog ──

test('loadAuditLog returns empty array when no file', () => {
  const events = loadAuditLog(TMP);
  assert.deepEqual(events, []);
});

test('loadAuditLog reads events from current.jsonl', () => {
  const e1 = makeEvent({ type: 'a' });
  const e2 = makeEvent({ type: 'b' });
  writeEvent(e1);
  writeEvent(e2);
  const events = loadAuditLog(TMP);
  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'a');
  assert.equal(events[1].type, 'b');
});

test('loadAuditLog skips corrupt lines', () => {
  writeEvent(makeEvent());
  appendFileSync(join(AUDIT_DIR, 'current.jsonl'), 'not-json\n', 'utf8');
  writeEvent(makeEvent());
  const events = loadAuditLog(TMP);
  assert.equal(events.length, 2);
});

// ── loadDailyLog ──

test('loadDailyLog returns events from date-specific file', () => {
  const e = makeEvent();
  writeFileSync(join(AUDIT_DIR, '2026-02-28.jsonl'), JSON.stringify(e) + '\n', 'utf8');
  const events = loadDailyLog(TMP, '2026-02-28');
  assert.equal(events.length, 1);
  assert.equal(events[0].id, e.id);
});

test('loadDailyLog returns empty for missing date', () => {
  const events = loadDailyLog(TMP, '1999-01-01');
  assert.deepEqual(events, []);
});

// ── loadIndex ──

test('loadIndex returns defaults when no index file', () => {
  const idx = loadIndex(TMP);
  assert.equal(idx.total, 0);
  assert.deepEqual(idx.byType, {});
});

test('loadIndex reads existing index', () => {
  writeFileSync(join(AUDIT_DIR, 'index.json'), JSON.stringify({
    total: 5, byType: { 'compile.start': 3 }, byFeature: {}, byDay: {},
  }), 'utf8');
  const idx = loadIndex(TMP);
  assert.equal(idx.total, 5);
  assert.equal(idx.byType['compile.start'], 3);
});

// ── queryAudit ──

test('queryAudit filters by type', () => {
  writeEvent(makeEvent({ type: 'compile.start' }));
  writeEvent(makeEvent({ type: 'compile.done' }));
  writeEvent(makeEvent({ type: 'agent.started' }));
  const results = queryAudit(TMP, { type: 'compile.start' });
  assert.equal(results.length, 1);
  assert.equal(results[0].type, 'compile.start');
});

test('queryAudit filters by typePrefix', () => {
  writeEvent(makeEvent({ type: 'compile.start' }));
  writeEvent(makeEvent({ type: 'compile.done' }));
  writeEvent(makeEvent({ type: 'agent.started' }));
  const results = queryAudit(TMP, { typePrefix: 'compile.' });
  assert.equal(results.length, 2);
});

test('queryAudit filters by source', () => {
  writeEvent(makeEvent({ source: 'kadima' }));
  writeEvent(makeEvent({ source: 'cli' }));
  const results = queryAudit(TMP, { source: 'kadima' });
  assert.equal(results.length, 1);
  assert.equal(results[0].source, 'kadima');
});

test('queryAudit filters by severity', () => {
  writeEvent(makeEvent({ severity: 'info' }));
  writeEvent(makeEvent({ severity: 'error' }));
  writeEvent(makeEvent({ severity: 'critical' }));
  const results = queryAudit(TMP, { severity: 'error' });
  assert.equal(results.length, 1);
});

test('queryAudit filters by feature', () => {
  writeEvent(makeEvent({ feature: 'auth' }));
  writeEvent(makeEvent({ feature: 'payments' }));
  const results = queryAudit(TMP, { feature: 'auth' });
  assert.equal(results.length, 1);
  assert.equal(results[0].feature, 'auth');
});

test('queryAudit filters by actorId', () => {
  writeEvent(makeEvent({ actor: { type: 'agent', id: 'agent-001' } }));
  writeEvent(makeEvent({ actor: { type: 'agent', id: 'agent-002' } }));
  const results = queryAudit(TMP, { actorId: 'agent-001' });
  assert.equal(results.length, 1);
});

test('queryAudit filters by time range', () => {
  writeEvent(makeEvent({ timestamp: '2026-02-27T10:00:00Z' }));
  writeEvent(makeEvent({ timestamp: '2026-02-28T10:00:00Z' }));
  writeEvent(makeEvent({ timestamp: '2026-03-01T10:00:00Z' }));
  const results = queryAudit(TMP, { since: '2026-02-28T00:00:00Z', until: '2026-03-01T00:00:00Z' });
  assert.equal(results.length, 1);
  assert.ok(results[0].timestamp.startsWith('2026-02-28'));
});

test('queryAudit respects limit', () => {
  for (let i = 0; i < 10; i++) writeEvent(makeEvent());
  const results = queryAudit(TMP, { limit: 3 });
  assert.equal(results.length, 3);
});

test('queryAudit with no filters returns all (up to limit)', () => {
  for (let i = 0; i < 5; i++) writeEvent(makeEvent());
  const results = queryAudit(TMP, {});
  assert.equal(results.length, 5);
});

// ── analyzeAudit ──

test('analyzeAudit on empty events', () => {
  const result = analyzeAudit([]);
  assert.equal(result.total, 0);
  assert.equal(result.errorRate, 0);
  assert.equal(result.timeRange, null);
});

test('analyzeAudit computes byType counts', () => {
  const events = [
    makeEvent({ type: 'compile.start' }),
    makeEvent({ type: 'compile.start' }),
    makeEvent({ type: 'agent.started' }),
  ];
  const result = analyzeAudit(events);
  assert.equal(result.total, 3);
  assert.equal(result.byType['compile.start'], 2);
  assert.equal(result.byType['agent.started'], 1);
});

test('analyzeAudit computes bySeverity', () => {
  const events = [
    makeEvent({ severity: 'info' }),
    makeEvent({ severity: 'error' }),
    makeEvent({ severity: 'critical' }),
  ];
  const result = analyzeAudit(events);
  assert.equal(result.bySeverity.info, 1);
  assert.equal(result.bySeverity.error, 1);
  assert.equal(result.bySeverity.critical, 1);
});

test('analyzeAudit computes errorRate', () => {
  const events = [
    makeEvent({ severity: 'info' }),
    makeEvent({ severity: 'info' }),
    makeEvent({ severity: 'error' }),
    makeEvent({ severity: 'critical' }),
  ];
  const result = analyzeAudit(events);
  assert.equal(result.errorRate, 0.5); // 2/4
});

test('analyzeAudit computes timeRange', () => {
  const events = [
    makeEvent({ timestamp: '2026-02-27T10:00:00Z' }),
    makeEvent({ timestamp: '2026-02-28T15:00:00Z' }),
    makeEvent({ timestamp: '2026-02-28T10:00:00Z' }),
  ];
  const result = analyzeAudit(events);
  assert.equal(result.timeRange.from, '2026-02-27T10:00:00Z');
  assert.equal(result.timeRange.to, '2026-02-28T15:00:00Z');
});

test('analyzeAudit computes topActors', () => {
  const events = [
    makeEvent({ actor: { type: 'agent', id: 'a1' } }),
    makeEvent({ actor: { type: 'agent', id: 'a1' } }),
    makeEvent({ actor: { type: 'agent', id: 'a2' } }),
  ];
  const result = analyzeAudit(events);
  assert.equal(result.topActors[0].id, 'a1');
  assert.equal(result.topActors[0].count, 2);
});

test('analyzeAudit computes byFeature', () => {
  const events = [
    makeEvent({ feature: 'auth' }),
    makeEvent({ feature: 'auth' }),
    makeEvent({ feature: 'pay' }),
    makeEvent({}),
  ];
  const result = analyzeAudit(events);
  assert.equal(result.byFeature['auth'], 2);
  assert.equal(result.byFeature['pay'], 1);
});

// ── replayAuditChain ──

test('replayAuditChain builds chain from parentEventId links', () => {
  const id1 = randomUUID();
  const id2 = randomUUID();
  const id3 = randomUUID();
  writeEvent(makeEvent({ id: id1, type: 'step1' }));
  writeEvent(makeEvent({ id: id2, type: 'step2', parentEventId: id1 }));
  writeEvent(makeEvent({ id: id3, type: 'step3', parentEventId: id2 }));
  const chain = replayAuditChain(TMP, id1);
  assert.equal(chain.length, 3);
  assert.equal(chain[0].type, 'step1');
  assert.equal(chain[1].type, 'step2');
  assert.equal(chain[2].type, 'step3');
});

test('replayAuditChain returns empty for missing startId', () => {
  writeEvent(makeEvent());
  const chain = replayAuditChain(TMP, 'nonexistent');
  assert.deepEqual(chain, []);
});

test('replayAuditChain returns single event for no children', () => {
  const id = randomUUID();
  writeEvent(makeEvent({ id }));
  const chain = replayAuditChain(TMP, id);
  assert.equal(chain.length, 1);
});

// ── listAuditLogs ──

test('listAuditLogs returns empty for no audit dir', () => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const logs = listAuditLogs(TMP);
  assert.deepEqual(logs, []);
});

test('listAuditLogs lists daily log files', () => {
  writeFileSync(join(AUDIT_DIR, '2026-02-27.jsonl'), JSON.stringify(makeEvent()) + '\n', 'utf8');
  writeFileSync(join(AUDIT_DIR, '2026-02-28.jsonl'), JSON.stringify(makeEvent()) + '\n' + JSON.stringify(makeEvent()) + '\n', 'utf8');
  writeFileSync(join(AUDIT_DIR, 'current.jsonl'), '', 'utf8'); // should be excluded
  writeFileSync(join(AUDIT_DIR, 'index.json'), '{}', 'utf8'); // should be excluded

  const logs = listAuditLogs(TMP);
  assert.equal(logs.length, 2);
  assert.equal(logs[0].date, '2026-02-27');
  assert.equal(logs[0].eventCount, 1);
  assert.equal(logs[1].date, '2026-02-28');
  assert.equal(logs[1].eventCount, 2);
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
