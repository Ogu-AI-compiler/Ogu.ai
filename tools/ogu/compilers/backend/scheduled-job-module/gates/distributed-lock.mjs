import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SJ004 — distributed-lock
 * Scheduled jobs running on multiple nodes need a distributed lock
 * to prevent concurrent execution. Check for lock patterns.
 *
 * Allowed patterns: redlock, redis SETNX, pg advisory lock, Agenda (built-in lock),
 * BullMQ repeat (built-in dedup), or spec.singleNode: true (explicit opt-out).
 */

const LOCK_PATTERNS = [
  /redlock|Redlock/,
  /redis\s*\.\s*(?:set|setnx)\s*\([^)]*(?:NX|lock)/i,
  /acquireLock|releaseLock|withLock/i,
  /pg_advisory_lock|advisory_lock/i,
  /agenda/i,
  /BullMQ|bullmq/i, // BullMQ repeat jobs have built-in dedup
  /distributedLock|distributed_lock/i,
];

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules','dist','.git','__tests__','tests'].includes(f.name)) walk(join(d,f.name)); }
      else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d,f.name));
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'scheduled-job-spec.json'), 'utf8'));

  // Explicit opt-out: single-node deployment
  if (spec.singleNode === true) {
    return { pass: true, code: 'SJ004', message: 'spec.singleNode=true — distributed lock check skipped', skipped: true };
  }

  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  for (const pattern of LOCK_PATTERNS) {
    if (pattern.test(allContent)) {
      return { pass: true, code: 'SJ004', message: `Distributed lock pattern found (${files.length} file(s))` };
    }
  }

  return {
    pass: false, code: 'SJ004',
    message: 'No distributed lock found — concurrent scheduler nodes will double-execute',
    detail: 'Add redlock, redis SETNX lock, or set spec.singleNode: true if single-node deployment.\nExample: const lock = await redlock.acquire([`lock:${jobId}`], 30000);'
  };
}
