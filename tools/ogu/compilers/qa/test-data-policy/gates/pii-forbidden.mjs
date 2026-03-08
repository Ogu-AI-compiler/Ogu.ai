import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA081 — pii-forbidden
 * Test data must not contain real PII (Personally Identifiable Information).
 *
 * Using real user data in tests creates:
 *   - GDPR/CCPA violations (test data is often less secure than prod)
 *   - Security risk (dev laptops, CI logs, snapshots are less controlled)
 *   - Compliance failures in regulated industries (healthcare, finance)
 *   - Test brittleness (data changes in prod → tests break)
 *
 * This gate checks:
 *   1. spec.piiPolicy.allowRealData must not be true
 *   2. If spec.piiPolicy.source is "production-copy" or "prod-dump" — fail
 *   3. spec.piiPolicy.anonymization must be declared if source involves real data
 *
 * Fixture files are NOT scanned (that would require reading user test files).
 * This gate validates the policy intent, not the fixture content.
 */

const FORBIDDEN_SOURCES = new Set([
  'production-copy', 'prod-copy', 'prod-dump', 'production-dump', 'live-export', 'prod-export',
]);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'test-data-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA081', message: 'test-data-policy-spec.json not readable' }; }

  const pii = spec.piiPolicy;
  if (!pii || typeof pii !== 'object') {
    return { pass: false, code: 'QA081', message: 'spec.piiPolicy not declared' };
  }

  if (pii.allowRealData === true) {
    return {
      pass: false, code: 'QA081',
      message: 'piiPolicy.allowRealData: true — real PII is forbidden in test data',
      detail: 'Use anonymized/synthetic data instead. Real PII in test fixtures violates GDPR Article 5(1)(f) and risks exposure in CI logs, dev machines, and snapshots.',
    };
  }

  const source = (pii.source ?? '').toLowerCase();
  if (FORBIDDEN_SOURCES.has(source)) {
    return {
      pass: false, code: 'QA081',
      message: `piiPolicy.source "${pii.source}" is a production data source — forbidden`,
      detail: 'Even anonymized production copies carry risk. Use synthetic data generators (Faker, Factory Bot) or sanitized snapshots.',
    };
  }

  // If source mentions "anonymized" prod copy, anonymization must be declared
  if ((source.includes('prod') || source.includes('real')) && !pii.anonymization) {
    return {
      pass: false, code: 'QA081',
      message: `piiPolicy.source "${pii.source}" suggests real data — piiPolicy.anonymization must be declared`,
      detail: 'Document how PII is removed: masking, pseudonymization, or generative replacement.',
    };
  }

  return {
    pass: true, code: 'QA081',
    message: `PII policy valid — source: "${pii.source ?? 'not specified'}", allowRealData: ${pii.allowRealData ?? false}`,
  };
}
