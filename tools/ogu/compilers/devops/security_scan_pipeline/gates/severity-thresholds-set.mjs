/**
 * Gate: severity-thresholds-set (SS003)
 * Validates that every scanner declares a failOn severity threshold. Without
 * a threshold, the scanner runs but never fails the pipeline — vulnerabilities
 * are reported but do not block deployments.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'security-scan-spec.json'), 'utf8'));
  const violations = [];

  for (const scanner of spec.scanners) {
    if (!scanner.failOn) {
      violations.push({
        scanner: scanner.type || '(no type)',
        reason:  'Missing failOn severity threshold — scanner will run but never fail the pipeline',
        hint:    `Set failOn to one of: ${[...VALID_SEVERITIES].join(', ')}`,
      });
    } else if (!VALID_SEVERITIES.has(scanner.failOn.toLowerCase())) {
      violations.push({
        scanner:  scanner.type,
        received: scanner.failOn,
        allowed:  [...VALID_SEVERITIES],
        reason:   `failOn value "${scanner.failOn}" is not a recognised severity level`,
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SS003',
      message: `${violations.length} severity threshold issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'SS003', message: 'All scanners have severity thresholds' };
}
