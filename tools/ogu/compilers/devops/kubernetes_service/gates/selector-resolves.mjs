/**
 * Gate: selector-resolves (KS002)
 * Cross-artifact gate: when a k8s-workload-artifact.json exists, validates that the
 * Service selector matches the workload name (which becomes the default pod label).
 * A Service with a selector that doesn't match any workload's pod labels routes zero
 * traffic — the endpoint list remains permanently empty.
 *
 * Falls back gracefully when no workload artifact exists (workload not yet compiled).
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'k8s-service-spec.json'), 'utf8'));

  // Multi-path artifact resolution — workload may be in a sibling or parent directory
  const candidates = [
    join(dir, 'k8s-workload-artifact.json'),
    join(dirname(dir), 'k8s-workload-artifact.json'),
    join(dirname(dir), 'kubernetes_workload', 'k8s-workload-artifact.json'),
  ];
  const artifactPath = candidates.find(p => existsSync(p));

  if (!artifactPath) {
    return {
      pass: true, code: 'KS002',
      message: 'No workload artifact — selector resolution skipped',
      skipped: true,
    };
  }

  const workload    = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const selectorApp = spec.selector?.app || spec.selector?.['app.kubernetes.io/name'];

  if (selectorApp && workload.name !== selectorApp) {
    return {
      pass: false, code: 'KS002',
      message: `Selector app "${selectorApp}" does not match workload name "${workload.name}"`,
      detail: {
        selector:  spec.selector,
        workload:  workload.name,
        hint: `Update selector.app to "${workload.name}" to route traffic to the workload pods`,
      },
    };
  }

  return {
    pass: true, code: 'KS002',
    message: `Selector resolves to workload "${workload.name}"`,
  };
}
