import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MT001 — spec-valid
 * Validates that training-spec.json exists and contains all required fields.
 *
 * Why:
 * - A training script without a declared task type cannot be validated by
 *   downstream gates: evaluation gates need to know if they are checking
 *   classification metrics or regression metrics.
 * - Requiring config_file reference enforces the hyperparameters-configurable
 *   contract: if a config file is declared, it must exist and be used.
 * - Declaring metrics enables automated alert when evaluation omits a required
 *   metric that was committed to in the spec before training ran.
 *
 * Escape hatch: none — all training scripts need a machine-readable spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'training-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'MT001', message: 'training-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'MT001', message: 'training-spec.json is invalid JSON' }; }

  const required = ['model_type', 'task', 'config_file', 'metrics'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'MT001', message: `training-spec.json missing: ${missing.join(', ')}` };
  }

  const VALID_TASKS = ['classification', 'regression', 'clustering', 'ranking', 'multi-label'];
  if (!VALID_TASKS.includes(spec.task)) {
    return {
      pass: false, code: 'MT001',
      message: `Unknown task: "${spec.task}" — use one of: ${VALID_TASKS.join(', ')}`,
    };
  }

  return { pass: true, code: 'MT001', message: `Spec valid: ${spec.model_type}, task: ${spec.task}` };
}
