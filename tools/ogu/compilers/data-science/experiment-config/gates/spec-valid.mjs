import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * EC001 — spec-valid
 * Validates that experiment-spec.json exists and contains all required fields.
 *
 * Why:
 * - An experiment without a declared model type and hyperparameter set cannot
 *   be reproduced: which model was run? With what parameters?
 * - Machine-readable experiment specs enable automated hyperparameter search,
 *   cross-experiment comparison, and audit trails for model governance.
 * - The spec also acts as the interface contract for config gates: without
 *   it, gates like all-hyperparams-documented cannot know what to check.
 *
 * Escape hatch: none — all ML experiments need a machine-readable spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'experiment-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'EC001', message: 'experiment-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'EC001', message: 'experiment-spec.json is invalid JSON' }; }

  const required = ['experiment_name', 'model_type', 'hyperparameters'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'EC001', message: `experiment-spec.json missing: ${missing.join(', ')}` };
  }

  if (typeof spec.hyperparameters !== 'object' || Array.isArray(spec.hyperparameters)) {
    return { pass: false, code: 'EC001', message: 'hyperparameters must be an object (key → value)' };
  }

  return { pass: true, code: 'EC001', message: `Spec valid: "${spec.experiment_name}", model: ${spec.model_type}` };
}
