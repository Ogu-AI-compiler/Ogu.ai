/**
 * Gate: autoscaling-bounds-valid (BW004)
 * When autoscaling is configured, validates that minReplicas <= maxReplicas and
 * that both values are valid. An inverted min/max causes the HPA to immediately
 * enter an error state and disable autoscaling for the worker.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'bg-worker-spec.json'), 'utf8'));
  const as   = spec.autoscaling;

  if (!as) return { pass: true, code: 'BW004', message: 'No autoscaling configured — skipped', skipped: true };

  const violations = [];

  if (typeof as.minReplicas !== 'number' || as.minReplicas < 0) {
    violations.push({ field: 'autoscaling.minReplicas', value: as.minReplicas, reason: 'must be a non-negative integer' });
  }
  if (typeof as.maxReplicas !== 'number' || as.maxReplicas < 1) {
    violations.push({ field: 'autoscaling.maxReplicas', value: as.maxReplicas, reason: 'must be a positive integer (≥ 1)' });
  }
  if (violations.length === 0 && as.minReplicas > as.maxReplicas) {
    violations.push({
      field:  'autoscaling',
      reason: `minReplicas (${as.minReplicas}) > maxReplicas (${as.maxReplicas}) — the HPA will enter an error state`,
      hint:   'minReplicas must be ≤ maxReplicas',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'BW004',
      message: `${violations.length} autoscaling bound issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'BW004', message: `Autoscaling bounds valid: ${as.minReplicas}–${as.maxReplicas} replicas` };
}
