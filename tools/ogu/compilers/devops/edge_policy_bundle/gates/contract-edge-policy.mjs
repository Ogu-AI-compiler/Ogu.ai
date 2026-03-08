/**
 * Gate: contract-edge-policy (EP007)
 * Validates that edge-policy-spec.json satisfies the edge policy contract:
 * every rule must be identifiable (name or match), positive rate limits must
 * not be zero, and the policy must have a name for auditability.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'edge-policy-spec.json'), 'utf8'));
  const violations = [];

  for (const rule of spec.rules) {
    if (!rule.name && !rule.match) {
      violations.push({ rule: '(unnamed)', reason: 'Rule is missing both name and match — cannot audit which rule matched a request', hint: 'Add a name or match expression to identify this rule' });
    }
    if (rule.rateLimit?.requestsPerSecond !== undefined && rule.rateLimit.requestsPerSecond <= 0) {
      violations.push({ rule: rule.name || rule.match, field: 'rateLimit.requestsPerSecond', value: rule.rateLimit.requestsPerSecond, reason: 'requestsPerSecond must be a positive number' });
    }
  }

  if (!spec.name) {
    violations.push({ rule: 'policy', field: 'name', reason: 'Policy is missing a name — the policy cannot be identified in audit logs', hint: 'Add a name field to the policy spec' });
  }

  if (violations.length) {
    return {
      pass: false, code: 'EP007',
      message: `${violations.length} contract violation(s) in edge-policy-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'EP007', message: 'Edge policy bundle contract satisfied' };
}
