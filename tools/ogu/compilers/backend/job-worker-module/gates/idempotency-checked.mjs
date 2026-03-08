import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * JW004 — idempotency-checked
 * If spec.idempotencyKey is declared, the worker must check for duplicate
 * processing before doing work. Pattern: check job.id / deduplication store / idempotency table.
 *
 * If spec.idempotencyKey is not set, this gate skips.
 */

const IDEMPOTENCY_PATTERNS = [
  /job\.id/,
  /idempotency/i,
  /dedup/i,
  /alreadyProcessed/i,
  /isProcessed/i,
  /seen\s*\.\s*(?:has|get)/i,
  /redis\s*\.\s*(?:get|exists)\s*\([^)]*job/i,
  /\.findUnique\s*\([^)]*idempotency/i,
];

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries; try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(e.name)) walk(join(d, e.name)); }
      else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.(test|spec|d)\./)) files.push(join(d, e.name));
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'job-worker-spec.json'), 'utf8'));
  if (!spec.idempotencyKey) return { pass: true, code: 'JW004', message: 'No idempotencyKey declared — idempotency check skipped', skipped: true };

  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  for (const pattern of IDEMPOTENCY_PATTERNS) {
    if (pattern.test(allContent)) {
      return { pass: true, code: 'JW004', message: `Idempotency check found (${files.length} file(s))` };
    }
  }

  return {
    pass: false, code: 'JW004',
    message: `spec.idempotencyKey "${spec.idempotencyKey}" declared but no deduplication check found in code`,
    detail: 'Add: const existing = await redis.get(job.id); if (existing) return; // already processed'
  };
}
