/**
 * Gate: chart-yaml-valid (HC002)
 * Validates that Chart.yaml exists and declares the minimum required fields.
 * A Chart.yaml without apiVersion, name, or version will be rejected by helm
 * commands (`helm lint`, `helm install`) before any templates are rendered.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_FIELDS = ['name', 'version', 'apiVersion'];

export async function run({ dir }) {
  const chartPath = join(dir, 'Chart.yaml');

  if (!existsSync(chartPath)) {
    return {
      pass: false, code: 'HC002',
      message: 'Chart.yaml not found',
      detail: { searched: chartPath, hint: 'Every Helm chart must have a Chart.yaml at its root' },
    };
  }

  const content = readFileSync(chartPath, 'utf8');
  const missing = REQUIRED_FIELDS.filter(k => !new RegExp('^' + k + ':', 'm').test(content));

  if (missing.length) {
    return {
      pass: false, code: 'HC002',
      message: `Chart.yaml missing required field(s): ${missing.join(', ')}`,
      detail: {
        missing,
        required: REQUIRED_FIELDS,
        hint: 'apiVersion should be "v2" for Helm 3 charts',
      },
    };
  }

  return { pass: true, code: 'HC002', message: 'Chart.yaml valid' };
}
