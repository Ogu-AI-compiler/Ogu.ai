/**
 * Gate: contract-security-scan (SS007)
 * Validates that the security scan pipeline satisfies the contract: at least
 * one image scanner and one SAST scanner must be configured. Image scanning
 * catches known CVEs in container images. SAST catches code-level vulnerabilities.
 * Both are required for a complete security posture.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const IMAGE_SCANNERS = new Set(['trivy', 'grype', 'clair', 'snyk']);
const SAST_SCANNERS  = new Set(['semgrep', 'bandit', 'gosec', 'sonarqube']);

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'security-scan-spec.json'), 'utf8'));
  const types      = spec.scanners.map(s => s.type?.toLowerCase());
  const violations = [];

  if (!types.some(t => IMAGE_SCANNERS.has(t)) && !spec.skipImageScan) {
    violations.push({
      rule:     'image-scanner-required',
      reason:   'No image scanner defined — container image CVEs will not be detected',
      options:  [...IMAGE_SCANNERS],
      hint:     'Add a scanner with type: trivy, grype, clair, or snyk. Set skipImageScan: true for exemption.',
    });
  }
  if (!types.some(t => SAST_SCANNERS.has(t)) && !spec.skipSAST) {
    violations.push({
      rule:     'sast-scanner-required',
      reason:   'No SAST scanner defined — code-level vulnerabilities will not be detected',
      options:  [...SAST_SCANNERS],
      hint:     'Add a scanner with type: semgrep, bandit, gosec, or sonarqube. Set skipSAST: true for exemption.',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'SS007',
      message: `${violations.length} security scan pipeline contract violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'SS007', message: 'Security scan pipeline contract satisfied' };
}
