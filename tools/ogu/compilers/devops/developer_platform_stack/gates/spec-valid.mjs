/**
 * Gate: spec-valid (DP001)
 * Validates that dev-platform-spec.json exists, is valid JSON, and declares
 * a name and a non-empty components array. Missing fields cause downstream gates
 * (component recognition, golden paths, IDP, SBOM coverage) to fail with
 * misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'dev-platform-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'DP001',
      message: 'dev-platform-spec.json not found',
      detail: { searched: specPath, hint: 'Create dev-platform-spec.json with name and components fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'DP001', message: `dev-platform-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = ['name', 'components'].filter(f => !spec[f]);
  if (missing.length) {
    return {
      pass: false, code: 'DP001',
      message: `dev-platform-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, hint: 'name identifies the platform; components is an array of platform tool/service configurations' },
    };
  }

  if (!Array.isArray(spec.components) || spec.components.length === 0) {
    return {
      pass: false, code: 'DP001',
      message: 'components must be a non-empty array',
      detail: { hint: 'Add at least one component (e.g., source-control, ci-cd, artifact-registry)' },
    };
  }

  return { pass: true, code: 'DP001', message: `dev-platform-spec.json valid — ${spec.components.length} component(s)` };
}
