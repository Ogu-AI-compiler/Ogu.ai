import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QT003 — retry-declared
 * Every queue must either declare a retry policy OR explicitly set noRetry:true.
 * Implicit "no retry" (omitted field) is not allowed — it's ambiguous.
 */

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'queue-topology-spec.json'), 'utf8'));
  const violations = [];

  for (const q of spec.queues) {
    const hasRetryPolicy = q.retryPolicy && typeof q.retryPolicy.maxRetries === 'number';
    const hasNoRetry = q.noRetry === true;

    if (!hasRetryPolicy && !hasNoRetry) {
      violations.push(`Queue "${q.name}" has neither retryPolicy nor noRetry:true — retry behavior is ambiguous`);
    }

    if (hasRetryPolicy) {
      const retry = q.retryPolicy;
      if (!retry.backoff && retry.maxRetries > 1) {
        violations.push(`Queue "${q.name}" retries ${retry.maxRetries} times but has no backoff strategy`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QT003',
      message: `${violations.length} queue(s) with undeclared retry policy`,
      detail: violations.join('\n') + '\n\nAdd retryPolicy: { maxRetries: N, backoff: "exponential"|"fixed" } or noRetry: true'
    };
  }

  return { pass: true, code: 'QT003', message: `All ${spec.queues.length} queue(s) have explicit retry declarations` };
}
