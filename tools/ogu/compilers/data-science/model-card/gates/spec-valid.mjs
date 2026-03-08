import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MC001 — spec-valid
 * Validates that model-card-spec.json exists and contains all required fields.
 *
 * Why:
 * - A model card spec is the entry point for all model documentation gates:
 *   without it, gates cannot verify intended use, bias documentation, or
 *   performance thresholds.
 * - Declaring intended_use in the spec (rather than relying solely on the
 *   markdown card) enables automated use-case compatibility checks between
 *   the model and its deployment context.
 * - The model_type and task fields enable deployment validators to reject
 *   model cards that describe a different model family than what is deployed.
 *
 * Escape hatch: none — all production models need a machine-readable card spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'model-card-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'MC001', message: 'model-card-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'MC001', message: 'model-card-spec.json is invalid JSON' }; }

  const required = ['model_name', 'model_type', 'task', 'intended_use'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'MC001', message: `model-card-spec.json missing: ${missing.join(', ')}` };
  }

  return { pass: true, code: 'MC001', message: `Spec valid: model="${spec.model_name}", task="${spec.task}"` };
}
