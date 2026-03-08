/**
 * Gate: spec-valid (BW001)
 * Validates bg-worker-spec.json exists, is valid JSON, and declares all required
 * fields. This is the entry gate for the background_worker_runtime compiler —
 * all downstream gates depend on a structurally sound spec.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'bg-worker-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'BW001',
      message: 'bg-worker-spec.json not found',
      detail: { hint: 'Create bg-worker-spec.json with: { name, image, queues: [{ name, connection }] }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'BW001',
      message: `bg-worker-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error before re-running' },
    };
  }

  const missing = ['name', 'image', 'queues'].filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'BW001',
      message: `Missing required fields: ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Required: { name, image, queues: [{ name, connection }], deadLetterQueue?, maxRetries?, concurrency? }',
      },
    };
  }

  if (!Array.isArray(spec.queues) || spec.queues.length === 0) {
    return {
      pass: false, code: 'BW001',
      message: 'queues must be a non-empty array',
      detail: { hint: 'A background worker must consume at least one queue: [{ name: "orders-queue", connection: "REDIS_URL" }]' },
    };
  }

  return {
    pass: true, code: 'BW001',
    message: `bg-worker-spec.json valid — "${spec.name}", ${spec.queues.length} queue(s)`,
  };
}
