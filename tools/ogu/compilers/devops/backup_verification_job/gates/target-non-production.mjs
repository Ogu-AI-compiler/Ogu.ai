/**
 * Gate: target-non-production (BV002)
 * Validates that the backup restore target is not a production environment.
 * Restoring a backup into production as a verification step risks data
 * corruption and service disruption. Verification must use an isolated
 * staging, dr-sandbox, or verify environment.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const PRODUCTION_NAMES = new Set(['production', 'prod', 'live', 'prd']);

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'backup-verify-spec.json'), 'utf8'));

  if (!spec.restoreTarget) {
    return {
      pass: false, code: 'BV002',
      message: 'restoreTarget is required — specify the environment where the backup will be restored for verification',
      detail: { hint: 'Use a non-production environment such as "staging", "verify", or "dr-sandbox"' },
    };
  }

  const target = spec.restoreTarget.toLowerCase().trim();

  if (PRODUCTION_NAMES.has(target) && !spec.productionOverride) {
    return {
      pass: false, code: 'BV002',
      message: `restoreTarget "${spec.restoreTarget}" is a production environment — backup verification must not run against production`,
      detail: {
        restoreTarget: spec.restoreTarget,
        reason:        'Restoring a backup into production risks data corruption and service disruption',
        hint:          'Use an isolated staging or dr-sandbox environment. Add productionOverride: true only with written justification.',
      },
    };
  }

  return { pass: true, code: 'BV002', message: `Restore target is non-production: ${spec.restoreTarget}` };
}
