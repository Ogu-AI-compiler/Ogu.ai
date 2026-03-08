import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA014 — fail-build-enforced
 * failBuildBelow must not be "none".
 * A coverage policy that never fails the build is just documentation — it has
 * no teeth. Developers will ignore coverage regressions because there is no
 * consequence.
 *
 * Valid values:
 * - "global"   — fail if any global threshold is not met
 * - "per-file" — fail if any per-file threshold is not met
 * - "both"     — fail on either global or per-file violation
 *
 * "none" is explicitly forbidden.
 */

const VALID_FAIL_MODES = new Set(['global', 'per-file', 'both']);

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'coverage-policy-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA014', message: 'coverage-policy-spec.json not readable' };
  }

  const mode = spec.failBuildBelow;

  if (mode === 'none' || mode === false || mode === null) {
    return {
      pass: false, code: 'QA014',
      message: 'failBuildBelow is "none" — coverage policy is defined but never enforced',
      detail: 'A coverage policy that does not fail the build is decorative. Set failBuildBelow to "global", "per-file", or "both".',
    };
  }

  if (!VALID_FAIL_MODES.has(mode)) {
    return {
      pass: false, code: 'QA014',
      message: `failBuildBelow "${mode}" is not recognised — must be: ${[...VALID_FAIL_MODES].join(', ')}`,
    };
  }

  return {
    pass: true, code: 'QA014',
    message: `failBuildBelow: "${mode}" — coverage gates are enforced`,
  };
}
