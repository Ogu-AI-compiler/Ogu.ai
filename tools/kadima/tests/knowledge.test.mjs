import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TMP = join(tmpdir(), `knowledge-test-${randomUUID().slice(0, 8)}`);

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, '.ogu/state'), { recursive: true });
  mkdirSync(join(TMP, '.ogu/runners'), { recursive: true });
  mkdirSync(join(TMP, '.ogu/memory'), { recursive: true });
  mkdirSync(join(TMP, '.ogu/audit'), { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

function writeOutput(taskId, output) {
  writeFileSync(
    join(TMP, `.ogu/runners/${taskId}.output.json`),
    JSON.stringify(output),
    'utf8'
  );
}

function writeFabric(entries) {
  writeFileSync(
    join(TMP, '.ogu/memory/fabric.json'),
    JSON.stringify({ entries }),
    'utf8'
  );
}

function readFabric() {
  const p = join(TMP, '.ogu/memory/fabric.json');
  if (!existsSync(p)) return { entries: [] };
  return JSON.parse(readFileSync(p, 'utf8'));
}

function readKnowledgeState() {
  const p = join(TMP, '.ogu/state/knowledge-state.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

// Emit audit events to a file (mock that daemon.mjs emitAudit does)
const auditEvents = [];
function mockEmitAudit(type, payload) {
  auditEvents.push({ type, payload, timestamp: new Date().toISOString() });
}

const { createKnowledgeLoop } = await import('../loops/knowledge.mjs');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    setup();
    auditEvents.length = 0;
    await fn();
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

console.log('\n  knowledge.mjs (loop)\n');

// ── Loop interface ──

await test('createKnowledgeLoop returns standard loop interface', async () => {
  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  assert.equal(loop.name, 'knowledge');
  assert.equal(typeof loop.isRunning, 'boolean');
  assert.equal(typeof loop.stop, 'function');
  assert.equal(typeof loop.forceTick, 'function');
  assert.equal(loop.isRunning, true);
  assert.equal(loop.tickCount, 0);
  assert.equal(loop.lastTick, null);
  loop.stop();
  assert.equal(loop.isRunning, false);
});

// ── Empty state ──

await test('forceTick with no outputs produces no entries', async () => {
  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick();
  loop.stop();

  assert.equal(loop.tickCount, 1);
  assert.ok(loop.lastTick);
  const fabric = readFabric();
  assert.equal(fabric.entries.length, 0);
});

// ── Pattern extraction from task outputs ──

await test('indexes cost pattern from task output', async () => {
  writeOutput('task-cost-1', {
    roleId: 'developer',
    cost: { totalCost: 0.15, model: 'claude-sonnet', totalTokens: 5000 },
    startedAt: '2026-02-28T10:00:00Z',
    completedAt: '2026-02-28T10:01:00Z',
  });

  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick();
  loop.stop();

  const fabric = readFabric();
  assert.ok(fabric.entries.length > 0);
  const costEntry = fabric.entries.find(e => e.tags.includes('cost'));
  assert.ok(costEntry, 'Should have a cost entry');
  assert.ok(costEntry.content.includes('$0.15'));
  assert.equal(costEntry.category, 'insight');
});

await test('indexes retry/error pattern from task output', async () => {
  writeOutput('task-retry-1', {
    roleId: 'reviewer',
    retries: 3,
    error: 'rate_limit_exceeded',
    result: 'completed after retries',
    startedAt: '2026-02-28T10:00:00Z',
    completedAt: '2026-02-28T10:02:00Z',
  });

  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick();
  loop.stop();

  const fabric = readFabric();
  const errorEntry = fabric.entries.find(e => e.tags.includes('error-recovery'));
  assert.ok(errorEntry, 'Should have an error-recovery entry');
  assert.ok(errorEntry.content.includes('3 retries'));
  assert.equal(errorEntry.category, 'error');
});

await test('indexes file output pattern from task output', async () => {
  writeOutput('task-files-1', {
    roleId: 'developer',
    result: 'done',
    files: [
      { path: 'src/api/auth.ts', action: 'created' },
      { path: 'src/api/auth.test.ts', action: 'created' },
    ],
    startedAt: '2026-02-28T10:00:00Z',
    completedAt: '2026-02-28T10:01:00Z',
  });

  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick();
  loop.stop();

  const fabric = readFabric();
  const filesEntry = fabric.entries.find(e => e.tags.includes('output-files'));
  assert.ok(filesEntry, 'Should have output-files entry');
  assert.ok(filesEntry.content.includes('2 files'));
});

await test('indexes duration pattern from task output', async () => {
  writeOutput('task-dur-1', {
    roleId: 'architect',
    startedAt: '2026-02-28T10:00:00Z',
    completedAt: '2026-02-28T10:05:00Z',
  });

  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick();
  loop.stop();

  const fabric = readFabric();
  const durEntry = fabric.entries.find(e => e.tags.includes('duration'));
  assert.ok(durEntry, 'Should have duration entry');
  assert.ok(durEntry.content.includes('300s'));
});

// ── Idempotency ──

await test('does not re-index already indexed tasks', async () => {
  writeOutput('task-idem-1', {
    roleId: 'dev',
    cost: { totalCost: 0.1, model: 'test', totalTokens: 100 },
    startedAt: '2026-02-28T10:00:00Z',
    completedAt: '2026-02-28T10:01:00Z',
  });

  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });

  await loop.forceTick();
  const afterFirst = readFabric().entries.length;

  await loop.forceTick();
  const afterSecond = readFabric().entries.length;

  loop.stop();

  assert.equal(afterFirst, afterSecond, 'Second tick should not add more entries');
});

// ── Knowledge state persistence ──

await test('saves knowledge state to disk', async () => {
  writeOutput('task-state-1', {
    roleId: 'dev',
    startedAt: '2026-02-28T10:00:00Z',
    completedAt: '2026-02-28T10:01:00Z',
  });

  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick();
  loop.stop();

  const state = readKnowledgeState();
  assert.ok(state);
  assert.ok(state.indexedTasks.includes('task-state-1'));
  assert.ok(state.totalIndexed >= 1);
});

// ── Audit emission ──

await test('emits knowledge.indexed audit event when entries added', async () => {
  writeOutput('task-audit-1', {
    roleId: 'dev',
    cost: { totalCost: 0.5, model: 'test', totalTokens: 1000 },
    startedAt: '2026-02-28T10:00:00Z',
    completedAt: '2026-02-28T10:01:00Z',
  });

  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick();
  loop.stop();

  const indexEvent = auditEvents.find(e => e.type === 'knowledge.indexed');
  assert.ok(indexEvent, 'Should emit knowledge.indexed event');
  assert.ok(indexEvent.payload.indexed > 0);
});

await test('does not emit audit event when nothing indexed', async () => {
  // No outputs to index
  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick();
  loop.stop();

  const indexEvent = auditEvents.find(e => e.type === 'knowledge.indexed');
  assert.ok(!indexEvent, 'Should not emit when nothing indexed');
});

// ── lastReport ──

await test('lastReport reflects tick results', async () => {
  writeOutput('task-report-1', {
    roleId: 'dev',
    cost: { totalCost: 0.1, model: 'x', totalTokens: 100 },
    startedAt: '2026-02-28T10:00:00Z',
    completedAt: '2026-02-28T10:01:00Z',
  });

  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick();
  loop.stop();

  const report = loop.lastReport;
  assert.ok(report);
  assert.ok(report.indexed > 0);
  assert.ok(report.timestamp);
  assert.equal(report.unindexedFound, 1);
});

// ── Handles errors gracefully ──

await test('gracefully handles missing runners dir', async () => {
  rmSync(join(TMP, '.ogu/runners'), { recursive: true, force: true });
  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick(); // should not throw
  loop.stop();
  assert.equal(loop.tickCount, 1);
});

await test('gracefully handles corrupt output file', async () => {
  writeFileSync(join(TMP, '.ogu/runners/corrupt.output.json'), 'not-json', 'utf8');
  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick(); // should not throw
  loop.stop();
  assert.equal(loop.tickCount, 1);
});

// ── Multiple task outputs ──

await test('indexes multiple task outputs in one tick', async () => {
  writeOutput('multi-1', {
    roleId: 'dev',
    cost: { totalCost: 0.1, model: 'a', totalTokens: 100 },
    startedAt: '2026-02-28T10:00:00Z',
    completedAt: '2026-02-28T10:01:00Z',
  });
  writeOutput('multi-2', {
    roleId: 'reviewer',
    cost: { totalCost: 0.2, model: 'b', totalTokens: 200 },
    startedAt: '2026-02-28T10:01:00Z',
    completedAt: '2026-02-28T10:02:00Z',
  });
  writeOutput('multi-3', {
    roleId: 'qa',
    retries: 2,
    error: 'timeout',
    result: 'ok',
    startedAt: '2026-02-28T10:02:00Z',
    completedAt: '2026-02-28T10:03:00Z',
  });

  const loop = createKnowledgeLoop({ root: TMP, intervalMs: 999999, emitAudit: mockEmitAudit });
  await loop.forceTick();
  loop.stop();

  const state = readKnowledgeState();
  assert.ok(state.indexedTasks.includes('multi-1'));
  assert.ok(state.indexedTasks.includes('multi-2'));
  assert.ok(state.indexedTasks.includes('multi-3'));

  const fabric = readFabric();
  assert.ok(fabric.entries.length >= 3, `Expected >= 3 entries, got ${fabric.entries.length}`);
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
