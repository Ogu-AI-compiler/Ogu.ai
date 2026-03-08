import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DS008 — idempotency-strategy
 * Use cases marked as idempotent must have an explicit dedupe or unique-key strategy.
 * Pattern: idempotencyKey, uniqueId, upsert, findOrCreate, ON CONFLICT DO NOTHING
 */

const IDEMPOTENCY_PATTERNS = [
  /idempotencyKey/,
  /idempotency_key/,
  /uniqueId/,
  /\.upsert\s*\(/,
  /findOrCreate/,
  /ON CONFLICT/i,
  /INSERT.*IGNORE/i,
  /dedupeKey/,
  /jobId\s*:/,        // BullMQ unique job
];

function getServiceFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.service\.ts$/) && !f.name.includes('.test.')) {
        results.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'service-spec.json'), 'utf8'));
  const idempotentUseCases = spec.useCases.filter(uc => uc.idempotent === true);

  if (idempotentUseCases.length === 0) {
    return { pass: true, code: 'DS008', message: 'No idempotent use cases declared — gate skipped', skipped: true };
  }

  const serviceFiles = getServiceFiles(dir);
  if (serviceFiles.length === 0) {
    return {
      pass: false, code: 'DS008',
      message: `${idempotentUseCases.length} idempotent use case(s) declared but no service file found`
    };
  }

  const allContent = serviceFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const hasIdempotencyMechanism = IDEMPOTENCY_PATTERNS.some(p => p.test(allContent));

  if (!hasIdempotencyMechanism) {
    return {
      pass: false, code: 'DS008',
      message: `${idempotentUseCases.length} idempotent use case(s) without dedupe strategy`,
      detail: `Idempotent use cases: ${idempotentUseCases.map(uc=>uc.name).join(', ')}\n\nAdd: upsert, idempotencyKey parameter, ON CONFLICT DO NOTHING, or unique constraint`
    };
  }

  return {
    pass: true, code: 'DS008',
    message: `Idempotency strategy present for ${idempotentUseCases.length} use case(s): ${idempotentUseCases.map(uc=>uc.name).join(', ')}`
  };
}
