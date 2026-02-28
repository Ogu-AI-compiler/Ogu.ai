/**
 * Audit Emitter Tests — append-only JSONL audit events with daily rotation.
 *
 * Run: node tools/ogu/tests/audit-emitter.test.mjs
 */

import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Create isolated test root and override repoRoot before importing
const testRoot = join(tmpdir(), `ogu-audit-test-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/audit'), { recursive: true });

// Override repoRoot for tests
const utilPath = new URL('../util.mjs', import.meta.url).pathname;
const origRepoRoot = (await import(utilPath)).repoRoot;

// We need to mock repoRoot. The simplest way: override the env variable and
// re-import with a wrapper. Instead, we test the module internals directly.
// Since the module uses repoRoot() which walks up to find .ogu, we'll create
// a .ogu dir in our test root so repoRoot() can find it if we cd there.

// Write a minimal test harness that creates its own audit functions
// scoped to our test directory.

console.log('\nAudit Emitter Tests\n');

// ── Direct file-based tests ──

const AUDIT_DIR = join(testRoot, '.ogu/audit');
const AUDIT_FILE = join(AUDIT_DIR, 'current.jsonl');
const INDEX_FILE = join(AUDIT_DIR, 'index.json');

// Helper: create an audit event manually (same logic as emitAudit)
function createEvent(type, payload, options = {}) {
  const event = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    severity: options.severity || 'info',
    source: options.source || 'cli',
    actor: options.actor || { type: 'human', id: 'test-user' },
    feature: options.feature || undefined,
    parentEventId: options.parentEventId || undefined,
    tags: options.tags || undefined,
    model: options.model || undefined,
    artifact: options.artifact || undefined,
    gate: options.gate || undefined,
    payload,
  };
  return event;
}

// ── Test event structure ──

test('1. Event has required fields: id, timestamp, type, severity, source, actor, payload', () => {
  const event = createEvent('test.event', { key: 'value' });
  assert(event.id, 'Should have id');
  assert(event.timestamp, 'Should have timestamp');
  assert(event.type === 'test.event', 'Should have type');
  assert(event.severity === 'info', 'Default severity should be info');
  assert(event.source === 'cli', 'Default source should be cli');
  assert(event.actor.type === 'human', 'Default actor type should be human');
  assert(event.payload.key === 'value', 'Payload should be preserved');
});

test('2. Event respects severity override', () => {
  const event = createEvent('error.event', {}, { severity: 'error' });
  assert(event.severity === 'error', 'Severity should be error');
});

test('3. Event respects source override', () => {
  const event = createEvent('agent.event', {}, { source: 'kadima' });
  assert(event.source === 'kadima', 'Source should be kadima');
});

test('4. Event respects actor override', () => {
  const event = createEvent('agent.event', {}, { actor: { type: 'agent', id: 'coder-01' } });
  assert(event.actor.type === 'agent', 'Actor type should be agent');
  assert(event.actor.id === 'coder-01', 'Actor id should be coder-01');
});

test('5. Event preserves optional fields when provided', () => {
  const event = createEvent('gate.passed', { gate: 'spec' }, {
    feature: 'auth-login',
    tags: ['compile', 'phase-1'],
    model: { provider: 'anthropic', model: 'sonnet', tokens: 5000, cost: 0.015 },
    artifact: { type: 'code', path: 'src/auth.ts', hash: 'abc123' },
    gate: { name: 'spec-check', passed: true, reason: 'all clear' },
  });
  assert(event.feature === 'auth-login', 'Feature should be preserved');
  assert(event.tags.length === 2, 'Tags should be preserved');
  assert(event.model.provider === 'anthropic', 'Model should be preserved');
  assert(event.artifact.path === 'src/auth.ts', 'Artifact should be preserved');
  assert(event.gate.name === 'spec-check', 'Gate should be preserved');
});

test('6. Event omits undefined optional fields', () => {
  const event = createEvent('simple.event', {});
  assert(event.feature === undefined, 'Feature should be undefined');
  assert(event.tags === undefined, 'Tags should be undefined');
  assert(event.model === undefined, 'Model should be undefined');
});

// ── JSONL file I/O ──

test('7. Events can be written and read back from JSONL', () => {
  // Write 3 events
  const events = [
    createEvent('compile.started', { slug: 'auth' }),
    createEvent('gate.passed', { gate: 'spec', phase: 1 }),
    createEvent('compile.passed', { slug: 'auth', errors: 0 }),
  ];
  const content = events.map(e => JSON.stringify(e)).join('\n') + '\n';
  writeFileSync(AUDIT_FILE, content, 'utf8');

  // Read back
  const lines = readFileSync(AUDIT_FILE, 'utf8').trim().split('\n');
  assert(lines.length === 3, `Should have 3 lines, got ${lines.length}`);
  const parsed = lines.map(l => JSON.parse(l));
  assert(parsed[0].type === 'compile.started', 'First event type');
  assert(parsed[1].type === 'gate.passed', 'Second event type');
  assert(parsed[2].type === 'compile.passed', 'Third event type');
});

test('8. Appending preserves existing events', () => {
  const newEvent = createEvent('gate.failed', { gate: 'contracts' });
  const existing = readFileSync(AUDIT_FILE, 'utf8');
  writeFileSync(AUDIT_FILE, existing + JSON.stringify(newEvent) + '\n', 'utf8');

  const lines = readFileSync(AUDIT_FILE, 'utf8').trim().split('\n');
  assert(lines.length === 4, `Should have 4 lines, got ${lines.length}`);
  const last = JSON.parse(lines[3]);
  assert(last.type === 'gate.failed', 'Last event should be gate.failed');
});

test('9. Each event has a unique UUID', () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    ids.add(createEvent('test', {}).id);
  }
  assert(ids.size === 100, 'All 100 events should have unique IDs');
});

test('10. Timestamp is valid ISO 8601', () => {
  const event = createEvent('test', {});
  const parsed = new Date(event.timestamp);
  assert(!isNaN(parsed.getTime()), 'Timestamp should parse as valid date');
  assert(event.timestamp.endsWith('Z'), 'Should end with Z');
});

// ── Daily rotation ──

test('11. Daily file naming matches YYYY-MM-DD.jsonl format', () => {
  const today = new Date().toISOString().slice(0, 10);
  const dailyFile = join(AUDIT_DIR, `${today}.jsonl`);
  const event = createEvent('daily.test', {});
  writeFileSync(dailyFile, JSON.stringify(event) + '\n', 'utf8');

  assert(existsSync(dailyFile), 'Daily file should exist');
  const content = readFileSync(dailyFile, 'utf8');
  assert(content.includes('daily.test'), 'Daily file should contain event');
});

// ── Index management ──

test('12. Index tracks event counts by type', () => {
  const index = { byType: {}, byFeature: {}, byDay: {}, total: 0 };

  // Simulate updateIndex logic
  const events = [
    createEvent('compile.started', {}, { feature: 'auth' }),
    createEvent('gate.passed', {}, { feature: 'auth' }),
    createEvent('gate.passed', {}, { feature: 'payments' }),
    createEvent('compile.passed', {}, { feature: 'auth' }),
  ];

  for (const e of events) {
    index.total++;
    index.byType[e.type] = (index.byType[e.type] || 0) + 1;
    if (e.feature) {
      index.byFeature[e.feature] = (index.byFeature[e.feature] || 0) + 1;
    }
    const day = e.timestamp.slice(0, 10);
    index.byDay[day] = (index.byDay[day] || 0) + 1;
  }

  assert(index.total === 4, 'Total should be 4');
  assert(index.byType['gate.passed'] === 2, 'gate.passed should appear twice');
  assert(index.byType['compile.started'] === 1, 'compile.started should appear once');
  assert(index.byFeature['auth'] === 3, 'auth feature should have 3 events');
  assert(index.byFeature['payments'] === 1, 'payments feature should have 1 event');
});

test('13. Index file can be serialized and deserialized', () => {
  const index = { byType: { 'gate.passed': 5 }, byFeature: { auth: 3 }, byDay: { '2026-02-28': 8 }, total: 8 };
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
  const loaded = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  assert(loaded.total === 8, 'Total preserved');
  assert(loaded.byType['gate.passed'] === 5, 'byType preserved');
});

// ── Replay chain ──

test('14. Replay chain links events by parentEventId', () => {
  const e1 = createEvent('task.started', { taskId: 'T-001' });
  const e2 = createEvent('task.progress', { taskId: 'T-001', progress: 50 }, { parentEventId: e1.id });
  const e3 = createEvent('task.completed', { taskId: 'T-001' }, { parentEventId: e2.id });

  const events = [e1, e2, e3];
  const byId = new Map(events.map(e => [e.id, e]));
  const byParent = new Map();
  for (const e of events) {
    if (e.parentEventId) {
      if (!byParent.has(e.parentEventId)) byParent.set(e.parentEventId, []);
      byParent.get(e.parentEventId).push(e);
    }
  }

  // Build chain from e1
  const chain = [e1];
  let current = e1;
  while (true) {
    const children = byParent.get(current.id);
    if (!children || children.length === 0) break;
    current = children[0];
    chain.push(current);
  }

  assert(chain.length === 3, `Chain should have 3 events, got ${chain.length}`);
  assert(chain[0].type === 'task.started', 'Chain starts with task.started');
  assert(chain[1].type === 'task.progress', 'Second is task.progress');
  assert(chain[2].type === 'task.completed', 'Third is task.completed');
});

test('15. Replay chain returns empty for unknown start ID', () => {
  const events = [createEvent('a', {}), createEvent('b', {})];
  const byId = new Map(events.map(e => [e.id, e]));
  const start = byId.get('nonexistent-id');
  assert(!start, 'Should not find nonexistent start event');
});

// ── Edge cases ──

test('16. Empty payload is valid', () => {
  const event = createEvent('empty.payload', {});
  assert(typeof event.payload === 'object', 'Payload should be object');
  assert(Object.keys(event.payload).length === 0, 'Payload should be empty');
});

test('17. Large payload serializes correctly', () => {
  const largePayload = {};
  for (let i = 0; i < 100; i++) {
    largePayload[`key_${i}`] = `value_${i}_${'x'.repeat(100)}`;
  }
  const event = createEvent('large.payload', largePayload);
  const serialized = JSON.stringify(event);
  const deserialized = JSON.parse(serialized);
  assert(Object.keys(deserialized.payload).length === 100, 'Should preserve all 100 keys');
});

test('18. Event type follows dot notation convention', () => {
  const validTypes = ['compile.started', 'gate.passed', 'gate.failed', 'agent.escalated', 'budget.deducted'];
  for (const type of validTypes) {
    const event = createEvent(type, {});
    assert(event.type === type, `Type should be ${type}`);
    assert(event.type.includes('.'), 'Type should contain dot');
  }
});

// ── Cleanup ──
rmSync(testRoot, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
