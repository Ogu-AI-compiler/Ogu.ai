/**
 * Gate: contract-scheduled-job (SJ008)
 * Validates that scheduled-job-spec.json satisfies the scheduled job contract:
 * every job must declare an owner (for on-call routing) and an explicit
 * concurrencyPolicy (to prevent silent resource exhaustion from overlapping runs).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'scheduled-job-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.owner) {
    violations.push({ rule: 'owner-required', reason: 'No owner declared — on-call routing cannot be determined when the job fails', hint: 'Add owner: "team-name" or an email address' });
  }
  if (!spec.concurrencyPolicy) {
    violations.push({ rule: 'concurrencyPolicy-required', reason: 'concurrencyPolicy not set — Kubernetes defaults to Allow which may cause job pile-up', hint: 'Set concurrencyPolicy to Forbid, Replace, or Allow' });
  }

  if (violations.length) {
    return {
      pass: false, code: 'SJ008',
      message: `${violations.length} contract violation(s) in scheduled-job-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'SJ008', message: `Scheduled job contract satisfied — "${spec.name}"` };
}
