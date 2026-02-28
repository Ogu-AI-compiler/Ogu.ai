import { repoRoot } from '../util.mjs';
import {
  runConsistencyCheck, loadTransaction, listTransactions,
  findOrphanedTransactions, gcIdempotencyKeys,
} from './lib/transaction.mjs';

/**
 * ogu consistency:check [--fix]  — Run all consistency checks
 * ogu tx:list [--limit N]       — List recent transactions
 * ogu tx:show <txId>            — Show transaction details
 * ogu tx:orphaned [--fix]       — Find/fix orphaned transactions
 * ogu idempotency:clean         — GC expired idempotency keys
 */

export async function consistencyCheck() {
  const root = repoRoot();
  const fix = process.argv.includes('--fix');
  const result = runConsistencyCheck(root, { fix });

  console.log(`\n  Consistency Check ${fix ? '(fix mode)' : ''}\n`);
  for (const r of result.results) {
    const icon = r.status === 'ok' ? '✓' : r.status === 'fixed' ? '~' : '✗';
    console.log(`  ${icon}  ${r.check.padEnd(28)} ${r.status.padEnd(8)} ${r.detail}`);
  }
  console.log(`\n  All passed: ${result.allPassed}`);
  return result.allPassed ? 0 : 1;
}

export async function txList() {
  const root = repoRoot();
  const args = process.argv.slice(3);
  let limit = 20;
  const limIdx = args.indexOf('--limit');
  if (limIdx !== -1 && args[limIdx + 1]) limit = parseInt(args[limIdx + 1], 10);

  const txs = listTransactions(root, { limit });
  if (txs.length === 0) {
    console.log('  No transactions found.');
    return 0;
  }

  console.log(`\n  Recent Transactions (${txs.length})\n`);
  console.log('  TX ID                              PHASE        TASK                  FEATURE');
  for (const tx of txs) {
    console.log(`  ${(tx.txId || '').padEnd(36)} ${(tx.phase || '').padEnd(12)} ${(tx.taskId || '').padEnd(20)} ${tx.featureSlug || ''}`);
  }
  return 0;
}

export async function txShow() {
  const txId = process.argv[3];
  if (!txId) {
    console.error('Usage: ogu tx:show <txId>');
    return 1;
  }
  const root = repoRoot();
  const tx = loadTransaction(root, txId);
  if (!tx) {
    console.error(`Transaction not found: ${txId}`);
    return 1;
  }

  console.log(`\n  Transaction: ${tx.txId}`);
  console.log(`  Phase: ${tx.phase}`);
  console.log(`  Task: ${tx.taskId}`);
  console.log(`  Feature: ${tx.featureSlug}`);
  console.log(`  Agent: ${tx.agentId || 'none'}`);
  console.log(`  Started: ${tx.startedAt}`);
  console.log(`  Completed: ${tx.completedAt || 'in progress'}`);
  if (tx.cost) console.log(`  Cost: $${tx.cost.totalCost || 0}`);
  if (tx.error) console.log(`  Error: ${tx.error}`);
  if (tx.acquiredResources?.length) console.log(`  Resources: ${tx.acquiredResources.join(', ')}`);
  return 0;
}

export async function txOrphaned() {
  const root = repoRoot();
  const fix = process.argv.includes('--fix');
  const orphans = findOrphanedTransactions(root);

  if (orphans.length === 0) {
    console.log('  No orphaned transactions.');
    return 0;
  }

  console.log(`\n  Orphaned Transactions: ${orphans.length}\n`);
  for (const tx of orphans) {
    console.log(`  ${tx.txId}  phase=${tx.phase}  task=${tx.taskId}  started=${tx.startedAt}`);
  }

  if (fix) {
    const result = runConsistencyCheck(root, { fix: true });
    const orphanCheck = result.results.find(r => r.check === 'orphaned_transactions');
    console.log(`\n  ${orphanCheck?.detail || 'Fixed'}`);
  }
  return 0;
}

export async function idempotencyClean() {
  const root = repoRoot();
  const result = gcIdempotencyKeys(root);
  console.log(`  Cleaned ${result.removed} expired idempotency keys.`);
  return 0;
}
