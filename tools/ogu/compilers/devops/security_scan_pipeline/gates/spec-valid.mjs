/**
 * Gate: spec-valid (SS001)
 * Validates that security-scan-spec.json exists, is valid JSON, and declares
 * a name and a non-empty scanners array. Missing fields cause downstream gates
 * (scanner recognition, severity thresholds, ignore rules) to fail with
 * misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'security-scan-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'SS001',
      message: 'security-scan-spec.json not found',
      detail: { searched: specPath, hint: 'Create security-scan-spec.json with name and scanners fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'SS001', message: `security-scan-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = ['name', 'scanners'].filter(f => !spec[f]);
  if (missing.length) {
    return {
      pass: false, code: 'SS001',
      message: `security-scan-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, hint: 'name identifies the pipeline; scanners is an array of scanner configurations' },
    };
  }

  if (!Array.isArray(spec.scanners) || spec.scanners.length === 0) {
    return {
      pass: false, code: 'SS001',
      message: 'scanners must be a non-empty array',
      detail: { hint: 'Add at least one scanner with a type and failOn severity threshold' },
    };
  }

  return { pass: true, code: 'SS001', message: `security-scan-spec.json valid — ${spec.scanners.length} scanner(s)` };
}
