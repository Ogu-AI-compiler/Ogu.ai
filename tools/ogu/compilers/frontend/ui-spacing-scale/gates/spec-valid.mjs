import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** USS001 — spec-valid: spacing-scale-spec.json exists with steps array and baseUnit */
export async function run({ dir }) {
  const specPath = join(dir, 'spacing-scale-spec.json');

  if (!existsSync(specPath)) {
    return { pass: false, code: 'USS001', message: 'spacing-scale-spec.json not found', detail: `Expected at: ${specPath}` };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'USS001', message: 'spacing-scale-spec.json is not valid JSON', detail: err.message };
  }

  if (!spec.baseUnit) {
    return { pass: false, code: 'USS001', message: 'spacing-scale-spec.json missing required field: baseUnit (e.g. "4px" or 4)' };
  }

  if (!spec.steps || !Array.isArray(spec.steps) || spec.steps.length === 0) {
    return { pass: false, code: 'USS001', message: 'spacing-scale-spec.json missing required field: steps (non-empty array)' };
  }

  return { pass: true, code: 'USS001', message: `Spec valid — baseUnit: ${spec.baseUnit}, ${spec.steps.length} step(s)` };
}
