/**
 * Gate: no-wildcard-paths (VP003)
 * Flags paths that use Vault wildcards (* or +) without an explicit exception
 * justification. Wildcard paths grant access to all current and future secrets
 * under that prefix — a security risk that requires deliberate approval.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'vault-policy-spec.json'), 'utf8'));
  const violations = [];

  for (const p of spec.paths) {
    if (p.path.includes('*') || p.path.includes('+')) {
      if (!p.wildcardException) {
        violations.push({
          path:   p.path,
          reason: 'wildcard path grants access to all current and future secrets under this prefix',
          hint:   'Add wildcardException: "reason" to explicitly acknowledge the broad access scope',
        });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'VP003',
      message: `${violations.length} wildcard path(s) without exception`,
      detail: {
        violations,
        hint: 'Narrow the path to a specific secret, or add wildcardException: "team scoped — read-only access to all secrets in this namespace" to each wildcard path',
      },
    };
  }

  return { pass: true, code: 'VP003', message: 'No unauthorized wildcard paths' };
}
