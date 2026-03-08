/**
 * Gate: paths-in-allowed-prefix (VP002)
 * Validates that every path in the policy is under an org-allowed Vault mount prefix.
 * Paths that don't start with a known mount prefix are likely typos or attempts to
 * access mounts that don't exist or haven't been approved for application use.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_ALLOWED_PREFIXES = ['secret/', 'kv/', 'auth/', 'pki/', 'transit/', 'database/', 'aws/', 'gcp/', 'azure/'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'vault-policy-spec.json'), 'utf8'));
  const allowed    = spec.allowedPrefixes || DEFAULT_ALLOWED_PREFIXES;
  const violations = [];

  for (const p of spec.paths) {
    const normalizedPath = p.path.replace(/\*$/, '').replace(/\+\//g, '/');
    const isAllowed = allowed.some(prefix =>
      normalizedPath.startsWith(prefix) || normalizedPath === prefix.replace(/\/$/, '')
    );
    if (!isAllowed) {
      violations.push({
        path:           p.path,
        allowedPrefixes: allowed,
        reason:         `path is outside the allowed prefix set`,
        hint:           `Add the required prefix (e.g., "secret/data/${p.path}") or add the prefix to allowedPrefixes`,
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'VP002',
      message: `${violations.length} path(s) outside allowed prefix`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'VP002',
    message: `All ${spec.paths.length} paths are within allowed prefixes`,
  };
}
