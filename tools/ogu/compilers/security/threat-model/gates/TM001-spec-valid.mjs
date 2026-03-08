import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TM001 — spec-valid: required top-level fields and structure */
export async function run({ dir }) {
  const specPath = join(dir, 'threat-model.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'TM001', message: 'No threat-model.json found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'TM001', message: 'threat-model.json is not valid JSON', detail: err.message };
  }

  const violations = [];

  if (!spec.feature || typeof spec.feature !== 'string') {
    violations.push('Missing or invalid field: feature (must be a non-empty string)');
  }
  if (!Array.isArray(spec.assets) || spec.assets.length === 0) {
    violations.push('Missing or invalid field: assets (must be a non-empty array)');
  }
  if (!Array.isArray(spec.trust_boundaries)) {
    violations.push('Missing or invalid field: trust_boundaries (must be an array)');
  }
  if (!Array.isArray(spec.threats)) {
    violations.push('Missing or invalid field: threats (must be an array)');
  }

  if (Array.isArray(spec.threats)) {
    const REQUIRED_THREAT_FIELDS = ['id', 'title', 'stride_category', 'affected_component', 'likelihood', 'impact'];
    spec.threats.forEach((threat, i) => {
      REQUIRED_THREAT_FIELDS.forEach(field => {
        if (threat[field] === undefined || threat[field] === null || threat[field] === '') {
          violations.push(`threats[${i}] (id: ${threat.id || '?'}): missing required field "${field}"`);
        }
      });
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TM001',
      message: `Spec validation failed: ${violations.length} violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'TM001', message: `Spec valid — ${spec.threats.length} threat(s) declared` };
}
