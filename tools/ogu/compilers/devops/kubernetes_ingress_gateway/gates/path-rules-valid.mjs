/**
 * Gate: path-rules-valid (KI005)
 * Validates that every path rule starts with / and uses a recognised pathType. Paths
 * that don't start with / are rejected by most ingress controllers. An invalid pathType
 * silently falls back to ImplementationSpecific behaviour, which varies by controller.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_PATH_TYPES = ['Prefix', 'Exact', 'ImplementationSpecific', 'PathPrefix', 'RegularExpression'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'k8s-ingress-spec.json'), 'utf8'));
  const violations = [];

  for (const rule of spec.rules) {
    for (const p of (rule.paths || [])) {
      if (!p.path) {
        violations.push({ host: rule.host, reason: 'path entry has no path field' });
        continue;
      }
      if (!p.path.startsWith('/')) {
        violations.push({ host: rule.host, path: p.path, reason: 'path must start with "/" — most ingress controllers reject non-rooted paths' });
      }
      if (p.pathType && !VALID_PATH_TYPES.includes(p.pathType)) {
        violations.push({ host: rule.host, path: p.path, pathType: p.pathType, reason: `invalid pathType — must be one of: ${VALID_PATH_TYPES.join(', ')}` });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'KI005',
      message: `${violations.length} path rule issue(s)`,
      detail: { violations, hint: 'Valid path example: { path: "/api", pathType: "Prefix", backend: { service: "my-api", port: 80 } }' },
    };
  }

  return { pass: true, code: 'KI005', message: 'All path rules are valid' };
}
