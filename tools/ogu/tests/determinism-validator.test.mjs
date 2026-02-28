import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TMP = join(tmpdir(), `determinism-test-${randomUUID().slice(0, 8)}`);

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, '.ogu/determinism'), { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

const {
  classifyOperation, validateDeterminism, compareOutputs,
  recordViolation, loadLedger, analyzeLedger,
} = await import('../commands/lib/determinism-validator.mjs');

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

console.log('\n  determinism-validator.mjs\n');

// ── classifyOperation ──

test('classifyOperation: random is non-deterministic', () => {
  assert.equal(classifyOperation({ type: 'random' }), 'non-deterministic');
});

test('classifyOperation: timestamp is non-deterministic', () => {
  assert.equal(classifyOperation({ type: 'timestamp' }), 'non-deterministic');
});

test('classifyOperation: uuid is non-deterministic', () => {
  assert.equal(classifyOperation({ type: 'uuid' }), 'non-deterministic');
});

test('classifyOperation: network is non-deterministic', () => {
  assert.equal(classifyOperation({ type: 'network' }), 'non-deterministic');
});

test('classifyOperation: math.random is non-deterministic', () => {
  assert.equal(classifyOperation({ type: 'math.random' }), 'non-deterministic');
});

test('classifyOperation: file_read is deterministic', () => {
  assert.equal(classifyOperation({ type: 'file_read' }), 'deterministic');
});

test('classifyOperation: compute is deterministic', () => {
  assert.equal(classifyOperation({ type: 'compute' }), 'deterministic');
});

// ── validateDeterminism ──

test('validateDeterminism: all deterministic ops pass', () => {
  const result = validateDeterminism({
    operations: [
      { type: 'file_read' },
      { type: 'compute' },
      { type: 'file_write' },
    ],
  });
  assert.equal(result.isDeterministic, true);
  assert.equal(result.violations.length, 0);
  assert.equal(result.totalOperations, 3);
});

test('validateDeterminism: detects non-deterministic ops', () => {
  const result = validateDeterminism({
    operations: [
      { type: 'file_read' },
      { type: 'random' },
      { type: 'compute' },
      { type: 'uuid' },
    ],
  });
  assert.equal(result.isDeterministic, false);
  assert.equal(result.violations.length, 2);
  assert.equal(result.violations[0].type, 'random');
  assert.equal(result.violations[0].index, 1);
  assert.equal(result.violations[1].type, 'uuid');
  assert.equal(result.violations[1].index, 3);
});

test('validateDeterminism: empty operations is deterministic', () => {
  const result = validateDeterminism({ operations: [] });
  assert.equal(result.isDeterministic, true);
  assert.equal(result.totalOperations, 0);
});

// ── compareOutputs ──

test('compareOutputs: identical files are deterministic', () => {
  const result = compareOutputs({
    expected: [{ path: 'a.ts', content: 'const x = 1;' }],
    actual: [{ path: 'a.ts', content: 'const x = 1;' }],
  });
  assert.equal(result.deterministic, true);
  assert.equal(result.overallScore, 1);
  assert.equal(result.fileResults[0].status, 'identical');
});

test('compareOutputs: extra file is non-deterministic', () => {
  const result = compareOutputs({
    expected: [{ path: 'a.ts', content: 'x' }],
    actual: [{ path: 'a.ts', content: 'x' }, { path: 'b.ts', content: 'y' }],
  });
  assert.equal(result.deterministic, false);
  const extra = result.fileResults.find(f => f.path === 'b.ts');
  assert.equal(extra.status, 'extra');
});

test('compareOutputs: missing file is non-deterministic', () => {
  const result = compareOutputs({
    expected: [{ path: 'a.ts', content: 'x' }, { path: 'b.ts', content: 'y' }],
    actual: [{ path: 'a.ts', content: 'x' }],
  });
  assert.equal(result.deterministic, false);
  const missing = result.fileResults.find(f => f.path === 'b.ts');
  assert.equal(missing.status, 'missing');
});

test('compareOutputs: empty sets are deterministic', () => {
  const result = compareOutputs({ expected: [], actual: [] });
  assert.equal(result.deterministic, true);
  assert.equal(result.overallScore, 1);
});

// ── recordViolation ──

test('recordViolation writes to ledger file', () => {
  const record = recordViolation(TMP, {
    taskId: 'task-1',
    featureSlug: 'auth',
    type: 'cosmetic',
    file: 'src/auth.ts',
    score: 0.85,
    details: 'Whitespace difference',
  });
  assert.ok(record.recordedAt);
  assert.equal(record.type, 'cosmetic');

  const ledgerPath = join(TMP, '.ogu/determinism/ledger.jsonl');
  assert.ok(existsSync(ledgerPath));
  const content = readFileSync(ledgerPath, 'utf8');
  assert.ok(content.includes('task-1'));
});

test('recordViolation appends (does not overwrite)', () => {
  recordViolation(TMP, { taskId: 't1', type: 'cosmetic' });
  recordViolation(TMP, { taskId: 't2', type: 'structural' });
  const lines = readFileSync(join(TMP, '.ogu/determinism/ledger.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
});

// ── loadLedger ──

test('loadLedger returns empty for no ledger file', () => {
  const entries = loadLedger(TMP);
  assert.deepEqual(entries, []);
});

test('loadLedger loads all entries', () => {
  recordViolation(TMP, { taskId: 't1', featureSlug: 'auth', type: 'cosmetic' });
  recordViolation(TMP, { taskId: 't2', featureSlug: 'pay', type: 'structural' });
  recordViolation(TMP, { taskId: 't3', featureSlug: 'auth', type: 'semantic' });

  const entries = loadLedger(TMP);
  assert.equal(entries.length, 3);
});

test('loadLedger filters by featureSlug', () => {
  recordViolation(TMP, { taskId: 't1', featureSlug: 'auth', type: 'cosmetic' });
  recordViolation(TMP, { taskId: 't2', featureSlug: 'pay', type: 'structural' });

  const entries = loadLedger(TMP, { featureSlug: 'auth' });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].taskId, 't1');
});

test('loadLedger filters by type', () => {
  recordViolation(TMP, { taskId: 't1', type: 'cosmetic' });
  recordViolation(TMP, { taskId: 't2', type: 'structural' });
  recordViolation(TMP, { taskId: 't3', type: 'cosmetic' });

  const entries = loadLedger(TMP, { type: 'cosmetic' });
  assert.equal(entries.length, 2);
});

test('loadLedger filters by taskId', () => {
  recordViolation(TMP, { taskId: 't1', type: 'a' });
  recordViolation(TMP, { taskId: 't2', type: 'b' });

  const entries = loadLedger(TMP, { taskId: 't2' });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, 'b');
});

test('loadLedger respects limit', () => {
  for (let i = 0; i < 10; i++) recordViolation(TMP, { taskId: `t${i}`, type: 'x' });
  const entries = loadLedger(TMP, { limit: 3 });
  assert.equal(entries.length, 3);
});

// ── analyzeLedger ──

test('analyzeLedger on empty ledger', () => {
  const result = analyzeLedger(TMP);
  assert.equal(result.totalViolations, 0);
  assert.deepEqual(result.byType, {});
  assert.deepEqual(result.topFiles, []);
});

test('analyzeLedger computes byType', () => {
  recordViolation(TMP, { taskId: 't1', type: 'cosmetic', file: 'a.ts' });
  recordViolation(TMP, { taskId: 't2', type: 'cosmetic', file: 'b.ts' });
  recordViolation(TMP, { taskId: 't3', type: 'structural', file: 'a.ts' });

  const result = analyzeLedger(TMP);
  assert.equal(result.totalViolations, 3);
  assert.equal(result.byType.cosmetic, 2);
  assert.equal(result.byType.structural, 1);
});

test('analyzeLedger computes topFiles', () => {
  recordViolation(TMP, { taskId: 't1', type: 'a', file: 'hot.ts' });
  recordViolation(TMP, { taskId: 't2', type: 'a', file: 'hot.ts' });
  recordViolation(TMP, { taskId: 't3', type: 'a', file: 'cold.ts' });

  const result = analyzeLedger(TMP);
  assert.equal(result.topFiles[0].file, 'hot.ts');
  assert.equal(result.topFiles[0].count, 2);
});

test('analyzeLedger computes byFeature', () => {
  recordViolation(TMP, { taskId: 't1', featureSlug: 'auth', type: 'a' });
  recordViolation(TMP, { taskId: 't2', featureSlug: 'auth', type: 'b' });
  recordViolation(TMP, { taskId: 't3', featureSlug: 'pay', type: 'a' });

  const result = analyzeLedger(TMP);
  assert.equal(result.byFeature.auth, 2);
  assert.equal(result.byFeature.pay, 1);
});

test('analyzeLedger computes recentRate', () => {
  recordViolation(TMP, { taskId: 't1', type: 'a' });
  recordViolation(TMP, { taskId: 't2', type: 'b' });

  const result = analyzeLedger(TMP);
  // Both are recent (just created)
  assert.equal(result.recentRate, 2);
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
