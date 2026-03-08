import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * TX004 — rollback-on-failure
 * Failure path must roll back all writes.
 * With ORM transactions ($transaction), rollback is automatic on exception.
 * With manual transactions, explicit ROLLBACK must exist.
 */

const AUTO_ROLLBACK_PATTERNS = [
  /\$transaction\s*\(/,      // Prisma — auto-rolls back on exception
  /session\.withTransaction/, // MongoDB
];

const MANUAL_ROLLBACK_PATTERNS = [
  /\.rollback\s*\(/,
  /ROLLBACK/,
  /trx\.rollback/,
];

const MANUAL_TRANSACTION_PATTERNS = [
  /knex\.transaction/,
  /BEGIN/,
  /db\.transaction/,
];

function getTxFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.tx\.|transaction/) && f.name.endsWith('.ts') && !f.name.includes('.test.')) {
        results.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const txFiles = getTxFiles(dir);
  if (txFiles.length === 0) {
    return { pass: true, code: 'TX004', message: 'No transaction files found — gate skipped', skipped: true };
  }

  const violations = [];

  for (const file of txFiles) {
    const content = readFileSync(file, 'utf8');

    const hasAutoRollback = AUTO_ROLLBACK_PATTERNS.some(p => p.test(content));
    const hasManualTx = MANUAL_TRANSACTION_PATTERNS.some(p => p.test(content));
    const hasManualRollback = MANUAL_ROLLBACK_PATTERNS.some(p => p.test(content));

    if (hasAutoRollback) continue; // Prisma $transaction auto-rolls back on exception

    if (hasManualTx && !hasManualRollback) {
      violations.push(`${file.replace(dir+'/','')}: Manual transaction without explicit rollback on failure`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'TX004',
      message: `${violations.length} transaction(s) without rollback on failure`,
      detail: violations.join('\n') + '\n\nAdd: try { ... } catch (err) { await trx.rollback(); throw err; }'
    };
  }

  return { pass: true, code: 'TX004', message: 'All transactions roll back on failure' };
}
