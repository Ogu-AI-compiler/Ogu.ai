/**
 * Gate: capabilities-allowed (VP004)
 * Validates that every capability declared in the policy is a recognised Vault
 * capability. Unrecognised capabilities are silently ignored by Vault but indicate
 * a typo or misunderstanding of the Vault policy language.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ALLOWED_CAPS = new Set(['create', 'read', 'update', 'delete', 'list', 'patch', 'sudo', 'deny']);

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'vault-policy-spec.json'), 'utf8'));
  const violations = [];

  for (const p of spec.paths) {
    const invalid = (p.capabilities || []).filter(c => !ALLOWED_CAPS.has(c));
    if (invalid.length) {
      violations.push({
        path:          p.path,
        invalidCaps:   invalid,
        reason:        `unrecognised Vault capability(ies): ${invalid.join(', ')}`,
        allowedValues: [...ALLOWED_CAPS],
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'VP004',
      message: `${violations.length} path(s) with invalid capabilities`,
      detail: {
        violations,
        hint: `Vault capabilities must be one of: ${[...ALLOWED_CAPS].join(', ')}`,
      },
    };
  }

  return {
    pass: true, code: 'VP004',
    message: `All capabilities are from the allowed set (${[...ALLOWED_CAPS].join(', ')})`,
  };
}
