/**
 * Gate: thresholds-valid (PC004)
 * Validates that all probe timing and threshold fields are positive integers, and
 * enforces the Kubernetes constraint that liveness.successThreshold must equal 1.
 * A successThreshold > 1 for liveness is rejected by the API server — Kubernetes
 * requires liveness to succeed once to consider the container healthy.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TIMING_FIELDS = ['initialDelaySeconds', 'periodSeconds', 'timeoutSeconds', 'successThreshold', 'failureThreshold'];

/** @param {object|null} probe @param {string} name */
function checkThresholds(probe, name) {
  if (!probe) return [];
  const errors = [];

  for (const field of TIMING_FIELDS) {
    if (probe[field] !== undefined) {
      if (!Number.isInteger(probe[field]) || probe[field] <= 0) {
        errors.push({
          probe: name, field,
          value: probe[field],
          reason: `${name}.${field} must be a positive integer, got: ${probe[field]}`,
        });
      }
    }
  }

  if (probe.successThreshold && probe.successThreshold > 1 && name === 'liveness') {
    errors.push({
      probe: name, field: 'successThreshold',
      value: probe.successThreshold,
      reason: `liveness.successThreshold must be 1 — Kubernetes API server rejects liveness probes with successThreshold > 1`,
    });
  }

  return errors;
}

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'probe-config-spec.json'), 'utf8'));
  const violations = [
    ...checkThresholds(spec.probes.liveness,  'liveness'),
    ...checkThresholds(spec.probes.readiness, 'readiness'),
    ...checkThresholds(spec.probes.startup,   'startup'),
  ];

  if (violations.length) {
    return {
      pass: false, code: 'PC004',
      message: `${violations.length} threshold/timing issue(s)`,
      detail: { violations, hint: 'All timing fields must be positive integers. liveness.successThreshold must be exactly 1.' },
    };
  }

  return {
    pass: true, code: 'PC004',
    message: 'All probe thresholds and timing values are valid',
  };
}
