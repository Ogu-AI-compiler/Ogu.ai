import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * EC004 — idempotency-persisted
 * Before executing handler logic, the consumer must persist a deduplication record.
 * This ensures at-least-once delivery doesn't cause double-processing.
 * Pattern: check + set in Redis/DB using event ID before processing.
 */

const IDEMPOTENCY_PATTERNS = [
  /redis\s*\.\s*(?:set|setnx|getset)\s*\([^)]*(?:event|msg|message)\.(?:id|eventId|messageId)/i,
  /\.findUnique\s*\([^)]*idempotency/i,
  /\.upsert\s*\([^)]*idempotency/i,
  /alreadyProcessed|isProcessed|isDuplicate|seenBefore/i,
  /processedEvents\.(?:has|add)\s*\(/i,
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
  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  for (const pattern of IDEMPOTENCY_PATTERNS) {
    if (pattern.test(allContent)) {
      return { pass: true, code: 'EC004', message: `Idempotency persistence found (${files.length} file(s))` };
    }
  }

  return {
    pass: false, code: 'EC004',
    message: 'No idempotency persistence found — at-least-once delivery requires deduplication',
    detail: 'Add: const seen = await redis.set(`processed:${event.id}`, "1", { NX: true, EX: 86400 }); if (!seen) return;'
  };
}
