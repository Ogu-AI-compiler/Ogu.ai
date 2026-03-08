import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DS006 — no-inline-multiwrite
 * Services that perform multiple sequential DB writes without a transaction must
 * delegate to a transaction-script module instead.
 *
 * Detection: ≥2 distinct write operation calls (create/update/delete/upsert) in the
 * same service file without a $transaction / .transaction wrapper.
 *
 * Why this matters: two sequential awaited writes with no transaction means a crash
 * between them leaves the database in a partially-written state — no rollback happens.
 */

const WRITE_OP_PATTERNS = [
  /await\s+\w+\.create\s*\(/,
  /await\s+\w+\.update\s*\(/,
  /await\s+\w+\.delete\s*\(/,
  /await\s+\w+\.upsert\s*\(/,
  /await\s+\w+\.deleteMany\s*\(/,
  /await\s+\w+\.updateMany\s*\(/,
  /await\s+\w+\.createMany\s*\(/,
];

const TRANSACTION_PATTERNS = [
  /\$transaction\s*\(/,
  /\.transaction\s*\(/,
  /BEGIN\b/,
  /COMMIT\b/,
  /ROLLBACK\b/,
];

function getServiceFiles(dir) {
  const results = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const f of entries) {
      if (f.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(f.name)) continue;
        walk(join(d, f.name));
      } else if (f.name.match(/\.service\.ts$/) && !f.name.includes('.test.')) {
        results.push(join(d, f.name));
      }
    }
  }

  walk(dir);
  return results;
}

export async function run({ dir }) {
  // Spec is optional — gate runs without it (spec only provides extra context)
  let spec = null;
  const specPath = join(dir, 'service-spec.json');
  if (existsSync(specPath)) {
    try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { /* proceed without spec */ }
  }

  const serviceFiles = getServiceFiles(dir);
  if (serviceFiles.length === 0) {
    return { pass: true, code: 'DS006', message: 'No *.service.ts files found — gate skipped', skipped: true };
  }

  const violations = [];

  for (const file of serviceFiles) {
    const content = readFileSync(file, 'utf8');

    const writeCount = WRITE_OP_PATTERNS.reduce((count, p) => {
      const matches = content.match(new RegExp(p.source, 'g'));
      return count + (matches ? matches.length : 0);
    }, 0);

    const hasTransaction = TRANSACTION_PATTERNS.some(p => p.test(content));

    if (writeCount >= 2 && !hasTransaction) {
      violations.push(
        `${file.replace(dir + '/', '')}: ${writeCount} write operation(s) without $transaction — ` +
        'delegate to transaction-script-module'
      );
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DS006',
      message: `${violations.length} service(s) with inline multi-write without transaction`,
      detail: violations.join('\n') +
        '\n\nCreate a transaction-script module and inject it:\n' +
        '  class MyTransactionScript {\n' +
        '    async execute(prisma.$transaction(async (tx) => { ... }))\n' +
        '  }',
    };
  }

  return {
    pass: true, code: 'DS006',
    message: `No inline multi-write patterns in ${serviceFiles.length} service file(s)`,
  };
}
