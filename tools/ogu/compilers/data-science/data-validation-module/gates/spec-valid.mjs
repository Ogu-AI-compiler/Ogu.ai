import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DV001 — spec-valid
 * Validates that validation-spec.json exists and contains all required fields.
 *
 * Why:
 * - A validation module without a spec cannot declare what it validates or
 *   what "valid" means. Without critical_columns, the validator may pass
 *   data that is missing the columns the model depends on.
 * - Declaring the validation library enables CI to verify the library is
 *   installed, prevents environment drift between development and production.
 *
 * Escape hatch: none — validation modules must have a machine-readable spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'validation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'DV001', message: 'validation-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'DV001', message: 'validation-spec.json is invalid JSON' }; }

  const required = ['dataset', 'critical_columns', 'library'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'DV001', message: `validation-spec.json missing: ${missing.join(', ')}` };
  }

  const VALID_LIBS = ['pandera', 'great_expectations', 'deepchecks', 'cerberus', 'voluptuous'];
  if (!VALID_LIBS.includes(spec.library)) {
    return {
      pass: false, code: 'DV001',
      message: `Unknown library: "${spec.library}" — use one of: ${VALID_LIBS.join(', ')}`,
    };
  }

  return { pass: true, code: 'DV001', message: `Spec valid: ${spec.dataset}, library: ${spec.library}` };
}
