import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QT004 — retention-declared
 * Every queue must declare retention policy for both completed and failed jobs.
 * Without retention, completed jobs accumulate indefinitely (memory/disk exhaustion).
 */

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'queue-topology-spec.json'), 'utf8'));
  const violations = [];

  for (const q of spec.queues) {
    const retention = q.retention;

    if (!retention) {
      violations.push(`Queue "${q.name}" has no retention policy — completed and failed jobs will accumulate forever`);
      continue;
    }

    if (!('completed' in retention)) {
      violations.push(`Queue "${q.name}" missing retention.completed (max jobs to keep or 0 for immediate removal)`);
    }
    if (!('failed' in retention)) {
      violations.push(`Queue "${q.name}" missing retention.failed (max failed jobs to keep for inspection)`);
    }

    // Validate sensible values
    if (typeof retention.completed === 'number' && retention.completed < 0) {
      violations.push(`Queue "${q.name}" retention.completed cannot be negative`);
    }
    if (typeof retention.failed === 'number' && retention.failed < 0) {
      violations.push(`Queue "${q.name}" retention.failed cannot be negative`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QT004',
      message: `${violations.length} queue(s) with missing retention policy`,
      detail: violations.join('\n') + '\n\nExample: retention: { completed: 100, failed: 500 }'
    };
  }

  return { pass: true, code: 'QT004', message: `All ${spec.queues.length} queue(s) have retention policies declared` };
}
