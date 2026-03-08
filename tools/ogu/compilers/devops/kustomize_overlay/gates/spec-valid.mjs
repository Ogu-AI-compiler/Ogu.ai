/**
 * Gate: spec-valid (KO001)
 * Validates that kustomize-spec.json exists, is valid JSON, and declares
 * the required fields. Missing base or environment causes downstream gates
 * (namespace matching, image tag policy) to fail with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED = ['base', 'environment'];

export async function run({ dir }) {
  const specPath = join(dir, 'kustomize-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'KO001',
      message: 'kustomize-spec.json not found',
      detail: { searched: specPath, hint: 'Create kustomize-spec.json with base and environment fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'KO001', message: `kustomize-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'KO001',
      message: `kustomize-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, required: REQUIRED, hint: 'base points to the base kustomization directory; environment identifies the target deploy environment' },
    };
  }

  return { pass: true, code: 'KO001', message: 'kustomize-spec.json valid' };
}
