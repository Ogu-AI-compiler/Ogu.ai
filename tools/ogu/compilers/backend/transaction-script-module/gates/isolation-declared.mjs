import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * TX005 — isolation-declared
 * If the spec requires a specific isolation level, it must be declared in code.
 * READ COMMITTED is the Postgres default — only flag if spec requests a different level.
 */

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

const ISOLATION_PATTERNS = [
  /isolationLevel/i,
  /Isolation\./, // Prisma enum
  /SERIALIZABLE/i,
  /REPEATABLE READ/i,
  /READ UNCOMMITTED/i,
  /SET TRANSACTION ISOLATION LEVEL/i,
];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'transaction-spec.json'), 'utf8'));

  // Only enforce if spec explicitly requests non-default isolation
  if (!spec.isolationLevel || spec.isolationLevel === 'READ COMMITTED') {
    return {
      pass: true, code: 'TX005',
      message: 'No non-default isolation level required — gate passes',
      skipped: true
    };
  }

  // Find transaction files and verify the isolation level is declared
  const txFiles = getTxFiles(dir);

  if (txFiles.length === 0) {
    return {
      pass: false, code: 'TX005',
      message: `Spec requires isolation level "${spec.isolationLevel}" but no transaction file found`
    };
  }

  const allContent = txFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const hasIsolation = ISOLATION_PATTERNS.some(p => p.test(allContent));

  if (!hasIsolation) {
    return {
      pass: false, code: 'TX005',
      message: `Spec requires isolation level "${spec.isolationLevel}" but it's not declared in code`,
      detail: `Add: prisma.$transaction([...], { isolationLevel: Prisma.TransactionIsolationLevel.${spec.isolationLevel.replace(' ', '')} })`
    };
  }

  return { pass: true, code: 'TX005', message: `Isolation level "${spec.isolationLevel}" is declared in transaction code` };
}
