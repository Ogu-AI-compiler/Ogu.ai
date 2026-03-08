/**
 * Gate: rate-limits-defined (EP002)
 * Validates that every edge rule declares a rate limit. Rules without rate
 * limits allow unlimited traffic through the edge, removing the primary DDoS
 * protection layer. Use skipRateLimitRequirement: true for internal-only routes.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'edge-policy-spec.json'), 'utf8'));

  if (spec.skipRateLimitRequirement) {
    return { pass: true, code: 'EP002', message: 'skipRateLimitRequirement=true — rate limit check skipped', skipped: true };
  }

  const violations = [];

  for (const rule of spec.rules) {
    const id = rule.name || rule.match || '(unnamed)';
    if (!rule.rateLimit) {
      violations.push({ rule: id, reason: 'No rateLimit defined — rule allows unlimited traffic', hint: 'Add rateLimit.requestsPerSecond or rateLimit.requestsPerMinute' });
    } else if (!rule.rateLimit.requestsPerSecond && !rule.rateLimit.requestsPerMinute) {
      violations.push({ rule: id, reason: 'rateLimit declared but no rate value specified', hint: 'Set either requestsPerSecond or requestsPerMinute' });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'EP002',
      message: `${violations.length} rule(s) missing rate limits`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'EP002', message: 'All rules have rate limits defined' };
}
