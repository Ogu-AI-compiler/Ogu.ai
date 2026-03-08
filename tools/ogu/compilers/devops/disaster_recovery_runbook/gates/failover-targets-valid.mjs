/**
 * Gate: failover-targets-valid (DR004)
 * Validates the failover configuration when declared. Primary and secondary
 * regions must be different, both must be specified, and the failover strategy
 * must be one of the recognised patterns.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_STRATEGIES = new Set(['active-active', 'active-passive', 'pilot-light', 'warm-standby']);

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'dr-runbook-spec.json'), 'utf8'));

  if (!spec.failover) {
    return { pass: true, code: 'DR004', message: 'No failover config — skipping', skipped: true };
  }

  const { failover }  = spec;
  const violations    = [];

  if (!failover.primaryRegion)   violations.push({ field: 'failover.primaryRegion',   reason: 'primaryRegion is required', hint: 'Specify the primary cloud region (e.g., "us-east-1")' });
  if (!failover.secondaryRegion) violations.push({ field: 'failover.secondaryRegion', reason: 'secondaryRegion is required', hint: 'Specify the failover cloud region (e.g., "eu-west-1")' });

  if (failover.primaryRegion && failover.secondaryRegion && failover.primaryRegion === failover.secondaryRegion) {
    violations.push({ field: 'failover', reason: `primaryRegion and secondaryRegion are both "${failover.primaryRegion}" — they must be different regions`, hint: 'Choose regions in separate geographic locations for resilience' });
  }

  if (!failover.strategy) {
    violations.push({ field: 'failover.strategy', allowed: [...VALID_STRATEGIES], reason: 'failover.strategy is required', hint: `Use one of: ${[...VALID_STRATEGIES].join(', ')}` });
  } else if (!VALID_STRATEGIES.has(failover.strategy)) {
    violations.push({ field: 'failover.strategy', received: failover.strategy, allowed: [...VALID_STRATEGIES], reason: `"${failover.strategy}" is not a recognised failover strategy` });
  }

  if (violations.length) {
    return {
      pass: false, code: 'DR004',
      message: `${violations.length} failover target issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DR004', message: `Failover: ${failover.primaryRegion} → ${failover.secondaryRegion} (${failover.strategy})` };
}
