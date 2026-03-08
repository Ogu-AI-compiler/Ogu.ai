import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * TX002 — writes-in-transaction
 * All DB write operations must occur inside a transaction boundary.
 * Detects write ops outside $transaction / transaction() blocks.
 */

const TRANSACTION_START = /\$transaction\s*\(|\.transaction\s*\(|knex\.transaction|db\.transaction/;
const WRITE_OPS = [
  /\bawait\s+\w+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/,
  /\bawait\s+\w+\.insert\s*\(/,
  /INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM/i,
];

function getTxFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.tx\.|transaction|[Tt]x\.(ts)$/) && !f.name.includes('.test.')) {
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
    return { pass: false, code: 'TX002', message: 'No transaction script file found (expected *.tx.ts or *transaction*.ts)' };
  }

  const violations = [];
  for (const file of txFiles) {
    const content = readFileSync(file, 'utf8');

    // Check that the file uses a transaction wrapper
    const hasTransactionBoundary = TRANSACTION_START.test(content);
    if (!hasTransactionBoundary) {
      violations.push(`${file.replace(dir+'/','')}: No transaction boundary found ($transaction, .transaction())`);
      continue;
    }

    // Check for writes that appear before or after the transaction block
    // Simple heuristic: check if there are top-level awaited writes outside the callback
    const lines = content.split('\n');
    let insideTransaction = 0;
    let depth = 0;
    lines.forEach((line, i) => {
      if (TRANSACTION_START.test(line)) insideTransaction = depth + 1;
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      depth += opens - closes;
      if (insideTransaction && depth < insideTransaction) insideTransaction = 0;

      // Write op outside transaction
      if (!insideTransaction && WRITE_OPS.some(p => p.test(line)) && !line.trim().startsWith('//')) {
        violations.push(`${file.replace(dir+'/','')}: ${i+1} — DB write outside transaction boundary: ${line.trim().slice(0,80)}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'TX002',
      message: `${violations.length} violation(s) — writes outside transaction boundary`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'TX002', message: 'All DB writes are inside transaction boundary' };
}
