/**
 * Transaction Tests — execute, rollback, idempotency, saga, consistency.
 *
 * Run: node tools/ogu/tests/transaction.test.mjs
 */

import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const {
  SOURCE_OF_TRUTH_HIERARCHY, TX_PHASES,
  executeTransaction, loadTransaction, listTransactions,
  findOrphanedTransactions, gcIdempotencyKeys,
  runConsistencyCheck,
  createSaga, SAGA_STATES,
  createTransactionLog, createCompensatingTransaction,
} = await import('../commands/lib/transaction.mjs');

// ── Setup ──

const testRoot = join(tmpdir(), `ogu-tx-test-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/transactions'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/idempotency'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/budget'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/audit'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/locks'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/agents/sessions'), { recursive: true });

writeFileSync(join(testRoot, '.ogu/audit/current.jsonl'), '');

const origRoot = process.env.OGU_ROOT;
process.env.OGU_ROOT = testRoot;

console.log('\nTransaction Tests\n');

// ── Section 1: Constants ──

test('1. SOURCE_OF_TRUTH_HIERARCHY — has 6 layers', () => {
  assert(SOURCE_OF_TRUTH_HIERARCHY.length === 6);
  assert(SOURCE_OF_TRUTH_HIERARCHY[0].layer === 'Audit Trail');
  assert(SOURCE_OF_TRUTH_HIERARCHY[0].rank === 1);
});

test('2. TX_PHASES — has 5 phases', () => {
  assert(TX_PHASES.length === 5);
  assert(TX_PHASES.includes('prepare'));
  assert(TX_PHASES.includes('execute'));
  assert(TX_PHASES.includes('commit'));
  assert(TX_PHASES.includes('committed'));
  assert(TX_PHASES.includes('rolled_back'));
});

test('3. SAGA_STATES — has 6 states', () => {
  assert(SAGA_STATES.length === 6);
  assert(SAGA_STATES.includes('pending'));
  assert(SAGA_STATES.includes('compensating'));
});

// ── Section 2: executeTransaction ──

test('4. executeTransaction — successful with executor', () => {
  const result = executeTransaction(testRoot, {
    taskId: 'task-1',
    featureSlug: 'feat-a',
    agentId: 'agent-1',
    estimatedCost: 0.01,
    executor: ({ txId }) => ({ outputs: ['file1.ts'], cost: { totalCost: 0.01 } }),
  });
  assert(result.success === true);
  assert(result.txId);
  assert(result.txId.startsWith('tx-'));
  assert(result.resultHash);
});

test('5. executeTransaction — writes transaction record', () => {
  const txFiles = readdirSync(join(testRoot, '.ogu/transactions')).filter(f => f.startsWith('tx-'));
  assert(txFiles.length >= 1);
});

test('6. executeTransaction — idempotent (same task returns cached)', () => {
  const r1 = executeTransaction(testRoot, {
    taskId: 'idem-task',
    featureSlug: 'feat-b',
    agentId: 'a',
    attempt: 0,
    executor: () => ({ outputs: ['x'], cost: { totalCost: 0.001 } }),
  });
  const r2 = executeTransaction(testRoot, {
    taskId: 'idem-task',
    featureSlug: 'feat-b',
    agentId: 'a',
    attempt: 0,
    executor: () => { throw new Error('should not run'); },
  });
  assert(r2.success === true);
  assert(r2.cached === true);
  assert(r2.txId === r1.txId);
});

test('7. executeTransaction — different attempt = new tx', () => {
  const r1 = executeTransaction(testRoot, {
    taskId: 'retry-task',
    featureSlug: 'feat-c',
    attempt: 0,
    executor: () => ({ outputs: [], cost: { totalCost: 0 } }),
  });
  const r2 = executeTransaction(testRoot, {
    taskId: 'retry-task',
    featureSlug: 'feat-c',
    attempt: 1,
    executor: () => ({ outputs: ['new'], cost: { totalCost: 0.02 } }),
  });
  assert(r2.txId !== r1.txId);
});

test('8. executeTransaction — rollback on executor failure', () => {
  const result = executeTransaction(testRoot, {
    taskId: 'fail-task',
    featureSlug: 'feat-d',
    agentId: 'a',
    attempt: 42,
    executor: () => { throw new Error('intentional failure'); },
  });
  assert(result.success === false);
  assert(result.error === 'intentional failure');
  assert(result.rollbackActions.includes('audit_logged'));
});

test('9. executeTransaction — no executor = commit with no outputs', () => {
  const result = executeTransaction(testRoot, {
    taskId: 'no-exec',
    featureSlug: 'feat-e',
    attempt: 0,
  });
  assert(result.success === true);
  assert(result.outputs === null || result.outputs === undefined);
});

// ── Section 3: loadTransaction + listTransactions ──

test('10. loadTransaction — loads by txId', () => {
  const list = listTransactions(testRoot, { limit: 1 });
  assert(list.length >= 1);
  const tx = loadTransaction(testRoot, list[0].txId);
  assert(tx);
  assert(tx.txId === list[0].txId);
});

test('11. loadTransaction — null for missing', () => {
  assert(loadTransaction(testRoot, 'tx-nonexistent') === null);
});

test('12. listTransactions — returns recent transactions sorted', () => {
  const list = listTransactions(testRoot);
  assert(list.length >= 3);
  // Sorted by startedAt DESC
  for (let i = 1; i < list.length; i++) {
    assert(list[i - 1].startedAt >= list[i].startedAt, 'Should be sorted desc');
  }
});

test('13. listTransactions — respects limit', () => {
  const list = listTransactions(testRoot, { limit: 2 });
  assert(list.length <= 2);
});

// ── Section 4: findOrphanedTransactions ──

test('14. findOrphanedTransactions — no orphans in normal state', () => {
  const orphans = findOrphanedTransactions(testRoot);
  // All our transactions completed — no orphans
  assert(orphans.length === 0);
});

test('15. findOrphanedTransactions — detects stale tx', () => {
  // Create a fake orphaned transaction
  const fakeTx = {
    txId: 'tx-orphan-test',
    phase: 'execute',
    taskId: 'stuck-task',
    featureSlug: 'feat-stuck',
    startedAt: new Date(Date.now() - 7200000).toISOString(), // 2h ago
  };
  writeFileSync(join(testRoot, '.ogu/transactions/tx-orphan-test.json'), JSON.stringify(fakeTx));
  const orphans = findOrphanedTransactions(testRoot);
  assert(orphans.length >= 1);
  assert(orphans.some(o => o.txId === 'tx-orphan-test'));
});

// ── Section 5: gcIdempotencyKeys ──

test('16. gcIdempotencyKeys — removes expired keys', () => {
  // Write an expired key
  writeFileSync(join(testRoot, '.ogu/idempotency/expired-key.json'), JSON.stringify({
    status: 'committed',
    committedAt: new Date(Date.now() - 100000000).toISOString(), // ~27h ago
  }));
  const result = gcIdempotencyKeys(testRoot);
  assert(result.removed >= 1);
  assert(!existsSync(join(testRoot, '.ogu/idempotency/expired-key.json')));
});

test('17. gcIdempotencyKeys — keeps fresh keys', () => {
  writeFileSync(join(testRoot, '.ogu/idempotency/fresh-key.json'), JSON.stringify({
    status: 'committed',
    committedAt: new Date().toISOString(),
  }));
  gcIdempotencyKeys(testRoot);
  assert(existsSync(join(testRoot, '.ogu/idempotency/fresh-key.json')));
});

// ── Section 6: runConsistencyCheck ──

test('18. runConsistencyCheck — returns results for all checks', () => {
  const result = runConsistencyCheck(testRoot);
  assert(Array.isArray(result.results));
  assert(result.results.length >= 3);
  assert(typeof result.allPassed === 'boolean');
});

test('19. runConsistencyCheck — budget_vs_audit check present', () => {
  const result = runConsistencyCheck(testRoot);
  assert(result.results.some(r => r.check === 'budget_vs_audit'));
});

test('20. runConsistencyCheck — orphaned_transactions check present', () => {
  const result = runConsistencyCheck(testRoot);
  const orphanCheck = result.results.find(r => r.check === 'orphaned_transactions');
  assert(orphanCheck);
  // We created an orphan earlier
  assert(orphanCheck.status === 'warning' || orphanCheck.status === 'ok');
});

test('21. runConsistencyCheck — fix mode cleans orphans', () => {
  const result = runConsistencyCheck(testRoot, { fix: true });
  const orphanCheck = result.results.find(r => r.check === 'orphaned_transactions');
  assert(orphanCheck.status === 'fixed' || orphanCheck.status === 'ok');
});

// ── Section 7: Legacy — createSaga ──

test('22. createSaga — creates saga with step/execute/getStatus', () => {
  const saga = createSaga('test-saga');
  assert(typeof saga.step === 'function');
  assert(typeof saga.execute === 'function');
  assert(typeof saga.getStatus === 'function');
});

test('23. createSaga — successful execution', async () => {
  const saga = createSaga('success-saga');
  const log = [];
  saga.step('s1', () => log.push('do-1'), () => log.push('undo-1'));
  saga.step('s2', () => log.push('do-2'), () => log.push('undo-2'));
  await saga.execute();
  assert(saga.getStatus().state === 'completed');
  assert(log.join(',') === 'do-1,do-2');
});

test('24. createSaga — compensates on failure', async () => {
  const saga = createSaga('fail-saga');
  const log = [];
  saga.step('s1', () => log.push('do-1'), () => log.push('undo-1'));
  saga.step('s2', () => { throw new Error('boom'); }, () => log.push('undo-2'));
  try { await saga.execute(); } catch { /* expected */ }
  assert(saga.getStatus().state === 'compensated');
  assert(log.includes('undo-1'), 'Should have compensated step 1');
});

// ── Section 8: Legacy — createTransactionLog ──

test('25. createTransactionLog — append and get', () => {
  const txLog = createTransactionLog();
  txLog.append({ type: 'write', file: 'a.ts' });
  txLog.append({ type: 'write', file: 'b.ts' });
  assert(txLog.getEntries().length === 2);
  assert(txLog.getEntries()[0].seq === 1);
  assert(txLog.getEntries()[1].seq === 2);
});

test('26. createTransactionLog — getByType filters', () => {
  const txLog = createTransactionLog();
  txLog.append({ type: 'write', file: 'a.ts' });
  txLog.append({ type: 'delete', file: 'b.ts' });
  txLog.append({ type: 'write', file: 'c.ts' });
  assert(txLog.getByType('write').length === 2);
  assert(txLog.getByType('delete').length === 1);
});

test('27. createTransactionLog — getSince returns entries after seq', () => {
  const txLog = createTransactionLog();
  txLog.append({ type: 'a' });
  txLog.append({ type: 'b' });
  txLog.append({ type: 'c' });
  assert(txLog.getSince(1).length === 2);
  assert(txLog.getSince(2).length === 1);
});

// ── Section 9: Legacy — createCompensatingTransaction ──

test('28. createCompensatingTransaction — commit runs actions', () => {
  const tx = createCompensatingTransaction();
  const log = [];
  tx.add(() => log.push('a1'), () => log.push('c1'));
  tx.add(() => log.push('a2'), () => log.push('c2'));
  tx.commit();
  assert(log.join(',') === 'a1,a2');
});

test('29. createCompensatingTransaction — rollback runs compensations in reverse', () => {
  const tx = createCompensatingTransaction();
  const log = [];
  tx.add(() => {}, () => log.push('c1'));
  tx.add(() => {}, () => log.push('c2'));
  tx.add(() => {}, () => log.push('c3'));
  tx.rollback();
  assert(log.join(',') === 'c3,c2,c1');
});

// ── Cleanup ──

process.env.OGU_ROOT = origRoot;
rmSync(testRoot, { recursive: true, force: true });

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
