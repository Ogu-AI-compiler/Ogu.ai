/**
 * Gate: scanners-known (SS002)
 * Validates that every declared scanner type is in the allowlist of recognised
 * security tools. Unknown scanner types may be typos or unsupported tools that
 * will fail silently at pipeline execution time.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const KNOWN_SCANNERS = new Set([
  'trivy', 'snyk', 'grype', 'semgrep', 'bandit', 'gosec',
  'checkov', 'tfsec', 'kubesec', 'nuclei', 'sonarqube',
  'owasp-zap', 'nikto', 'clair',
]);

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'security-scan-spec.json'), 'utf8'));
  const violations = spec.scanners
    .filter(s => !KNOWN_SCANNERS.has(s.type?.toLowerCase()))
    .map(s => ({
      type:    s.type || '(no type)',
      reason:  `Scanner type "${s.type}" is not in the allowlist of recognised security tools`,
      allowed: [...KNOWN_SCANNERS],
    }));

  if (violations.length) {
    return {
      pass: false, code: 'SS002',
      message: `${violations.length} unknown scanner type(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'SS002', message: `All ${spec.scanners.length} scanner(s) recognized` };
}
