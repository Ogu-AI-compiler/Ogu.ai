/**
 * Gate: ordering-explicit (MR005)
 * Validates that the migration ordering policy relative to deployment is set.
 * Running migrations in the wrong phase causes schema/code mismatches:
 * pre-deploy is safest for additive changes, post-deploy for cleanup or
 * backwards-compatible drops, and deploy for non-breaking in-place changes.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID = new Set(['pre-deploy', 'deploy', 'post-deploy']);

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'db-migration-runner-spec.json'), 'utf8'));

  if (!spec.orderingPolicy) {
    return {
      pass: false, code: 'MR005',
      message: 'orderingPolicy not set — migration execution order relative to deployment must be explicit',
      detail: {
        allowed: [...VALID],
        guidance: {
          'pre-deploy':  'Run before new pods start — safest for additive migrations (new columns, tables)',
          'deploy':      'Run in parallel with deployment — only for non-breaking, backward-compatible changes',
          'post-deploy': 'Run after all pods are healthy — for cleanup or non-breaking drops',
        },
        hint: 'Set orderingPolicy to one of the allowed values',
      },
    };
  }

  if (!VALID.has(spec.orderingPolicy)) {
    return {
      pass: false, code: 'MR005',
      message: `Invalid orderingPolicy: "${spec.orderingPolicy}"`,
      detail: { received: spec.orderingPolicy, allowed: [...VALID] },
    };
  }

  return { pass: true, code: 'MR005', message: `Migration ordering: ${spec.orderingPolicy}` };
}
