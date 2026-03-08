/**
 * Gate: contract-secret-bundle (SB007)
 * Enforces the secret_bundle runtime contract: a rotation policy must be declared
 * (undefined rotation is an audit/compliance risk), at least one deployment environment
 * must be defined, and secret names within the bundle must be unique (duplicates
 * cause non-deterministic resolution by the secret store).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_ROTATION_POLICIES = ['30d', '90d', '180d', '1y', 'manual', 'never'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'secret-bundle-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.rotationPolicy) {
    violations.push({
      rule:   'rotation-policy-required',
      reason: 'No rotationPolicy defined — secret rotation schedule is required for compliance',
      hint:   `Set rotationPolicy to one of: ${VALID_ROTATION_POLICIES.join(', ')}`,
    });
  } else if (!VALID_ROTATION_POLICIES.includes(spec.rotationPolicy)) {
    violations.push({
      rule:          'rotation-policy-invalid',
      value:         spec.rotationPolicy,
      allowedValues: VALID_ROTATION_POLICIES,
      reason:        `"${spec.rotationPolicy}" is not a recognised rotation policy`,
    });
  }

  if (!spec.environments || spec.environments.length === 0) {
    violations.push({
      rule:   'environments-required',
      reason: 'No environments defined for secret deployment',
      hint:   'Add at least one environment (e.g. ["staging", "production"])',
    });
  }

  const names = spec.secrets.map(s => s.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) {
    violations.push({
      rule:       'unique-names',
      duplicates: [...new Set(dupes)],
      reason:     'Duplicate secret names in the bundle — runtime resolution is non-deterministic',
      hint:       'Remove or rename duplicate secret entries',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'SB007',
      message: `${violations.length} contract violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'SB007',
    message: `Secret bundle contract satisfied — ${spec.secrets.length} secrets, rotation: ${spec.rotationPolicy}, namespace: "${spec.namespace}"`,
  };
}
