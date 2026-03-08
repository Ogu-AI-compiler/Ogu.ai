/**
 * Gate: spec-valid (HC001)
 * Validates that helm-chart-spec.json exists, is valid JSON, and declares
 * all required fields. Missing fields here cause downstream gates (values
 * coverage, contract checks) to fail with unhelpful "cannot read property" errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED = ['chartName', 'version', 'appVersion'];

export async function run({ dir }) {
  const specPath = join(dir, 'helm-chart-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'HC001',
      message: 'helm-chart-spec.json not found',
      detail: { searched: specPath, hint: 'Create helm-chart-spec.json with chartName, version, and appVersion fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'HC001', message: `helm-chart-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'HC001',
      message: `helm-chart-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, required: REQUIRED, hint: 'All three fields are required to generate a valid Chart.yaml' },
    };
  }

  return { pass: true, code: 'HC001', message: 'helm-chart-spec.json valid' };
}
