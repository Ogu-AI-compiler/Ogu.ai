import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * JN001 — spec-valid
 * Validates that notebook-spec.json exists and contains all required fields.
 *
 * Why:
 * - A notebook without a declared purpose is undiscoverable: future engineers
 *   cannot determine from the filename alone whether it is exploratory, a
 *   training script, a report, or a utility.
 * - Declaring sections enables the notebook-sections gate to verify the
 *   notebook covers the topics it claimed to cover.
 * - Machine-readable specs enable automated notebook catalog generation
 *   and dependency tracking across the project.
 *
 * Escape hatch: none — all non-trivial notebooks need a spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'notebook-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'JN001', message: 'notebook-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'JN001', message: 'notebook-spec.json is invalid JSON' }; }

  const required = ['notebook_name', 'purpose', 'sections'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'JN001', message: `notebook-spec.json missing: ${missing.join(', ')}` };
  }

  if (!Array.isArray(spec.sections) || spec.sections.length === 0) {
    return { pass: false, code: 'JN001', message: 'sections must be a non-empty array of section names' };
  }

  return { pass: true, code: 'JN001', message: `Spec valid: "${spec.notebook_name}", ${spec.sections.length} sections declared` };
}
