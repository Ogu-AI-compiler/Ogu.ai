/**
 * Gate: no-undeclared-secrets (SJ006)
 * Validates that every envRef marked as a secret includes a secretName
 * pointing to the Kubernetes Secret resource. A secret ref without a
 * secretName will fail at pod scheduling with a missing reference error.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'scheduled-job-spec.json'), 'utf8'));
  const violations = (spec.envRefs || [])
    .filter(r => r.secret && !r.secretName)
    .map(r => ({
      envRef:   r.name || '(unnamed)',
      reason:   'envRef marked as secret but missing secretName — pod will fail to schedule',
      hint:     'Add secretName: "my-secret" to point to the Kubernetes Secret resource',
    }));

  if (violations.length) {
    return {
      pass: false, code: 'SJ006',
      message: `${violations.length} undeclared secret ref(s) in envRefs`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'SJ006', message: 'All secret refs declared' };
}
