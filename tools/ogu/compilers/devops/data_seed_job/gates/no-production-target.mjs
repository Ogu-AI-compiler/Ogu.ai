/**
 * Gate: no-production-target (DS004)
 * Validates that the seed job does not target production unless an explicit
 * override is declared. Seed jobs are designed for development and staging
 * environments — running them in production can corrupt live data or violate
 * GDPR/data compliance requirements.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const PRODUCTION_NAMES = new Set(['production', 'prod']);

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'data-seed-spec.json'), 'utf8'));
  const envs = (spec.targetEnvironments || []).map(e => e.toLowerCase());

  const prodEnvs = envs.filter(e => PRODUCTION_NAMES.has(e));

  if (prodEnvs.length > 0 && !spec.productionOverride) {
    return {
      pass: false, code: 'DS004',
      message: `Production environment(s) in targetEnvironments without productionOverride`,
      detail: {
        productionTargets: prodEnvs,
        hint: 'Add productionOverride: true with a written justification if seeding production is intentional. This is a data safety gate.',
      },
    };
  }

  return { pass: true, code: 'DS004', message: `Target environments: ${envs.join(', ')}` };
}
