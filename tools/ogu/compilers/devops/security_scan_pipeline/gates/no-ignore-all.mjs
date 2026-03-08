/**
 * Gate: no-ignore-all (SS004)
 * Validates that no scanner uses a blanket ignore rule. ignoreAll=true or
 * ignoreVulns=["*"] effectively disables the scanner — the pipeline runs and
 * reports success while ignoring all findings. This defeats the purpose of
 * having security scanning in the pipeline.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'security-scan-spec.json'), 'utf8'));
  const violations = [];

  for (const scanner of spec.scanners) {
    if (scanner.ignoreAll === true) {
      violations.push({ scanner: scanner.type, field: 'ignoreAll', reason: 'ignoreAll=true disables all security checks for this scanner', hint: 'Remove ignoreAll or use specific ignore rules for known false positives' });
    }
    if (Array.isArray(scanner.ignoreVulns) && scanner.ignoreVulns.includes('*')) {
      violations.push({ scanner: scanner.type, field: 'ignoreVulns', reason: 'ignoreVulns=["*"] ignores all vulnerabilities — scanner will never block', hint: 'List specific CVE IDs instead of using a wildcard' });
    }
  }

  if (spec.globalIgnore === true) {
    violations.push({ field: 'globalIgnore', reason: 'globalIgnore=true disables all scanners in the pipeline', hint: 'Remove globalIgnore — this defeats the purpose of the security scan pipeline' });
  }

  if (violations.length) {
    return {
      pass: false, code: 'SS004',
      message: `${violations.length} unsafe ignore rule(s) found`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'SS004', message: 'No blanket ignore rules found' };
}
