/**
 * Gate: concurrency-policy-set (SJ004)
 * Validates that a concurrencyPolicy is declared. Without an explicit policy,
 * Kubernetes defaults to Allow — which lets multiple instances of the job run
 * in parallel. For most scheduled jobs this causes resource exhaustion, data
 * duplication, or deadlocks when two instances process the same records.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_POLICIES = ['Allow', 'Forbid', 'Replace'];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'scheduled-job-spec.json'), 'utf8'));

  if (!spec.concurrencyPolicy) {
    return {
      pass: false, code: 'SJ004',
      message: 'concurrencyPolicy not set — Kubernetes defaults to Allow which may cause job pile-up',
      detail: {
        allowed: VALID_POLICIES,
        hint: 'Forbid: queue next run until current finishes. Replace: cancel running, start new. Allow: run in parallel (rarely correct for scheduled jobs).',
      },
    };
  }

  if (!VALID_POLICIES.includes(spec.concurrencyPolicy)) {
    return {
      pass: false, code: 'SJ004',
      message: `Invalid concurrencyPolicy: "${spec.concurrencyPolicy}"`,
      detail: { received: spec.concurrencyPolicy, allowed: VALID_POLICIES },
    };
  }

  return { pass: true, code: 'SJ004', message: `concurrencyPolicy: ${spec.concurrencyPolicy}` };
}
