/**
 * Gate: hpa-bounds-valid (RS005)
 * Validates HPA configuration bounds for each workload. An inverted min/max
 * puts the HPA in an error state, a minReplicas of 0 allows the service to
 * scale to zero (unexpected for most services), and an out-of-range CPU
 * utilization target causes the HPA controller to never trigger.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'rightsizing-spec.json'), 'utf8'));
  const violations = [];

  for (const w of spec.workloads) {
    if (!w.hpa) continue;
    const { minReplicas, maxReplicas, targetCPUUtilizationPercentage } = w.hpa;

    if (minReplicas !== undefined && maxReplicas !== undefined && minReplicas > maxReplicas) {
      violations.push({ workload: w.name, field: 'hpa', reason: `minReplicas (${minReplicas}) > maxReplicas (${maxReplicas}) — HPA will enter an error state`, hint: 'minReplicas must be ≤ maxReplicas' });
    }
    if (minReplicas !== undefined && minReplicas < 1) {
      violations.push({ workload: w.name, field: 'hpa.minReplicas', value: minReplicas, reason: 'minReplicas must be ≥ 1 — a value of 0 allows the service to scale to zero unexpectedly' });
    }
    if (targetCPUUtilizationPercentage !== undefined && (targetCPUUtilizationPercentage < 1 || targetCPUUtilizationPercentage > 100)) {
      violations.push({ workload: w.name, field: 'hpa.targetCPUUtilizationPercentage', value: targetCPUUtilizationPercentage, reason: 'Must be between 1 and 100', hint: 'Typical values: 50-80 for most services' });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'RS005',
      message: `${violations.length} HPA bound violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'RS005', message: 'HPA bounds valid' };
}
