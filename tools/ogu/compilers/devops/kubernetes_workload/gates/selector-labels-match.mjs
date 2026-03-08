/**
 * Gate: selector-labels-match (KW002)
 * Validates that every label in selectorLabels is also present in podLabels. Kubernetes
 * rejects workloads where the selector does not match the pod template labels — pods
 * will not be scheduled and the workload will report a configuration error forever.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec           = JSON.parse(readFileSync(join(dir, 'k8s-workload-spec.json'), 'utf8'));
  const selectorLabels = spec.selectorLabels || spec.selector?.matchLabels || {};
  const podLabels      = spec.podLabels || spec.template?.metadata?.labels || {};

  if (Object.keys(selectorLabels).length === 0) {
    return {
      pass: true, code: 'KW002',
      message: `No explicit selectorLabels — default label "app: ${spec.name}" assumed`,
    };
  }

  const violations = [];
  for (const [key, value] of Object.entries(selectorLabels)) {
    if (podLabels[key] !== value) {
      violations.push({
        label:       `${key}: ${value}`,
        reason:      'selector label not found in pod template labels',
        podLabels:   podLabels,
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'KW002',
      message: `${violations.length} selector/pod label mismatch(es)`,
      detail: {
        violations,
        hint: 'Selector labels must be a subset of pod template labels. Kubernetes will reject the workload otherwise.',
      },
    };
  }

  return { pass: true, code: 'KW002', message: 'Selector labels match pod template labels' };
}
