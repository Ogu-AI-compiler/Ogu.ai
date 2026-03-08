/**
 * Gate: rollout-strategy-valid (KW006)
 * Validates the Kubernetes rollout/update strategy. An invalid strategy type will
 * be silently ignored by Kubernetes (it falls back to default), making the spec
 * misleading. Invalid RollingUpdate parameters cause the controller to reject the
 * workload manifest entirely.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_TYPES = ['RollingUpdate', 'Recreate'];

function parseIntOrPercent(val) {
  if (typeof val === 'number') return { valid: val >= 0, value: val };
  if (typeof val === 'string' && val.endsWith('%')) {
    const n = parseInt(val, 10);
    return { valid: !isNaN(n) && n >= 0 && n <= 100, value: val };
  }
  const n = parseInt(val, 10);
  return { valid: !isNaN(n) && n >= 0, value: val };
}

export async function run({ dir }) {
  const spec     = JSON.parse(readFileSync(join(dir, 'k8s-workload-spec.json'), 'utf8'));
  const strategy = spec.strategy || spec.updateStrategy;

  if (spec.kind === 'DaemonSet') {
    return { pass: true, code: 'KW006', message: 'DaemonSet — rollout strategy check skipped', skipped: true };
  }

  if (!strategy) {
    return {
      pass: true, code: 'KW006',
      message: 'No explicit rollout strategy — Kubernetes default (RollingUpdate) will be used',
    };
  }

  const violations = [];

  if (strategy.type && !VALID_TYPES.includes(strategy.type)) {
    violations.push({
      field:         'strategy.type',
      value:         strategy.type,
      allowedValues: VALID_TYPES,
      reason:        `"${strategy.type}" is not a valid Kubernetes update strategy`,
    });
  }

  if (strategy.type === 'RollingUpdate' && strategy.rollingUpdate) {
    const { maxSurge, maxUnavailable } = strategy.rollingUpdate;
    if (maxSurge !== undefined) {
      const { valid } = parseIntOrPercent(maxSurge);
      if (!valid) violations.push({ field: 'strategy.rollingUpdate.maxSurge', value: maxSurge, reason: 'must be a non-negative integer or percentage (e.g. 1 or "25%")' });
    }
    if (maxUnavailable !== undefined) {
      const { valid } = parseIntOrPercent(maxUnavailable);
      if (!valid) violations.push({ field: 'strategy.rollingUpdate.maxUnavailable', value: maxUnavailable, reason: 'must be a non-negative integer or percentage (e.g. 0 or "25%")' });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'KW006',
      message: `${violations.length} rollout strategy issue(s)`,
      detail: { violations, hint: 'Valid example: { type: "RollingUpdate", rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } }' },
    };
  }

  return { pass: true, code: 'KW006', message: `Rollout strategy valid: ${strategy.type || 'RollingUpdate'}` };
}
