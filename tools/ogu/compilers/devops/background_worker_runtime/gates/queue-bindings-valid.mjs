/**
 * Gate: queue-bindings-valid (BW003)
 * Validates that every queue entry declares both a name and a connection reference.
 * A queue without a name cannot be addressed. A queue without a connection reference
 * will fail at worker startup with a missing environment variable error.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'bg-worker-spec.json'), 'utf8'));
  const violations = (spec.queues || [])
    .filter(q => !q.name || !q.connection)
    .map(q => ({
      queue:  q.name || '(unnamed)',
      reason: !q.name ? 'missing name' : 'missing connection reference (env var pointing to broker URL)',
    }));

  if (violations.length) {
    return {
      pass: false, code: 'BW003',
      message: `${violations.length} queue binding(s) invalid`,
      detail: {
        violations,
        hint: 'Each queue needs: { name: "orders-queue", connection: "REDIS_URL" } where connection is the env var name for the broker URL',
      },
    };
  }

  return { pass: true, code: 'BW003', message: `All ${(spec.queues || []).length} queue bindings are valid` };
}
