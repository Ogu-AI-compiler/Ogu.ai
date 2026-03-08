import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TM002 — stride-categories-valid: every threat must have a valid STRIDE category */
export async function run({ dir }) {
  const specPath = join(dir, 'threat-model.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'TM002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TM002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.threats) || spec.threats.length === 0) {
    return { pass: true, code: 'TM002', message: 'No threats declared — gate skipped', skipped: true };
  }

  const VALID_STRIDE = new Set([
    'spoofing', 'tampering', 'repudiation',
    'information_disclosure', 'denial_of_service', 'elevation_of_privilege',
    // Common abbreviations
    's', 't', 'r', 'i', 'd', 'e',
  ]);

  const violations = [];

  for (const threat of spec.threats) {
    const id = threat.id || '?';
    const category = String(threat.stride_category || '').toLowerCase().replace(/ /g, '_');
    if (!VALID_STRIDE.has(category)) {
      violations.push(`Threat "${id}": stride_category "${threat.stride_category}" is not valid — must be one of: Spoofing, Tampering, Repudiation, Information_Disclosure, Denial_of_Service, Elevation_of_Privilege`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TM002',
      message: `${violations.length} threat(s) have invalid STRIDE category`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'TM002', message: `All ${spec.threats.length} threat(s) have valid STRIDE categories` };
}
